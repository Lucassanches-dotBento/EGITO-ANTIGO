import * as THREE from 'three';

export interface TextureBundle {
  sandstoneFloor: THREE.CanvasTexture;
  sandstoneFloorNormal: THREE.DataTexture;
  sandstoneFloorRoughness: THREE.DataTexture;
  desertSand: THREE.CanvasTexture;
  desertSandNormal: THREE.DataTexture;
  pillarFrieze: THREE.CanvasTexture;
  pillarNormal: THREE.DataTexture;
  wallRelief: THREE.CanvasTexture;
  wallNormal: THREE.DataTexture;
  linenBandage: THREE.CanvasTexture;
  linenNormal: THREE.DataTexture;
  nemesStripes: THREE.CanvasTexture;
  waterNormal: THREE.DataTexture;
  contactShadow: THREE.CanvasTexture;
  glowDisc: THREE.CanvasTexture;
  dustMote: THREE.CanvasTexture;
  trapPlate: THREE.CanvasTexture;
  getGlyphFaceTexture: (glyph: string, letter: string, highlighted: boolean) => THREE.CanvasTexture;
  getPopupTexture: (text: string, color: string) => THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for procedural texture');
  return [canvas, ctx];
}

function configureRepeatTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Converts a scalar [0..1] height field (width x height) into a tileable tangent-space normal map.
 */
