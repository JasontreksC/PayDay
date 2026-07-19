import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createVault,
  decryptMemo,
  encryptMemo,
  rewrapVault,
  rewrapVaultWithRecoveryKey,
  toSessionDek,
  unlockVault,
} from '../lib/crypto';
import { clearSessionDek, loadSessionDek, saveSessionDek } from '../lib/dekStore';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

type CryptoStatus = 'idle' | 'loading' | 'ready' | 'locked';

interface CryptoContextValue {
  status: CryptoStatus;
  unlockError: string | null;
  pendingRecoveryKey: string | null;
  beginClientUnlock: () => void;
  cancelClientUnlock: () => void;
  acknowledgeRecoveryKey: () => void;
  unlockWithPassword: (password: string) => Promise<string | null>;
  resetVaultWithPassword: (password: string) => Promise<string | null>;
  /** 복구 키로 기존 DEK를 연 뒤 새 비밀번호로 다시 감쌈 (이후 로그인은 비밀번호만) */
  restoreVaultFromRecoveryKey: (
    recoveryKey: string,
    newPassword: string,
  ) => Promise<string | null>;
  /** 현재 비밀번호로 vault를 열 수 있는지만 확인 (쓰기 없음) */
  verifyVaultPassword: (password: string) => Promise<string | null>;
  /** 현재 비밀번호로 DEK를 연 뒤 새 비밀번호로 다시 감쌈 */
  rewrapVaultWithPassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<string | null>;
  reissueRecoveryKey: (password: string) => Promise<string | null>;
  clearCrypto: () => void;
  encryptMemoText: (plaintext: string, aad?: string) => Promise<string>;
  decryptMemoText: (
    ciphertext: string | null | undefined,
    aad?: string,
  ) => Promise<string | undefined>;
}

const CryptoContext = createContext<CryptoContextValue | null>(null);

