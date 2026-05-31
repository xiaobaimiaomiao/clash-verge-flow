import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, "../public/icons");

function crc32(buf) {
  let crc = 0xffffffff;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePng(size, r, g, b, text = "CF") {
  const width = size;
  const height = size;
  const channels = 4;
  const raw = Buffer.alloc(height * (1 + width * channels));

  for (let y = 0; y < height; y++) {
    const offset = y * (1 + width * channels);
    raw[offset] = 0;
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * channels;
      const cx = x / width - 0.5;
      const cy = y / height - 0.5;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const cornerR = 0.22;
      const inside =
        dist < 0.5 - cornerR +
        (Math.abs(cx) < 0.5 - cornerR && Math.abs(cy) < 0.5 - cornerR
          ? cornerR
          : 0);
      if (inside) {
        const t = (x + y) / (width + height);
        raw[px] = Math.round(r + (197 - r) * t);
        raw[px + 1] = Math.round(g + (163 - g) * t);
        raw[px + 2] = Math.round(b + (255 - b) * t);
        raw[px + 3] = 255;
      } else {
        raw[px] = 0;
        raw[px + 1] = 0;
        raw[px + 2] = 0;
        raw[px + 3] = 0;
      }
    }
  }

  const compressed = deflateSync(raw);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, "ascii");
    const payload = Buffer.concat([typeB, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(payload));
    return Buffer.concat([len, payload, crc]);
  }

  const png = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])];

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  png.push(chunk("IHDR", ihdr));
  png.push(chunk("IDAT", compressed));
  png.push(chunk("IEND", Buffer.alloc(0)));

  return Buffer.concat(png);
}

const icons = [
  { name: "icon-16.png", size: 16, r: 255, g: 183, b: 197 },
  { name: "icon-48.png", size: 48, r: 255, g: 183, b: 197 },
  { name: "icon-128.png", size: 128, r: 255, g: 183, b: 197 },
  { name: "icon-offline-48.png", size: 48, r: 75, g: 85, b: 99 },
];

for (const icon of icons) {
  const buf = makePng(icon.size, icon.r, icon.g, icon.b);
  const filePath = resolve(iconsDir, icon.name);
  writeFileSync(filePath, buf);
  console.log(`Generated: ${filePath} (${buf.length} bytes)`);
}
