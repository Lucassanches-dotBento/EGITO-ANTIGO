import { soundEngine } from './audio';
import { CHAMBERS, ChamberDef, GodId, letterToHieroglyph, RelicOption } from './data';

export type GameMode =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'CHAMBER_CLEAR'
  | 'VICTORY'
  | 'GAME_OVER';

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  score: number;
  chamberIndex: number;
  godId: GodId;
  word: string;
  collectedMask: boolean[];
  nextGlyphIndex: number;
  portalOpen: boolean;
  divineEnergy: number; // 0..100
  dashReadyRatio: number; // 0..1
  bossHp: number;
  bossMaxHp: number;
  combos: number;
  activePowerTimer: number;
}

interface Vec2 {
  x: number;
  y: number;
}

interface Pillar {
  x: number;
  y: number;
  r: number;
}

interface GlyphStone {
  index: number;
  letter: string;
  glyph: string;
  x: number;
  y: number;
  collected: boolean;
  bobPhase: number;
}

interface SpikeTrap {
  x: number;
  y: number;
  w: number;
  h: number;
  cycleTimer: number;
  period: number;
  state: 'idle' | 'warning' | 'active';
}

interface Enemy {
  id: number;
  kind: 'scarab' | 'mummy' | 'obelisk' | 'boss';
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  hitFlash: number;
  slowTimer: number;
  aiTimer: number;
  telegraphTimer: number;
  chargeDirX: number;
  chargeDirY: number;
  chargingTimer: number;
  squash: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  fromPlayer: boolean;
  color: string;
  life: number;
}

interface PulseArc {
  x: number;
  y: number;
  angle: number;
  radius: number;
  life: number;
  maxLife: number;
}

interface BeamEffect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  maxLife: number;
  color: string;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
}

interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  large?: boolean;
}

interface Afterimage {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  facing: number;
}

const WORLD_W = 1200;
const WORLD_H = 720;
const WALL_PAD = 56;
const MAX_PARTICLES = 260;

