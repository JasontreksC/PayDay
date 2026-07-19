const PBKDF2_ITERATIONS = 600_000;
/** 예전 wrap(버전 태그 없는 base64)이 사용한 반복 횟수 */
const PBKDF2_ITERATIONS_LEGACY = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const DEK_BITS = 256;
const MEMO_PREFIX = 'v1:';
/** v2: 거래 id를 AAD로 묶고 평문을 패딩한 메모 암호문 */
const MEMO_PREFIX_V2 = 'v2:';
/** wrapped_dek 포맷: p2:<PBKDF2 반복 횟수>:<base64(iv||cipher)> */
const WRAP_PREFIX = 'p2:';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importPasswordKey(password: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
}

export async function deriveKek(
  secret: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const baseKey = await importPasswordKey(secret);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: DEK_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: DEK_BITS }, true, [
    'encrypt',
    'decrypt',
  ]);
}

/** 사람이 읽고 저장하기 쉬운 복구 키 (예: A1B2-C3D4-...) */
export function generateRecoveryKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return hex.match(/.{1,4}/g)!.join('-');
}

export async function wrapDek(dek: CryptoKey, kek: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const rawDek = new Uint8Array(await crypto.subtle.exportKey('raw', dek));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, rawDek),
  );
  const payload = new Uint8Array(iv.length + cipher.length);
  payload.set(iv, 0);
  payload.set(cipher, iv.length);
  return bytesToBase64(payload);
}

export async function unwrapDek(wrappedDek: string, kek: CryptoKey): Promise<CryptoKey> {
  const payload = base64ToBytes(wrappedDek);
  if (payload.length <= IV_BYTES) {
    throw new Error('저장된 암호 키가 올바르지 않습니다.');
  }

  const iv = payload.slice(0, IV_BYTES);
  const cipher = payload.slice(IV_BYTES);
  const rawDek = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    kek,
    cipher as BufferSource,
  );

  return crypto.subtle.importKey('raw', rawDek, { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function wrapDekWithSecret(
  dek: CryptoKey,
  secret: string,
): Promise<{ salt: string; wrappedDek: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const kek = await deriveKek(secret, salt, PBKDF2_ITERATIONS);
  const wrappedDek = await wrapDek(dek, kek);
  return {
    salt: bytesToBase64(salt),
    wrappedDek: `${WRAP_PREFIX}${PBKDF2_ITERATIONS}:${wrappedDek}`,
  };
}

/** wrapped_dek 문자열에서 PBKDF2 반복 횟수와 암호문 base64를 분리 */
function parseWrappedDek(wrappedDek: string): { iterations: number; payload: string } {
  if (wrappedDek.startsWith(WRAP_PREFIX)) {
    const rest = wrappedDek.slice(WRAP_PREFIX.length);
    const sep = rest.indexOf(':');
    const iterations = Number(rest.slice(0, sep));
    if (sep <= 0 || !Number.isInteger(iterations) || iterations <= 0) {
      throw new Error('저장된 암호 키 형식이 올바르지 않습니다.');
    }
    return { iterations, payload: rest.slice(sep + 1) };
  }
  // 버전 태그가 없는 초기 포맷
  return { iterations: PBKDF2_ITERATIONS_LEGACY, payload: wrappedDek };
}

export async function createVault(password: string): Promise<{
  salt: string;
  wrappedDek: string;
  recoverySalt: string;
  wrappedDekRecovery: string;
  recoveryKey: string;
  dek: CryptoKey;
}> {
  const dek = await generateDek();
  const passwordWrap = await wrapDekWithSecret(dek, password);

  const recoveryKey = generateRecoveryKey();
  const recoveryWrap = await wrapDekWithSecret(dek, recoveryKey);

  return {
    salt: passwordWrap.salt,
    wrappedDek: passwordWrap.wrappedDek,
    recoverySalt: recoveryWrap.salt,
    wrappedDekRecovery: recoveryWrap.wrappedDek,
    recoveryKey,
    dek,
  };
}

/** 기존 DEK를 새 비밀번호로 다시 감쌈 (비밀번호 변경 시 메모 유지) */
export async function rewrapVault(
  dek: CryptoKey,
  password: string,
): Promise<{ salt: string; wrappedDek: string }> {
  return wrapDekWithSecret(dek, password);
}

/** 기존 DEK를 새 복구 키로 다시 감쌈 */
export async function rewrapVaultWithRecoveryKey(dek: CryptoKey): Promise<{
  recoverySalt: string;
  wrappedDekRecovery: string;
  recoveryKey: string;
}> {
  const recoveryKey = generateRecoveryKey();
  const recoveryWrap = await wrapDekWithSecret(dek, recoveryKey);
  return {
    recoverySalt: recoveryWrap.salt,
    wrappedDekRecovery: recoveryWrap.wrappedDek,
    recoveryKey,
  };
}

export async function unlockVault(
  secret: string,
  saltBase64: string,
  wrappedDek: string,
): Promise<CryptoKey> {
  const salt = base64ToBytes(saltBase64);
  const { iterations, payload } = parseWrappedDek(wrappedDek);
  const kek = await deriveKek(secret, salt, iterations);
  return unwrapDek(payload, kek);
}

/**
 * 세션(IndexedDB) 보관용 사본. extractable=false라서 XSS가 키 원문을
 * 밖으로 빼낼 수 없고, 메모 암복호화에만 쓸 수 있다.
 */
export async function toSessionDek(dek: CryptoKey): Promise<CryptoKey> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', dek));
  const sessionDek = await crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
  raw.fill(0);
  return sessionDek;
}

/** 메모 길이가 암호문 길이로 새어 나가지 않도록 이 크기 배수로 패딩 */
const MEMO_PAD_BLOCK = 64;

/** 암호화된 메모 접두사와 페이로드를 분리. 우리 포맷이 아니면 null */
function splitMemo(
  value: string,
): { version: 1 | 2; payload: Uint8Array } | null {
  const prefix = value.startsWith(MEMO_PREFIX_V2)
    ? MEMO_PREFIX_V2
    : value.startsWith(MEMO_PREFIX)
      ? MEMO_PREFIX
      : null;
  if (!prefix) return null;

  let payload: Uint8Array;
  try {
    payload = base64ToBytes(value.slice(prefix.length));
  } catch {
    // 접두사만 우연히 같은 평문 (예: 사용자가 "v1:"로 시작하는 메모 입력)
    return null;
  }
  // 최소한 IV + GCM 태그(16바이트)는 있어야 우리가 만든 암호문
  if (payload.length <= IV_BYTES + 16) return null;

  return { version: prefix === MEMO_PREFIX_V2 ? 2 : 1, payload };
}

export function isEncryptedMemo(value: string | null | undefined): boolean {
  return typeof value === 'string' && splitMemo(value) !== null;
}

/** 평문을 [2바이트 길이 헤더 | 원문 | 0 패딩] 형태로 블록 크기에 맞춰 패딩 */
function padPlaintext(plaintext: string): Uint8Array {
  const raw = new TextEncoder().encode(plaintext);
  if (raw.length > 0xffff) {
    throw new Error('메모가 너무 깁니다.');
  }
  const needed = raw.length + 2;
  const total = Math.max(MEMO_PAD_BLOCK, Math.ceil(needed / MEMO_PAD_BLOCK) * MEMO_PAD_BLOCK);
  const out = new Uint8Array(total);
  out[0] = (raw.length >> 8) & 0xff;
  out[1] = raw.length & 0xff;
  out.set(raw, 2);
  return out;
}

function unpadPlaintext(bytes: Uint8Array): string {
  if (bytes.length < 2) {
    throw new Error('메모 복호화에 실패했습니다.');
  }
  const len = (bytes[0] << 8) | bytes[1];
  if (len > bytes.length - 2) {
    throw new Error('메모 복호화에 실패했습니다.');
  }
  return new TextDecoder().decode(bytes.slice(2, 2 + len));
}

/**
 * 메모를 AES-GCM으로 암호화한다. 최신 포맷(v2)은
 *  - 거래 id를 AAD로 묶어 다른 행의 암호문으로 바꿔치기하는 것을 막고
 *  - 평문을 블록 단위로 패딩해 메모 길이가 새지 않도록 한다.
 * `aad`(보통 거래 id)를 주면 v2, 없으면 이전 포맷(v1)으로 만든다.
 */
export async function encryptMemo(
  plaintext: string,
  dek: CryptoKey,
  aad?: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

  if (aad === undefined) {
    const encoded = new TextEncoder().encode(plaintext);
    const cipher = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, encoded),
    );
    const payload = new Uint8Array(iv.length + cipher.length);
    payload.set(iv, 0);
    payload.set(cipher, iv.length);
    return `${MEMO_PREFIX}${bytesToBase64(payload)}`;
  }

  const padded = padPlaintext(plaintext);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) },
      dek,
      padded as BufferSource,
    ),
  );
  const payload = new Uint8Array(iv.length + cipher.length);
  payload.set(iv, 0);
  payload.set(cipher, iv.length);
  return `${MEMO_PREFIX_V2}${bytesToBase64(payload)}`;
}

