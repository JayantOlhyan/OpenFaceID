import crypto from 'crypto';

export interface EncryptedPayload {
  version: number;
  iv: string; // 12-byte initialization vector in hex
  salt: string; // 32-byte PBKDF2 salt in hex
  authTag: string; // 16-byte GCM authentication tag in hex
  ciphertext: string; // Encrypted data in hex
}

export class CryptoManager {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12; // 96 bits for GCM
  private static readonly SALT_LENGTH = 32; // 256 bits
  private static readonly TAG_LENGTH = 16; // 128 bits
  private static readonly PBKDF2_ITERATIONS = 100_000;
  private static readonly KEY_LENGTH = 32; // 256 bits for AES-256

  public static deriveKey(passphrase: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
      passphrase,
      salt,
      this.PBKDF2_ITERATIONS,
      this.KEY_LENGTH,
      'sha256'
    );
  }

  public static encrypt(data: string | Buffer, masterSecret: string): EncryptedPayload {
    const salt = crypto.randomBytes(this.SALT_LENGTH);
    const key = this.deriveKey(masterSecret, salt);
    const iv = crypto.randomBytes(this.IV_LENGTH);

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
    const plaintextBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');

    const encrypted = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Zeroize derived key buffer
    key.fill(0);

    return {
      version: 1,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      authTag: authTag.toString('hex'),
      ciphertext: encrypted.toString('hex'),
    };
  }

  public static decrypt(payload: EncryptedPayload, masterSecret: string): Buffer {
    const salt = Buffer.from(payload.salt, 'hex');
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');
    const ciphertext = Buffer.from(payload.ciphertext, 'hex');

    const key = this.deriveKey(masterSecret, salt);
    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    // Zeroize derived key buffer
    key.fill(0);

    return decrypted;
  }
}
