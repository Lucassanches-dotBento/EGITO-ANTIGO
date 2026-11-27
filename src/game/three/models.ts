import * as THREE from 'three';
import { TextureBundle } from './textures';

export interface ExplorerVisual {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Group;
  scepterCrystal: THREE.Mesh;
  bastetShield: THREE.Mesh;
  raFlares: THREE.Mesh[];
  aimArrow: THREE.Mesh;
  hitFlashMaterials: THREE.MeshStandardMaterial[];
  dispose: () => void;
}

export interface EnemyVisual {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  coreMesh: THREE.Mesh;
  accentMesh?: THREE.Mesh;
  ringMesh?: THREE.Mesh;
  legs?: THREE.Mesh[];
  telegraphRing: THREE.Mesh;
  hitFlashMaterials: THREE.MeshStandardMaterial[];
  dispose: () => void;
}

export interface TrapVisual {
  group: THREE.Group;
  spikesGroup: THREE.Group;
  warningFrame: THREE.Mesh;
  warningMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export interface GlyphVisual {
  group: THREE.Group;
  stelePivot: THREE.Group;
  frontFace: THREE.Mesh;
  backFace: THREE.Mesh;
  groundRing: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  steleMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export interface PortalVisual {
  group: THREE.Group;
  vortexDisc: THREE.Mesh;
  vortexRing: THREE.Mesh;
  portalLight: THREE.PointLight;
  vortexMat: THREE.MeshBasicMaterial;
  ringMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export interface BrazierVisual {
  group: THREE.Group;
  flameOuter: THREE.Mesh;
  flameInner: THREE.Mesh;
  emberMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export interface SceneryBundle {
  group: THREE.Group;
  floorMat: THREE.MeshStandardMaterial;
  portal: PortalVisual;
  braziers: BrazierVisual[];
  starField: THREE.Points;
  dispose: () => void;
}

function disposeObjectResources(root: THREE.Object3D, skipTextures?: Set<THREE.Texture>) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      geometries.add(mesh.geometry);
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        materials.add(m);
      }
    }
  });

  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => {
    const std = m as THREE.MeshStandardMaterial;
    if (std.map && !skipTextures?.has(std.map)) std.map.dispose();
    if (std.emissiveMap && !skipTextures?.has(std.emissiveMap)) std.emissiveMap.dispose();
    m.dispose();
  });
}

function makeContactShadow(textures: TextureBundle, radius: number, opacity = 0.65): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(radius * 2.2, radius * 2.2);
  const mat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    depthWrite: false,
    opacity,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  return mesh;
}

