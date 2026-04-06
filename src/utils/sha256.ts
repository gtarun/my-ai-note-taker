const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
  0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
  0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
  0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
  0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
  0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
];

export class Sha256 {
  private state = new Uint32Array([
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19,
  ]);
  private buffer = new Uint8Array(64);
  private bufferLength = 0;
  private bytesHashed = 0;
  private finished = false;

  update(chunk: Uint8Array) {
    if (this.finished) {
      throw new Error('SHA-256 digest already finalized.');
    }

    let offset = 0;
    this.bytesHashed += chunk.length;

    while (offset < chunk.length) {
      const take = Math.min(64 - this.bufferLength, chunk.length - offset);
      this.buffer.set(chunk.subarray(offset, offset + take), this.bufferLength);
      this.bufferLength += take;
      offset += take;

      if (this.bufferLength === 64) {
        this.compress(this.buffer);
        this.bufferLength = 0;
      }
    }
  }

  digestHex() {
    if (!this.finished) {
      this.finish();
    }

    return Array.from(this.state)
      .map((word) => word.toString(16).padStart(8, '0'))
      .join('');
  }

  private finish() {
    this.finished = true;
    const bitLength = this.bytesHashed * 8;

    this.buffer[this.bufferLength++] = 0x80;

    if (this.bufferLength > 56) {
      this.buffer.fill(0, this.bufferLength, 64);
      this.compress(this.buffer);
      this.bufferLength = 0;
    }

    this.buffer.fill(0, this.bufferLength, 56);
    const high = Math.floor(bitLength / 0x100000000);
    const low = bitLength >>> 0;

    writeUint32(this.buffer, 56, high);
    writeUint32(this.buffer, 60, low);
    this.compress(this.buffer);
  }

  private compress(block: Uint8Array) {
    const w = new Uint32Array(64);

    for (let i = 0; i < 16; i += 1) {
      const offset = i * 4;
      w[i] =
        ((block[offset] ?? 0) << 24) |
        ((block[offset + 1] ?? 0) << 16) |
        ((block[offset + 2] ?? 0) << 8) |
        (block[offset + 3] ?? 0);
    }

    for (let i = 16; i < 64; i += 1) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = add32(w[i - 16], s0, w[i - 7], s1);
    }

    let [a, b, c, d, e, f, g, h] = Array.from(this.state);

    for (let i = 0; i < 64; i += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = add32(h, s1, ch, K[i], w[i]);
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = add32(s0, maj);

      h = g;
      g = f;
      f = e;
      e = add32(d, temp1);
      d = c;
      c = b;
      b = a;
      a = add32(temp1, temp2);
    }

    this.state[0] = add32(this.state[0], a);
    this.state[1] = add32(this.state[1], b);
    this.state[2] = add32(this.state[2], c);
    this.state[3] = add32(this.state[3], d);
    this.state[4] = add32(this.state[4], e);
    this.state[5] = add32(this.state[5], f);
    this.state[6] = add32(this.state[6], g);
    this.state[7] = add32(this.state[7], h);
  }
}

function rightRotate(value: number, count: number) {
  return (value >>> count) | (value << (32 - count));
}

function add32(...values: number[]) {
  let result = 0;

  for (const value of values) {
    result = (result + value) >>> 0;
  }

  return result;
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}