function buildNormalDataTexture(
  heightField: Float32Array,
  size: number,
  strength: number,
  repeatX: number,
  repeatY: number,
  anisotropy: number
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const hL = heightField[y * size + xm];
      const hR = heightField[y * size + xp];
      const hU = heightField[ym * size + x];
      const hD = heightField[yp * size + x];

      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const len = Math.hypot(dx, dy, 1);

      const idx = (y * size + x) * 4;
      data[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// Deterministic pseudo-random hash for tileable stone pitting & weathering
function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number, period: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y0 = ((yi % period) + period) % period;
  const y1 = (y0 + 1) % period;

  const a = hash2(x0, y0);
  const b = hash2(x1, y0);
  const c = hash2(x0, y1);
  const d = hash2(x1, y1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbmTileable(u: number, v: number, baseFreq: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = baseFreq;
  for (let i = 0; i < 4; i++) {
    sum += valueNoise(u * freq, v * freq, freq) * amp;
    freq *= 2;
    amp *= 0.5;
  }
  return sum;
}

function createSandstoneFloorPBR(anisotropy: number) {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const heightField = new Float32Array(size * size);
  const roughData = new Uint8Array(size * size * 4);

  const tiles = 4;
  const tileSize = size / tiles;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const gx = Math.floor(x / tileSize);
      const gy = Math.floor(y / tileSize);
      const lx = (x % tileSize) / tileSize;
      const ly = (y % tileSize) / tileSize;

      // Distance from mortar seam
      const edgeDist = Math.min(lx, 1 - lx, ly, 1 - ly);
      const mortarMask = edgeDist < 0.032 ? 0 : Math.min(1, (edgeDist - 0.032) / 0.045);

      const n = fbmTileable(u, v, 8);
      const fine = fbmTileable(u, v, 32);
      const tileTone = (hash2(gx * 7 + 1, gy * 13 + 3) - 0.5) * 18;

      // Subtle diamond chisel bevel near slab interior
      const centerDist = Math.max(Math.abs(lx - 0.5), Math.abs(ly - 0.5));
      const innerGroove = Math.abs(centerDist - 0.34) < 0.012 ? -0.18 : 0;

      // Surface height for normal generation
      const h = mortarMask * (0.68 + n * 0.22 + fine * 0.1 + innerGroove) + (1 - mortarMask) * 0.12;
      heightField[y * size + x] = h;

      // Albedo: weathered limestone + wind-blown sand in mortar joints
      const sandBlend = (1 - mortarMask) * 0.48;
      const baseR = 178 + tileTone + (n - 0.5) * 28 + (fine - 0.5) * 16;
      const baseG = 136 + tileTone * 0.8 + (n - 0.5) * 22 + (fine - 0.5) * 12;
      const baseB = 82 + tileTone * 0.5 + (n - 0.5) * 16 + (fine - 0.5) * 10;

      const mortarR = 72 + fine * 42;
      const mortarG = 50 + fine * 32;
      const mortarB = 28 + fine * 18;

      const r = Math.max(0, Math.min(255, baseR * (1 - sandBlend) + mortarR * sandBlend + innerGroove * 55));
      const g = Math.max(0, Math.min(255, baseG * (1 - sandBlend) + mortarG * sandBlend + innerGroove * 45));
      const b = Math.max(0, Math.min(255, baseB * (1 - sandBlend) + mortarB * sandBlend + innerGroove * 30));

      const idx = (y * size + x) * 4;
      img.data[idx] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b;
      img.data[idx + 3] = 255;

      // Roughness: stone faces polished slightly by footsteps (~0.66), mortar dusty (~0.96)
      const roughVal = Math.round((0.64 + (1 - mortarMask) * 0.32 + (1 - fine) * 0.08) * 255);
      roughData[idx] = roughVal;
      roughData[idx + 1] = roughVal;
      roughData[idx + 2] = roughVal;
      roughData[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);

  const albedo = configureRepeatTexture(canvas, 8, 5, anisotropy, true);
  const normal = buildNormalDataTexture(heightField, size, 4.2, 8, 5, anisotropy);
  const roughness = new THREE.DataTexture(roughData, size, size, THREE.RGBAFormat);
  roughness.colorSpace = THREE.NoColorSpace;
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;
  roughness.repeat.set(8, 5);
  roughness.anisotropy = anisotropy;
  roughness.generateMipmaps = true;
  roughness.minFilter = THREE.LinearMipmapLinearFilter;
  roughness.needsUpdate = true;

  return { albedo, normal, roughness };
}

function createDesertSandPBR(anisotropy: number) {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const heightField = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n = fbmTileable(u, v, 6);
      // Wind-blown desert ripples
      const ripple = 0.5 + 0.5 * Math.sin((v * 14 + n * 1.4 + Math.sin(u * Math.PI * 4) * 0.25) * Math.PI * 2);
      const grain = hash2(x, y) * 0.14;
      const h = ripple * 0.65 + n * 0.25 + grain;
      heightField[y * size + x] = h;

      const shade = (ripple - 0.5) * 24 + (n - 0.5) * 22 + (grain - 0.07) * 30;
      const idx = (y * size + x) * 4;
      img.data[idx] = Math.max(0, Math.min(255, 166 + shade));
      img.data[idx + 1] = Math.max(0, Math.min(255, 124 + shade * 0.8));
      img.data[idx + 2] = Math.max(0, Math.min(255, 72 + shade * 0.55));
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const albedo = configureRepeatTexture(canvas, 26, 26, anisotropy, true);
  const normal = buildNormalDataTexture(heightField, size, 3.6, 26, 26, anisotropy);
  return { albedo, normal };
}

function createPillarFriezePBR(anisotropy: number) {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);
  const heightField = new Float32Array(size * size);

  ctx.fillStyle = '#C99B5E';
  ctx.fillRect(0, 0, size, size);

  // Fluted limestone shafts + lapis/gold rings
  for (let y = 0; y < size; y++) {
    const v = y / size;
    const isBand1 = y >= 58 && y <= 102;
    const isBand2 = y >= 394 && y <= 438;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const flute = Math.abs(Math.sin(u * Math.PI * 16));
      const grain = fbmTileable(u, v, 16);
      let h = 0.55 + flute * 0.28 + grain * 0.12;
      if (isBand1 || isBand2) h = 0.88 + grain * 0.08;
      heightField[y * size + x] = h;
    }
  }

  for (let x = 0; x < size; x += 32) {
    const grad = ctx.createLinearGradient(x, 0, x + 32, 0);
    grad.addColorStop(0, 'rgba(58, 34, 14, 0.34)');
    grad.addColorStop(0.5, 'rgba(255, 232, 186, 0.18)');
    grad.addColorStop(1, 'rgba(58, 34, 14, 0.34)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, 32, size);
  }

  // Painted Egyptian lapis & gold frieze bands
  ctx.fillStyle = '#17345A';
  ctx.fillRect(0, 64, size, 34);
  ctx.fillRect(0, 400, size, 34);

  ctx.fillStyle = '#D97706';
  ctx.fillRect(0, 58, size, 6);
  ctx.fillRect(0, 98, size, 6);
  ctx.fillRect(0, 394, size, 6);
  ctx.fillRect(0, 434, size, 6);

  // Carved glyph cartouches
  const glyphs = ['𓋴', '𓏏', '𓄿', '𓂋', '𓍯', '𓈖', '𓅓', '𓆑'];
  ctx.fillStyle = 'rgba(72, 42, 16, 0.72)';
  ctx.font = 'bold 34px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) {
    ctx.fillText(glyphs[i % glyphs.length], 32 + i * 64, 245);
  }

  const albedo = configureRepeatTexture(canvas, 1, 1, anisotropy, true);
  const normal = buildNormalDataTexture(heightField, size, 3.8, 1, 1, anisotropy);
  return { albedo, normal };
}

function createWallReliefPBR(anisotropy: number) {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const heightField = new Float32Array(size * size);

  const rows = 4;
  const rowH = size / rows;
  const colW = size / 2;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(y / rowH);
    const ly = (y % rowH) / rowH;
    const xOffset = (row % 2) * (colW / 2);

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const sx = (x + xOffset) % size;
      const col = Math.floor(sx / colW);
      const lx = (sx % colW) / colW;

      const edgeDist = Math.min(lx * 2, (1 - lx) * 2, ly, 1 - ly);
      const mortar = edgeDist < 0.05 ? 0 : Math.min(1, (edgeDist - 0.05) / 0.06);
      const n = fbmTileable(u, v, 10);
      const blockVar = (hash2(col + row * 5, row * 11) - 0.5) * 18;

      heightField[y * size + x] = mortar * (0.72 + n * 0.25) + (1 - mortar) * 0.15;

      const idx = (y * size + x) * 4;
      const m = 0.45 + 0.55 * mortar;
      img.data[idx] = Math.max(0, Math.min(255, (176 + blockVar + (n - 0.5) * 26) * m));
      img.data[idx + 1] = Math.max(0, Math.min(255, (132 + blockVar * 0.8 + (n - 0.5) * 20) * m));
      img.data[idx + 2] = Math.max(0, Math.min(255, (78 + blockVar * 0.5 + (n - 0.5) * 14) * m));
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Decorative lotus frieze band near top
  ctx.fillStyle = 'rgba(130, 58, 12, 0.85)';
  ctx.fillRect(0, 14, size, 18);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
  for (let x = 12; x < size; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 15);
    ctx.lineTo(x + 7, 30);
    ctx.lineTo(x - 7, 30);
    ctx.closePath();
    ctx.fill();
  }

  const albedo = configureRepeatTexture(canvas, 3, 1, anisotropy, true);
  const normal = buildNormalDataTexture(heightField, size, 4.0, 3, 1, anisotropy);
  return { albedo, normal };
}

