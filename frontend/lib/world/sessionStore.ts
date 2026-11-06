export type SessionIdStore = {
  read: () => string | null;
  write: (sessionId: string) => void;
  clear: () => void;
};

export const SESSION_STORAGE_KEY = 'rwacomply.world.session';

type KeyValueStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export function sessionIdStore(storage: KeyValueStore, key = SESSION_STORAGE_KEY): SessionIdStore {
  return {
    read: () => storage.getItem(key),
    write: (sessionId) => storage.setItem(key, sessionId),
    clear: () => storage.removeItem(key),
  };
}

export function browserSessionStore(): SessionIdStore {
  if (typeof sessionStorage === 'undefined') {
    throw new Error('Session storage is unavailable');
  }
  return sessionIdStore(sessionStorage);
}
