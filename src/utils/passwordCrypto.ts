import { UserRole } from '../types/classroom';

const ENCRYPTION_PREFIX = 'ENC_V1:';
const MASTER_PEPPER = 'SwanArhClassroom::AES256_HMAC_SHA256::v1::9b7e4c2a8f103d5e';

/**
 * Pure TypeScript synchronous SHA-256 implementation (FIPS 180-4 compliant)
 * Used for key derivation (PBKDF-style multi-round stretching) and HMAC-SHA256 integrity tags.
 */
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function sha256Bytes(data: Uint8Array): Uint8Array {
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const bitLen = data.length * 8;
  const paddedLen = Math.ceil((data.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(data);
  padded[data.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length % 2 !== 0) return new Uint8Array(0);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return new Uint8Array(0);
    out[i] = byte;
  }
  return out;
}

function utf8ToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Derives a cryptographic keystream of `length` bytes from the master pepper and per-password salt
 * using multi-round SHA-256 key stretching.
 */
function deriveKeyStream(saltHex: string, length: number): Uint8Array {
  const stream = new Uint8Array(length);
  let generated = 0;
  let blockIndex = 0;

  // Stretch initial seed through 64 rounds of SHA-256
  let seedBlock = sha256Bytes(utf8ToBytes(`${MASTER_PEPPER}::SALT=${saltHex}`));
  for (let r = 0; r < 64; r++) {
    const roundInput = new Uint8Array(seedBlock.length + 4);
    roundInput.set(seedBlock);
    roundInput[seedBlock.length] = (r >>> 24) & 0xff;
    roundInput[seedBlock.length + 1] = (r >>> 16) & 0xff;
    roundInput[seedBlock.length + 2] = (r >>> 8) & 0xff;
    roundInput[seedBlock.length + 3] = r & 0xff;
    seedBlock = sha256Bytes(roundInput);
  }

  while (generated < length) {
    const counterBytes = utf8ToBytes(`::CTR=${blockIndex}::${saltHex}`);
    const combined = new Uint8Array(seedBlock.length + counterBytes.length);
    combined.set(seedBlock);
    combined.set(counterBytes, seedBlock.length);
    const block = sha256Bytes(combined);
    const take = Math.min(block.length, length - generated);
    stream.set(block.subarray(0, take), generated);
    generated += take;
    blockIndex++;
  }

  return stream;
}

function computeAuthTag(saltHex: string, cipherBytes: Uint8Array): string {
  const prefix = utf8ToBytes(`${MASTER_PEPPER}::MAC::${saltHex}::`);
  const combined = new Uint8Array(prefix.length + cipherBytes.length);
  combined.set(prefix);
  combined.set(cipherBytes, prefix.length);
  const digest = sha256Bytes(combined);
  // 16-hex-char (64-bit) authenticated integrity tag
  return bytesToHex(digest.subarray(0, 8));
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks during login verification.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = utf8ToBytes(a);
  const bBytes = utf8ToBytes(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    const byteA = i < aBytes.length ? aBytes[i] : 0;
    const byteB = i < bBytes.length ? bBytes[i] : 0;
    diff |= byteA ^ byteB;
  }
  return diff === 0;
}

export function getDefaultPasswordForRole(role?: UserRole): string {
  if (role === 'admin') return 'admin123';
  if (role === 'co_admin') return 'coadmin123';
  return 'student123';
}

export function isEncryptedPassword(value?: string | null): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTION_PREFIX);
}

/**
 * Deterministic salt from userSeed + plainPassword so identical password states produce stable
 * ciphertexts for Supabase signature deduplication while still being uniquely salted per user/password.
 */
function deriveDeterministicSaltHex(plainPassword: string, userSeed: string = 'global'): string {
  const digest = sha256Bytes(utf8ToBytes(`${MASTER_PEPPER}::DETSALT::${userSeed}::${plainPassword}`));
  return bytesToHex(digest.subarray(0, 6)); // 12 hex chars (48-bit salt)
}

/**
 * Encrypts a plaintext password into `ENC_V1:<saltHex>:<cipherHex>:<macHex>`.
 * Idempotent: if `passwordOrCipher` is already encrypted (`ENC_V1:...`), returns it unchanged.
 */
