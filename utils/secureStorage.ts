const encoder = new TextEncoder();
const decoder = new TextDecoder();

const PREFIX = 'enc:';

const hexToBytes = (hex: string): Uint8Array => {
  const cleanHex = hex.trim();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
};

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

const fromBase64 = (b64: string): Uint8Array => {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export async function deriveKeyFromHash(hashHex: string): Promise<CryptoKey> {
  const bytes = hexToBytes(hashHex);
  // Ensure we have 32 bytes for AES-256
  const keyBytes = bytes.length >= 32 ? bytes.slice(0, 32) : new Uint8Array(32).map((_, i) => bytes[i % bytes.length]);
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

const encryptValue = async (key: CryptoKey, value: string): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = encoder.encode(value);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return `${PREFIX}${toBase64(iv.buffer)}:${toBase64(encrypted)}`;
};

const decryptValue = async (key: CryptoKey, payload: string): Promise<string | null> => {
  if (!payload.startsWith(PREFIX)) return payload;

  const parts = payload.split(':');
  if (parts.length !== 3) return null;

  const iv = fromBase64(parts[1]);
  const cipher = fromBase64(parts[2]);

  try {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return decoder.decode(decrypted);
  } catch (err) {
    console.error('Failed to decrypt secure item', err);
    return null;
  }
};

export async function getSecureItem(key: string, cryptoKey: CryptoKey): Promise<string | null> {
  const stored = localStorage.getItem(key);
  if (stored === null) return null;

  const value = await decryptValue(cryptoKey, stored);

  // Migrate legacy plain-text values into encrypted format
  if (value !== null && !stored.startsWith(PREFIX)) {
    try {
      const encrypted = await encryptValue(cryptoKey, value);
      localStorage.setItem(key, encrypted);
    } catch (err) {
      console.error('Failed to migrate secure item', err);
    }
  }

  return value;
}

export async function setSecureItem(key: string, value: string | null, cryptoKey: CryptoKey) {
  if (value === null || value === undefined) {
    localStorage.removeItem(key);
    return;
  }

  const encrypted = await encryptValue(cryptoKey, value);
  localStorage.setItem(key, encrypted);
}