export function createExplorerModel(textures: TextureBundle): ExplorerVisual {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);

  const shadow = makeContactShadow(textures, 0.95, 0.72);
  group.add(shadow);

  // Materials
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xb97a52, roughness: 0.62, metalness: 0.05 });
  const linenMat = new THREE.MeshStandardMaterial({ color: 0xf3e5c8, roughness: 0.85, metalness: 0.02 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.24,
    metalness: 0.88,
    emissive: 0x451a03,
    emissiveIntensity: 0.25,
  });
  const lapisMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.36, metalness: 0.35 });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.5,
    roughness: 0.15,
    metalness: 0.2,
  });

  // Legs
  const legGeo = new THREE.CapsuleGeometry(0.14, 0.38, 4, 8);
  const leftLeg = new THREE.Mesh(legGeo, skinMat);
  leftLeg.position.set(-0.18, 0.34, 0);
  leftLeg.castShadow = true;
  bodyPivot.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, skinMat);
  rightLeg.position.set(0.18, 0.34, 0);
  rightLeg.castShadow = true;
  bodyPivot.add(rightLeg);

  // Royal Shendyt kilt + gold belt
  const kiltGeo = new THREE.CylinderGeometry(0.3, 0.42, 0.52, 12);
  const kilt = new THREE.Mesh(kiltGeo, linenMat);
  kilt.position.y = 0.72;
  kilt.castShadow = true;
  bodyPivot.add(kilt);

  const beltGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.12, 12);
  const belt = new THREE.Mesh(beltGeo, goldMat);
  belt.position.y = 0.96;
  bodyPivot.add(belt);

  // Torso + Usekh golden collar
  const torsoGeo = new THREE.CylinderGeometry(0.32, 0.28, 0.62, 12);
  const torso = new THREE.Mesh(torsoGeo, skinMat);
  torso.position.y = 1.28;
  torso.castShadow = true;
  bodyPivot.add(torso);

  const collarGeo = new THREE.TorusGeometry(0.31, 0.08, 8, 16);
  const collar = new THREE.Mesh(collarGeo, goldMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.54;
  bodyPivot.add(collar);

  // Head + Nemes Pharaoh headdress + Uraeus cobra crest
  const headGeo = new THREE.SphereGeometry(0.24, 14, 12);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 1.82;
  head.castShadow = true;
  bodyPivot.add(head);

  const nemesCrownGeo = new THREE.ConeGeometry(0.34, 0.46, 6);
  const nemesCrown = new THREE.Mesh(nemesCrownGeo, lapisMat);
  nemesCrown.position.set(0, 1.96, -0.05);
  nemesCrown.rotation.x = -0.35;
  nemesCrown.castShadow = true;
  bodyPivot.add(nemesCrown);

  const lappetGeo = new THREE.BoxGeometry(0.12, 0.44, 0.16);
  const leftLappet = new THREE.Mesh(lappetGeo, goldMat);
  leftLappet.position.set(-0.24, 1.72, 0.04);
  leftLappet.rotation.z = 0.14;
  bodyPivot.add(leftLappet);

  const rightLappet = new THREE.Mesh(lappetGeo, goldMat);
  rightLappet.position.set(0.24, 1.72, 0.04);
  rightLappet.rotation.z = -0.14;
  bodyPivot.add(rightLappet);

  const uraeusGeo = new THREE.ConeGeometry(0.055, 0.2, 6);
  const uraeus = new THREE.Mesh(uraeusGeo, goldMat);
  uraeus.position.set(0, 2.02, 0.23);
  uraeus.rotation.x = 0.25;
  bodyPivot.add(uraeus);

  // Left arm
  const armGeo = new THREE.CapsuleGeometry(0.1, 0.38, 4, 8);
  const leftArm = new THREE.Mesh(armGeo, skinMat);
  leftArm.position.set(-0.42, 1.24, 0);
  leftArm.rotation.z = 0.2;
  leftArm.castShadow = true;
  bodyPivot.add(leftArm);

  // Right arm holding Golden Solar Scepter (+Z forward in local coords)
  const rightArm = new THREE.Group();
  rightArm.position.set(0.42, 1.38, 0);
  bodyPivot.add(rightArm);

  const rightArmMesh = new THREE.Mesh(armGeo, skinMat);
  rightArmMesh.position.set(0, -0.14, 0.1);
  rightArmMesh.rotation.x = -0.55;
  rightArmMesh.castShadow = true;
  rightArm.add(rightArmMesh);

  const staffGeo = new THREE.CylinderGeometry(0.035, 0.03, 1.45, 8);
  const staff = new THREE.Mesh(staffGeo, goldMat);
  staff.position.set(0.03, 0.04, 0.36);
  staff.rotation.x = 0.45;
  rightArm.add(staff);

  const scepterRingGeo = new THREE.TorusGeometry(0.14, 0.025, 8, 16);
  const scepterRing = new THREE.Mesh(scepterRingGeo, goldMat);
  scepterRing.position.set(0.03, 0.65, 0.66);
  rightArm.add(scepterRing);

  const scepterCrystalGeo = new THREE.OctahedronGeometry(0.12, 0);
  const scepterCrystal = new THREE.Mesh(scepterCrystalGeo, crystalMat);
  scepterCrystal.position.set(0.03, 0.65, 0.66);
  rightArm.add(scepterCrystal);

  // Ground aim direction arrow
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 0.42);
  arrowShape.lineTo(0.24, -0.05);
  arrowShape.lineTo(0, 0.08);
  arrowShape.lineTo(-0.24, -0.05);
  arrowShape.closePath();
  const arrowGeo = new THREE.ShapeGeometry(arrowShape);
  const arrowMat = new THREE.MeshBasicMaterial({
    color: 0xfcd34d,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const aimArrow = new THREE.Mesh(arrowGeo, arrowMat);
  aimArrow.rotation.x = Math.PI / 2;
  aimArrow.position.set(0, 0.04, 1.15);
  group.add(aimArrow);

  // Bastet Shield Aura
  const shieldGeo = new THREE.SphereGeometry(1.25, 20, 14);
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0x2dd4bf,
    emissive: 0x14b8a6,
    emissiveIntensity: 0.85,
    transparent: true,
    opacity: 0.24,
    roughness: 0.1,
    metalness: 0.2,
    depthWrite: false,
  });
  const bastetShield = new THREE.Mesh(shieldGeo, shieldMat);
  bastetShield.position.y = 1.05;
  bastetShield.visible = false;
  group.add(bastetShield);

  // Ra 3 Orbiting Solar Disks
  const raFlares: THREE.Mesh[] = [];
  const flareGeo = new THREE.OctahedronGeometry(0.26, 1);
  const flareMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xf97316,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });
  for (let i = 0; i < 3; i++) {
    const flare = new THREE.Mesh(flareGeo, flareMat);
    flare.visible = false;
    group.add(flare);
    raFlares.push(flare);
  }

  const sharedTex = new Set<THREE.Texture>([textures.contactShadow]);
  return {
    group,
    bodyPivot,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    scepterCrystal,
    bastetShield,
    raFlares,
    aimArrow,
    hitFlashMaterials: [skinMat, linenMat, goldMat, lapisMat],
    dispose: () => disposeObjectResources(group, sharedTex),
  };
}

