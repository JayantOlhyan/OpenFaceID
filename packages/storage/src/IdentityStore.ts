import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import type { EnrolledIdentity } from '../../vision/src/index.ts';
import { CryptoManager, KeyringManager, MemorySanitizer } from '../../security/src/index.ts';
import { Logger } from '../../core/src/index.ts';

interface SerializedIdentity {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  embeddingsBase64: string[];
  averageEmbeddingBase64: string;
  recognitionStats: {
    matchCount: number;
    lastRecognizedAt?: number;
    lastConfidence?: number;
  };
}

export class IdentityStore {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.join(os.homedir(), '.openfaceid', 'identities');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true, mode: 0o700 });
      }
    } catch {
      // Fallback to os.tmpdir() if homedir is sandboxed or read-only
      this.baseDir = path.join(os.tmpdir(), '.openfaceid', 'identities');
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
    }
  }

  public getSafeFilePath(id: string): string {
    if (typeof id !== 'string' || !id || id.includes('\0')) {
      throw new Error('INVALID_PATH: Null bytes or invalid ID');
    }
    const sanitizedId = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitizedId || sanitizedId !== id) {
      throw new Error(`INVALID_ID: Identity ID "${id}" contains illegal characters`);
    }
    const resolvedPath = path.resolve(this.baseDir, `${sanitizedId}.enc`);
    const normalizedBase = path.resolve(this.baseDir);
    if (!resolvedPath.startsWith(normalizedBase + path.sep)) {
      throw new Error(`PATH_TRAVERSAL: Attempted path escape for ID "${id}"`);
    }

    try {
      if (fs.existsSync(resolvedPath)) {
        const lstat = fs.lstatSync(resolvedPath);
        if (lstat.isSymbolicLink()) {
          const realPath = fs.realpathSync(resolvedPath);
          if (!realPath.startsWith(normalizedBase + path.sep)) {
            throw new Error('SYMLINK_ATTACK: Symlink points outside base directory');
          }
        }
      }
    } catch (e: any) {
      if (e.message?.includes('SYMLINK_ATTACK')) throw e;
    }

    return resolvedPath;
  }

  public async saveIdentity(identity: EnrolledIdentity): Promise<boolean> {
    try {
      const masterSecret = await KeyringManager.getOrCreateMasterSecret();

      const serialized: SerializedIdentity = {
        id: identity.id,
        name: identity.name,
        enabled: identity.enabled,
        createdAt: identity.createdAt,
        updatedAt: identity.updatedAt,
        embeddingsBase64: identity.embeddings.map((emb) =>
          Buffer.from(emb.buffer, emb.byteOffset, emb.byteLength).toString('base64')
        ),
        averageEmbeddingBase64: Buffer.from(
          identity.averageEmbedding.buffer,
          identity.averageEmbedding.byteOffset,
          identity.averageEmbedding.byteLength
        ).toString('base64'),
        recognitionStats: identity.recognitionStats,
      };

      const jsonStr = JSON.stringify(serialized);
      const encrypted = CryptoManager.encrypt(jsonStr, masterSecret);

      const filePath = this.getSafeFilePath(identity.id);
      fs.writeFileSync(filePath, JSON.stringify(encrypted, null, 2), { mode: 0o600 });

      Logger.info('storage', `Encrypted biometric identity saved: ${identity.name} (${identity.id})`);
      return true;
    } catch (err) {
      Logger.error('storage', `Failed to save identity ${identity.id}`, { error: String(err) });
      return false;
    }
  }

  public async getIdentity(id: string): Promise<EnrolledIdentity | null> {
    try {
      const filePath = this.getSafeFilePath(id);
      if (!fs.existsSync(filePath)) return null;

      const masterSecret = await KeyringManager.getOrCreateMasterSecret();
      const content = fs.readFileSync(filePath, 'utf8');
      const encrypted = JSON.parse(content);

      const decryptedBuffer = CryptoManager.decrypt(encrypted, masterSecret);
      const serialized: SerializedIdentity = JSON.parse(decryptedBuffer.toString('utf8'));

      // Convert Base64 back to Float32Array
      const embeddings = serialized.embeddingsBase64.map((b64) => {
        const buf = Buffer.from(b64, 'base64');
        return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / Float32Array.BYTES_PER_ELEMENT);
      });

      const avgBuf = Buffer.from(serialized.averageEmbeddingBase64, 'base64');
      const averageEmbedding = new Float32Array(
        avgBuf.buffer,
        avgBuf.byteOffset,
        avgBuf.byteLength / Float32Array.BYTES_PER_ELEMENT
      );

      return {
        id: serialized.id,
        name: serialized.name,
        enabled: serialized.enabled,
        createdAt: serialized.createdAt,
        updatedAt: serialized.updatedAt,
        embeddings,
        averageEmbedding,
        recognitionStats: serialized.recognitionStats,
      };
    } catch (err) {
      Logger.error('storage', `Failed to load identity ${id}`, { error: String(err) });
      return null;
    }
  }

  public async listIdentities(): Promise<EnrolledIdentity[]> {
    this.ensureDirectoryExists();
    const files = fs.readdirSync(this.baseDir).filter((f) => f.endsWith('.enc'));
    const identities: EnrolledIdentity[] = [];

    for (const file of files) {
      const id = path.basename(file, '.enc');
      const identity = await this.getIdentity(id);
      if (identity) {
        identities.push(identity);
      }
    }

    return identities;
  }

  public async deleteIdentity(id: string): Promise<boolean> {
    try {
      const filePath = this.getSafeFilePath(id);
      if (!fs.existsSync(filePath)) return false;

      // Secure File Shredding: multi-pass overwrite before unlinking
      const fileSize = fs.statSync(filePath).size;
      const zeroBuffer = crypto.randomBytes(fileSize);
      fs.writeFileSync(filePath, zeroBuffer);
      MemorySanitizer.zeroizeBuffer(zeroBuffer);
      fs.writeFileSync(filePath, Buffer.alloc(fileSize, 0));

      fs.unlinkSync(filePath);
      Logger.info('storage', `Biometric identity shredded and removed: ${id}`);
      return true;
    } catch (err) {
      Logger.error('storage', `Error deleting identity ${id}`, { error: String(err) });
      return false;
    }
  }
}
