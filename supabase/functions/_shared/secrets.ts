const encoder = new TextEncoder();
const decoder = new TextDecoder();

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;

export function readEncryptionKey() {
  const key = Deno.env.get('USER_DATA_ENCRYPTION_KEY') ?? '';

  if (!key.trim()) {
    throw new Error('Missing USER_DATA_ENCRYPTION_KEY.');
  }

  return key.trim();
}

export async function encryptSecret(value: string, secret: string) {
  if (!value) {
    return '';
  }

  const cryptoKey = await importEncryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    cryptoKey,
    encoder.encode(value)
  );

  return `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(payload: string | null | undefined, secret: string) {
  if (!payload) {
    return '';
  }

  const [ivPart, cipherPart] = payload.split('.');
  if (!ivPart || !cipherPart) {
    throw new Error('Encrypted secret payload is invalid.');
  }

  const cryptoKey = await importEncryptionKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: fromBase64(ivPart) },
    cryptoKey,
    fromBase64(cipherPart)
  );

  return decoder.decode(decrypted);
}

async function importEncryptionKey(secret: string) {
  const material = await crypto.subtle.digest('SHA-256', encoder.encode(secret));

  return crypto.subtle.importKey('raw', material, { name: ALGORITHM }, false, ['encrypt', 'decrypt']);
}

function toBase64(value: Uint8Array) {
  return btoa(String.fromCharCode(...value));
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