export function createScarabModel(textures: TextureBundle): EnemyVisual {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);
  group.add(makeContactShadow(textures, 0.7, 0.6));

  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x0f766e,
    roughness: 0.22,
    metalness: 0.78,
    emissive: 0x042f2e,
    emissiveIntensity: 0.35,
  });
  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.28,
    metalness: 0.85,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf97316,
    emissiveIntensity: 1.8,
  });

  // Domed carapace
  const carapaceGeo = new THREE.SphereGeometry(0.46, 14, 10);
  const carapace = new THREE.Mesh(carapaceGeo, shellMat);
  carapace.scale.set(0.95, 0.56, 1.25);
  carapace.position.set(0, 0.38, -0.04);
  carapace.castShadow = true;
  bodyPivot.add(carapace);

  // Wing seam ridge
  const seamGeo = new THREE.BoxGeometry(0.07, 0.14, 0.82);
  const seam = new THREE.Mesh(seamGeo, goldTrimMat);
  seam.position.set(0, 0.56, -0.06);
  bodyPivot.add(seam);

  // Head + horn + eyes + mandibles
  const headGeo = new THREE.SphereGeometry(0.24, 10, 8);
  const head = new THREE.Mesh(headGeo, goldTrimMat);
  head.position.set(0, 0.34, 0.5);
  bodyPivot.add(head);

  const eyeGeo = new THREE.SphereGeometry(0.06, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.11, 0.41, 0.64);
  bodyPivot.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.11, 0.41, 0.64);
  bodyPivot.add(eyeR);

  const mandibleGeo = new THREE.ConeGeometry(0.05, 0.26, 5);
  const mandL = new THREE.Mesh(mandibleGeo, goldTrimMat);
  mandL.rotation.x = Math.PI / 2;
  mandL.rotation.z = -0.3;
  mandL.position.set(-0.12, 0.26, 0.74);
  bodyPivot.add(mandL);
  const mandR = new THREE.Mesh(mandibleGeo, goldTrimMat);
  mandR.rotation.x = Math.PI / 2;
  mandR.rotation.z = 0.3;
  mandR.position.set(0.12, 0.26, 0.74);
  bodyPivot.add(mandR);

  // 6 articulated legs
  const legs: THREE.Mesh[] = [];
  const legGeo = new THREE.BoxGeometry(0.32, 0.06, 0.07);
  for (let side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(legGeo, goldTrimMat);
      leg.position.set(side * 0.46, 0.2, -0.28 + i * 0.26);
      leg.rotation.z = side * -0.35;
      bodyPivot.add(leg);
      legs.push(leg);
    }
  }

  // Telegraph ring
  const teleGeo = new THREE.RingGeometry(0.65, 0.88, 24);
  const teleMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const telegraphRing = new THREE.Mesh(teleGeo, teleMat);
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.04;
  telegraphRing.visible = false;
  group.add(telegraphRing);

  const sharedTex = new Set<THREE.Texture>([textures.contactShadow]);
  return {
    group,
    bodyPivot,
    coreMesh: carapace,
    legs,
    telegraphRing,
    hitFlashMaterials: [shellMat, goldTrimMat],
    dispose: () => disposeObjectResources(group, sharedTex),
  };
}

export function createMummyModel(textures: TextureBundle): EnemyVisual {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);
  group.add(makeContactShadow(textures, 0.9, 0.68));

  const linenMat = new THREE.MeshStandardMaterial({
    color: 0xd6c7a7,
    roughness: 0.9,
    metalness: 0.02,
  });
  const darkWrapMat = new THREE.MeshStandardMaterial({
    color: 0x78654b,
    roughness: 0.85,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.3,
    metalness: 0.82,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 2.2,
  });

  // Lower shroud + wrapped torso
  const baseGeo = new THREE.CylinderGeometry(0.28, 0.38, 0.85, 10);
  const base = new THREE.Mesh(baseGeo, darkWrapMat);
  base.position.y = 0.43;
  base.castShadow = true;
  bodyPivot.add(base);

  const torsoGeo = new THREE.CylinderGeometry(0.36, 0.28, 0.72, 10);
  const torso = new THREE.Mesh(torsoGeo, linenMat);
  torso.position.y = 1.18;
  torso.castShadow = true;
  bodyPivot.add(torso);

  // Wrapping bandage rings
  const ringGeo = new THREE.TorusGeometry(0.34, 0.055, 6, 12);
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(ringGeo, linenMat);
    band.rotation.x = Math.PI / 2 + (i % 2 === 0 ? 0.14 : -0.14);
    band.position.y = 0.75 + i * 0.28;
    bodyPivot.add(band);
  }

  // Funerary collar & head mask
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 6, 12), goldMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.54;
  bodyPivot.add(collar);

  const headGeo = new THREE.BoxGeometry(0.42, 0.48, 0.42);
  const head = new THREE.Mesh(headGeo, linenMat);
  head.position.y = 1.82;
  head.castShadow = true;
  bodyPivot.add(head);

  const maskCrest = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.36, 4), goldMat);
  maskCrest.position.set(0, 2.12, 0);
  maskCrest.rotation.y = Math.PI / 4;
  bodyPivot.add(maskCrest);

  // Glowing eyes
  const eyeGeo = new THREE.SphereGeometry(0.06, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.1, 1.84, 0.22);
  bodyPivot.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.1, 1.84, 0.22);
  bodyPivot.add(eyeR);

  // Outstretched zombie/mummy arms
  const armGeo = new THREE.BoxGeometry(0.15, 0.15, 0.78);
  const armL = new THREE.Mesh(armGeo, linenMat);
  armL.position.set(-0.42, 1.34, 0.36);
  armL.castShadow = true;
  bodyPivot.add(armL);
  const armR = new THREE.Mesh(armGeo, linenMat);
  armR.position.set(0.42, 1.34, 0.36);
  armR.castShadow = true;
  bodyPivot.add(armR);

  // Telegraph ring
  const teleGeo = new THREE.RingGeometry(0.85, 1.15, 24);
  const teleMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const telegraphRing = new THREE.Mesh(teleGeo, teleMat);
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.04;
  telegraphRing.visible = false;
  group.add(telegraphRing);

  const sharedTex = new Set<THREE.Texture>([textures.contactShadow]);
  return {
    group,
    bodyPivot,
    coreMesh: torso,
    accentMesh: armL,
    ringMesh: armR,
    telegraphRing,
    hitFlashMaterials: [linenMat, darkWrapMat, goldMat],
    dispose: () => disposeObjectResources(group, sharedTex),
  };
}

