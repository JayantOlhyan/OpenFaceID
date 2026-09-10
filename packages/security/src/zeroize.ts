export class MemorySanitizer {
  public static zeroizeBuffer(buf: Buffer | Uint8Array | Float32Array | Uint8ClampedArray): void {
    if (buf instanceof Buffer || buf instanceof Uint8Array || buf instanceof Uint8ClampedArray) {
      buf.fill(0);
    } else if (buf instanceof Float32Array) {
      buf.fill(0.0);
    }
  }

  public static shredMemory(buf: Buffer): void {
    // Multi-pass overwrite (0x55, 0xAA, 0x00) for security-sensitive memory
    buf.fill(0x55);
    buf.fill(0xaa);
    buf.fill(0x00);
  }
}