export class PyramidGameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private lastTime = 0;

  private mode: GameMode = 'TITLE_MENU';
  private chamberIndex = 0;
  private score = 0;
  private orderedCombos = 0;
  private relics: RelicOption['id'][] = [];
  private activeGodId: GodId = 'bastet';

  // Player state
  private px = WORLD_W / 2;
  private py = WORLD_H - 110;
  private pvx = 0;
  private pvy = 0;
  private pRadius = 18;
  private pFacing = -Math.PI / 2;
  private hp = 4;
  private maxHp = 4;
  private invulnTimer = 0;
  private hitFlashTimer = 0;
  private pulseCooldown = 0;
  private dashCooldown = 0;
  private dashTimer = 0;
  private dashDirX = 0;
  private dashDirY = -1;
  private squashX = 1;
  private squashY = 1;
  private divineEnergy = 65;

  // God active buff timers
  private bastetTimer = 0;
  private raOrbitTimer = 0;
  private raOrbitAngle = 0;
  private osirisAuraTimer = 0;
  private anubisRingTimer = 0;

  // Input states
  private heldKeys = new Set<string>();
  private touchMoveVec: Vec2 = { x: 0, y: 0 };
  private pointerWorld: Vec2 | null = null;
  private lastAimWasMouse = false;
  private bufferedPulse = 0;
  private bufferedDash = 0;
  private bufferedPower = 0;

  // Chamber entities
  private pillars: Pillar[] = [];
  private glyphs: GlyphStone[] = [];
  private traps: SpikeTrap[] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private pulseArcs: PulseArc[] = [];
  private beams: BeamEffect[] = [];
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private afterimages: Afterimage[] = [];
  private portalOpen = false;
  private portalPulse = 0;
  private nextEnemyId = 1;

  // Feel & atmosphere
  private hitstopTimer = 0;
  private shakeTrauma = 0;
  private worldTime = 0;
  private titleStars: { x: number; y: number; r: number; speed: number; alpha: number }[] = [];
  private lastHudPush = 0;
  private lastHudHash = '';

  // Callbacks
  private onHudUpdate: (hud: HudSnapshot) => void;
  private onChamberClear: (chamberIndex: number, score: number, combos: number) => void;
  private onVictory: (score: number, combos: number) => void;
  private onGameOver: (score: number, chamberIndex: number, combos: number) => void;
  private onPauseToggle: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: {
      onHudUpdate: (hud: HudSnapshot) => void;
      onChamberClear: (chamberIndex: number, score: number, combos: number) => void;
      onVictory: (score: number, combos: number) => void;
      onGameOver: (score: number, chamberIndex: number, combos: number) => void;
      onPauseToggle: () => void;
    }
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not acquire 2D canvas context');
    this.ctx = context;

    this.onHudUpdate = callbacks.onHudUpdate;
    this.onChamberClear = callbacks.onChamberClear;
    this.onVictory = callbacks.onVictory;
    this.onGameOver = callbacks.onGameOver;
    this.onPauseToggle = callbacks.onPauseToggle;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 2,
        life: 0,
        maxLife: 1,
        color: '#FCD34D',
      });
    }

    for (let i = 0; i < 90; i++) {
      this.titleStars.push({
        x: Math.random() * WORLD_W,
        y: Math.random() * (WORLD_H * 0.65),
        r: 0.8 + Math.random() * 1.8,
        speed: 4 + Math.random() * 10,
        alpha: 0.25 + Math.random() * 0.65,
      });
    }

    this.bindEvents();
    this.startLoop();
  }

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  public destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
  }

  private handleWindowBlur = () => {
    this.heldKeys.clear();
    this.touchMoveVec = { x: 0, y: 0 };
  };

  private handleContextMenu = (e: MouseEvent) => {
    if (this.mode === 'PLAYING') {
      e.preventDefault();
    }
  };

  private toWorldCoords(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / WORLD_W, rect.height / WORLD_H);
    const offsetX = (rect.width - WORLD_W * scale) / 2;
    const offsetY = (rect.height - WORLD_H * scale) / 2;
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (this.mode !== 'PLAYING') return;
    this.pointerWorld = this.toWorldCoords(e.clientX, e.clientY);
    this.lastAimWasMouse = true;
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (this.mode !== 'PLAYING') return;
    this.pointerWorld = this.toWorldCoords(e.clientX, e.clientY);
    this.lastAimWasMouse = true;
    const dx = this.pointerWorld.x - this.px;
    const dy = this.pointerWorld.y - this.py;
    if (dx !== 0 || dy !== 0) {
      this.pFacing = Math.atan2(dy, dx);
    }
    if (e.button === 0) {
      this.bufferedPulse = 0.14;
    } else if (e.button === 2) {
      this.bufferedDash = 0.14;
    }
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    // Allow typing inside name input on title menu
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
      return;
    }

    const code = e.code;
    if (code === 'Escape' || code === 'KeyP') {
      if (this.mode === 'PLAYING' || this.mode === 'PAUSED') {
        e.preventDefault();
        this.onPauseToggle();
      }
      return;
    }

    if (this.mode !== 'PLAYING') return;

    if (
      code === 'Space' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight'
    ) {
      e.preventDefault();
    }

    this.heldKeys.add(code);

    if (code === 'Space' || code === 'KeyJ') {
      this.lastAimWasMouse = false;
      this.bufferedPulse = 0.14;
    } else if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyK') {
      this.bufferedDash = 0.14;
    } else if (code === 'KeyE' || code === 'KeyQ') {
      this.bufferedPower = 0.16;
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  public setTouchMove(x: number, y: number) {
    this.touchMoveVec = { x, y };
    if (Math.hypot(x, y) > 0.15) {
      this.lastAimWasMouse = false;
      this.pFacing = Math.atan2(y, x);
    }
  }

  public triggerPulse() {
    if (this.mode === 'PLAYING') this.bufferedPulse = 0.14;
  }

  public triggerDash() {
    if (this.mode === 'PLAYING') this.bufferedDash = 0.14;
  }

  public triggerDivinePower() {
    if (this.mode === 'PLAYING') this.bufferedPower = 0.16;
  }

  public setMode(mode: GameMode) {
    this.mode = mode;
    if (mode !== 'PLAYING') {
      this.heldKeys.clear();
    }
  }

  public startNewExpedition(startChamberIndex = 0) {
    const safeIdx = Math.max(0, Math.min(CHAMBERS.length - 1, startChamberIndex));
    this.score = 0;
    this.orderedCombos = 0;
    this.maxHp = 4;
    this.hp = 4;
    this.divineEnergy = 65;
    this.relics = [];
    this.chamberIndex = safeIdx;
    this.loadChamber(safeIdx);
    this.mode = 'PLAYING';
    this.pushHud(true);
  }

  public applyRelicAndAdvance(relicId: RelicOption['id']) {
    this.relics.push(relicId);
    if (relicId === 'max_hp') {
      this.maxHp += 1;
      this.hp = this.maxHp;
    } else {
      // Small blessing heal between chambers
      this.hp = Math.min(this.maxHp, this.hp + 1);
    }
    this.chamberIndex += 1;
    if (this.chamberIndex >= CHAMBERS.length) {
      this.mode = 'VICTORY';
      soundEngine.playVictory();
      this.onVictory(this.score, this.orderedCombos);
      return;
    }
    this.loadChamber(this.chamberIndex);
    this.mode = 'PLAYING';
    this.pushHud(true);
  }

  public restartCurrentChamber() {
    if (this.hp <= 0) {
      this.hp = this.maxHp;
    }
    this.loadChamber(this.chamberIndex);
    this.mode = 'PLAYING';
    this.pushHud(true);
  }

  private hasRelic(id: RelicOption['id']): boolean {
    return this.relics.includes(id);
  }

  private countRelic(id: RelicOption['id']): number {
    return this.relics.filter((r) => r === id).length;
  }

  private loadChamber(idx: number) {
    const def: ChamberDef = CHAMBERS[idx];
    this.activeGodId = def.godId;
    this.px = WORLD_W / 2;
    this.py = WORLD_H - 96;
    this.pvx = 0;
    this.pvy = 0;
    this.pFacing = -Math.PI / 2;
    this.invulnTimer = 0.55;
    this.hitFlashTimer = 0;
    this.pulseCooldown = 0;
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.divineEnergy = Math.max(this.divineEnergy, 65);
    this.bastetTimer = 0;
    this.raOrbitTimer = 0;
    this.osirisAuraTimer = 0;
    this.anubisRingTimer = 0;
    this.portalOpen = false;
    this.portalPulse = 0;
    this.projectiles = [];
    this.pulseArcs = [];
    this.beams = [];
    this.floatingTexts = [];
    this.afterimages = [];
    this.enemies = [];

    // Pillars
    this.pillars = [];
    if (def.pillarCount === 4) {
      const offsets = [
        { x: 310, y: 230 },
        { x: WORLD_W - 310, y: 230 },
        { x: 310, y: WORLD_H - 210 },
        { x: WORLD_W - 310, y: WORLD_H - 210 },
      ];
      offsets.forEach((p) => this.pillars.push({ x: p.x, y: p.y, r: 28 }));
    } else if (def.pillarCount >= 6) {
      const offsets = [
        { x: 260, y: 210 },
        { x: WORLD_W - 260, y: 210 },
        { x: 260, y: WORLD_H - 200 },
        { x: WORLD_W - 260, y: WORLD_H - 200 },
        { x: 460, y: 360 },
        { x: WORLD_W - 460, y: 360 },
      ];
      offsets.forEach((p) => this.pillars.push({ x: p.x, y: p.y, r: 26 }));
    }

    // Spike traps
    this.traps = [];
    const trapSlots = [
      { x: 420, y: 270 },
      { x: WORLD_W - 480, y: 270 },
      { x: 420, y: 450 },
      { x: WORLD_W - 480, y: 450 },
    ];
    for (let i = 0; i < def.spikeTrapCount; i++) {
      const slot = trapSlots[i % trapSlots.length];
      this.traps.push({
        x: slot.x,
        y: slot.y,
        w: 64,
        h: 64,
        cycleTimer: i * 0.65,
        period: 2.5,
        state: 'idle',
      });
    }

    // Glyph Stones
    this.glyphs = [];
    const candidateSpots: Vec2[] = [
      { x: 150, y: 150 },
      { x: WORLD_W - 150, y: 150 },
      { x: 160, y: WORLD_H / 2 },
      { x: WORLD_W - 160, y: WORLD_H / 2 },
      { x: WORLD_W / 2, y: 220 },
      { x: 190, y: WORLD_H - 140 },
      { x: WORLD_W - 190, y: WORLD_H - 140 },
    ];
    // Deterministic shuffle per chamber so letters spread cleanly
    const rotated = candidateSpots
      .slice(idx % candidateSpots.length)
      .concat(candidateSpots.slice(0, idx % candidateSpots.length));
    for (let i = 0; i < def.word.length; i++) {
      const spot = rotated[i % rotated.length];
      const ch = def.word[i];
      this.glyphs.push({
        index: i,
        letter: ch,
        glyph: letterToHieroglyph(ch),
        x: spot.x,
        y: spot.y,
        collected: false,
        bobPhase: i * 1.1,
      });
    }

    // Spawn Enemies away from player start
    const spawnEnemy = (kind: Enemy['kind'], x: number, y: number) => {
      if (kind === 'scarab') {
        const scarabHp = 2 + Math.floor(idx / 3);
        this.enemies.push({
          id: this.nextEnemyId++,
          kind,
          x,
          y,
          vx: 0,
          vy: 0,
          r: 14,
          hp: scarabHp,
          maxHp: scarabHp,
          speed: 145 + idx * 12,
          hitFlash: 0,
          slowTimer: 0,
          aiTimer: 0.6 + Math.random() * 1.0,
          telegraphTimer: 0,
          chargeDirX: 0,
          chargeDirY: 0,
          chargingTimer: 0,
          squash: 1,
        });
      } else if (kind === 'mummy') {
        const mummyHp = 5 + Math.floor(idx / 2);
        this.enemies.push({
          id: this.nextEnemyId++,
          kind,
          x,
          y,
          vx: 0,
          vy: 0,
          r: 20,
          hp: mummyHp,
          maxHp: mummyHp,
          speed: 98 + idx * 9,
          hitFlash: 0,
          slowTimer: 0,
          aiTimer: 1.1 + Math.random() * 0.9,
          telegraphTimer: 0,
          chargeDirX: 0,
          chargeDirY: 0,
          chargingTimer: 0,
          squash: 1,
        });
      } else if (kind === 'obelisk') {
        const obeliskHp = 6 + Math.floor(idx / 2);
        this.enemies.push({
          id: this.nextEnemyId++,
          kind,
          x,
          y,
          vx: 0,
          vy: 0,
          r: 22,
          hp: obeliskHp,
          maxHp: obeliskHp,
          speed: 0,
          hitFlash: 0,
          slowTimer: 0,
          aiTimer: 1.1 + Math.random() * 0.7,
          telegraphTimer: 0,
          chargeDirX: 0,
          chargeDirY: 0,
          chargingTimer: 0,
          squash: 1,
        });
      } else if (kind === 'boss') {
        this.enemies.push({
          id: this.nextEnemyId++,
          kind: 'boss',
          x: WORLD_W / 2,
          y: 230,
          vx: 0,
          vy: 0,
          r: 36,
          hp: 38,
          maxHp: 38,
          speed: 105,
          hitFlash: 0,
          slowTimer: 0,
          aiTimer: 1.4,
          telegraphTimer: 0,
          chargeDirX: 0,
          chargeDirY: 0,
          chargingTimer: 0,
          squash: 1,
        });
      }
    };

    for (let i = 0; i < def.scarabCount; i++) {
      const sx = 140 + ((i * 190) % (WORLD_W - 280));
      const sy = 115 + ((i * 85) % 240);
      spawnEnemy('scarab', sx, sy);
    }
    for (let i = 0; i < def.mummyCount; i++) {
      const mx = i % 2 === 0 ? 210 : WORLD_W - 210;
      const my = 165 + Math.floor(i / 2) * 165;
      spawnEnemy('mummy', mx, my);
    }
    const obeliskPositions: Vec2[] = [
      { x: 155, y: 265 },
      { x: WORLD_W - 155, y: 265 },
      { x: WORLD_W / 2 - 215, y: 145 },
      { x: WORLD_W / 2 + 215, y: 145 },
    ];
    for (let i = 0; i < def.obeliskCount; i++) {
      const slot = obeliskPositions[i % obeliskPositions.length];
      spawnEnemy('obelisk', slot.x, slot.y);
    }
    if (def.hasBoss) {
      spawnEnemy('boss', WORLD_W / 2, 220);
    }
  }

  private spawnParticles(x: number, y: number, color: string, count: number, speed = 150) {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        const ang = Math.random() * Math.PI * 2;
        const spd = speed * (0.35 + Math.random() * 0.75);
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd;
        p.size = 2 + Math.random() * 3.5;
        p.maxLife = 0.28 + Math.random() * 0.35;
        p.life = p.maxLife;
        p.color = color;
        spawned++;
      }
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string, large = false) {
    this.floatingTexts.push({
      x,
      y,
      vy: -36,
      text,
      color,
      life: 0.95,
      maxLife: 0.95,
      large,
    });
  }

  private startLoop() {
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      this.update(dt, now);
      this.render();

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private update(dt: number, nowMs: number) {
    this.worldTime += dt;

    // Title ambient animation
    for (const s of this.titleStars) {
      s.y -= s.speed * dt;
      if (s.y < 0) {
        s.y = WORLD_H * 0.65;
        s.x = Math.random() * WORLD_W;
      }
    }

    if (this.mode !== 'PLAYING') {
      return;
    }

    // Decay screen shake even during hitstop
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.8);

    // Hitstop freeze
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    // Timers
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.bufferedPulse = Math.max(0, this.bufferedPulse - dt);
    this.bufferedDash = Math.max(0, this.bufferedDash - dt);
    this.bufferedPower = Math.max(0, this.bufferedPower - dt);

    this.bastetTimer = Math.max(0, this.bastetTimer - dt);
    this.raOrbitTimer = Math.max(0, this.raOrbitTimer - dt);
    this.osirisAuraTimer = Math.max(0, this.osirisAuraTimer - dt);
    this.anubisRingTimer = Math.max(0, this.anubisRingTimer - dt);

    const powerGainMult = 1 + this.countRelic('power_gain') * 0.4;
    this.divineEnergy = Math.min(100, this.divineEnergy + dt * 4.4 * powerGainMult);

    // Squash recovery
    this.squashX += (1 - this.squashX) * Math.min(1, dt * 14);
    this.squashY += (1 - this.squashY) * Math.min(1, dt * 14);

    // Movement input
    let mx = this.touchMoveVec.x;
    let my = this.touchMoveVec.y;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) my -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) my += 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) mx -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) mx += 1;

    const mag = Math.hypot(mx, my);
    if (mag > 0.01) {
      mx /= mag;
      my /= mag;
      if (!this.lastAimWasMouse) {
        this.pFacing = Math.atan2(my, mx);
      }
    }

    if (this.lastAimWasMouse && this.pointerWorld) {
      this.pFacing = Math.atan2(this.pointerWorld.y - this.py, this.pointerWorld.x - this.px);
    }

    // Buffered Dash
    const dashCdMax = 0.95 * Math.pow(0.75, this.countRelic('dash_cd'));
    if (this.bufferedDash > 0 && this.dashCooldown <= 0 && this.dashTimer <= 0) {
      this.bufferedDash = 0;
      this.dashCooldown = dashCdMax;
      this.dashTimer = 0.16;
      this.invulnTimer = Math.max(this.invulnTimer, 0.21);
      if (mag > 0.05) {
        this.dashDirX = mx;
        this.dashDirY = my;
      } else {
        this.dashDirX = Math.cos(this.pFacing);
        this.dashDirY = Math.sin(this.pFacing);
      }
      this.squashX = 1.32;
      this.squashY = 0.74;
      soundEngine.playDash();
      this.spawnParticles(this.px, this.py, '#FCD34D', 10, 120);
    }

    // Buffered Solar Pulse
    if (this.bufferedPulse > 0 && this.pulseCooldown <= 0) {
      this.bufferedPulse = 0;
      this.performSolarPulse();
    }

    // Buffered Divine Power
    if (this.bufferedPower > 0 && this.divineEnergy >= 100) {
      this.bufferedPower = 0;
      this.performDivinePower();
    }

    // Move Player
    const baseSpeed = 248 * (1 + this.countRelic('move_speed') * 0.15) * (this.bastetTimer > 0 ? 1.45 : 1);
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      const dashSpeed = 680;
      this.pvx = this.dashDirX * dashSpeed;
      this.pvy = this.dashDirY * dashSpeed;
      this.afterimages.push({
        x: this.px,
        y: this.py,
        life: 0.18,
        maxLife: 0.18,
        facing: this.pFacing,
      });
    } else {
      const targetVx = mx * baseSpeed;
      const targetVy = my * baseSpeed;
      const accel = 16;
      this.pvx += (targetVx - this.pvx) * Math.min(1, dt * accel);
      this.pvy += (targetVy - this.pvy) * Math.min(1, dt * accel);
    }

    this.px += this.pvx * dt;
    this.py += this.pvy * dt;
    const playerPos = { x: this.px, y: this.py };
    this.resolveArenaAndPillars(playerPos, this.pRadius);
    this.px = playerPos.x;
    this.py = playerPos.y;

    // Ra orbiting solar flares
    if (this.raOrbitTimer > 0) {
      this.raOrbitAngle += dt * 4.5;
      for (let k = 0; k < 3; k++) {
        const ang = this.raOrbitAngle + (k * Math.PI * 2) / 3;
        const fx = this.px + Math.cos(ang) * 72;
        const fy = this.py + Math.sin(ang) * 72;
        for (const e of this.enemies) {
          if (Math.hypot(e.x - fx, e.y - fy) < e.r + 16 && e.hitFlash <= 0) {
            this.damageEnemy(e, 2, (e.x - this.px) * 2, (e.y - this.py) * 2);
          }
        }
      }
    }

    // Update Traps
    for (const trap of this.traps) {
      trap.cycleTimer = (trap.cycleTimer + dt) % trap.period;
      if (trap.cycleTimer < 1.15) trap.state = 'idle';
      else if (trap.cycleTimer < 1.75) trap.state = 'warning';
      else trap.state = 'active';

      if (
        trap.state === 'active' &&
        this.px + this.pRadius * 0.7 > trap.x &&
        this.px - this.pRadius * 0.7 < trap.x + trap.w &&
        this.py + this.pRadius * 0.7 > trap.y &&
        this.py - this.pRadius * 0.7 < trap.y + trap.h
      ) {
        this.hurtPlayer(1);
      }
    }

    // Update Glyphs & Check Pickup
    const nextExpectedIdx = this.getNextExpectedGlyphIndex();
    for (const g of this.glyphs) {
      if (g.collected) continue;
      g.bobPhase += dt * 3;
      if (Math.hypot(this.px - g.x, this.py - g.y) < this.pRadius + 24) {
        g.collected = true;
        const isOrdered = g.index === nextExpectedIdx;
        const points = isOrdered ? 150 : 75;
        this.score += points;
        if (isOrdered) {
          this.orderedCombos += 1;
          this.divineEnergy = Math.min(100, this.divineEnergy + 18);
        } else {
          this.divineEnergy = Math.min(100, this.divineEnergy + 8);
        }
        const collectedCount = this.glyphs.filter((item) => item.collected).length;
        soundEngine.playGlyphPickup(collectedCount - 1, isOrdered);
        this.spawnParticles(g.x, g.y, isOrdered ? '#FCD34D' : '#38BDF8', 18, 170);
        this.addFloatingText(
          g.x,
          g.y - 16,
          isOrdered ? `${g.glyph} +150 MA'AT` : `${g.glyph} +75`,
          isOrdered ? '#FDE68A' : '#7DD3FC',
          isOrdered
        );

        // In Chamber 5, each solar seal strikes Apophis Boss!
        const boss = this.enemies.find((e) => e.kind === 'boss');
        if (boss) {
          this.beams.push({
            x1: g.x,
            y1: g.y,
            x2: boss.x,
            y2: boss.y,
            life: 0.28,
            maxLife: 0.28,
            color: '#FCD34D',
          });
          this.damageEnemy(boss, 3, 0, 0);
        }

        if (collectedCount === this.glyphs.length) {
          this.checkPortalActivation();
        }
      }
    }

    // Also check portal activation if boss died after all glyphs collected
    if (!this.portalOpen && this.glyphs.every((g) => g.collected)) {
      this.checkPortalActivation();
    }

    if (this.portalOpen) {
      this.portalPulse += dt * 3;
      if (Math.hypot(this.px - WORLD_W / 2, this.py - 84) < this.pRadius + 34) {
        soundEngine.playPortalOpen();
        if (this.chamberIndex >= CHAMBERS.length - 1) {
          this.score += 500;
          this.mode = 'VICTORY';
          soundEngine.playVictory();
          this.onVictory(this.score, this.orderedCombos);
        } else {
          this.score += 250;
          this.mode = 'CHAMBER_CLEAR';
          this.onChamberClear(this.chamberIndex, this.score, this.orderedCombos);
        }
        return;
      }
    }

    // Update Enemies
    this.updateEnemies(dt);

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;

      let remove =
        pr.life <= 0 ||
        pr.x < WALL_PAD ||
        pr.x > WORLD_W - WALL_PAD ||
        pr.y < WALL_PAD ||
        pr.y > WORLD_H - WALL_PAD;

      if (!remove) {
        for (const p of this.pillars) {
          if (Math.hypot(pr.x - p.x, pr.y - p.y) < pr.r + p.r) {
            remove = true;
            this.spawnParticles(pr.x, pr.y, pr.color, 5, 80);
            break;
          }
        }
      }

      if (!remove && !pr.fromPlayer) {
        if (Math.hypot(pr.x - this.px, pr.y - this.py) < pr.r + this.pRadius - 2) {
          if (this.bastetTimer > 0) {
            remove = true;
            this.spawnParticles(pr.x, pr.y, '#2DD4BF', 8, 120);
          } else {
            remove = true;
            this.hurtPlayer(1);
          }
        }
      } else if (!remove && pr.fromPlayer) {
        for (const e of this.enemies) {
          if (Math.hypot(pr.x - e.x, pr.y - e.y) < pr.r + e.r) {
            this.damageEnemy(e, 2, pr.vx * 0.4, pr.vy * 0.4);
            remove = true;
            break;
          }
        }
      }

      if (remove) {
        this.projectiles.splice(i, 1);
      }
    }

    // Update Visual FX
    for (let i = this.pulseArcs.length - 1; i >= 0; i--) {
      this.pulseArcs[i].life -= dt;
      if (this.pulseArcs[i].life <= 0) this.pulseArcs.splice(i, 1);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].life -= dt;
      if (this.beams[i].life <= 0) this.beams.splice(i, 1);
    }
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].life -= dt;
      if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
    }
    for (const p of this.particles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Push HUD snapshot cleanly without spamming React
    if (nowMs - this.lastHudPush > 75) {
      this.lastHudPush = nowMs;
      this.pushHud(false);
    }
  }

  private checkPortalActivation() {
    const bossAlive = this.enemies.some((e) => e.kind === 'boss');
    if (!bossAlive && !this.portalOpen) {
      this.portalOpen = true;
      soundEngine.playPortalOpen();
      this.spawnParticles(WORLD_W / 2, 84, '#FCD34D', 28, 200);
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.35);
      this.pushHud(true);
    }
  }

  private performSolarPulse() {
    this.pulseCooldown = 0.38;
    const rangeMult = 1 + this.countRelic('pulse_range') * 0.25;
    const radius = 108 * rangeMult;
    const coneHalfAngle = 1.05; // wide sweeping solar arc

    this.squashX = 1.24;
    this.squashY = 0.8;
    soundEngine.playPulse();

    this.pulseArcs.push({
      x: this.px,
      y: this.py,
      angle: this.pFacing,
      radius,
      life: 0.2,
      maxLife: 0.2,
    });

    this.spawnParticles(
      this.px + Math.cos(this.pFacing) * 44,
      this.py + Math.sin(this.pFacing) * 44,
      '#FBBF24',
      10,
      160
    );

    // Hit enemies in arc
    let landedHit = false;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dx = e.x - this.px;
      const dy = e.y - this.py;
      const dist = Math.hypot(dx, dy);
      if (dist <= radius + e.r) {
        const angToEnemy = Math.atan2(dy, dx);
        const diff = Math.abs(Math.atan2(Math.sin(angToEnemy - this.pFacing), Math.cos(angToEnemy - this.pFacing)));
        if (diff <= coneHalfAngle || dist < 44) {
          const dmg = this.hasRelic('pulse_range') ? 3 : 2;
          this.damageEnemy(e, dmg, Math.cos(angToEnemy) * 260, Math.sin(angToEnemy) * 260);
          landedHit = true;
        }
      }
    }

    // Deflect incoming enemy orbs!
    for (const pr of this.projectiles) {
      if (pr.fromPlayer) continue;
      const dx = pr.x - this.px;
      const dy = pr.y - this.py;
      const dist = Math.hypot(dx, dy);
      if (dist <= radius + 12) {
        pr.fromPlayer = true;
        pr.vx = Math.cos(this.pFacing) * 420;
        pr.vy = Math.sin(this.pFacing) * 420;
        pr.color = '#38BDF8';
        pr.life = 1.8;
        this.spawnParticles(pr.x, pr.y, '#38BDF8', 8, 120);
        this.score += 25;
        landedHit = true;
      }
    }

    if (landedHit) {
      this.hitstopTimer = 0.04;
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.28);
    }
  }

  private performDivinePower() {
    this.divineEnergy = 0;
    soundEngine.playGodPower(this.activeGodId);
    this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.45);
    this.squashX = 1.3;
    this.squashY = 1.3;

    switch (this.activeGodId) {
      case 'bastet': {
        this.bastetTimer = 2.8;
        this.invulnTimer = Math.max(this.invulnTimer, 2.8);
        this.spawnParticles(this.px, this.py, '#2DD4BF', 26, 210);
        this.addFloatingText(this.px, this.py - 28, 'VÉU DE BASTET', '#2DD4BF', true);
        break;
      }
      case 'anubis': {
        this.anubisRingTimer = 0.45;
        this.spawnParticles(this.px, this.py, '#FBBF24', 32, 260);
        this.addFloatingText(this.px, this.py - 28, 'JUÍZO DE ANÚBIS', '#FCD34D', true);
        // Clear projectiles
        this.projectiles = this.projectiles.filter((pr) => pr.fromPlayer);
        // Heavy AoE damage
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          const dist = Math.hypot(e.x - this.px, e.y - this.py);
          if (dist < 260) {
            const ang = Math.atan2(e.y - this.py, e.x - this.px);
            this.damageEnemy(e, 4, Math.cos(ang) * 320, Math.sin(ang) * 320);
          }
        }
        this.hitstopTimer = 0.055;
        break;
      }
      case 'osiris': {
        this.osirisAuraTimer = 4.0;
        if (this.hp < this.maxHp) {
          this.hp += 1;
        } else {
          this.score += 100;
        }
        for (const e of this.enemies) {
          e.slowTimer = 4.0;
        }
        this.spawnParticles(this.px, this.py, '#10B981', 28, 220);
        this.addFloatingText(this.px, this.py - 28, '+1 ANKH · NILO', '#34D399', true);
        break;
      }
      case 'horus': {
        const bx2 = this.px + Math.cos(this.pFacing) * 1100;
        const by2 = this.py + Math.sin(this.pFacing) * 1100;
        this.beams.push({
          x1: this.px,
          y1: this.py,
          x2: bx2,
          y2: by2,
          life: 0.35,
          maxLife: 0.35,
          color: '#38BDF8',
        });
        this.addFloatingText(this.px, this.py - 28, 'OLHO DE HÓRUS', '#7DD3FC', true);
        // Line segment distance to enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          const d = this.pointToSegmentDist(e.x, e.y, this.px, this.py, bx2, by2);
          if (d < e.r + 28) {
            this.damageEnemy(e, 5, Math.cos(this.pFacing) * 200, Math.sin(this.pFacing) * 200);
          }
        }
        this.hitstopTimer = 0.05;
        break;
      }
      case 'ra': {
        this.raOrbitTimer = 5.0;
        this.spawnParticles(this.px, this.py, '#FCD34D', 36, 280);
        this.addFloatingText(this.px, this.py - 28, 'CHAMA DE RÁ', '#FDE68A', true);
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          if (Math.hypot(e.x - this.px, e.y - this.py) < 200) {
            this.damageEnemy(e, 3, 0, 0);
          }
        }
        break;
      }
    }
    this.pushHud(true);
  }

  private pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  private updateEnemies(dt: number) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.slowTimer = Math.max(0, e.slowTimer - dt);
      e.squash += (1 - e.squash) * Math.min(1, dt * 12);

      const slowFactor = e.slowTimer > 0 ? 0.4 : 1;
      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const dist = Math.max(1, Math.hypot(dx, dy));

      if (e.kind === 'scarab') {
        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          e.vx *= 0.85;
          e.vy *= 0.85;
          if (e.telegraphTimer <= 0) {
            e.chargingTimer = 0.32;
            e.squash = 1.3;
          }
        } else if (e.chargingTimer > 0) {
          e.chargingTimer -= dt;
          e.vx = e.chargeDirX * 390 * slowFactor;
          e.vy = e.chargeDirY * 390 * slowFactor;
        } else {
          e.aiTimer -= dt;
          e.vx = (dx / dist) * e.speed * slowFactor;
          e.vy = (dy / dist) * e.speed * slowFactor;
          if (e.aiTimer <= 0 && dist < 290) {
            e.telegraphTimer = 0.36;
            e.chargeDirX = dx / dist;
            e.chargeDirY = dy / dist;
            e.aiTimer = 1.4 + Math.random() * 0.85;
          }
        }
      } else if (e.kind === 'mummy') {
        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          e.vx = 0;
          e.vy = 0;
          if (e.telegraphTimer <= 0) {
            e.chargingTimer = 0.5;
            e.squash = 1.25;
          }
        } else if (e.chargingTimer > 0) {
          e.chargingTimer -= dt;
          e.vx = e.chargeDirX * 435 * slowFactor;
          e.vy = e.chargeDirY * 435 * slowFactor;
        } else {
          e.aiTimer -= dt;
          e.vx = (dx / dist) * e.speed * slowFactor;
          e.vy = (dy / dist) * e.speed * slowFactor;
          if (e.aiTimer <= 0 && dist < 390) {
            e.telegraphTimer = 0.54;
            e.chargeDirX = dx / dist;
            e.chargeDirY = dy / dist;
            e.aiTimer = 1.85 + Math.random() * 0.8;
          }
        }
      } else if (e.kind === 'obelisk') {
        e.vx = 0;
        e.vy = 0;
        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt * slowFactor;
          if (e.telegraphTimer <= 0) {
            const ang = Math.atan2(dy, dx);
            const spreadOffsets =
              this.chamberIndex >= 3 ? [-0.22, 0, 0.22] : this.chamberIndex >= 2 ? [-0.14, 0.14] : [0];
            const orbSpeed = 285 + this.chamberIndex * 12;
            for (const offset of spreadOffsets) {
              this.projectiles.push({
                x: e.x,
                y: e.y,
                vx: Math.cos(ang + offset) * orbSpeed,
                vy: Math.sin(ang + offset) * orbSpeed,
                r: 8,
                fromPlayer: false,
                color: '#F97316',
                life: 4.0,
              });
            }
            e.squash = 1.2;
            e.aiTimer = 1.75;
          }
        } else {
          e.aiTimer -= dt * slowFactor;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = 0.78;
          }
        }
      } else if (e.kind === 'boss') {
        // Apophis Shadow Guardian: hovers, telegraphs 3-orb or enraged 5-orb volleys & summons scarabs
        const enraged = e.hp <= e.maxHp * 0.5;
        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          e.vx *= 0.88;
          e.vy *= 0.88;
          if (e.telegraphTimer <= 0) {
            const baseAng = Math.atan2(dy, dx);
            const volley = enraged ? [-0.52, -0.26, 0, 0.26, 0.52] : [-0.34, 0, 0.34];
            const volleySpeed = enraged ? 295 : 270;
            for (const offset of volley) {
              this.projectiles.push({
                x: e.x,
                y: e.y,
                vx: Math.cos(baseAng + offset) * volleySpeed,
                vy: Math.sin(baseAng + offset) * volleySpeed,
                r: 9,
                fromPlayer: false,
                color: '#EC4899',
                life: 4.2,
              });
            }
            if (enraged && this.enemies.length < 7) {
              this.enemies.push({
                id: this.nextEnemyId++,
                kind: 'scarab',
                x: e.x + (Math.random() > 0.5 ? 54 : -54),
                y: e.y + 32,
                vx: 0,
                vy: 0,
                r: 14,
                hp: 3,
                maxHp: 3,
                speed: 185,
                hitFlash: 0,
                slowTimer: 0,
                aiTimer: 0.7,
                telegraphTimer: 0,
                chargeDirX: 0,
                chargeDirY: 0,
                chargingTimer: 0,
                squash: 1,
              });
            }
            e.squash = 1.25;
            e.aiTimer = enraged ? 1.3 : 1.6;
          }
        } else {
          e.aiTimer -= dt * slowFactor;
          const moveRate = enraged ? 1.3 : 0.95;
          const targetX = WORLD_W / 2 + Math.cos(this.worldTime * moveRate) * 260;
          const targetY = 205 + Math.sin(this.worldTime * (moveRate * 1.4)) * 95;
          e.vx = (targetX - e.x) * (enraged ? 1.8 : 1.5) * slowFactor;
          e.vy = (targetY - e.y) * (enraged ? 1.8 : 1.5) * slowFactor;
          if (e.aiTimer <= 0) {
            e.telegraphTimer = enraged ? 0.65 : 0.78;
          }
        }
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.kind !== 'obelisk') {
        this.resolveArenaAndPillars(e, e.r);
      }

      // Player collision
      if (Math.hypot(e.x - this.px, e.y - this.py) < e.r + this.pRadius - 3) {
        if (this.bastetTimer > 0 && e.kind === 'scarab') {
          this.damageEnemy(e, 4, (e.x - this.px) * 4, (e.y - this.py) * 4);
        } else {
          this.hurtPlayer(1);
        }
      }
    }
  }

  private damageEnemy(e: Enemy, dmg: number, knockX: number, knockY: number) {
    e.hp -= dmg;
    e.hitFlash = 0.14;
    e.squash = 0.72;
    if (e.kind !== 'obelisk' && e.kind !== 'boss') {
      e.x += knockX * 0.08;
      e.y += knockY * 0.08;
    }
    this.spawnParticles(e.x, e.y, '#FBBF24', 9, 140);

    if (e.hp <= 0) {
      const idx = this.enemies.indexOf(e);
      if (idx !== -1) this.enemies.splice(idx, 1);
      const pts = e.kind === 'boss' ? 600 : e.kind === 'mummy' ? 120 : e.kind === 'obelisk' ? 150 : 60;
      this.score += pts;
      this.divineEnergy = Math.min(100, this.divineEnergy + 14);
      soundEngine.playBanish();
      this.spawnParticles(e.x, e.y, e.kind === 'boss' ? '#FCD34D' : '#F97316', 20, 210);
      this.addFloatingText(e.x, e.y - 12, `+${pts}`, '#FDE68A', e.kind === 'boss');
      this.hitstopTimer = e.kind === 'boss' ? 0.075 : 0.035;
      this.shakeTrauma = Math.min(1, this.shakeTrauma + (e.kind === 'boss' ? 0.65 : 0.22));
      this.pushHud(true);
    }
  }

  private hurtPlayer(amount: number) {
    if (this.invulnTimer > 0 || this.mode !== 'PLAYING') return;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnTimer = 0.8;
    this.hitFlashTimer = 0.22;
    this.hitstopTimer = 0.055;
    this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.58);
    soundEngine.playHit();
    this.spawnParticles(this.px, this.py, '#EF4444', 18, 190);
    this.pushHud(true);

    if (this.hp <= 0) {
      this.mode = 'GAME_OVER';
      soundEngine.playGameOver();
      this.onGameOver(this.score, this.chamberIndex, this.orderedCombos);
    }
  }

  private resolveArenaAndPillars(entity: { x: number; y: number }, r: number) {
    entity.x = Math.max(WALL_PAD + r, Math.min(WORLD_W - WALL_PAD - r, entity.x));
    entity.y = Math.max(WALL_PAD + r, Math.min(WORLD_H - WALL_PAD - r, entity.y));

    for (const p of this.pillars) {
      const dx = entity.x - p.x;
      const dy = entity.y - p.y;
      const dist = Math.hypot(dx, dy);
      const minDist = r + p.r;
      if (dist < minDist && dist > 0.001) {
        const push = minDist - dist;
        entity.x += (dx / dist) * push;
        entity.y += (dy / dist) * push;
      }
    }
  }

  private getNextExpectedGlyphIndex(): number {
    for (const g of this.glyphs) {
      if (!g.collected) return g.index;
    }
    return -1;
  }

  private pushHud(force: boolean) {
    const boss = this.enemies.find((e) => e.kind === 'boss');
    const snap: HudSnapshot = {
      hp: this.hp,
      maxHp: this.maxHp,
      score: this.score,
      chamberIndex: this.chamberIndex,
      godId: this.activeGodId,
      word: CHAMBERS[this.chamberIndex].word,
      collectedMask: this.glyphs.map((g) => g.collected),
      nextGlyphIndex: this.getNextExpectedGlyphIndex(),
      portalOpen: this.portalOpen,
      divineEnergy: Math.floor(this.divineEnergy),
      dashReadyRatio:
        this.dashCooldown <= 0
          ? 1
          : Math.max(0, 1 - this.dashCooldown / (0.85 * Math.pow(0.75, this.countRelic('dash_cd')))),
      bossHp: boss ? boss.hp : 0,
      bossMaxHp: boss ? boss.maxHp : 0,
      combos: this.orderedCombos,
      activePowerTimer: Math.max(this.bastetTimer, this.raOrbitTimer, this.osirisAuraTimer),
    };
    const hash = `${snap.hp}-${snap.maxHp}-${snap.score}-${snap.chamberIndex}-${snap.collectedMask.join('')}-${snap.portalOpen}-${Math.floor(snap.divineEnergy / 5)}-${snap.bossHp}-${Math.round(snap.dashReadyRatio * 10)}`;
    if (force || hash !== this.lastHudHash) {
      this.lastHudHash = hash;
      this.onHudUpdate(snap);
    }
  }

  // ==================== RENDERING ====================
  private render() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const targetW = Math.max(1, Math.floor(rect.width * dpr));
    const targetH = Math.max(1, Math.floor(rect.height * dpr));
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#090704';
    ctx.fillRect(0, 0, targetW, targetH);

    // Aspect-fit logical 1200x720 world
    const scale = Math.min(targetW / WORLD_W, targetH / WORLD_H);
    const offsetX = (targetW - WORLD_W * scale) / 2;
    const offsetY = (targetH - WORLD_H * scale) / 2;

    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (this.mode === 'TITLE_MENU') {
      this.renderTitleBackdrop(ctx);
      ctx.restore();
      return;
    }

    // Apply decaying camera shake
    if (this.shakeTrauma > 0.001) {
      const mag = this.shakeTrauma * this.shakeTrauma * 14;
      const sx = (Math.random() * 2 - 1) * mag;
      const sy = (Math.random() * 2 - 1) * mag;
      ctx.translate(sx, sy);
    }

    this.renderChamberFloor(ctx);
    this.renderTraps(ctx);
    this.renderPortal(ctx);
    this.renderGlyphs(ctx);
    this.renderPillars(ctx);
    this.renderAfterimages(ctx);
    this.renderEnemies(ctx);
    this.renderPlayer(ctx);
    this.renderProjectiles(ctx);
    this.renderPulseArcsAndBeams(ctx);
    this.renderParticles(ctx);
    this.renderFloatingTexts(ctx);

    ctx.restore();
  }

  private renderTitleBackdrop(ctx: CanvasRenderingContext2D) {
    // Deep Egyptian desert night sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    sky.addColorStop(0, '#09070D');
    sky.addColorStop(0.55, '#1D1408');
    sky.addColorStop(1, '#2D1D08');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Moving starfield (honoring Egito_Antigo .stars)
    for (const s of this.titleStars) {
      ctx.fillStyle = `rgba(254, 243, 199, ${s.alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Warm Solar Moon Halo on right side (leaving left 40% calmer for Title lockup)
    const sunX = WORLD_W * 0.72;
    const sunY = WORLD_H * 0.36;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 240);
    sunGlow.addColorStop(0, 'rgba(251, 191, 36, 0.35)');
    sunGlow.addColorStop(0.5, 'rgba(217, 119, 6, 0.12)');
    sunGlow.addColorStop(1, 'rgba(217, 119, 6, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 240, 0, Math.PI * 2);
    ctx.fill();

    // Solar disk
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 54, 0, Math.PI * 2);
    ctx.fill();

    // Distant Dunes
    ctx.fillStyle = '#181006';
    ctx.beginPath();
    ctx.moveTo(0, WORLD_H * 0.68);
    ctx.quadraticCurveTo(WORLD_W * 0.25, WORLD_H * 0.62, WORLD_W * 0.55, WORLD_H * 0.7);
    ctx.quadraticCurveTo(WORLD_W * 0.8, WORLD_H * 0.75, WORLD_W, WORLD_H * 0.66);
    ctx.lineTo(WORLD_W, WORLD_H);
    ctx.lineTo(0, WORLD_H);
    ctx.closePath();
    ctx.fill();

    // Great Pyramid & Companion Pyramid on right focal horizon
    const floatY = Math.sin(this.worldTime * 1.4) * 4;
    // Main Pyramid
    ctx.fillStyle = '#2A1B0A';
    ctx.beginPath();
    ctx.moveTo(sunX - 240, WORLD_H * 0.74);
    ctx.lineTo(sunX + 10, WORLD_H * 0.36 + floatY);
    ctx.lineTo(sunX + 260, WORLD_H * 0.74);
    ctx.closePath();
    ctx.fill();

    // Lit face of Pyramid
    ctx.fillStyle = '#472E11';
    ctx.beginPath();
    ctx.moveTo(sunX + 10, WORLD_H * 0.36 + floatY);
    ctx.lineTo(sunX + 260, WORLD_H * 0.74);
    ctx.lineTo(sunX + 40, WORLD_H * 0.74);
    ctx.closePath();
    ctx.fill();

    // Golden Apex Capstone
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.moveTo(sunX + 10, WORLD_H * 0.36 + floatY);
    ctx.lineTo(sunX - 18, WORLD_H * 0.405 + floatY);
    ctx.lineTo(sunX + 38, WORLD_H * 0.405 + floatY);
    ctx.closePath();
    ctx.fill();

    // Foreground temple terrace & Nile reflection shimmer
    ctx.fillStyle = '#120C04';
    ctx.fillRect(0, WORLD_H * 0.74, WORLD_W, WORLD_H * 0.26);

    // Subtle Nile golden shimmer lines
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.2)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = WORLD_H * 0.79 + i * 20;
      const shift = Math.sin(this.worldTime * 1.5 + i) * 18;
      ctx.beginPath();
      ctx.moveTo(sunX - 120 + shift, y);
      ctx.lineTo(sunX + 140 + shift, y);
      ctx.stroke();
    }
  }

  private renderChamberFloor(ctx: CanvasRenderingContext2D) {
    const def = CHAMBERS[this.chamberIndex];
    // Outer wall dark basalt
    ctx.fillStyle = '#0D0A06';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Arena sandstone floor
    ctx.fillStyle = def.floorTint;
    ctx.fillRect(WALL_PAD, WALL_PAD, WORLD_W - WALL_PAD * 2, WORLD_H - WALL_PAD * 2);

    // Subtle stone grid tiles
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.08)';
    ctx.lineWidth = 1;
    const tile = 64;
    for (let x = WALL_PAD; x <= WORLD_W - WALL_PAD; x += tile) {
      ctx.beginPath();
      ctx.moveTo(x, WALL_PAD);
      ctx.lineTo(x, WORLD_H - WALL_PAD);
      ctx.stroke();
    }
    for (let y = WALL_PAD; y <= WORLD_H - WALL_PAD; y += tile) {
      ctx.beginPath();
      ctx.moveTo(WALL_PAD, y);
      ctx.lineTo(WORLD_W - WALL_PAD, y);
      ctx.stroke();
    }

    // Nile water channels in Osiris chamber
    if (def.godId === 'osiris') {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.09)';
      ctx.fillRect(WALL_PAD, WORLD_H / 2 - 22, WORLD_W - WALL_PAD * 2, 44);
    }

    // Sacred center ring motif
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.14)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(WORLD_W / 2, WORLD_H / 2, 110, 0, Math.PI * 2);
    ctx.stroke();

    // Inner border trim
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 4;
    ctx.strokeRect(WALL_PAD, WALL_PAD, WORLD_W - WALL_PAD * 2, WORLD_H - WALL_PAD * 2);

    // Corner Flickering Braziers
    const braziers = [
      { x: WALL_PAD + 24, y: WALL_PAD + 24 },
      { x: WORLD_W - WALL_PAD - 24, y: WALL_PAD + 24 },
      { x: WALL_PAD + 24, y: WORLD_H - WALL_PAD - 24 },
      { x: WORLD_W - WALL_PAD - 24, y: WORLD_H - WALL_PAD - 24 },
    ];
    for (const b of braziers) {
      const flicker = 0.85 + Math.sin(this.worldTime * 11 + b.x) * 0.15;
      const glow = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, 68 * flicker);
      glow.addColorStop(0, 'rgba(251, 191, 36, 0.32)');
      glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 68 * flicker, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7 * flicker, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderTraps(ctx: CanvasRenderingContext2D) {
    for (const trap of this.traps) {
      ctx.save();
      ctx.fillStyle =
        trap.state === 'active'
          ? 'rgba(220, 38, 38, 0.35)'
          : trap.state === 'warning'
            ? 'rgba(245, 158, 11, 0.28)'
            : 'rgba(120, 82, 20, 0.22)';
      ctx.strokeStyle =
        trap.state === 'active'
          ? '#EF4444'
          : trap.state === 'warning'
            ? '#FBBF24'
            : '#78350F';
      ctx.lineWidth = 2;
      ctx.fillRect(trap.x, trap.y, trap.w, trap.h);
      ctx.strokeRect(trap.x, trap.y, trap.w, trap.h);

      if (trap.state === 'active') {
        ctx.fillStyle = '#FCA5A5';
        for (let sx = 12; sx <= trap.w - 12; sx += 20) {
          for (let sy = 12; sy <= trap.h - 12; sy += 20) {
            ctx.beginPath();
            ctx.moveTo(trap.x + sx, trap.y + sy - 8);
            ctx.lineTo(trap.x + sx + 6, trap.y + sy + 6);
            ctx.lineTo(trap.x + sx - 6, trap.y + sy + 6);
            ctx.closePath();
            ctx.fill();
          }
        }
      } else if (trap.state === 'warning') {
        ctx.fillStyle = '#FCD34D';
        ctx.font = 'bold 18px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', trap.x + trap.w / 2, trap.y + trap.h / 2);
      }
      ctx.restore();
    }
  }

  private renderPortal(ctx: CanvasRenderingContext2D) {
    const x = WORLD_W / 2;
    const y = 84;
    ctx.save();
    if (this.portalOpen) {
      const pulse = 36 + Math.sin(this.portalPulse) * 5;
      const grad = ctx.createRadialGradient(x, y, 6, x, y, pulse + 20);
      grad.addColorStop(0, '#FEF3C7');
      grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.75)');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, pulse + 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FCD34D';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#FEF3C7';
      ctx.font = '24px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☥', x, y + 1);
    } else {
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(217, 119, 6, 0.3)';
      ctx.font = '20px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☥', x, y + 1);
    }
    ctx.restore();
  }

  private renderGlyphs(ctx: CanvasRenderingContext2D) {
    const nextIdx = this.getNextExpectedGlyphIndex();
    for (const g of this.glyphs) {
      if (g.collected) continue;
      const isNext = g.index === nextIdx;
      const bob = Math.sin(g.bobPhase) * 4;
      const gy = g.y + bob;

      ctx.save();
      if (isNext) {
        const ringR = 28 + Math.sin(this.worldTime * 5) * 4;
        ctx.strokeStyle = 'rgba(252, 211, 77, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(g.x, gy, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Stone tablet base
      ctx.fillStyle = isNext ? '#451A03' : '#291A0B';
      ctx.strokeStyle = isNext ? '#FCD34D' : '#B45309';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(g.x - 19, gy - 22, 38, 44, 8);
      ctx.fill();
      ctx.stroke();

      // Hieroglyph symbol
      ctx.fillStyle = isNext ? '#FEF08A' : '#FDE68A';
      ctx.font = '22px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(g.glyph, g.x, gy - 3);

      // Tiny letter label
      ctx.fillStyle = isNext ? '#FBBF24' : '#D97706';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText(g.letter, g.x, gy + 15);
      ctx.restore();
    }
  }

  private renderPillars(ctx: CanvasRenderingContext2D) {
    for (const p of this.pillars) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.arc(p.x + 4, p.y + 6, p.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#3B2814';
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderAfterimages(ctx: CanvasRenderingContext2D) {
    for (const a of this.afterimages) {
      const alpha = (a.life / a.maxLife) * 0.45;
      ctx.fillStyle = `rgba(252, 211, 77, ${alpha})`;
      ctx.beginPath();
      ctx.arc(a.x, a.y, this.pRadius * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderEnemies(ctx: CanvasRenderingContext2D) {
    for (const e of this.enemies) {
      ctx.save();
      // Telegraph lanes or rings
      if (e.telegraphTimer > 0) {
        if (e.kind === 'mummy' || e.kind === 'scarab') {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)';
          ctx.lineWidth = e.kind === 'mummy' ? 14 : 6;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x + e.chargeDirX * 150, e.y + e.chargeDirY * 150);
          ctx.stroke();
        } else {
          ctx.strokeStyle = e.kind === 'boss' ? '#EC4899' : '#F97316';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r + 14 * (e.telegraphTimer / 1.0), 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.translate(e.x, e.y);
      ctx.scale(e.squash, 2 - e.squash);

      const isFlashing = e.hitFlash > 0;
      if (e.kind === 'scarab') {
        ctx.fillStyle = isFlashing ? '#FFFFFF' : e.slowTimer > 0 ? '#10B981' : '#B45309';
        ctx.strokeStyle = '#FCD34D';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Wings accent
        ctx.fillStyle = isFlashing ? '#FFFFFF' : '#F59E0B';
        ctx.beginPath();
        ctx.arc(0, -3, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'mummy') {
        ctx.fillStyle = isFlashing ? '#FFFFFF' : e.slowTimer > 0 ? '#059669' : '#4B5563';
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Bandage stripes
        ctx.strokeStyle = '#D1D5DB';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, -4);
        ctx.lineTo(10, -4);
        ctx.moveTo(-10, 4);
        ctx.lineTo(10, 4);
        ctx.stroke();
      } else if (e.kind === 'obelisk') {
        ctx.fillStyle = isFlashing ? '#FFFFFF' : '#292524';
        ctx.strokeStyle = e.telegraphTimer > 0 ? '#F97316' : '#D97706';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -e.r);
        ctx.lineTo(e.r * 0.85, e.r * 0.85);
        ctx.lineTo(-e.r * 0.85, e.r * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (e.kind === 'boss') {
        // Apophis Shadow Guardian
        ctx.fillStyle = isFlashing ? '#FFFFFF' : '#31102F';
        ctx.strokeStyle = '#EC4899';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Serpent eye
        ctx.fillStyle = '#FDE047';
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(0, 0, 3, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D) {
    // Blink during invulnerability
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 18) % 2 === 0 && this.bastetTimer <= 0) {
      return;
    }

    ctx.save();
    // Anubis AoE ring visual
    if (this.anubisRingTimer > 0) {
      const prog = 1 - this.anubisRingTimer / 0.45;
      ctx.strokeStyle = `rgba(251, 191, 36, ${1 - prog})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(this.px, this.py, 40 + prog * 220, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Osiris renewal aura
    if (this.osirisAuraTimer > 0) {
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.px, this.py, 48, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Bastet feline shield
    if (this.bastetTimer > 0) {
      ctx.strokeStyle = '#2DD4BF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.px, this.py, this.pRadius + 9, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ra orbiting solar disks
    if (this.raOrbitTimer > 0) {
      for (let k = 0; k < 3; k++) {
        const ang = this.raOrbitAngle + (k * Math.PI * 2) / 3;
        const fx = this.px + Math.cos(ang) * 72;
        const fy = this.py + Math.sin(ang) * 72;
        ctx.fillStyle = '#FCD34D';
        ctx.beginPath();
        ctx.arc(fx, fy, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#EA580C';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Directional aim indicator
    const aimX = this.px + Math.cos(this.pFacing) * 30;
    const aimY = this.py + Math.sin(this.pFacing) * 30;
    ctx.fillStyle = 'rgba(252, 211, 77, 0.8)';
    ctx.beginPath();
    ctx.arc(aimX, aimY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Player Body
    ctx.translate(this.px, this.py);
    ctx.rotate(this.pFacing + Math.PI / 2);
    ctx.scale(this.squashX, this.squashY);

    // Mantle
    ctx.fillStyle = this.hitFlashTimer > 0 ? '#EF4444' : '#0284C7';
    ctx.strokeStyle = '#FCD34D';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.pRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Nemes Gold Headpiece
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(0, -3, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderProjectiles(ctx: CanvasRenderingContext2D) {
    for (const pr of this.projectiles) {
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FEF3C7';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  private renderPulseArcsAndBeams(ctx: CanvasRenderingContext2D) {
    for (const arc of this.pulseArcs) {
      const alpha = arc.life / arc.maxLife;
      ctx.save();
      ctx.strokeStyle = `rgba(252, 211, 77, ${alpha})`;
      ctx.lineWidth = 10 * alpha + 2;
      ctx.beginPath();
      ctx.arc(arc.x, arc.y, arc.radius * (1.05 - alpha * 0.25), arc.angle - 0.95, arc.angle + 0.95);
      ctx.stroke();
      ctx.restore();
    }

    for (const b of this.beams) {
      const alpha = b.life / b.maxLife;
      ctx.save();
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 12 * alpha + 3;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D) {
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.fillStyle = ft.color;
      ctx.font = ft.large
        ? 'bold 18px "Cinzel", serif'
        : 'bold 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}