export function createObeliskModel(textures: TextureBundle): EnemyVisual {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);
  group.add(makeContactShadow(textures, 1.15, 0.72));

  const basaltMat = new THREE.MeshStandardMaterial({
    color: 0x292524,
    roughness: 0.65,
    metalness: 0.28,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x785532,
    map: textures.wallRelief,
    roughness: 0.75,
    metalness: 0.08,
  });
  const runeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 1.5,
    roughness: 0.25,
  });

  // Stepped plinth
  const plinth1 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.36, 1.7), basaltMat);
  plinth1.position.y = 0.18;
  plinth1.castShadow = true;
  plinth1.receiveShadow = true;
  bodyPivot.add(plinth1);

  const plinth2 = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.34, 1.25), basaltMat);
  plinth2.position.y = 0.52;
  plinth2.castShadow = true;
  bodyPivot.add(plinth2);

  // Obelisk 4-sided tapering shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.54, 2.35, 4), stoneMat);
  shaft.rotation.y = Math.PI / 4;
  shaft.position.y = 1.85;
  shaft.castShadow = true;
  bodyPivot.add(shaft);

  // Pyramidion cap
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.65, 4), basaltMat);
  tip.rotation.y = Math.PI / 4;
  tip.position.y = 3.35;
  tip.castShadow = true;
  bodyPivot.add(tip);

  // Glowing rune collar
  const runeBand = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.16, 0.84), runeMat);
  runeBand.position.y = 2.0;
  bodyPivot.add(runeBand);

  // Floating spinning curse crystal above tip
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), runeMat);
  crystal.position.y = 4.15;
  bodyPivot.add(crystal);

  // Telegraph ring
  const teleGeo = new THREE.RingGeometry(1.05, 1.38, 28);
  const teleMat = new THREE.MeshBasicMaterial({
    color: 0xfb923c,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const telegraphRing = new THREE.Mesh(teleGeo, teleMat);
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.04;
  telegraphRing.visible = false;
  group.add(telegraphRing);

  const sharedTex = new Set<THREE.Texture>([textures.contactShadow, textures.wallRelief]);
  return {
    group,
    bodyPivot,
    coreMesh: crystal,
    accentMesh: runeBand,
    telegraphRing,
    hitFlashMaterials: [basaltMat, stoneMat],
    dispose: () => disposeObjectResources(group, sharedTex),
  };
}

export function createBossModel(textures: TextureBundle): EnemyVisual {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);
  group.add(makeContactShadow(textures, 2.0, 0.82));

  const obsidianMat = new THREE.MeshStandardMaterial({
    color: 0x1e1326,
    roughness: 0.35,
    metalness: 0.62,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.22,
    metalness: 0.9,
    emissive: 0x451a03,
    emissiveIntensity: 0.3,
  });
  const voidCoreMat = new THREE.MeshStandardMaterial({
    color: 0xf472b6,
    emissive: 0xdb2777,
    emissiveIntensity: 2.0,
    roughness: 0.15,
  });

  // Coiled serpent base rings
  const coil1 = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.28, 10, 24), obsidianMat);
  coil1.rotation.x = Math.PI / 2;
  coil1.position.y = 0.32;
  coil1.castShadow = true;
  bodyPivot.add(coil1);

  const coil2 = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.22, 10, 20), obsidianMat);
  coil2.rotation.x = Math.PI / 2;
  coil2.position.y = 0.72;
  coil2.castShadow = true;
  bodyPivot.add(coil2);

  // Towering serpentine torso
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.68, 1.85, 12), obsidianMat);
  torso.position.y = 1.65;
  torso.castShadow = true;
  bodyPivot.add(torso);

  // Golden ribs / armor collar
  const rib = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 8, 16), goldMat);
  rib.rotation.x = Math.PI / 2;
  rib.position.y = 2.2;
  bodyPivot.add(rib);

  // Cobra hood via ExtrudeGeometry
  const hoodShape = new THREE.Shape();
  hoodShape.moveTo(0, -0.8);
  hoodShape.bezierCurveTo(1.25, -0.5, 1.4, 0.7, 0.45, 1.15);
  hoodShape.lineTo(0, 1.35);
  hoodShape.lineTo(-0.45, 1.15);
  hoodShape.bezierCurveTo(-1.4, 0.7, -1.25, -0.5, 0, -0.8);
  const hoodGeo = new THREE.ExtrudeGeometry(hoodShape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  hoodGeo.center();
  const hood = new THREE.Mesh(hoodGeo, obsidianMat);
  hood.position.set(0, 3.05, -0.15);
  hood.castShadow = true;
  bodyPivot.add(hood);

  // Sculpted horned serpent head + glowing crimson eyes
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 12, 10), obsidianMat);
  head.scale.set(0.95, 0.9, 1.35);
  head.position.set(0, 3.15, 0.28);
  bodyPivot.add(head);

  const hornGeo = new THREE.ConeGeometry(0.11, 0.75, 6);
  const hornL = new THREE.Mesh(hornGeo, goldMat);
  hornL.position.set(-0.34, 3.72, 0.12);
  hornL.rotation.z = 0.42;
  bodyPivot.add(hornL);
  const hornR = new THREE.Mesh(hornGeo, goldMat);
  hornR.position.set(0.34, 3.72, 0.12);
  hornR.rotation.z = -0.42;
  bodyPivot.add(hornR);

  const eyeGeo = new THREE.SphereGeometry(0.09, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeo, voidCoreMat);
  eyeL.position.set(-0.2, 3.22, 0.66);
  bodyPivot.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, voidCoreMat);
  eyeR.position.set(0.2, 3.22, 0.66);
  bodyPivot.add(eyeR);

  // Floating Void Heart core & rotating rune halo
  const coreCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), voidCoreMat);
  coreCrystal.position.set(0, 2.05, 0.64);
  bodyPivot.add(coreCrystal);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.065, 8, 32), voidCoreMat);
  halo.position.set(0, 2.65, -0.35);
  bodyPivot.add(halo);

  // Telegraph ring
  const teleGeo = new THREE.RingGeometry(1.65, 2.15, 32);
  const teleMat = new THREE.MeshBasicMaterial({
    color: 0xec4899,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const telegraphRing = new THREE.Mesh(teleGeo, teleMat);
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.05;
  telegraphRing.visible = false;
  group.add(telegraphRing);

  const sharedTex = new Set<THREE.Texture>([textures.contactShadow]);
  return {
    group,
    bodyPivot,
    coreMesh: coreCrystal,
    ringMesh: halo,
    telegraphRing,
    hitFlashMaterials: [obsidianMat, goldMat],
    dispose: () => disposeObjectResources(group, sharedTex),
  };
}

export function createPillarModel(textures: TextureBundle, radiusWorld: number): THREE.Group {
  const group = new THREE.Group();
  group.add(makeContactShadow(textures, radiusWorld * 1.15, 0.65));

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xc2955d,
    map: textures.pillarFrieze,
    roughness: 0.78,
    metalness: 0.06,
  });
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x8b6236,
    roughness: 0.85,
    metalness: 0.05,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.3,
    metalness: 0.82,
  });

  // Stepped square plinth
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(radiusWorld * 2.05, 0.45, radiusWorld * 2.05),
    baseMat
  );
  plinth.position.y = 0.225;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Fluted sandstone column shaft
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusWorld * 0.76, radiusWorld * 0.88, 4.4, 14),
    stoneMat
  );
  shaft.position.y = 2.65;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  // Golden collar ring
  const collar = new THREE.Mesh(new THREE.TorusGeometry(radiusWorld * 0.82, 0.09, 8, 18), goldMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 4.68;
  group.add(collar);

  // Flared Lotus/Papyrus capital
  const capital = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusWorld * 1.18, radiusWorld * 0.76, 0.72, 14),
    stoneMat
  );
  capital.position.y = 5.05;
  capital.castShadow = true;
  group.add(capital);

  // Top abacus stone
  const abacus = new THREE.Mesh(
    new THREE.BoxGeometry(radiusWorld * 2.15, 0.3, radiusWorld * 2.15),
    baseMat
  );
  abacus.position.y = 5.56;
  abacus.castShadow = true;
  group.add(abacus);

  return group;
}

