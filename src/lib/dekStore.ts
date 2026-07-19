/**
 * 세션용 DEK 보관소.
 *
 * 키 원문(base64)을 sessionStorage에 두는 대신, extractable=false인
 * CryptoKey 객체를 IndexedDB에 structured clone으로 저장한다.
 * XSS가 발생해도 키를 사용할 수는 있어도 원문을 빼낼 수는 없다.
 *
 * IndexedDB는 탭이 닫혀도 남으므로, sessionStorage에 탭 단위 마커를 두고
 * 마커가 없는 상태에서 키를 읽으려 하면(= 탭/브라우저를 닫았다 다시 연 경우)
 * 저장된 키를 지워 기존 sessionStorage와 같은 잠금 의미를 유지한다.
 */

const DB_NAME = 'payday-crypto';
const DB_VERSION = 1;
const STORE_NAME = 'dek';

function markerKey(userId: string): string {
  return `payday_dek_marker_${userId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const request = run(tx.objectStore(STORE_NAME));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function saveSessionDek(userId: string, dek: CryptoKey): Promise<void> {
  await withStore('readwrite', (store) => store.put(dek, userId));
  sessionStorage.setItem(markerKey(userId), '1');
}

export async function loadSessionDek(userId: string): Promise<CryptoKey | null> {
  // 예전 버전이 남긴 평문(base64) DEK 제거
  sessionStorage.removeItem(`payday_dek_${userId}`);

  if (sessionStorage.getItem(markerKey(userId)) !== '1') {
    // 이 탭에서 잠금 해제한 적 없음 → 이전 세션이 남긴 키가 있다면 폐기
    await clearSessionDek(userId).catch(() => {});
    return null;
  }

  const value = await withStore<unknown>('readonly', (store) => store.get(userId));
  return value instanceof CryptoKey ? value : null;
}

export async function clearSessionDek(userId: string): Promise<void> {
  sessionStorage.removeItem(markerKey(userId));
  await withStore('readwrite', (store) => store.delete(userId));
}