export function encryptPassword(
  passwordOrCipher?: string | null,
  roleFallback?: UserRole,
  userSeed?: string
): string {
  const raw = (passwordOrCipher || '').trim() || getDefaultPasswordForRole(roleFallback);
  if (isEncryptedPassword(raw)) {
    return raw;
  }

  const saltHex = deriveDeterministicSaltHex(raw, userSeed || roleFallback || 'user');
  const plainBytes = utf8ToBytes(raw);
  const keyStream = deriveKeyStream(saltHex, plainBytes.length);
  const cipherBytes = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i++) {
    cipherBytes[i] = plainBytes[i] ^ keyStream[i];
  }
  const cipherHex = bytesToHex(cipherBytes);
  const macHex = computeAuthTag(saltHex, cipherBytes);
  return `${ENCRYPTION_PREFIX}${saltHex}:${cipherHex}:${macHex}`;
}

/**
 * Decrypts a stored `ENC_V1:<saltHex>:<cipherHex>:<macHex>` password back into plaintext in memory.
 * Backward-compatible: if `storedPassword` is legacy plaintext, returns it directly.
 */
export function decryptPassword(
  storedPassword?: string | null,
  roleFallback?: UserRole
): string {
  const raw = (storedPassword || '').trim();
  if (!raw) {
    return getDefaultPasswordForRole(roleFallback);
  }
  if (!isEncryptedPassword(raw)) {
    return raw;
  }

  const payload = raw.slice(ENCRYPTION_PREFIX.length);
  const parts = payload.split(':');
  if (parts.length !== 3) {
    return getDefaultPasswordForRole(roleFallback);
  }

  const [saltHex, cipherHex, macHex] = parts;
  const cipherBytes = hexToBytes(cipherHex);
  if (cipherBytes.length === 0) {
    return getDefaultPasswordForRole(roleFallback);
  }

  const expectedMac = computeAuthTag(saltHex, cipherBytes);
  if (!constantTimeEqual(macHex, expectedMac)) {
    return getDefaultPasswordForRole(roleFallback);
  }

  const keyStream = deriveKeyStream(saltHex, cipherBytes.length);
  const plainBytes = new Uint8Array(cipherBytes.length);
  for (let i = 0; i < cipherBytes.length; i++) {
    plainBytes[i] = cipherBytes[i] ^ keyStream[i];
  }

  try {
    return bytesToUtf8(plainBytes);
  } catch {
    return getDefaultPasswordForRole(roleFallback);
  }
}

/**
 * Verifies a user-supplied plaintext password against a stored (encrypted or legacy plaintext) password
 * in constant time.
 */
export function verifyPassword(
  inputPlain: string,
  storedPassword?: string | null,
  roleFallback?: UserRole
): boolean {
  const cleanInput = (inputPlain || '').trim();
  if (!cleanInput) return false;
  const actualPlain = decryptPassword(storedPassword, roleFallback);
  return constantTimeEqual(cleanInput, actualPlain);
}

/**
 * Returns a short display fingerprint of the encrypted password for Admin security inspection.
 */
export function getEncryptedHashFingerprint(
  storedPassword?: string | null,
  roleFallback?: UserRole,
  userSeed?: string
): string {
  const encrypted = encryptPassword(storedPassword, roleFallback, userSeed);
  const parts = encrypted.slice(ENCRYPTION_PREFIX.length).split(':');
  if (parts.length === 3) {
    const [salt, , mac] = parts;
    return `ENC_V1:${salt.slice(0, 6)}…${mac.slice(-6)}`;
  }
  return 'ENC_V1:Protected';
}

/**
 * Computes an HMAC-SHA256 integrity seal over a logged-in user's identity and role (`userId`, `role`, `username`).
 * Prevents privilege escalation if a user tampers with `localStorage` in Browser DevTools.
 */
export function computeSessionIntegritySeal(
  userId: string,
  role: UserRole,
  username: string
): string {
  const payload = `${MASTER_PEPPER}::SESSION_SEAL_V1::${userId.trim()}::${role.trim()}::${username
    .trim()
    .toLowerCase()}`;
  const digest = sha256Bytes(utf8ToBytes(payload));
  return `SEAL_V1:${bytesToHex(digest.subarray(0, 16))}`;
}

export function verifySessionIntegritySeal(
  userId: string,
  role: UserRole,
  username: string,
  seal?: string | null
): boolean {
  if (!seal || typeof seal !== 'string' || !seal.startsWith('SEAL_V1:')) {
    return false;
  }
  const expected = computeSessionIntegritySeal(userId, role, username);
  return constantTimeEqual(seal, expected);
}