export function createSpikeTrapModel(textures: TextureBundle, widthWorld: number): TrapVisual {
  const group = new THREE.Group();

  const plateMat = new THREE.MeshStandardMaterial({
    map: textures.trapPlate,
    roughness: 0.72,
    metalness: 0.25,
  });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(widthWorld, 0.06, widthWorld), plateMat);
  plate.position.y = 0.03;
  plate.receiveShadow = true;
  group.add(plate);

  // Warning border frame
  const warningMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.3,
    roughness: 0.35,
  });
  const frameThickness = 0.14;
  const warningFrame = new THREE.Mesh(
    new THREE.RingGeometry(widthWorld * 0.56, widthWorld * 0.68, 4),
    warningMat
  );
  warningFrame.rotation.x = -Math.PI / 2;
  warningFrame.rotation.z = Math.PI / 4;
  warningFrame.position.y = 0.065;
  group.add(warningFrame);

  // 9 sharp metallic bronze/steel pyramid spikes
  const spikesGroup = new THREE.Group();
  spikesGroup.position.y = -0.65;
  group.add(spikesGroup);

  const spikeGeo = new THREE.ConeGeometry(0.18, 0.85, 4);
  const spikeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.25,
    metalness: 0.88,
    emissive: 0x450a0a,
    emissiveIntensity: 0.25,
  });

  const step = widthWorld * 0.26;
  for (let gx = -1; gx <= 1; gx++) {
    for (let gz = -1; gz <= 1; gz++) {
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(gx * step, 0.42, gz * step);
      spike.rotation.y = Math.PI / 4;
      spike.castShadow = true;
      spikesGroup.add(spike);
    }
  }
  void frameThickness;

  const sharedTex = new Set<THREE.Texture>([textures.trapPlate]);
  return {
    group,
    spikesGroup,
    warningFrame,
    warningMat,
    dispose: () => disposeObjectResources(group, sharedTex),
  };
}

