import fs from 'fs';
import zlib from 'zlib';

// Minimal pure Node PNG generator
function createPng(width, height, r, g, b, a = 255) {
  const bytesPerPixel = 4;
  const rowSize = width * bytesPerPixel;
  const rawData = Buffer.alloc((rowSize + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowSize + 1);
    rawData[rowOffset] = 0; // Filter type: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * bytesPerPixel;
      // Draw background teal
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;

      // Draw subtle white center square/logo marker
      const cx = width / 2;
      const cy = height / 2;
      const halfSize = width * 0.28;
      if (Math.abs(x - cx) < halfSize && Math.abs(y - cy) < halfSize) {
        // white cart area
        if (
          Math.abs(x - cx) < halfSize * 0.9 &&
          (y - cy < -halfSize * 0.2 || Math.abs(x - cx) < halfSize * 0.3 || y - cy > halfSize * 0.5)
        ) {
          rawData[pixelOffset] = 255;
          rawData[pixelOffset + 1] = 255;
          rawData[pixelOffset + 2] = 255;
        }
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression method
  ihdr[11] = 0; // Filter method
  ihdr[12] = 0; // Interlace method

  function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // CRC32 table
  function crc32(buf) {
    let c = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
      c = crcTable[(c ^ buf[n]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  const idatChunk = createChunk('IDAT', deflated);
  const ihdrChunk = createChunk('IHDR', ihdr);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate CRC Table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

// Brand teal: #0d3944 -> r: 13, g: 57, b: 68
fs.writeFileSync('public/pwa-192x192.png', createPng(192, 192, 13, 57, 68));
fs.writeFileSync('public/pwa-512x512.png', createPng(512, 512, 13, 57, 68));
fs.writeFileSync('public/pwa-maskable-512x512.png', createPng(512, 512, 13, 57, 68));
fs.writeFileSync('public/apple-touch-icon.png', createPng(180, 180, 13, 57, 68));
console.log('Successfully generated PWA and Apple Touch PNG icons!');
