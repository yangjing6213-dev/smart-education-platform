export type PickupQrMatrix = boolean[][];

const SIZE = 29;
const DATA_CODEWORDS = 55;
const ECC_CODEWORDS = 15;
const CREDENTIAL = /^[A-Za-z0-9_-]{43}$/u;

function multiplyGf(left: number, right: number): number {
  let result = 0;
  let a = left;
  let b = right;
  while (b > 0) {
    if ((b & 1) !== 0) result ^= a;
    a <<= 1;
    if ((a & 0x100) !== 0) a ^= 0x11d;
    b >>>= 1;
  }
  return result;
}

function generatorPolynomial(degree: number): number[] {
  let polynomial = [1];
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    const next = Array.from({ length: polynomial.length + 1 }, () => 0);
    for (let j = 0; j < polynomial.length; j += 1) {
      next[j] = next[j]! ^ polynomial[j]!;
      next[j + 1] = next[j + 1]! ^ multiplyGf(polynomial[j]!, root);
    }
    polynomial = next;
    root = multiplyGf(root, 2);
  }
  return polynomial;
}

function errorCorrection(data: readonly number[], degree: number): number[] {
  const generator = generatorPolynomial(degree);
  const result = Array.from({ length: degree }, () => 0);
  for (const value of data) {
    const factor = value ^ result[0]!;
    for (let i = 0; i < degree - 1; i += 1) {
      result[i] = result[i + 1]! ^ multiplyGf(generator[i + 1]!, factor);
    }
    result[degree - 1] = multiplyGf(generator[degree]!, factor);
  }
  return result;
}

function makeDataCodewords(credential: string): number[] {
  const bits: number[] = [];
  const appendBits = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  const bytes = Array.from(credential, (character) => character.charCodeAt(0));
  appendBits(0b0100, 4);
  appendBits(bytes.length, 8);
  for (const byte of bytes) appendBits(byte, 8);
  for (let i = 0; i < Math.min(4, DATA_CODEWORDS * 8 - bits.length); i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const data = [] as number[];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }
  for (let pad = 0; data.length < DATA_CODEWORDS; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11);
  return data;
}

function setFinder(matrix: (boolean | null)[][], centerRow: number, centerColumn: number): void {
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const row = centerRow + dy;
      const column = centerColumn + dx;
      if (row < 0 || row >= SIZE || column < 0 || column >= SIZE) continue;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      matrix[row]![column] = distance !== 4 && distance !== 2;
    }
  }
}

function formatInformation(): number {
  const data = (0b01 << 3) | 0;
  let remainder = data << 10;
  for (let bit = 14; bit >= 10; bit -= 1) {
    if (((remainder >>> bit) & 1) !== 0) remainder ^= 0x537 << (bit - 10);
  }
  return ((data << 10) | remainder) ^ 0x5412;
}

export function encodePickupCredentialQr(credential: string): PickupQrMatrix {
  if (!CREDENTIAL.test(credential)) throw new Error("接送凭证格式不正确，无法生成二维码。");

  const data = makeDataCodewords(credential);
  const codewords = [...data, ...errorCorrection(data, ECC_CODEWORDS)];
  const matrix = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null as boolean | null),
  );

  setFinder(matrix, 3, 3);
  setFinder(matrix, 3, SIZE - 4);
  setFinder(matrix, SIZE - 4, 3);

  for (let i = 8; i <= SIZE - 9; i += 1) {
    const dark = i % 2 === 0;
    matrix[6]![i] = dark;
    matrix[i]![6] = dark;
  }

  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      matrix[22 + dy]![22 + dx] = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
    }
  }

  const format = formatInformation();
  for (let i = 0; i <= 5; i += 1) matrix[i]![8] = ((format >>> i) & 1) !== 0;
  matrix[7]![8] = ((format >>> 6) & 1) !== 0;
  matrix[8]![8] = ((format >>> 7) & 1) !== 0;
  matrix[8]![7] = ((format >>> 8) & 1) !== 0;
  for (let i = 9; i < 15; i += 1) matrix[8]![14 - i] = ((format >>> i) & 1) !== 0;
  for (let i = 0; i < 8; i += 1) matrix[8]![SIZE - 1 - i] = ((format >>> i) & 1) !== 0;
  for (let i = 8; i < 15; i += 1) matrix[SIZE - 15 + i]![8] = ((format >>> i) & 1) !== 0;
  matrix[SIZE - 8]![8] = true;

  let bitIndex = 0;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const row = upward ? SIZE - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const column = right - offset;
        if (matrix[row]![column] !== null) continue;
        const byte = codewords[bitIndex >>> 3] ?? 0;
        const bit = ((byte >>> (7 - (bitIndex & 7))) & 1) !== 0;
        matrix[row]![column] = (row + column) % 2 === 0 ? !bit : bit;
        bitIndex += 1;
      }
    }
  }

  return matrix.map((row) => row.map((module) => module ?? false));
}

export function withPickupQrQuietZone(matrix: PickupQrMatrix): PickupQrMatrix {
  if (matrix.length !== SIZE || matrix.some((row) => row.length !== SIZE)) {
    throw new Error("二维码矩阵格式不正确。");
  }
  const quietRow = Array.from({ length: SIZE + 8 }, () => false);
  return [
    ...Array.from({ length: 4 }, () => [...quietRow]),
    ...matrix.map((row) => [false, false, false, false, ...row, false, false, false, false]),
    ...Array.from({ length: 4 }, () => [...quietRow]),
  ];
}