export function createGlyphRelicModel(
  textures: TextureBundle,
  glyph: string,
  letter: string
): GlyphVisual {
  const group = new THREE.Group();

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const groundRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.98, 28), ringMat);
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.04;
  group.add(groundRing);

  const stelePivot = new THREE.Group();
  stelePivot.position.y = 1.25;
  group.add(stelePivot);

  const steleMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.28,
    metalness: 0.85,
    emissive: 0x451a03,
    emissiveIntensity: 0.4,
  });

  // Outer carved golden cartouche slab
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.12, 1.44, 0.16), steleMat);
  slab.castShadow = true;
  stelePivot.add(slab);

  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.16, 16, 1, false, 0, Math.PI), steleMat);
  topCap.rotation.z = Math.PI / 2;
  topCap.rotation.y = Math.PI / 2;
  topCap.position.y = 0.72;
  stelePivot.add(topCap);

  // Front & back faces with hieroglyph texture
  const faceGeo = new THREE.PlaneGeometry(0.96, 1.24);
  const initialTex = textures.getGlyphFaceTexture(glyph, letter, false);
  const faceMat = new THREE.MeshBasicMaterial({ map: initialTex });

  const frontFace = new THREE.Mesh(faceGeo, faceMat);
  frontFace.position.z = 0.085;
  stelePivot.add(frontFace);

  const backFace = new THREE.Mesh(faceGeo, faceMat);
  backFace.rotation.y = Math.PI;
  backFace.position.z = -0.085;
  stelePivot.add(backFace);

  return {
    group,
    stelePivot,
    frontFace,
    backFace,
    groundRing,
    ringMat,
    steleMat,
    dispose: () => {
      // Do not dispose cached glyph face textures owned by TextureBundle
      const texSet = new Set<THREE.Texture>();
      const m = frontFace.material as THREE.MeshBasicMaterial;
      if (m.map) texSet.add(m.map);
      disposeObjectResources(group, texSet);
    },
  };
}

export function createBrazierModel(textures: TextureBundle): BrazierVisual {
  const group = new THREE.Group();

  const bronzeMat = new THREE.MeshStandardMaterial({
    color: 0x784b20,
    roughness: 0.42,
    metalness: 0.78,
  });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 2.2,
    roughness: 0.35,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.52, 0.75, 8), bronzeMat);
  base.position.y = 0.375;
  base.castShadow = true;
  group.add(base);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.3, 0.42, 10), bronzeMat);
  bowl.position.y = 0.92;
  bowl.castShadow = true;
  group.add(bowl);

  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), emberMat);
  ember.scale.set(1, 0.35, 1);
  ember.position.y = 1.08;
  group.add(ember);

  const flameOuterMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.85,
  });
  const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.05, 7), flameOuterMat);
  flameOuter.position.y = 1.56;
  group.add(flameOuter);

  const flameInnerMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.95,
  });
  const flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 6), flameInnerMat);
  flameInner.position.y = 1.44;
  group.add(flameInner);

  void textures;
  return {
    group,
    flameOuter,
    flameInner,
    emberMat,
    dispose: () => disposeObjectResources(group),
  };
}

