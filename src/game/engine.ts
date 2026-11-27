import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { soundEngine } from './audio';
import { CHAMBERS, ChamberDef, GodId, GODS, letterToHieroglyph, RelicOption } from './data';
import {
  buildTempleAndDesertScenery,
  createBossModel,
  createExplorerModel,
  createGlyphRelicModel,
  createMummyModel,
  createObeliskModel,
  createPillarModel,
  createScarabModel,
  createSpikeTrapModel,
  EnemyVisual,
  ExplorerVisual,
  GlyphVisual,
  SceneryBundle,
  TrapVisual,
} from './three/models';
import { createTextureBundle, TextureBundle } from './three/textures';

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
  facing: number;
}

interface Projectile {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  fromPlayer: boolean;
  color: number;
  life: number;
}

interface PulseArc {
  x: number;
  y: number;
  angle: number;
  radius: number;
  life: number;
  maxLife: number;
  mesh: THREE.Mesh;
}

interface BeamEffect {
  life: number;
  maxLife: number;
  mesh: THREE.Mesh;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  life: number;
  maxLife: number;
  color: number;
}

interface FloatingText {
  x: number;
  y: number;
  z: number;
  vy: number;
  life: number;
  maxLife: number;
  scaleBase: number;
  sprite: THREE.Sprite;
}

interface Afterimage {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  facing: number;
  mesh: THREE.Mesh;
}

const WORLD_W = 1200;
const WORLD_H = 720;
const WALL_PAD = 56;
const SCALE = 0.04; // 1200x720 -> 48m x 28.8m
const ARENA_W = WORLD_W * SCALE;
const ARENA_D = WORLD_H * SCALE;
const WALL_PAD_3D = WALL_PAD * SCALE;

const MAX_PARTICLES = 280;
const MAX_PROJECTILES = 56;

// Reusable scratch math objects (zero-GC inside animation loop)
const _vec3 = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3Up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _mouseNdc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.9);
const _hitPoint = new THREE.Vector3();

function to3DX(lx: number): number {
  return (lx - WORLD_W / 2) * SCALE;
}

function to3DZ(ly: number): number {
  return (ly - WORLD_H / 2) * SCALE;
}

function toLogicalX(wx: number): number {
  return wx / SCALE + WORLD_W / 2;
}