function createLinenPBR(anisotropy: number) {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const heightField = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const warp = Math.sin(u * Math.PI * 64) * 0.5 + 0.5;
      const weft = Math.sin(v * Math.PI * 64) * 0.5 + 0.5;
      const weave = warp * 0.5 + weft * 0.5;
      const wrapSeam = Math.sin(v * Math.PI * 10 + Math.sin(u * Math.PI * 2) * 0.4) * 0.5 + 0.5;
      const wear = fbmTileable(u, v, 8);
      heightField[y * size + x] = weave * 0.35 + wrapSeam * 0.45 + wear * 0.2;

      const tone = 198 + (weave - 0.5) * 20 + (wrapSeam - 0.5) * 28 + (wear - 0.5) * 32;
      const idx = (y * size + x) * 4;
      img.data[idx] = Math.max(0, Math.min(255, tone));
      img.data[idx + 1] = Math.max(0, Math.min(255, tone * 0.91));
      img.data[idx + 2] = Math.max(0, Math.min(255, tone * 0.74));
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const albedo = configureRepeatTexture(canvas, 2, 2, anisotropy, true);
  const normal = buildNormalDataTexture(heightField, size, 3.0, 2, 2, anisotropy);
  return { albedo, normal };
}

function createNemesStripesTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  for (let y = 0; y < size; y += 24) {
    ctx.fillStyle = (y / 24) % 2 === 0 ? '#1E3A8A' : '#EAB308';
    ctx.fillRect(0, y, size, 24);
  }
  return configureRepeatTexture(canvas, 1, 1, anisotropy, true);
}

