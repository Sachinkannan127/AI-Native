const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

function createPngWithLetterA(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const t = Buffer.from(type);
    const crcData = Buffer.concat([t, data]);
    const crc = Buffer.alloc(4);
    let c = ~0;
    for (let i = 0; i < crcData.length; i++) {
      c ^= crcData[i];
      for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (-(c & 1) & 0xedb88320);
    }
    crc.writeInt32BE(~c);
    return Buffer.concat([len, t, data, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);

  // Background: #27443b (39, 68, 59)
  const bgR = 39, bgG = 68, bgB = 59;
  // Foreground Letter A: #f7f6f1 (247, 246, 241)
  const fgR = 247, fgG = 246, fgB = 241;

  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // Filter byte 0 (None)

    for (let x = 0; x < size; x++) {
      const idx = y * (stride + 1) + 1 + x * 4;

      // Normalized coordinates [0, 1]
      const nx = x / size;
      const ny = y / size;

      // Draw rounded rect maskable background
      let isBg = true;
      // Slight border radius
      const radius = 0.18;
      const dx = Math.max(0, Math.abs(nx - 0.5) - (0.5 - radius));
      const dy = Math.max(0, Math.abs(ny - 0.5) - (0.5 - radius));
      if (Math.sqrt(dx * dx + dy * dy) > radius) {
        // Outside rounded corners: transparent
        raw[idx] = 0;
        raw[idx + 1] = 0;
        raw[idx + 2] = 0;
        raw[idx + 3] = 0;
        continue;
      }

      // Check if inside Letter 'A'
      // Geometric definition of serif capital A
      let isA = false;
      const topY = 0.22, botY = 0.78;
      const midY = 0.58;
      const strokeW = 0.085;

      if (ny >= topY && ny <= botY) {
        const progress = (ny - topY) / (botY - topY);
        // Left leg center
        const leftCenterX = 0.50 - 0.22 * progress;
        // Right leg center
        const rightCenterX = 0.50 + 0.22 * progress;

        // Left stroke
        if (Math.abs(nx - leftCenterX) <= strokeW * (1.1 - 0.2 * progress)) {
          isA = true;
        }
        // Right stroke (slightly thicker serif)
        if (Math.abs(nx - rightCenterX) <= strokeW * (1.2 - 0.2 * progress)) {
          isA = true;
        }
        // Crossbar
        if (Math.abs(ny - midY) <= 0.035 && nx >= leftCenterX && nx <= rightCenterX) {
          isA = true;
        }
        // Top peak bridge
        if (ny <= topY + 0.06 && Math.abs(nx - 0.5) <= strokeW * 0.9) {
          isA = true;
        }
        // Base serifs
        if (ny >= botY - 0.035) {
          if (Math.abs(nx - leftCenterX) <= strokeW * 1.6) isA = true;
          if (Math.abs(nx - rightCenterX) <= strokeW * 1.6) isA = true;
        }
      }

      if (isA) {
        raw[idx] = fgR;
        raw[idx + 1] = fgG;
        raw[idx + 2] = fgB;
        raw[idx + 3] = 255;
      } else {
        raw[idx] = bgR;
        raw[idx + 1] = bgG;
        raw[idx + 2] = bgB;
        raw[idx + 3] = 255;
      }
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  const iend = Buffer.alloc(0);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", iend)]);
}

const iconsDir = path.join(__dirname, "public", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

// 1. Generate PNGs
fs.writeFileSync(path.join(iconsDir, "icon-192.png"), createPngWithLetterA(192));
fs.writeFileSync(path.join(iconsDir, "icon-512.png"), createPngWithLetterA(512));
fs.writeFileSync(path.join(iconsDir, "apple-touch-icon.png"), createPngWithLetterA(180));

// 2. Generate SVG icon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#27443b"/>
  <text x="50%" y="68%" text-anchor="middle" font-family="Georgia, 'Playfair Display', serif" font-size="340" font-style="italic" font-weight="700" fill="#f7f6f1">A</text>
</svg>`;

fs.writeFileSync(path.join(iconsDir, "icon.svg"), svgIcon);
fs.writeFileSync(path.join(__dirname, "public", "favicon.svg"), svgIcon);

console.log("Successfully generated all PWA icons in public/icons/");
