import crypto from 'node:crypto';

/**
 * Detects the runtime environment
 */
export const isBun = typeof (globalThis as any).Bun !== 'undefined';
export const isNode = !isBun && typeof process !== 'undefined';

/**
 * Gets the current platform section name
 */
export const getPlatform = (): 'linux' | 'windows' => {
  return process.platform === 'win32' ? 'windows' : 'linux';
};

/**
 * Gets the environment mode from NODE_ENV
 */
export const getMode = (): 'development' | 'production' => {
  const env = process.env.NODE_ENV?.toLowerCase();
  return env === 'production' ? 'production' : 'development';
};

/**
 * Decrypts .enc files based on the rs_encrypt / ConfigCloud format
 * Line 0: IV (Base64)
 * Line 1: Ciphertext (Base64)
 * Password: TSRLIB_AES_PASSWORD (Hex)
 */
export function decryptConfig(encryptedData: string): any {
  const password = process.env.TSRLIB_AES_PASSWORD;
  if (!password) {
    throw new Error('Decryption failed: TSRLIB_AES_PASSWORD environment variable is not set.');
  }

  // The format is two lines: IV then Ciphertext
  const lines = encryptedData.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error('Invalid .enc file format. Expected IV on line 1 and Ciphertext on line 2.');
  }

  const iv = Buffer.from(lines[0], 'base64');
  const ciphertext = Buffer.from(lines[1], 'base64');
  const key = Buffer.from(password, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return JSON.parse(decrypted.toString('utf8'));
}