import * as THREE from 'three';

export interface TextureBundle {
  sandstoneFloor: THREE.CanvasTexture;
  desertSand: THREE.CanvasTexture;
  pillarFrieze: THREE.CanvasTexture;
  wallRelief: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  glowDisc: THREE.CanvasTexture;
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
  anisotropy: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createSandstoneFloorTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);

  ctx.fillStyle = '#B88D56';
  ctx.fillRect(0, 0, size, size);

  // Stone grain noise
  for (let i = 0; i < 3800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 2.5;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,232,190,0.09)' : 'rgba(62,38,16,0.12)';
    ctx.fillRect(x, y, r, r);
  }

  // Carved ashlar tile grid (4x4 slabs)
  const step = size / 4;
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const px = gx * step;
      const py = gy * step;
      const shade = ((gx + gy * 2) % 3) * 7 - 7;
      ctx.fillStyle = `rgb(${176 + shade}, ${134 + shade}, ${82 + Math.floor(shade * 0.6)})`;
      ctx.fillRect(px + 3, py + 3, step - 6, step - 6);

      // Inner bevel highlight
      ctx.strokeStyle = 'rgba(253, 224, 160, 0.22)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 5, py + 5, step - 10, step - 10);

      // Subtle central scarab/solar diamond motif on alternating tiles
      if ((gx + gy) % 2 === 0) {
        ctx.strokeStyle = 'rgba(110, 74, 34, 0.28)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px + step / 2, py + 24);
        ctx.lineTo(px + step - 24, py + step / 2);
        ctx.lineTo(px + step / 2, py + step - 24);
        ctx.lineTo(px + 24, py + step / 2);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  // Dark mortar seams
  ctx.strokeStyle = 'rgba(38, 22, 10, 0.72)';
  ctx.lineWidth = 4;
  for (let i = 0; i <= 4; i++) {
    const pos = i * step;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(size, pos);
    ctx.stroke();
  }

  return configureRepeatTexture(canvas, 8, 5, anisotropy);
}

function createDesertSandTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);

  ctx.fillStyle = '#8F683A';
  ctx.fillRect(0, 0, size, size);

  // Wind-swept sand ripples
  for (let y = 0; y < size; y += 8) {
    const wave = Math.sin((y / size) * Math.PI * 10) * 14;
    ctx.strokeStyle = y % 16 === 0 ? 'rgba(246, 206, 145, 0.14)' : 'rgba(54, 35, 16, 0.15)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.33, y + wave, size * 0.66, y - wave, size, y);
    ctx.stroke();
  }

  for (let i = 0; i < 4200; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,228,175,0.08)' : 'rgba(35,21,8,0.1)';
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }

  return configureRepeatTexture(canvas, 24, 24, anisotropy);
}

function createPillarFriezeTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#C99B5E';
  ctx.fillRect(0, 0, 512, 512);

  // Vertical fluting & stone grain
  for (let x = 0; x < 512; x += 32) {
    const grad = ctx.createLinearGradient(x, 0, x + 32, 0);
    grad.addColorStop(0, 'rgba(65, 38, 15, 0.24)');
    grad.addColorStop(0.5, 'rgba(255, 226, 174, 0.14)');
    grad.addColorStop(1, 'rgba(65, 38, 15, 0.24)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, 32, 512);
  }

  // Painted Egyptian gold/lapis bands
  ctx.fillStyle = '#1E3A5F';
  ctx.fillRect(0, 64, 512, 34);
  ctx.fillRect(0, 400, 512, 34);

  ctx.fillStyle = '#D97706';
  ctx.fillRect(0, 58, 512, 6);
  ctx.fillRect(0, 98, 512, 6);
  ctx.fillRect(0, 394, 512, 6);
  ctx.fillRect(0, 434, 512, 6);

  // Carved glyphs along mid-band
  const glyphs = ['𓋴', '𓏏', '𓄿', '𓂋', '𓍯', '𓈖', '𓅓', '𓆑'];
  ctx.fillStyle = 'rgba(251, 191, 36, 0.55)';
  ctx.font = 'bold 30px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) {
    ctx.fillText(glyphs[i % glyphs.length], 32 + i * 64, 245);
  }

  return configureRepeatTexture(canvas, 1, 1, anisotropy);
}

function createWallReliefTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 256);
  ctx.fillStyle = '#A67A45';
  ctx.fillRect(0, 0, 512, 256);

  // Horizontal stone courses
  for (let row = 0; row < 4; row++) {
    const y = row * 64;
    const offset = (row % 2) * 64;
    for (let x = -64; x < 512; x += 128) {
      ctx.fillStyle = (row + Math.floor(x / 128)) % 2 === 0 ? '#AE814B' : '#9E733F';
      ctx.fillRect(x + offset + 2, y + 2, 124, 60);
      ctx.strokeStyle = 'rgba(42, 25, 11, 0.6)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + offset, y, 128, 64);
    }
  }

  // Gold lotus frieze strip near top
  ctx.fillStyle = '#92400E';
  ctx.fillRect(0, 20, 512, 22);
  ctx.fillStyle = '#F59E0B';
  for (let x = 16; x < 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 22);
    ctx.lineTo(x + 9, 40);
    ctx.lineTo(x - 9, 40);
    ctx.closePath();
    ctx.fill();
  }

  return configureRepeatTexture(canvas, 4, 1, anisotropy);
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

  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, size - 16, size - 16);

  ctx.strokeStyle = '#57371B';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, size - 48, size - 48);

  // 3x3 spike sockets
  for (let gx = 0; gx < 3; gx++) {
    for (let gy = 0; gy < 3; gy++) {
      const cx = 64 + gx * 64;
      const cy = 64 + gy * 64;
      ctx.fillStyle = '#0F0905';
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#B45309';
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
  const sandstoneFloor = createSandstoneFloorTexture(anisotropy);
  const desertSand = createDesertSandTexture(anisotropy);
  const pillarFrieze = createPillarFriezeTexture(anisotropy);
  const wallRelief = createWallReliefTexture(anisotropy);
  const contactShadow = createRadialTexture([
    [0, 'rgba(0, 0, 0, 0.58)'],
    [0.55, 'rgba(0, 0, 0, 0.25)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ]);
  const glowDisc = createRadialTexture([
    [0, 'rgba(255, 255, 255, 0.95)'],
    [0.4, 'rgba(255, 255, 255, 0.45)'],
    [1, 'rgba(255, 255, 255, 0)'],
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
      bgGrad.addColorStop(0, '#5B390C');
      bgGrad.addColorStop(0.5, '#331F07');
      bgGrad.addColorStop(1, '#1E1104');
    } else {
      bgGrad.addColorStop(0, '#1B2D45');
      bgGrad.addColorStop(0.5, '#0F1B2B');
      bgGrad.addColorStop(1, '#09111C');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 256, 320);

    // Cartouche border
    ctx.strokeStyle = highlighted ? '#FBBF24' : '#38BDF8';
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, 228, 292);

    ctx.strokeStyle = highlighted ? 'rgba(254, 240, 138, 0.5)' : 'rgba(125, 211, 252, 0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, 200, 264);

    // Hieroglyph
    ctx.fillStyle = highlighted ? '#FDE68A' : '#BAE6FD';
    ctx.font = 'bold 124px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, 128, 142);

    // Latin badge
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
    ctx.strokeStyle = 'rgba(12, 8, 4, 0.9)';
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
    sandstoneFloor,
    desertSand,
    pillarFrieze,
    wallRelief,
    contactShadow,
    glowDisc,
    trapPlate,
    getGlyphFaceTexture,
    getPopupTexture,
    dispose: () => {
      sandstoneFloor.dispose();
      desertSand.dispose();
      pillarFrieze.dispose();
      wallRelief.dispose();
      contactShadow.dispose();
      glowDisc.dispose();
      trapPlate.dispose();
      glyphFaceCache.forEach((t) => t.dispose());
      glyphFaceCache.clear();
      popupCache.forEach((t) => t.dispose());
      popupCache.clear();
    },
  };
}