export function createNorthPortalModel(textures: TextureBundle): PortalVisual {
  const group = new THREE.Group();

  const pylonMat = new THREE.MeshStandardMaterial({
    color: 0xb98a50,
    map: textures.wallRelief,
    roughness: 0.75,
    metalness: 0.08,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.22,
    metalness: 0.88,
  });

  // Left & Right Pylons
  const pylonGeo = new THREE.BoxGeometry(1.5, 5.4, 1.4);
  const leftPylon = new THREE.Mesh(pylonGeo, pylonMat);
  leftPylon.position.set(-2.35, 2.7, 0);
  leftPylon.castShadow = true;
  leftPylon.receiveShadow = true;
  group.add(leftPylon);

  const rightPylon = new THREE.Mesh(pylonGeo, pylonMat);
  rightPylon.position.set(2.35, 2.7, 0);
  rightPylon.castShadow = true;
  rightPylon.receiveShadow = true;
  group.add(rightPylon);

  // Lintel beam + Winged Solar Disk
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.9, 1.55), pylonMat);
  lintel.position.set(0, 5.4, 0);
  lintel.castShadow = true;
  group.add(lintel);

  const sunDisk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.24, 18), goldMat);
  sunDisk.rotation.x = Math.PI / 2;
  sunDisk.position.set(0, 5.42, 0.78);
  group.add(sunDisk);

  const wingGeo = new THREE.BoxGeometry(1.85, 0.28, 0.16);
  const wingL = new THREE.Mesh(wingGeo, goldMat);
  wingL.position.set(-1.45, 5.42, 0.76);
  wingL.rotation.z = 0.08;
  group.add(wingL);
  const wingR = new THREE.Mesh(wingGeo, goldMat);
  wingR.position.set(1.45, 5.42, 0.76);
  wingR.rotation.z = -0.08;
  group.add(wingR);

  // Threshold dais
  const step = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 2.0), goldMat);
  step.position.set(0, 0.08, 0.35);
  step.receiveShadow = true;
  group.add(step);

  // Swirling Portal Energy Vortex
  const vortexMat = new THREE.MeshBasicMaterial({
    map: textures.glowDisc,
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const vortexDisc = new THREE.Mesh(new THREE.CircleGeometry(1.9, 28), vortexMat);
  vortexDisc.position.set(0, 2.45, 0);
  group.add(vortexDisc);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    emissive: 0x1e293b,
    emissiveIntensity: 0.4,
    roughness: 0.25,
    metalness: 0.8,
  });
  const vortexRing = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.14, 10, 32), ringMat);
  vortexRing.position.set(0, 2.45, 0);
  group.add(vortexRing);

  const portalLight = new THREE.PointLight(0xfbbf24, 1.2, 16, 1.5);
  portalLight.position.set(0, 2.6, 1.4);
  group.add(portalLight);

  const sharedTex = new Set<THREE.Texture>([textures.wallRelief, textures.glowDisc]);
  return {
    group,
    vortexDisc,
    vortexRing,
    portalLight,
    vortexMat,
    ringMat,
    dispose: () => disposeObjectResources(group, sharedTex),
  };
}

