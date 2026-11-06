import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const SESSION_ID_HASH_DOMAIN = 'rwacomply.session-id.v1';
export const CONTINUATION_GRANT_HASH_DOMAIN = 'rwacomply.continuation-grant.v1';

export function domainHash(domain: string, value: string): string {
  return createHash('sha256').update(domain).update('\0').update(value).digest('hex');
}

export type EncryptedSession = {
  ciphertext: string;
  iv: string;
  tag: string;
};

export function encryptSessionId(sessionId: string, key: Buffer): EncryptedSession {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(sessionId, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptSessionId(encrypted: EncryptedSession, key: Buffer): string {
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch {
    throw new Error('Session decryption failed');
  }
}