function createWaterNormalTexture(anisotropy: number): THREE.DataTexture {
  const size = 256;
  const heightField = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const w1 = Math.sin((u * 4 + v * 2) * Math.PI * 2) * 0.3;
      const w2 = Math.cos((u * 3 - v * 5) * Math.PI * 2) * 0.25;
      const n = fbmTileable(u, v, 8) * 0.45;
      heightField[y * size + x] = 0.5 + w1 + w2 + n;
    }
  }
  return buildNormalDataTexture(heightField, size, 2.2, 4, 8, anisotropy);
}

function createRadialTexture(stops: [number, string][]): THREE.CanvasTexture {
  const size = 128;
  const [canvas, ctx] = makeCanvas(size, size);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  for (const [offset, color] of stops) {
    grad.addColorStop(offset, color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createTrapPlateTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  ctx.fillStyle = '#2A1B10';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, size - 16, size - 16);

  ctx.strokeStyle = '#57371B';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, size - 48, size - 48);

  for (let gx = 0; gx < 3; gx++) {
    for (let gy = 0; gy < 3; gy++) {
      const cx = 64 + gx * 64;
      const cy = 64 + gy * 64;
      ctx.fillStyle = '#0D0704';
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createTextureBundle(anisotropy: number): TextureBundle {
  const floorPBR = createSandstoneFloorPBR(anisotropy);
  const desertPBR = createDesertSandPBR(anisotropy);
  const pillarPBR = createPillarFriezePBR(anisotropy);
  const wallPBR = createWallReliefPBR(anisotropy);
  const linenPBR = createLinenPBR(anisotropy);
  const nemesStripes = createNemesStripesTexture(anisotropy);
  const waterNormal = createWaterNormalTexture(anisotropy);

  const contactShadow = createRadialTexture([
    [0, 'rgba(0, 0, 0, 0.65)'],
    [0.52, 'rgba(0, 0, 0, 0.28)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ]);
  const glowDisc = createRadialTexture([
    [0, 'rgba(255, 255, 255, 0.96)'],
    [0.42, 'rgba(255, 255, 255, 0.48)'],
    [1, 'rgba(255, 255, 255, 0)'],
  ]);
  const dustMote = createRadialTexture([
    [0, 'rgba(255, 244, 214, 0.95)'],
    [0.5, 'rgba(251, 191, 36, 0.35)'],
    [1, 'rgba(251, 191, 36, 0)'],
  ]);
  const trapPlate = createTrapPlateTexture(anisotropy);

  const glyphFaceCache = new Map<string, THREE.CanvasTexture>();
  const popupCache = new Map<string, THREE.CanvasTexture>();

  const getGlyphFaceTexture = (glyph: string, letter: string, highlighted: boolean) => {
    const key = `${glyph}_${letter}_${highlighted ? 1 : 0}`;
    const cached = glyphFaceCache.get(key);
    if (cached) return cached;

    const [canvas, ctx] = makeCanvas(256, 320);
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 320);
    if (highlighted) {
      bgGrad.addColorStop(0, '#6B420F');
      bgGrad.addColorStop(0.5, '#3A2308');
      bgGrad.addColorStop(1, '#1E1104');
    } else {
      bgGrad.addColorStop(0, '#1B2D45');
      bgGrad.addColorStop(0.5, '#0F1B2B');
      bgGrad.addColorStop(1, '#09111C');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 256, 320);

    ctx.strokeStyle = highlighted ? '#FBBF24' : '#38BDF8';
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, 228, 292);

    ctx.strokeStyle = highlighted ? 'rgba(254, 240, 138, 0.55)' : 'rgba(125, 211, 252, 0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, 200, 264);

    ctx.fillStyle = highlighted ? '#FEF08A' : '#BAE6FD';
    ctx.font = 'bold 124px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, 128, 142);

    ctx.fillStyle = highlighted ? '#F59E0B' : '#0284C7';
    ctx.fillRect(86, 232, 84, 46);
    ctx.fillStyle = highlighted ? '#181006' : '#F8FAFC';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(letter, 128, 256);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    tex.needsUpdate = true;
    glyphFaceCache.set(key, tex);
    return tex;
  };

  const getPopupTexture = (text: string, color: string) => {
    const key = `${text}__${color}`;
    const cached = popupCache.get(key);
    if (cached) return cached;

    if (popupCache.size > 40) {
      const oldestKey = popupCache.keys().next().value;
      if (oldestKey) {
        popupCache.get(oldestKey)?.dispose();
        popupCache.delete(oldestKey);
      }
    }

    const [canvas, ctx] = makeCanvas(384, 96);
    ctx.clearRect(0, 0, 384, 96);
    ctx.font = '900 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(12, 8, 4, 0.92)';
    ctx.strokeText(text, 192, 48);
    ctx.fillStyle = color;
    ctx.fillText(text, 192, 48);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    popupCache.set(key, tex);
    return tex;
  };

  return {
    sandstoneFloor: floorPBR.albedo,
    sandstoneFloorNormal: floorPBR.normal,
    sandstoneFloorRoughness: floorPBR.roughness,
    desertSand: desertPBR.albedo,
    desertSandNormal: desertPBR.normal,
    pillarFrieze: pillarPBR.albedo,
    pillarNormal: pillarPBR.normal,
    wallRelief: wallPBR.albedo,
    wallNormal: wallPBR.normal,
    linenBandage: linenPBR.albedo,
    linenNormal: linenPBR.normal,
    nemesStripes,
    waterNormal,
    contactShadow,
    glowDisc,
    dustMote,
    trapPlate,
    getGlyphFaceTexture,
    getPopupTexture,
    dispose: () => {
      floorPBR.albedo.dispose();
      floorPBR.normal.dispose();
      floorPBR.roughness.dispose();
      desertPBR.albedo.dispose();
      desertPBR.normal.dispose();
      pillarPBR.albedo.dispose();
      pillarPBR.normal.dispose();
      wallPBR.albedo.dispose();
      wallPBR.normal.dispose();
      linenPBR.albedo.dispose();
      linenPBR.normal.dispose();
      nemesStripes.dispose();
      waterNormal.dispose();
      contactShadow.dispose();
      glowDisc.dispose();
      dustMote.dispose();
      trapPlate.dispose();
      glyphFaceCache.forEach((t) => t.dispose());
      glyphFaceCache.clear();
      popupCache.forEach((t) => t.dispose());
      popupCache.clear();
    },
  };
}