const REWRAP_ATTEMPTS = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function CryptoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  /** 항상 extractable=false 키만 보관. 키 원문은 어디에도 남지 않는다. */
  const dekRef = useRef<CryptoKey | null>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const unlockInFlightRef = useRef(false);
  const [status, setStatus] = useState<CryptoStatus>('idle');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [pendingRecoveryKey, setPendingRecoveryKey] = useState<string | null>(null);

  const beginClientUnlock = useCallback(() => {
    unlockInFlightRef.current = true;
    setUnlockError(null);
    setStatus('loading');
  }, []);

  const cancelClientUnlock = useCallback(() => {
    unlockInFlightRef.current = false;
    setStatus(user ? 'locked' : 'idle');
  }, [user]);

  const acknowledgeRecoveryKey = useCallback(() => {
    setPendingRecoveryKey(null);
  }, []);

  const resolveUserId = useCallback(async () => {
    if (user?.id) return user.id;
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  }, [user]);

  const resolveUserEmail = useCallback(async () => {
    if (user?.email) return user.email;
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? null;
  }, [user]);

  /**
   * 입력한 비밀번호가 실제 로그인 비밀번호인지 서버에 확인한다.
   * vault가 아직 없을 때 임의의 문자열로 vault가 생성되면, 다른 기기에서
   * 실제 로그인 비밀번호로는 영영 열 수 없게 되므로 생성 전에 검증한다.
   * (실패해도 기존 세션은 유지된다.)
   */
  const verifyLoginPassword = useCallback(
    async (password: string): Promise<boolean> => {
      const email = await resolveUserEmail();
      if (!email) return false;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return !error;
    },
    [resolveUserEmail],
  );

  const clearCrypto = useCallback(() => {
    dekRef.current = null;
    setUnlockError(null);
    setPendingRecoveryKey(null);
    if (lastUserIdRef.current) {
      clearSessionDek(lastUserIdRef.current).catch(() => {});
      lastUserIdRef.current = null;
    }
    setStatus(user ? 'locked' : 'idle');
  }, [user]);

  /** 잠금 해제 직후의 extractable DEK를 non-extractable 사본으로 바꿔 보관 */
  const persistDek = useCallback(async (dek: CryptoKey, userId: string) => {
    const sessionDek = await toSessionDek(dek);
    dekRef.current = sessionDek;
    lastUserIdRef.current = userId;
    try {
      await saveSessionDek(userId, sessionDek);
    } catch {
      // 저장 실패 시에도 이 탭에서는 메모리 키로 계속 사용 가능
    }
    setUnlockError(null);
    setStatus('ready');
  }, []);

  const fetchVaultColumns = useCallback(async (userId: string) => {
    return supabase
      .from('profiles')
      .select('crypto_salt, wrapped_dek, crypto_salt_recovery, wrapped_dek_recovery')
      .eq('id', userId)
      .single();
  }, []);

  const unlockWithPassword = useCallback(
    async (password: string) => {
      unlockInFlightRef.current = true;
      setStatus('loading');
      setUnlockError(null);

      const fail = (message: string) => {
        unlockInFlightRef.current = false;
        setStatus('locked');
        setUnlockError(message);
        return message;
      };

      const userId = await resolveUserId();
      if (!userId) {
        unlockInFlightRef.current = false;
        setStatus('idle');
        return '로그인이 필요합니다.';
      }

      try {
        const { data, error } = await fetchVaultColumns(userId);
        if (error) return fail(error.message);

        let dek: CryptoKey;

        if (!data.crypto_salt || !data.wrapped_dek) {
          // vault를 만들기 전에, 입력한 값이 실제 로그인 비밀번호인지 확인.
          // 그래야 다른 기기에서 로그인 비밀번호로 이 vault를 열 수 있다.
          if (!(await verifyLoginPassword(password))) {
            return fail('비밀번호가 올바르지 않습니다.');
          }

          // 최초 설정. 다른 기기/탭과 동시에 실행돼도 vault가 하나만 생기도록
          // 조건부 갱신(wrapped_dek가 아직 null일 때만)으로 선점한다.
          const vault = await createVault(password);
          const { data: claimed, error: updateError } = await supabase
            .from('profiles')
            .update({
              crypto_salt: vault.salt,
              wrapped_dek: vault.wrappedDek,
              crypto_salt_recovery: vault.recoverySalt,
              wrapped_dek_recovery: vault.wrappedDekRecovery,
            })
            .eq('id', userId)
            .is('wrapped_dek', null)
            .select('id');

          if (updateError) return fail(updateError.message);

          if (claimed && claimed.length > 0) {
            dek = vault.dek;
            setPendingRecoveryKey(vault.recoveryKey);
          } else {
            // 다른 기기가 먼저 vault를 만들었음 → 그 vault를 연다
            const { data: fresh, error: refetchError } = await fetchVaultColumns(userId);
            if (refetchError || !fresh?.crypto_salt || !fresh?.wrapped_dek) {
              return fail(refetchError?.message ?? '암호 키를 불러오지 못했습니다.');
            }
            dek = await unlockVault(password, fresh.crypto_salt, fresh.wrapped_dek);
          }
        } else {
          dek = await unlockVault(password, data.crypto_salt, data.wrapped_dek);

          // 예전 계정: 복구 wrap이 없으면 지금 만들어 두고 키를 보여줌
          if (!data.crypto_salt_recovery || !data.wrapped_dek_recovery) {
            const recovery = await rewrapVaultWithRecoveryKey(dek);
            const { data: claimed, error: recoveryError } = await supabase
              .from('profiles')
              .update({
                crypto_salt_recovery: recovery.recoverySalt,
                wrapped_dek_recovery: recovery.wrappedDekRecovery,
              })
              .eq('id', userId)
              .is('wrapped_dek_recovery', null)
              .select('id');

            if (!recoveryError && claimed && claimed.length > 0) {
              setPendingRecoveryKey(recovery.recoveryKey);
            }
          }
        }

        await persistDek(dek, userId);
        unlockInFlightRef.current = false;
        return null;
      } catch {
        return fail('비밀번호가 올바르지 않거나 암호 키를 열 수 없습니다.');
      }
    },
    [fetchVaultColumns, persistDek, resolveUserId, verifyLoginPassword],
  );

  const resetVaultWithPassword = useCallback(
    async (password: string) => {
      const userId = await resolveUserId();
      if (!userId) return '로그인이 필요합니다.';

      setStatus('loading');
      setUnlockError(null);

      try {
        const vault = await createVault(password);
        const { error } = await supabase
          .from('profiles')
          .update({
            crypto_salt: vault.salt,
            wrapped_dek: vault.wrappedDek,
            crypto_salt_recovery: vault.recoverySalt,
            wrapped_dek_recovery: vault.wrappedDekRecovery,
          })
          .eq('id', userId);

        if (error) {
          setStatus('locked');
          setUnlockError(error.message);
          return error.message;
        }

        setPendingRecoveryKey(vault.recoveryKey);
        await persistDek(vault.dek, userId);
        return null;
      } catch {
        const message = '암호 키를 다시 만들 수 없습니다.';
        setStatus('locked');
        setUnlockError(message);
        return message;
      }
    },
    [persistDek, resolveUserId],
  );

  const restoreVaultFromRecoveryKey = useCallback(
    async (recoveryKey: string, newPassword: string) => {
      const userId = await resolveUserId();
      if (!userId) return '로그인이 필요합니다.';

      const normalized = recoveryKey.replace(/\s+/g, '').toUpperCase();
      if (!normalized) return '복구 키를 입력해 주세요.';

      setStatus('loading');
      setUnlockError(null);

      try {
        const { data, error } = await fetchVaultColumns(userId);
        if (error) {
          setStatus('locked');
          return error.message;
        }

        if (!data.crypto_salt_recovery || !data.wrapped_dek_recovery) {
          setStatus('locked');
          return '저장된 복구 키가 없습니다. 새 암호 키를 만들어야 합니다.';
        }

        const dek = await unlockVault(
          normalized,
          data.crypto_salt_recovery,
          data.wrapped_dek_recovery,
        );
        const passwordWrap = await rewrapVault(dek, newPassword);

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            crypto_salt: passwordWrap.salt,
            wrapped_dek: passwordWrap.wrappedDek,
          })
          .eq('id', userId);

        if (updateError) {
          setStatus('locked');
          return updateError.message;
        }

        await persistDek(dek, userId);
        return null;
      } catch {
        setStatus('locked');
        return '복구 키가 올바르지 않거나 메모를 복구하지 못했습니다.';
      }
    },
    [fetchVaultColumns, persistDek, resolveUserId],
  );

  /** 비밀번호로 vault를 열어 extractable DEK를 얻는다 (재래핑 등 쓰기 작업용) */
  const openVaultWithPassword = useCallback(
    async (password: string): Promise<{ dek: CryptoKey; userId: string } | string> => {
      const userId = await resolveUserId();
      if (!userId) return '로그인이 필요합니다.';

      const { data, error } = await fetchVaultColumns(userId);
      if (error) return error.message;
      if (!data.crypto_salt || !data.wrapped_dek) return '저장된 암호 키가 없습니다.';

      try {
        const dek = await unlockVault(password, data.crypto_salt, data.wrapped_dek);
        return { dek, userId };
      } catch {
        return '현재 비밀번호가 올바르지 않습니다.';
      }
    },
    [fetchVaultColumns, resolveUserId],
  );

  const verifyVaultPassword = useCallback(
    async (password: string) => {
      const result = await openVaultWithPassword(password);
      return typeof result === 'string' ? result : null;
    },
    [openVaultWithPassword],
  );

  const rewrapVaultWithPassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const opened = await openVaultWithPassword(currentPassword);
      if (typeof opened === 'string') return opened;

      try {
        const vault = await rewrapVault(opened.dek, newPassword);

        // 인증 비밀번호는 이미 바뀐 뒤라, 이 쓰기가 실패한 채 남으면
        // 새 비밀번호로 잠금 해제가 안 된다. 짧게 재시도해 갭을 줄인다.
        let lastMessage: string | null = null;
        for (let attempt = 0; attempt < REWRAP_ATTEMPTS; attempt++) {
          const { error } = await supabase
            .from('profiles')
            .update({
              crypto_salt: vault.salt,
              wrapped_dek: vault.wrappedDek,
            })
            .eq('id', opened.userId);

          if (!error) {
            await persistDek(opened.dek, opened.userId);
            return null;
          }

          lastMessage = error.message;
          await delay(500 * (attempt + 1));
        }

        return lastMessage ?? '암호 키를 새 비밀번호로 다시 감싸지 못했습니다.';
      } catch {
        return '암호 키를 새 비밀번호로 다시 감싸지 못했습니다.';
      }
    },
    [openVaultWithPassword, persistDek],
  );

  const reissueRecoveryKey = useCallback(
    async (password: string) => {
      const opened = await openVaultWithPassword(password);
      if (typeof opened === 'string') return opened;

      try {
        const recovery = await rewrapVaultWithRecoveryKey(opened.dek);
        const { error } = await supabase
          .from('profiles')
          .update({
            crypto_salt_recovery: recovery.recoverySalt,
            wrapped_dek_recovery: recovery.wrappedDekRecovery,
          })
          .eq('id', opened.userId);

        if (error) return error.message;

        setPendingRecoveryKey(recovery.recoveryKey);
        return null;
      } catch {
        return '복구 키를 다시 발급하지 못했습니다.';
      }
    },
    [openVaultWithPassword],
  );

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!user) {
        if (lastUserIdRef.current) {
          clearSessionDek(lastUserIdRef.current).catch(() => {});
          lastUserIdRef.current = null;
        }
        dekRef.current = null;
        setPendingRecoveryKey(null);
        setStatus('idle');
        setUnlockError(null);
        return;
      }

      lastUserIdRef.current = user.id;

      if (dekRef.current) {
        setStatus('ready');
        return;
      }

      if (unlockInFlightRef.current) {
        setStatus('loading');
        return;
      }

      setStatus('loading');

      try {
        const dek = await loadSessionDek(user.id);
        if (cancelled) return;
        if (!dek) {
          setStatus('locked');
          return;
        }
        dekRef.current = dek;
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('locked');
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const encryptMemoText = useCallback(async (plaintext: string, aad?: string) => {
    if (!dekRef.current) {
      throw new Error('암호 키가 잠겨 있습니다.');
    }
    return encryptMemo(plaintext, dekRef.current, aad);
  }, []);

  const decryptMemoText = useCallback(
    async (ciphertext: string | null | undefined, aad?: string) => {
      if (!ciphertext) return undefined;
      if (!dekRef.current) {
        throw new Error('암호 키가 잠겨 있습니다.');
      }
      return decryptMemo(ciphertext, dekRef.current, aad);
    },
    [],
  );

  const value = useMemo(
    () => ({
      status,
      unlockError,
      pendingRecoveryKey,
      beginClientUnlock,
      cancelClientUnlock,
      acknowledgeRecoveryKey,
      unlockWithPassword,
      resetVaultWithPassword,
      restoreVaultFromRecoveryKey,
      verifyVaultPassword,
      rewrapVaultWithPassword,
      reissueRecoveryKey,
      clearCrypto,
      encryptMemoText,
      decryptMemoText,
    }),
    [
      status,
      unlockError,
      pendingRecoveryKey,
      beginClientUnlock,
      cancelClientUnlock,
      acknowledgeRecoveryKey,
      unlockWithPassword,
      resetVaultWithPassword,
      restoreVaultFromRecoveryKey,
      verifyVaultPassword,
      rewrapVaultWithPassword,
      reissueRecoveryKey,
      clearCrypto,
      encryptMemoText,
      decryptMemoText,
    ],
  );

  return <CryptoContext.Provider value={value}>{children}</CryptoContext.Provider>;
}

export function useCrypto() {
  const context = useContext(CryptoContext);
  if (!context) {
    throw new Error('useCrypto must be used within CryptoProvider');
  }
  return context;
}