export function buildTempleAndDesertScenery(
  textures: TextureBundle,
  arenaW: number,
  arenaD: number,
  wallPad: number
): SceneryBundle {
  const group = new THREE.Group();

  // 1. Playable Sandstone Temple Courtyard Floor
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xc2955e,
    map: textures.sandstoneFloor,
    roughness: 0.84,
    metalness: 0.05,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(arenaW, arenaD), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Subtle inlaid Golden Sun-Disk Medallion in courtyard center
  const inlayMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.32,
    metalness: 0.8,
    emissive: 0x451a03,
    emissiveIntensity: 0.22,
  });
  const centerRing = new THREE.Mesh(new THREE.RingGeometry(3.8, 4.15, 48), inlayMat);
  centerRing.rotation.x = -Math.PI / 2;
  centerRing.position.y = 0.012;
  group.add(centerRing);

  const innerRing = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.72, 36), inlayMat);
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.012;
  group.add(innerRing);

  // 2. Perimeter Open Colonnade Parapet Walls (low enough to frame the desert & pyramids!)
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xaf834b,
    map: textures.wallRelief,
    roughness: 0.8,
    metalness: 0.06,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.34,
    metalness: 0.78,
  });

  const halfW = arenaW / 2;
  const halfD = arenaD / 2;
  const innerHalfW = halfW - wallPad;
  const innerHalfD = halfD - wallPad;

  // North back sanctuary wall (flanking the portal)
  const northSegW = (arenaW - 6.6) / 2;
  const northWallL = new THREE.Mesh(new THREE.BoxGeometry(northSegW, 2.8, wallPad), wallMat);
  northWallL.position.set(-halfW + northSegW / 2, 1.4, -innerHalfD - wallPad / 2);
  northWallL.castShadow = true;
  northWallL.receiveShadow = true;
  group.add(northWallL);

  const northWallR = new THREE.Mesh(new THREE.BoxGeometry(northSegW, 2.8, wallPad), wallMat);
  northWallR.position.set(halfW - northSegW / 2, 1.4, -innerHalfD - wallPad / 2);
  northWallR.castShadow = true;
  northWallR.receiveShadow = true;
  group.add(northWallR);

  // West, East, and South stepped parapets (low 1.35m height so camera & desert vista are unobstructed)
  const sideWallGeo = new THREE.BoxGeometry(wallPad, 1.35, arenaD);
  const westWall = new THREE.Mesh(sideWallGeo, wallMat);
  westWall.position.set(-innerHalfW - wallPad / 2, 0.675, 0);
  westWall.castShadow = true;
  westWall.receiveShadow = true;
  group.add(westWall);

  const eastWall = new THREE.Mesh(sideWallGeo, wallMat);
  eastWall.position.set(innerHalfW + wallPad / 2, 0.675, 0);
  eastWall.castShadow = true;
  eastWall.receiveShadow = true;
  group.add(eastWall);

  const southWall = new THREE.Mesh(new THREE.BoxGeometry(arenaW, 1.1, wallPad), wallMat);
  southWall.position.set(0, 0.55, innerHalfD + wallPad / 2);
  southWall.castShadow = true;
  southWall.receiveShadow = true;
  group.add(southWall);

  // Golden border coping along the courtyard rim
  const rimN = new THREE.Mesh(new THREE.BoxGeometry(arenaW, 0.14, 0.25), trimMat);
  rimN.position.set(0, 0.07, -innerHalfD);
  group.add(rimN);
  const rimS = new THREE.Mesh(new THREE.BoxGeometry(arenaW, 0.14, 0.25), trimMat);
  rimS.position.set(0, 0.07, innerHalfD);
  group.add(rimS);

  // 3. North Portal
  const portal = createNorthPortalModel(textures);
  portal.group.position.set(0, 0, -innerHalfD + 0.35);
  group.add(portal.group);

  // 4. Corner & Portal Torch Braziers
  const braziers: BrazierVisual[] = [];
  const brazierCoords: [number, number][] = [
    [-4.3, -innerHalfD + 0.9],
    [4.3, -innerHalfD + 0.9],
    [-innerHalfW - 0.8, -innerHalfD + 1.5],
    [innerHalfW + 0.8, -innerHalfD + 1.5],
    [-innerHalfW - 0.8, innerHalfD - 1.5],
    [innerHalfW + 0.8, innerHalfD - 1.5],
  ];
  for (const [bx, bz] of brazierCoords) {
    const b = createBrazierModel(textures);
    b.group.position.set(bx, 0, bz);
    group.add(b.group);
    braziers.push(b);
  }

  // 5. Endless Moonlit Sahara Desert Terrain & Monumental Distant Pyramids
  const desertMat = new THREE.MeshStandardMaterial({
    color: 0x6f4e2b,
    map: textures.desertSand,
    roughness: 0.95,
    metalness: 0.02,
  });
  const desertGeo = new THREE.PlaneGeometry(340, 340, 36, 36);
  const posAttr = desertGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    // Keep depression flat under the temple courtyard
    const distFromCourt = Math.max(Math.abs(x) - halfW - 2, Math.abs(y) - halfD - 2, 0);
    const blend = Math.min(1, distFromCourt / 18);
    const dune =
      (Math.sin(x * 0.065) * 2.2 + Math.cos(y * 0.05 + x * 0.025) * 1.9 + Math.sin((x + y) * 0.09) * 0.85) *
      blend;
    posAttr.setZ(i, dune - 0.35);
  }
  desertGeo.computeVertexNormals();
  const desert = new THREE.Mesh(desertGeo, desertMat);
  desert.rotation.x = -Math.PI / 2;
  desert.receiveShadow = true;
  group.add(desert);

  // 3 Distant Monumental Pyramids framing the horizon
  const pyramidMat = new THREE.MeshStandardMaterial({
    color: 0x8e6638,
    roughness: 0.88,
    metalness: 0.05,
  });
  const pyramidCapMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.25,
    metalness: 0.88,
    emissive: 0x451a03,
    emissiveIntensity: 0.35,
  });

  const pyramidSpecs = [
    { x: -38, z: -64, r: 22, h: 24 },
    { x: 6, z: -86, r: 30, h: 34 },
    { x: 48, z: -58, r: 17, h: 19 },
  ];
  for (const spec of pyramidSpecs) {
    const pyr = new THREE.Mesh(new THREE.ConeGeometry(spec.r, spec.h, 4), pyramidMat);
    pyr.rotation.y = Math.PI / 4;
    pyr.position.set(spec.x, spec.h / 2 - 0.3, spec.z);
    group.add(pyr);

    // Gilded capstone (benben)
    const capH = spec.h * 0.14;
    const capR = spec.r * 0.14;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(capR, capH, 4), pyramidCapMat);
    cap.rotation.y = Math.PI / 4;
    cap.position.set(spec.x, spec.h - capH / 2 - 0.28, spec.z);
    group.add(cap);
  }

  // 6. Starlit Egyptian Night Sky Dome Points
  const starCount = 340;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * (Math.PI * 0.42);
    const radius = 145 + Math.random() * 25;
    starPositions[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
    starPositions[i * 3 + 1] = Math.cos(phi) * radius + 8;
    starPositions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius - 20;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xfef3c7,
    size: 0.72,
    transparent: true,
    opacity: 0.85,
  });
  const starField = new THREE.Points(starGeo, starMat);
  group.add(starField);

  const sharedTex = new Set<THREE.Texture>([
    textures.sandstoneFloor,
    textures.desertSand,
    textures.wallRelief,
    textures.glowDisc,
  ]);
  return {
    group,
    floorMat,
    portal,
    braziers,
    starField,
    dispose: () => {
      portal.dispose();
      braziers.forEach((b) => b.dispose());
      disposeObjectResources(group, sharedTex);
    },
  };
}