function toLogicalY(wz: number): number {
  return wz / SCALE + WORLD_H / 2;
}

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const gl =
      (probe.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (probe.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return false;
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    let rendererStr = '';
    if (debugInfo) {
      rendererStr = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
    } else {
      rendererStr = String(gl.getParameter(gl.RENDERER) || '');
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
  } catch {
    return false;
  }
}

export class PyramidGameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private envRT: THREE.WebGLRenderTarget;
  private composer: EffectComposer | null = null;
  private composerRT: THREE.WebGLRenderTarget | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private textures: TextureBundle;
  private scenery: SceneryBundle;
  private isSoftwareGl: boolean;
  private contextLost = false;

  // Lights
  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private heroLight: THREE.PointLight;
  private fog: THREE.FogExp2;

  // Loop & resize
  private rafId: number | null = null;
  private fenceTimerId: number | null = null;
  private lastTime = 0;
  private resizeObserver: ResizeObserver;

  // Game state
  private mode: GameMode = 'TITLE_MENU';
  private chamberIndex = 0;
  private score = 0;
  private orderedCombos = 0;
  private relics: RelicOption['id'][] = [];
  private activeGodId: GodId = 'bastet';
  private cameraCloseMode = false;

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
  private pointerClient: Vec2 | null = null;
  private lastAimWasMouse = false;
  private bufferedPulse = 0;
  private bufferedDash = 0;
  private bufferedPower = 0;

  // Logical entities
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

  // 3D Scene pools & visual bindings
  private explorerVisual: ExplorerVisual;
  private chamberGroup = new THREE.Group();
  private pillarMeshes: THREE.Group[] = [];
  private trapVisuals: TrapVisual[] = [];
  private glyphVisuals: GlyphVisual[] = [];
  private enemyVisuals = new Map<number, EnemyVisual>();
  private projectileMeshes: THREE.Mesh[] = [];
  private projectileGeo: THREE.SphereGeometry;
  private particleMesh: THREE.InstancedMesh;
  private particleGeo: THREE.OctahedronGeometry;
  private particleMat: THREE.MeshBasicMaterial;
  private pulseGeo: THREE.RingGeometry;
  private beamGeo: THREE.CylinderGeometry;
  private afterimageGeo: THREE.CapsuleGeometry;
  private anubisWaveMesh: THREE.Mesh;
  private osirisRingMesh: THREE.Mesh;

  // Camera & feel
  private camPos = new THREE.Vector3(0, 21.5, 29);
  private camTarget = new THREE.Vector3(0, 0.9, 6);
  private hitstopTimer = 0;
  private shakeTrauma = 0;
  private worldTime = 0;
  private lastHudPush = 0;
  private lastHudHash = '';

  // Callbacks
  private onHudUpdate: (hud: HudSnapshot) => void;
  private onChamberClear: (chamberIndex: number, score: number, combos: number) => void;
  private onVictory: (score: number, combos: number) => void;
  private onGameOver: (score: number, chamberIndex: number, combos: number) => void;
  private onPauseToggle: () => void;
  private onWebGLContextLost?: () => void;

  constructor(
    container: HTMLElement,
    callbacks: {
      onHudUpdate: (hud: HudSnapshot) => void;
      onChamberClear: (chamberIndex: number, score: number, combos: number) => void;
      onVictory: (score: number, combos: number) => void;
      onGameOver: (score: number, chamberIndex: number, combos: number) => void;
      onPauseToggle: () => void;
      onWebGLContextLost?: () => void;
    }
  ) {
    this.container = container;
    this.onHudUpdate = callbacks.onHudUpdate;
    this.onChamberClear = callbacks.onChamberClear;
    this.onVictory = callbacks.onVictory;
    this.onGameOver = callbacks.onGameOver;
    this.onPauseToggle = callbacks.onPauseToggle;
    this.onWebGLContextLost = callbacks.onWebGLContextLost;

    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    // Clear mount container cleanly
    this.container.replaceChildren(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0x130d07, 0.011);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x130d07);

    // Studio IBL reflections on all devices (ensures gold/obsidian PBR readability)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);

    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.5, 280);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);

    // 3-Point Lighting
    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0xb45309, 0.72);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.keyLight.position.set(16, 28, 18);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 90;
    this.keyLight.shadow.camera.left = -28;
    this.keyLight.shadow.camera.right = 28;
    this.keyLight.shadow.camera.top = 22;
    this.keyLight.shadow.camera.bottom = -22;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0xf59e0b, 0.95);
    this.rimLight.position.set(-14, 14, -22);
    this.scene.add(this.rimLight);

    // Procedural Textures & Scenery
    const anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.textures = createTextureBundle(anisotropy);
    this.scenery = buildTempleAndDesertScenery(this.textures, ARENA_W, ARENA_D, WALL_PAD_3D);
    this.scene.add(this.scenery.group);
    this.scene.add(this.chamberGroup);

    // Hero Explorer
    this.explorerVisual = createExplorerModel(this.textures);
    this.explorerVisual.group.position.set(to3DX(this.px), 0, to3DZ(this.py));
    this.scene.add(this.explorerVisual.group);

    this.heroLight = new THREE.PointLight(0xfbbf24, 1.35, 11, 1.5);
    this.heroLight.position.set(0, 2.2, 0.4);
    this.explorerVisual.group.add(this.heroLight);

    // God shockwave / aura rings
    this.anubisWaveMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.25, 40),
      new THREE.MeshBasicMaterial({
        color: 0xfcd34d,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.anubisWaveMesh.rotation.x = -Math.PI / 2;
    this.anubisWaveMesh.position.y = 0.25;
    this.anubisWaveMesh.visible = false;
    this.scene.add(this.anubisWaveMesh);

    this.osirisRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(2.1, 2.35, 36),
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.osirisRingMesh.rotation.x = -Math.PI / 2;
    this.osirisRingMesh.position.y = 0.09;
    this.osirisRingMesh.visible = false;
    this.explorerVisual.group.add(this.osirisRingMesh);

    // Shared effect geometries
    this.pulseGeo = new THREE.RingGeometry(0.45, 1.0, 28, 1, -1.05, 2.1);
    this.beamGeo = new THREE.CylinderGeometry(0.24, 0.24, 1, 10);
    this.beamGeo.rotateX(Math.PI / 2);
    this.afterimageGeo = new THREE.CapsuleGeometry(0.32, 0.9, 4, 8);

    // Pooled Projectiles
    this.projectileGeo = new THREE.SphereGeometry(0.32, 12, 10);
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      this.projectiles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        r: 8,
        fromPlayer: false,
        color: 0xf97316,
        life: 0,
      });
      const mat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xf97316,
        emissiveIntensity: 1.8,
        roughness: 0.2,
      });
      const mesh = new THREE.Mesh(this.projectileGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectileMeshes.push(mesh);
    }

    // Pooled InstancedMesh Particles
    this.particleGeo = new THREE.OctahedronGeometry(0.14, 0);
    this.particleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
    });
    this.particleMesh = new THREE.InstancedMesh(this.particleGeo, this.particleMat, MAX_PARTICLES);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 1,
        life: 0,
        maxLife: 1,
        color: 0xfcd34d,
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.set(0, 0, 0);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      _color.setHex(0xfcd34d);
      this.particleMesh.setColorAt(i, _color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
    this.scene.add(this.particleMesh);

    if (!this.isSoftwareGl) {
      const pixelRatio = this.renderer.getPixelRatio();
      this.composerRT = new THREE.WebGLRenderTarget(
        Math.max(1, Math.floor(width * pixelRatio)),
        Math.max(1, Math.floor(height * pixelRatio)),
        {
          type: THREE.HalfFloatType,
          samples: 4,
        }
      );
      this.composer = new EffectComposer(this.renderer, this.composerRT);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.34, 0.52, 0.92);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
      this.renderer.compile(this.scene, this.camera);
    }

    // ResizeObserver for crisp viewport scaling
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    this.bindEvents();
    this.applyChamberAtmosphere(0);
    this.startLoop();
  }

  private handleResize = () => {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
  };

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    this.renderer.domElement.addEventListener('mousemove', this.handleMouseMove);
    this.renderer.domElement.addEventListener('mousedown', this.handleMouseDown);
    this.renderer.domElement.addEventListener('contextmenu', this.handleContextMenu);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
    this.onWebGLContextLost?.();
  };

  private handleContextRestored = () => {
    this.contextLost = false;
  };

  public destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.fenceTimerId !== null) window.clearTimeout(this.fenceTimerId);
    this.resizeObserver.disconnect();

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.renderer.domElement.removeEventListener('mousemove', this.handleMouseMove);
    this.renderer.domElement.removeEventListener('mousedown', this.handleMouseDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.handleContextMenu);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.clearChamberVisuals();
    this.explorerVisual.dispose();
    this.scenery.dispose();
    this.textures.dispose();

    this.projectileGeo.dispose();
    for (const m of this.projectileMeshes) {
      (m.material as THREE.Material).dispose();
    }
    this.particleGeo.dispose();
    this.particleMat.dispose();
    this.pulseGeo.dispose();
    this.beamGeo.dispose();
    this.afterimageGeo.dispose();
    (this.anubisWaveMesh.geometry as THREE.BufferGeometry).dispose();
    (this.anubisWaveMesh.material as THREE.Material).dispose();
    (this.osirisRingMesh.geometry as THREE.BufferGeometry).dispose();
    (this.osirisRingMesh.material as THREE.Material).dispose();

    for (const arc of this.pulseArcs) {
      (arc.mesh.material as THREE.Material).dispose();
      this.scene.remove(arc.mesh);
    }
    for (const b of this.beams) {
      (b.mesh.material as THREE.Material).dispose();
      this.scene.remove(b.mesh);
    }
    for (const ai of this.afterimages) {
      (ai.mesh.material as THREE.Material).dispose();
      this.scene.remove(ai.mesh);
    }
    for (const ft of this.floatingTexts) {
      (ft.sprite.material as THREE.Material).dispose();
      this.scene.remove(ft.sprite);
    }

    this.composer?.dispose();
    this.composerRT?.dispose();
    this.envRT.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
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

  private raycastPointerToLogical(clientX: number, clientY: number): Vec2 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    _mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _mouseNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_mouseNdc, this.camera);
    if (_raycaster.ray.intersectPlane(_aimPlane, _hitPoint)) {
      return {
        x: toLogicalX(_hitPoint.x),
        y: toLogicalY(_hitPoint.z),
      };
    }
    return null;
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (this.mode !== 'PLAYING') return;
    this.pointerClient = { x: e.clientX, y: e.clientY };
    this.lastAimWasMouse = true;
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (this.mode !== 'PLAYING') return;
    this.pointerClient = { x: e.clientX, y: e.clientY };
    this.lastAimWasMouse = true;
    const hit = this.raycastPointerToLogical(e.clientX, e.clientY);
    if (hit) {
      const dx = hit.x - this.px;
      const dy = hit.y - this.py;
      if (dx !== 0 || dy !== 0) {
        this.pFacing = Math.atan2(dy, dx);
      }
    }
    if (e.button === 0) {
      this.bufferedPulse = 0.14;
    } else if (e.button === 2) {
      this.bufferedDash = 0.14;
    }
  };

  private handleKeyDown = (e: KeyboardEvent) => {
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
    } else if (code === 'KeyV') {
      this.cameraCloseMode = !this.cameraCloseMode;
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

  public toggleCameraView() {
    this.cameraCloseMode = !this.cameraCloseMode;
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

  private applyChamberAtmosphere(idx: number) {
    const def = CHAMBERS[idx];
    const god = GODS[def.godId];
    this.rimLight.color.set(god.secondaryColor);

    const chamberFogColors = [0x26170c, 0x171426, 0x0d211d, 0x0e1a2b, 0x2b1507];
    const zenithColors = [0x090b1a, 0x080716, 0x051214, 0x060d1c, 0x140804];
    const glowColors = [0xd97706, 0x6366f1, 0x10b981, 0x38bdf8, 0xf59e0b];

    const fogHex = chamberFogColors[idx] ?? 0x26170c;
    this.fog.color.setHex(fogHex);
    (this.scene.background as THREE.Color).setHex(fogHex);

    this.scenery.skyUniforms.uZenithColor.value.setHex(zenithColors[idx] ?? 0x090b1a);
    this.scenery.skyUniforms.uHorizonColor.value.setHex(fogHex);
    this.scenery.skyUniforms.uGlowColor.value.setHex(glowColors[idx] ?? 0xd97706);

    const floorTints = [0xd4a66a, 0xb59eb5, 0x8cc0af, 0x9bb5cf, 0xdca55c];
    this.scenery.floorMat.color.setHex(floorTints[idx] ?? 0xd4a66a);
  }

  private clearChamberVisuals() {
    for (const pm of this.pillarMeshes) {
      pm.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) m.dispose();
        }
      });
      this.chamberGroup.remove(pm);
    }
    this.pillarMeshes = [];

    for (const tv of this.trapVisuals) {
      tv.dispose();
      this.chamberGroup.remove(tv.group);
    }
    this.trapVisuals = [];

    for (const gv of this.glyphVisuals) {
      gv.dispose();
      this.chamberGroup.remove(gv.group);
    }
    this.glyphVisuals = [];

    this.enemyVisuals.forEach((ev) => {
      ev.dispose();
      this.chamberGroup.remove(ev.group);
    });
    this.enemyVisuals.clear();

    for (const pr of this.projectiles) pr.active = false;
    for (const m of this.projectileMeshes) m.visible = false;

    for (const arc of this.pulseArcs) {
      (arc.mesh.material as THREE.Material).dispose();
      this.scene.remove(arc.mesh);
    }
    this.pulseArcs = [];

    for (const b of this.beams) {
      (b.mesh.material as THREE.Material).dispose();
      this.scene.remove(b.mesh);
    }
    this.beams = [];

    for (const ai of this.afterimages) {
      (ai.mesh.material as THREE.Material).dispose();
      this.scene.remove(ai.mesh);
    }
    this.afterimages = [];

    for (const ft of this.floatingTexts) {
      (ft.sprite.material as THREE.Material).dispose();
      this.scene.remove(ft.sprite);
    }
    this.floatingTexts = [];
  }

  private loadChamber(idx: number) {
    this.clearChamberVisuals();
    this.applyChamberAtmosphere(idx);

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
    this.enemies = [];

    // Snap camera smoothly behind spawn
    this.camPos.set(to3DX(this.px), 20, to3DZ(this.py) + 18);
    this.camTarget.set(to3DX(this.px), 0.9, to3DZ(this.py) - 2);

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
    for (const p of this.pillars) {
      const pm = createPillarModel(this.textures, p.r * SCALE);
      pm.position.set(to3DX(p.x), 0, to3DZ(p.y));
      this.chamberGroup.add(pm);
      this.pillarMeshes.push(pm);
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
      const trap: SpikeTrap = {
        x: slot.x,
        y: slot.y,
        w: 64,
        h: 64,
        cycleTimer: i * 0.65,
        period: 2.5,
        state: 'idle',
      };
      this.traps.push(trap);
      const tv = createSpikeTrapModel(this.textures, trap.w * SCALE);
      tv.group.position.set(to3DX(trap.x + trap.w / 2), 0, to3DZ(trap.y + trap.h / 2));
      this.chamberGroup.add(tv.group);
      this.trapVisuals.push(tv);
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
    const rotated = candidateSpots
      .slice(idx % candidateSpots.length)
      .concat(candidateSpots.slice(0, idx % candidateSpots.length));
    for (let i = 0; i < def.word.length; i++) {
      const spot = rotated[i % rotated.length];
      const ch = def.word[i];
      const glyphChar = letterToHieroglyph(ch);
      this.glyphs.push({
        index: i,
        letter: ch,
        glyph: glyphChar,
        x: spot.x,
        y: spot.y,
        collected: false,
        bobPhase: i * 1.1,
      });
      const gv = createGlyphRelicModel(this.textures, glyphChar, ch);
      gv.group.position.set(to3DX(spot.x), 0, to3DZ(spot.y));
      this.chamberGroup.add(gv.group);
      this.glyphVisuals.push(gv);
    }

    // Spawn Enemies
    for (let i = 0; i < def.scarabCount; i++) {
      const sx = 140 + ((i * 190) % (WORLD_W - 280));
      const sy = 115 + ((i * 85) % 240);
      this.spawnEnemy('scarab', sx, sy, idx);
    }
    for (let i = 0; i < def.mummyCount; i++) {
      const mx = i % 2 === 0 ? 210 : WORLD_W - 210;
      const my = 165 + Math.floor(i / 2) * 165;
      this.spawnEnemy('mummy', mx, my, idx);
    }
    const obeliskPositions: Vec2[] = [
      { x: 155, y: 265 },
      { x: WORLD_W - 155, y: 265 },
      { x: WORLD_W / 2 - 215, y: 145 },
      { x: WORLD_W / 2 + 215, y: 145 },
    ];
    for (let i = 0; i < def.obeliskCount; i++) {
      const slot = obeliskPositions[i % obeliskPositions.length];
      this.spawnEnemy('obelisk', slot.x, slot.y, idx);
    }
    if (def.hasBoss) {
      this.spawnEnemy('boss', WORLD_W / 2, 220, idx);
    }
  }

  private spawnEnemy(kind: Enemy['kind'], x: number, y: number, idx: number) {
    const id = this.nextEnemyId++;
    let enemy: Enemy;
    let visual: EnemyVisual;

    if (kind === 'scarab') {
      const scarabHp = 2 + Math.floor(idx / 3);
      enemy = {
        id,
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
        facing: Math.PI / 2,
      };
      visual = createScarabModel(this.textures);
    } else if (kind === 'mummy') {
      const mummyHp = 5 + Math.floor(idx / 2);
      enemy = {
        id,
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
        facing: Math.PI / 2,
      };
      visual = createMummyModel(this.textures);
    } else if (kind === 'obelisk') {
      const obeliskHp = 6 + Math.floor(idx / 2);
      enemy = {
        id,
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
        facing: 0,
      };
      visual = createObeliskModel(this.textures);
    } else {
      enemy = {
        id,
        kind: 'boss',
        x,
        y,
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
        facing: Math.PI / 2,
      };
      visual = createBossModel(this.textures);
    }

    visual.group.position.set(to3DX(x), 0, to3DZ(y));
    this.chamberGroup.add(visual.group);
    this.enemies.push(enemy);
    this.enemyVisuals.set(id, visual);
  }

  private spawnProjectile(
    x: number,
    y: number,
    vx: number,
    vy: number,
    r: number,
    fromPlayer: boolean,
    colorHex: number,
    life: number
  ) {
    for (let i = 0; i < this.projectiles.length; i++) {
      const pr = this.projectiles[i];
      if (!pr.active) {
        pr.active = true;
        pr.x = x;
        pr.y = y;
        pr.vx = vx;
        pr.vy = vy;
        pr.r = r;
        pr.fromPlayer = fromPlayer;
        pr.color = colorHex;
        pr.life = life;

        const mesh = this.projectileMeshes[i];
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.setHex(colorHex);
        mat.emissive.setHex(colorHex);
        mesh.scale.setScalar((r * SCALE) / 0.32);
        mesh.position.set(to3DX(x), 0.95, to3DZ(y));
        mesh.visible = true;
        return;
      }
    }
  }

  private spawnParticles(lx: number, ly: number, colorHex: number, count: number, speed = 150, yStart = 0.85) {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        const ang = Math.random() * Math.PI * 2;
        const spd = speed * SCALE * (0.35 + Math.random() * 0.75);
        p.active = true;
        p.x = to3DX(lx);
        p.y = yStart + Math.random() * 0.4;
        p.z = to3DZ(ly);
        p.vx = Math.cos(ang) * spd;
        p.vy = 1.4 + Math.random() * 3.8;
        p.vz = Math.sin(ang) * spd;
        p.size = 0.65 + Math.random() * 1.15;
        p.maxLife = 0.32 + Math.random() * 0.36;
        p.life = p.maxLife;
        p.color = colorHex;
        spawned++;
      }
    }
  }

  private addBeam(x1: number, y1: number, x2: number, y2: number, colorHex: number, life: number) {
    const startX = to3DX(x1);
    const startZ = to3DZ(y1);
    const endX = to3DX(x2);
    const endZ = to3DZ(y2);
    const dx = endX - startX;
    const dz = endZ - startZ;
    const len = Math.max(0.1, Math.hypot(dx, dz));

    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.beamGeo, mat);
    mesh.position.set((startX + endX) / 2, 1.15, (startZ + endZ) / 2);
    mesh.scale.set(1, 1, len);
    mesh.rotation.y = Math.atan2(dx, dz);
    this.scene.add(mesh);
    this.beams.push({ life, maxLife: life, mesh });
  }

  private addFloatingText(lx: number, ly: number, text: string, colorCss: string, large = false) {
    const tex = this.textures.getPopupTexture(text, colorCss);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    const scaleBase = large ? 4.4 : 3.2;
    sprite.scale.set(scaleBase, scaleBase * 0.25, 1);
    sprite.position.set(to3DX(lx), 2.55, to3DZ(ly));
    this.scene.add(sprite);
    this.floatingTexts.push({
      x: to3DX(lx),
      y: 2.55,
      z: to3DZ(ly),
      vy: 1.9,
      life: 0.95,
      maxLife: 0.95,
      scaleBase,
      sprite,
    });
  }

  // GPU vs Software-WebGL Pacing Loop
  private afterDraw(fn: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.fenceTimerId = window.setTimeout(fn, 16);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      this.fenceTimerId = window.setTimeout(fn, 16);
      return;
    }
    gl.flush();
    const start = performance.now();
    const poll = () => {
      if (this.contextLost) return;
      const signaled = gl.getSyncParameter(sync, gl.SYNC_STATUS) === gl.SIGNALED;
      if (signaled || performance.now() - start > 80) {
        gl.deleteSync(sync);
        fn();
      } else {
        this.fenceTimerId = window.setTimeout(poll, 4);
      }
    };
    this.fenceTimerId = window.setTimeout(poll, 4);
  }

  private startLoop() {
    this.lastTime = performance.now();
    const tick = () => {
      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      this.update(dt, now);
      if (!this.contextLost) {
        if (this.composer && !this.isSoftwareGl) {
          this.composer.render();
        } else {
          this.renderer.render(this.scene, this.camera);
        }
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.rafId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.rafId = requestAnimationFrame(tick);
    }
  }

  private update(dt: number, nowMs: number) {
    this.worldTime += dt;

    // Animate Nile oasis water normal ripples & desert breeze palm fronds
    this.textures.waterNormal.offset.x = (this.textures.waterNormal.offset.x + dt * 0.032) % 1;
    this.textures.waterNormal.offset.y = (this.textures.waterNormal.offset.y + dt * 0.085) % 1;

    for (let i = 0; i < this.scenery.palmCrowns.length; i++) {
      const crown = this.scenery.palmCrowns[i];
      crown.rotation.z = Math.sin(this.worldTime * 1.4 + i * 1.3) * 0.055;
      crown.rotation.x = Math.cos(this.worldTime * 1.1 + i) * 0.04;
    }

    // Animate flickering torch braziers & real fire PointLights
    for (let i = 0; i < this.scenery.braziers.length; i++) {
      const b = this.scenery.braziers[i];
      const f = 0.88 + Math.sin(this.worldTime * 11 + i * 1.9) * 0.16 + Math.cos(this.worldTime * 17 + i) * 0.08;
      b.flameOuter.scale.set(0.95 + (f - 1) * 0.3, f, 0.95 + (f - 1) * 0.3);
      b.flameInner.scale.set(1, 0.9 + (f - 0.85) * 0.4, 1);
      b.emberMat.emissiveIntensity = 1.9 + f * 0.7;
      if (b.fireLight) {
        b.fireLight.intensity = 3.2 + f * 1.4;
      }
    }
    this.scenery.starField.rotation.y += dt * 0.008;
    this.scenery.dustField.rotation.y += dt * 0.018;
    this.scenery.dustField.position.y = Math.sin(this.worldTime * 0.7) * 0.25;

    // Title Menu sweeping monumental temple flyby
    if (this.mode === 'TITLE_MENU') {
      const orbitAng = this.worldTime * 0.18;
      this.camPos.set(Math.sin(orbitAng) * 26, 13.5 + Math.sin(this.worldTime * 0.4) * 1.6, Math.cos(orbitAng) * 24 + 4);
      this.camTarget.set(0, 2.2, -5);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camTarget);
      this.explorerVisual.group.position.set(0, 0, 10.5);
      this.explorerVisual.group.rotation.y = Math.PI;
      this.explorerVisual.scepterCrystal.rotation.y = this.worldTime * 2.2;
      this.explorerVisual.cape.rotation.x = 0.22 + Math.sin(this.worldTime * 2.4) * 0.05;
      this.updateParticlesAndVisualFx(dt);
      return;
    }

    if (this.mode !== 'PLAYING') {
      this.updateCamera(dt);
      return;
    }

    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.8);

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.updateCamera(dt);
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

    if (this.lastAimWasMouse && this.pointerClient) {
      const hit = this.raycastPointerToLogical(this.pointerClient.x, this.pointerClient.y);
      if (hit) {
        this.pFacing = Math.atan2(hit.y - this.py, hit.x - this.px);
      }
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
      this.spawnParticles(this.px, this.py, 0xfcd34d, 12, 140);
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
      this.spawnAfterimage();
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
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          if (Math.hypot(e.x - fx, e.y - fy) < e.r + 16 && e.hitFlash <= 0) {
            this.damageEnemy(e, 2, (e.x - this.px) * 2, (e.y - this.py) * 2);
          }
        }
      }
    }

    // Update Traps & 3D Spike Elevation
    for (let i = 0; i < this.traps.length; i++) {
      const trap = this.traps[i];
      const tv = this.trapVisuals[i];
      trap.cycleTimer = (trap.cycleTimer + dt) % trap.period;
      if (trap.cycleTimer < 1.15) trap.state = 'idle';
      else if (trap.cycleTimer < 1.75) trap.state = 'warning';
      else trap.state = 'active';

      const targetSpikeY = trap.state === 'active' ? 0.05 : trap.state === 'warning' ? -0.45 : -0.72;
      tv.spikesGroup.position.y += (targetSpikeY - tv.spikesGroup.position.y) * Math.min(1, dt * 22);
      if (trap.state === 'warning') {
        const blink = 0.5 + 0.5 * Math.sin(this.worldTime * 28);
        tv.warningMat.color.setHex(0xf59e0b);
        tv.warningMat.emissive.setHex(0xf59e0b);
        tv.warningMat.emissiveIntensity = 0.6 + blink * 1.4;
      } else if (trap.state === 'active') {
        tv.warningMat.color.setHex(0xef4444);
        tv.warningMat.emissive.setHex(0xdc2626);
        tv.warningMat.emissiveIntensity = 1.6;
      } else {
        tv.warningMat.color.setHex(0x78350f);
        tv.warningMat.emissive.setHex(0x451a03);
        tv.warningMat.emissiveIntensity = 0.2;
      }

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
    for (let i = 0; i < this.glyphs.length; i++) {
      const g = this.glyphs[i];
      const gv = this.glyphVisuals[i];
      if (g.collected) {
        gv.group.visible = false;
        continue;
      }
      gv.group.visible = true;
      g.bobPhase += dt * 3;
      const isNext = g.index === nextExpectedIdx;

      gv.stelePivot.position.y = 1.25 + Math.sin(g.bobPhase) * 0.16;
      gv.stelePivot.rotation.y += dt * (isNext ? 1.85 : 0.95);
      gv.ringMat.color.setHex(isNext ? 0xfbbf24 : 0x38bdf8);
      gv.ringMat.opacity = isNext ? 0.75 + Math.sin(this.worldTime * 7) * 0.2 : 0.45;
      gv.steleMat.emissiveIntensity = isNext ? 0.9 : 0.25;

      const faceTex = this.textures.getGlyphFaceTexture(g.glyph, g.letter, isNext);
      const faceMat = gv.frontFace.material as THREE.MeshBasicMaterial;
      if (faceMat.map !== faceTex) {
        faceMat.map = faceTex;
        faceMat.needsUpdate = true;
      }

      if (Math.hypot(this.px - g.x, this.py - g.y) < this.pRadius + 24) {
        g.collected = true;
        gv.group.visible = false;
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
        this.spawnParticles(g.x, g.y, isOrdered ? 0xfcd34d : 0x38bdf8, 20, 180, 1.2);
        this.addFloatingText(
          g.x,
          g.y - 16,
          isOrdered ? `${g.glyph} +150 MA'AT` : `${g.glyph} +75`,
          isOrdered ? '#FDE68A' : '#7DD3FC',
          isOrdered
        );

        const boss = this.enemies.find((e) => e.kind === 'boss');
        if (boss) {
          this.addBeam(g.x, g.y, boss.x, boss.y, 0xfcd34d, 0.3);
          this.damageEnemy(boss, 3, 0, 0);
        }

        if (collectedCount === this.glyphs.length) {
          this.checkPortalActivation();
        }
      }
    }

    if (!this.portalOpen && this.glyphs.every((g) => g.collected)) {
      this.checkPortalActivation();
    }

    // Update Portal visual state
    const portal = this.scenery.portal;
    if (this.portalOpen) {
      this.portalPulse += dt * 3;
      portal.vortexDisc.rotation.z += dt * 2.2;
      portal.vortexMat.color.setHex(0xfde047);
      portal.vortexMat.opacity = 0.72 + Math.sin(this.portalPulse * 2) * 0.18;
      portal.ringMat.color.setHex(0xf59e0b);
      portal.ringMat.emissive.setHex(0xf59e0b);
      portal.ringMat.emissiveIntensity = 1.6;
      portal.portalLight.intensity = 4.2 + Math.sin(this.portalPulse * 3) * 0.8;

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
    } else {
      portal.vortexDisc.rotation.z += dt * 0.4;
      portal.vortexMat.color.setHex(0x38bdf8);
      portal.vortexMat.opacity = 0.14;
      portal.ringMat.color.setHex(0x475569);
      portal.ringMat.emissive.setHex(0x1e293b);
      portal.ringMat.emissiveIntensity = 0.3;
      portal.portalLight.intensity = 1.1;
    }

    // Update Enemies & sync 3D models
    this.updateEnemies(dt);

    // Update Projectiles
    for (let i = 0; i < this.projectiles.length; i++) {
      const pr = this.projectiles[i];
      if (!pr.active) continue;

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
            this.spawnParticles(pr.x, pr.y, pr.color, 6, 85);
            break;
          }
        }
      }

      if (!remove && !pr.fromPlayer) {
        if (Math.hypot(pr.x - this.px, pr.y - this.py) < pr.r + this.pRadius - 2) {
          if (this.bastetTimer > 0) {
            remove = true;
            this.spawnParticles(pr.x, pr.y, 0x2dd4bf, 8, 120);
          } else {
            remove = true;
            this.hurtPlayer(1);
          }
        }
      } else if (!remove && pr.fromPlayer) {
        for (let k = this.enemies.length - 1; k >= 0; k--) {
          const e = this.enemies[k];
          if (Math.hypot(pr.x - e.x, pr.y - e.y) < pr.r + e.r) {
            this.damageEnemy(e, 2, pr.vx * 0.4, pr.vy * 0.4);
            remove = true;
            break;
          }
        }
      }

      const mesh = this.projectileMeshes[i];
      if (remove) {
        pr.active = false;
        mesh.visible = false;
      } else {
        mesh.position.set(to3DX(pr.x), 0.95 + Math.sin(this.worldTime * 12 + i) * 0.08, to3DZ(pr.y));
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.setHex(pr.color);
        mat.emissive.setHex(pr.color);
      }
    }

    this.syncExplorerVisual(dt);
    this.updateParticlesAndVisualFx(dt);
    this.updateCamera(dt);

    if (nowMs - this.lastHudPush > 75) {
      this.lastHudPush = nowMs;
      this.pushHud(false);
    }
  }

  private syncExplorerVisual(dt: number) {
    const ev = this.explorerVisual;
    ev.group.position.set(to3DX(this.px), 0, to3DZ(this.py));

    // Yaw: logical (cos(pFacing), sin(pFacing)) -> 3D (sin(yaw), cos(yaw)) => yaw = PI/2 - pFacing
    const targetYaw = Math.PI / 2 - this.pFacing;
    ev.group.rotation.y = targetYaw;

    // Squash & stretch
    ev.bodyPivot.scale.set(this.squashX, this.squashY, this.squashX);

    // Walk / run limb gait
    const speedMag = Math.hypot(this.pvx, this.pvy);
    const moveFactor = Math.min(1, speedMag / 220);
    const swing = Math.sin(this.worldTime * 15) * 0.58 * moveFactor;
    ev.leftLeg.rotation.x = swing;
    ev.rightLeg.rotation.x = -swing;
    ev.leftArm.rotation.x = -swing * 0.75;
    ev.rightArm.rotation.x = swing * 0.45 + (this.pulseCooldown > 0.2 ? -0.9 : 0);
    ev.cape.rotation.x =
      0.2 + moveFactor * 0.48 + (this.dashTimer > 0 ? 0.35 : 0) + Math.sin(this.worldTime * 8) * 0.05;
    ev.scepterCrystal.rotation.y += dt * 3.2;

    // Hit flash / invulnerability blink
    const flashing = this.hitFlashTimer > 0;
    for (const mat of ev.hitFlashMaterials) {
      mat.emissive.setHex(flashing ? 0xef4444 : mat === ev.hitFlashMaterials[2] ? 0x451a03 : 0x000000);
      mat.emissiveIntensity = flashing ? 1.4 : mat === ev.hitFlashMaterials[2] ? 0.25 : 0;
    }

    // Bastet Shield
    ev.bastetShield.visible = this.bastetTimer > 0;
    if (this.bastetTimer > 0) {
      ev.bastetShield.rotation.y += dt * 2.5;
      const pulse = 1 + Math.sin(this.worldTime * 10) * 0.05;
      ev.bastetShield.scale.setScalar(pulse);
    }

    // Osiris Healing Ring
    this.osirisRingMesh.visible = this.osirisAuraTimer > 0;
    if (this.osirisAuraTimer > 0) {
      this.osirisRingMesh.rotation.z += dt * 2;
    }

    // Anubis expanding shockwave
    if (this.anubisRingTimer > 0) {
      this.anubisWaveMesh.visible = true;
      const p = 1 - this.anubisRingTimer / 0.45;
      this.anubisWaveMesh.position.set(to3DX(this.px), 0.35, to3DZ(this.py));
      this.anubisWaveMesh.scale.setScalar(1 + p * 9.5);
      (this.anubisWaveMesh.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.85;
    } else {
      this.anubisWaveMesh.visible = false;
    }

    // Ra 3 orbiting solar disks
    for (let k = 0; k < 3; k++) {
      const flare = ev.raFlares[k];
      if (this.raOrbitTimer > 0) {
        flare.visible = true;
        // Convert world orbit angle into local coords relative to ev.group.rotation.y
        const worldAng = this.raOrbitAngle + (k * Math.PI * 2) / 3;
        const r3d = 72 * SCALE;
        const wx = Math.cos(worldAng) * r3d;
        const wz = Math.sin(worldAng) * r3d;
        const cosY = Math.cos(-ev.group.rotation.y);
        const sinY = Math.sin(-ev.group.rotation.y);
        flare.position.set(wx * cosY - wz * sinY, 1.15, wx * sinY + wz * cosY);
        flare.rotation.y += dt * 5;
        flare.rotation.x += dt * 3;
      } else {
        flare.visible = false;
      }
    }
  }

  private updateCamera(dt: number) {
    const px3 = to3DX(this.px);
    const pz3 = to3DZ(this.py);
    const lookAheadX = Math.cos(this.pFacing) * 1.4;
    const lookAheadZ = Math.sin(this.pFacing) * 1.4;

    const camHeight = this.cameraCloseMode ? 12.8 : 21.5;
    const camBack = this.cameraCloseMode ? 14.5 : 19.8;

    _vec3.set(px3 * 0.72 + lookAheadX * 0.6, camHeight, pz3 + camBack);
    _vec3B.set(px3 * 0.85 + lookAheadX, 0.9, pz3 - 1.2 + lookAheadZ * 0.7);

    const smooth = 1 - Math.exp(-8.5 * dt);
    this.camPos.lerp(_vec3, smooth);
    this.camTarget.lerp(_vec3B, smooth);

    // Subtle FOV punch during Sand Dash
    const targetFov = this.dashTimer > 0 ? 51 : 46;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 14);
      this.camera.updateProjectionMatrix();
    }

    this.camera.position.copy(this.camPos);
    if (this.shakeTrauma > 0.001) {
      const mag = this.shakeTrauma * this.shakeTrauma * 0.65;
      this.camera.position.x += (Math.random() * 2 - 1) * mag;
      this.camera.position.y += (Math.random() * 2 - 1) * mag * 0.6;
      this.camera.position.z += (Math.random() * 2 - 1) * mag;
    }
    this.camera.lookAt(this.camTarget);
  }

  private spawnAfterimage() {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.afterimageGeo, mat);
    mesh.position.set(to3DX(this.px), 0.9, to3DZ(this.py));
    mesh.rotation.y = Math.PI / 2 - this.pFacing;
    this.scene.add(mesh);
    this.afterimages.push({
      x: this.px,
      y: this.py,
      life: 0.18,
      maxLife: 0.18,
      facing: this.pFacing,
      mesh,
    });
  }

  private updateParticlesAndVisualFx(dt: number) {
    // Pulse Arcs
    for (let i = this.pulseArcs.length - 1; i >= 0; i--) {
      const arc = this.pulseArcs[i];
      arc.life -= dt;
      if (arc.life <= 0) {
        (arc.mesh.material as THREE.Material).dispose();
        this.scene.remove(arc.mesh);
        this.pulseArcs.splice(i, 1);
      } else {
        const progress = 1 - arc.life / arc.maxLife;
        const s = arc.radius * SCALE * (0.45 + progress * 0.68);
        arc.mesh.scale.set(s, s, 1);
        (arc.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.85;
      }
    }

    // Beams
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      if (b.life <= 0) {
        (b.mesh.material as THREE.Material).dispose();
        this.scene.remove(b.mesh);
        this.beams.splice(i, 1);
      } else {
        (b.mesh.material as THREE.MeshBasicMaterial).opacity = b.life / b.maxLife;
      }
    }

    // Afterimages
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const ai = this.afterimages[i];
      ai.life -= dt;
      if (ai.life <= 0) {
        (ai.mesh.material as THREE.Material).dispose();
        this.scene.remove(ai.mesh);
        this.afterimages.splice(i, 1);
      } else {
        (ai.mesh.material as THREE.MeshBasicMaterial).opacity = (ai.life / ai.maxLife) * 0.45;
      }
    }

    // InstancedMesh 3D Particles
    let anyParticles = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyParticles = true;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 9.8 * dt;
      p.vx *= 0.94;
      p.vz *= 0.94;
      if (p.y < 0.08) {
        p.y = 0.08;
        p.vy *= -0.4;
      }
      p.life -= dt;

      if (p.life <= 0) {
        p.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.set(0, 0, 0);
      } else {
        const s = p.size * (p.life / p.maxLife);
        _dummy.position.set(p.x, p.y, p.z);
        _dummy.rotation.set(this.worldTime * 4 + i, this.worldTime * 3 + i, 0);
        _dummy.scale.set(s, s, s);
        _color.setHex(p.color);
        this.particleMesh.setColorAt(i, _color);
      }
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
    }
    if (anyParticles) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) {
        this.particleMesh.instanceColor.needsUpdate = true;
      }
    }

    // Floating Text Sprites
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) {
        (ft.sprite.material as THREE.Material).dispose();
        this.scene.remove(ft.sprite);
        this.floatingTexts.splice(i, 1);
      } else {
        ft.sprite.position.set(ft.x, ft.y, ft.z);
        (ft.sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, (ft.life / ft.maxLife) * 1.4);
      }
    }
  }

  private checkPortalActivation() {
    const bossAlive = this.enemies.some((e) => e.kind === 'boss');
    if (!bossAlive && !this.portalOpen) {
      this.portalOpen = true;
      soundEngine.playPortalOpen();
      this.spawnParticles(WORLD_W / 2, 84, 0xfcd34d, 32, 220, 1.5);
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.35);
      this.pushHud(true);
    }
  }

  private performSolarPulse() {
    this.pulseCooldown = 0.38;
    const rangeMult = 1 + this.countRelic('pulse_range') * 0.25;
    const radius = 108 * rangeMult;
    const coneHalfAngle = 1.05;

    this.squashX = 1.24;
    this.squashY = 0.8;
    soundEngine.playPulse();

    const mat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.pulseGeo, mat);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = -this.pFacing;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(to3DX(this.px), 0.72, to3DZ(this.py));
    this.scene.add(mesh);

    this.pulseArcs.push({
      x: this.px,
      y: this.py,
      angle: this.pFacing,
      radius,
      life: 0.22,
      maxLife: 0.22,
      mesh,
    });

    this.spawnParticles(
      this.px + Math.cos(this.pFacing) * 44,
      this.py + Math.sin(this.pFacing) * 44,
      0xfbbf24,
      12,
      165
    );

    let landedHit = false;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dx = e.x - this.px;
      const dy = e.y - this.py;
      const dist = Math.hypot(dx, dy);
      if (dist <= radius + e.r) {
        const angToEnemy = Math.atan2(dy, dx);
        const diff = Math.abs(
          Math.atan2(Math.sin(angToEnemy - this.pFacing), Math.cos(angToEnemy - this.pFacing))
        );
        if (diff <= coneHalfAngle || dist < 44) {
          const dmg = this.hasRelic('pulse_range') ? 3 : 2;
          this.damageEnemy(e, dmg, Math.cos(angToEnemy) * 260, Math.sin(angToEnemy) * 260);
          landedHit = true;
        }
      }
    }

    // Deflect incoming enemy orbs
    for (const pr of this.projectiles) {
      if (!pr.active || pr.fromPlayer) continue;
      const dx = pr.x - this.px;
      const dy = pr.y - this.py;
      const dist = Math.hypot(dx, dy);
      if (dist <= radius + 12) {
        pr.fromPlayer = true;
        pr.vx = Math.cos(this.pFacing) * 420;
        pr.vy = Math.sin(this.pFacing) * 420;
        pr.color = 0x38bdf8;
        pr.life = 1.8;
        this.spawnParticles(pr.x, pr.y, 0x38bdf8, 8, 120);
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
        this.spawnParticles(this.px, this.py, 0x2dd4bf, 28, 210);
        this.addFloatingText(this.px, this.py - 28, 'VÉU DE BASTET', '#2DD4BF', true);
        break;
      }
      case 'anubis': {
        this.anubisRingTimer = 0.45;
        this.spawnParticles(this.px, this.py, 0xfbbf24, 34, 260);
        this.addFloatingText(this.px, this.py - 28, 'JUÍZO DE ANÚBIS', '#FCD34D', true);
        for (let i = 0; i < this.projectiles.length; i++) {
          const pr = this.projectiles[i];
          if (pr.active && !pr.fromPlayer) {
            pr.active = false;
            this.projectileMeshes[i].visible = false;
          }
        }
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
        this.spawnParticles(this.px, this.py, 0x10b981, 28, 220);
        this.addFloatingText(this.px, this.py - 28, '+1 ANKH · NILO', '#34D399', true);
        break;
      }
      case 'horus': {
        const bx2 = this.px + Math.cos(this.pFacing) * 1100;
        const by2 = this.py + Math.sin(this.pFacing) * 1100;
        this.addBeam(this.px, this.py, bx2, by2, 0x38bdf8, 0.36);
        this.addFloatingText(this.px, this.py - 28, 'OLHO DE HÓRUS', '#7DD3FC', true);
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
        this.spawnParticles(this.px, this.py, 0xfcd34d, 36, 280);
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
              this.spawnProjectile(
                e.x,
                e.y,
                Math.cos(ang + offset) * orbSpeed,
                Math.sin(ang + offset) * orbSpeed,
                8,
                false,
                0xf97316,
                4.0
              );
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
              this.spawnProjectile(
                e.x,
                e.y,
                Math.cos(baseAng + offset) * volleySpeed,
                Math.sin(baseAng + offset) * volleySpeed,
                9,
                false,
                0xec4899,
                4.2
              );
            }
            if (enraged && this.enemies.length < 7) {
              this.spawnEnemy(
                'scarab',
                e.x + (Math.random() > 0.5 ? 54 : -54),
                e.y + 32,
                this.chamberIndex
              );
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
      e.facing = Math.atan2(dy, dx);

      // Sync 3D model for enemy
      const ev = this.enemyVisuals.get(e.id);
      if (ev) {
        ev.group.position.set(to3DX(e.x), 0, to3DZ(e.y));
        ev.bodyPivot.scale.set(1 / Math.sqrt(e.squash), e.squash, 1 / Math.sqrt(e.squash));

        if (e.kind === 'scarab') {
          ev.group.rotation.y = Math.PI / 2 - e.facing;
          if (ev.legs) {
            for (let l = 0; l < ev.legs.length; l++) {
              ev.legs[l].rotation.y = Math.sin(this.worldTime * 22 + l * 1.4) * 0.28;
            }
          }
        } else if (e.kind === 'mummy') {
          ev.group.rotation.y = Math.PI / 2 - e.facing;
          ev.bodyPivot.rotation.z = Math.sin(this.worldTime * 9 + e.id) * 0.08;
        } else if (e.kind === 'obelisk') {
          ev.coreMesh.rotation.y += dt * (e.telegraphTimer > 0 ? 9.5 : 2.2);
          ev.coreMesh.position.y = 4.15 + Math.sin(this.worldTime * 3 + e.id) * 0.16;
        } else if (e.kind === 'boss') {
          ev.group.rotation.y = Math.PI / 2 - e.facing;
          ev.coreMesh.rotation.y += dt * 3.5;
          if (ev.ringMesh) {
            ev.ringMesh.rotation.z += dt * (e.hp <= e.maxHp * 0.5 ? 4.2 : 1.8);
          }
          if (ev.tailSegments) {
            for (let s = 0; s < ev.tailSegments.length; s++) {
              ev.tailSegments[s].position.x = Math.sin(this.worldTime * 5.2 - s * 0.95) * (0.22 + s * 0.14);
            }
          }
          ev.bodyPivot.position.y = Math.sin(this.worldTime * 3.2) * 0.18;
        }

        ev.telegraphRing.visible = e.telegraphTimer > 0;
        if (e.telegraphTimer > 0) {
          const pulse = 1 + Math.sin(this.worldTime * 24) * 0.14;
          ev.telegraphRing.scale.setScalar(pulse);
        }

        const isFlashing = e.hitFlash > 0;
        const isSlowed = e.slowTimer > 0;
        for (const mat of ev.hitFlashMaterials) {
          if (isFlashing) {
            mat.emissive.setHex(0xffffff);
            mat.emissiveIntensity = 1.6;
          } else if (isSlowed) {
            mat.emissive.setHex(0x10b981);
            mat.emissiveIntensity = 0.65;
          } else {
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          }
        }
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
    this.spawnParticles(e.x, e.y, 0xfbbf24, 10, 145);

    if (e.hp <= 0) {
      const idx = this.enemies.indexOf(e);
      if (idx !== -1) this.enemies.splice(idx, 1);
      const ev = this.enemyVisuals.get(e.id);
      if (ev) {
        ev.dispose();
        this.chamberGroup.remove(ev.group);
        this.enemyVisuals.delete(e.id);
      }

      const pts = e.kind === 'boss' ? 600 : e.kind === 'mummy' ? 120 : e.kind === 'obelisk' ? 150 : 60;
      this.score += pts;
      this.divineEnergy = Math.min(100, this.divineEnergy + 14);
      soundEngine.playBanish();
      this.spawnParticles(e.x, e.y, e.kind === 'boss' ? 0xfcd34d : 0xf97316, 22, 220, 1.0);
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
    this.spawnParticles(this.px, this.py, 0xef4444, 18, 190);
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
}

// Re-export unused scratch references prevention (ensuring tree-shaking keeps helpers clean)
void _quat;
void _vec3Up;