export async function decryptMemo(
  ciphertext: string | null | undefined,
  dek: CryptoKey,
  aad?: string,
): Promise<string | undefined> {
  if (!ciphertext) return undefined;

  const parsed = splitMemo(ciphertext);
  if (!parsed) return ciphertext;

  const iv = parsed.payload.slice(0, IV_BYTES);
  const cipher = parsed.payload.slice(IV_BYTES);

  const params: AesGcmParams = { name: 'AES-GCM', iv: iv as BufferSource };
  if (parsed.version === 2 && aad !== undefined) {
    params.additionalData = new TextEncoder().encode(aad);
  }

  const plain = new Uint8Array(await crypto.subtle.decrypt(params, dek, cipher as BufferSource));
  return parsed.version === 2 ? unpadPlaintext(plain) : new TextDecoder().decode(plain);
}

export function downloadRecoveryKeyImage(recoveryKey: string, email?: string | null): void {
  const width = 720;
  const height = 420;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#0f1419';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#1a2332';
  ctx.fillRect(32, 32, width - 64, height - 64);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 36px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('PayDay', 56, 100);

  ctx.fillStyle = '#8b9bb4';
  ctx.font = '500 16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Recovery Key', 56, 132);

  if (email) {
    ctx.fillStyle = '#6b7c93';
    ctx.font = '400 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(email, 56, 158);
  }

  ctx.fillStyle = '#f4f7fb';
  ctx.font = '600 22px ui-monospace, SFMono-Regular, Menlo, monospace';
  const lines = recoveryKey.match(/.{1,19}/g) ?? [recoveryKey];
  lines.forEach((line, i) => {
    ctx.fillText(line, 56, 220 + i * 34);
  });

  ctx.fillStyle = '#6b7c93';
  ctx.font = '400 13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('이 이미지를 안전한 곳에 보관하세요.', 56, 320);
  ctx.fillText('비밀번호를 잊었을 때 이 키로 메모를 복구할 수 있습니다.', 56, 344);
  ctx.fillText('타인과 공유하지 마세요.', 56, 368);

  const link = document.createElement('a');
  link.download = 'payday-recovery-key.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
