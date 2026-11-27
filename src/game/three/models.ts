import * as THREE from 'three';
import { TextureBundle } from './textures';

export interface ExplorerVisual {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Group;
  cape: THREE.Mesh;
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
  tailSegments?: THREE.Mesh[];
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
  fireLight?: THREE.PointLight;
  dispose: () => void;
}

export interface SkyUniforms {
  uZenithColor: { value: THREE.Color };
  uHorizonColor: { value: THREE.Color };
  uGlowColor: { value: THREE.Color };
  uSunDir: { value: THREE.Vector3 };
}

export interface SceneryBundle {
  group: THREE.Group;
  floorMat: THREE.MeshStandardMaterial;
  waterMat: THREE.MeshPhysicalMaterial;
  skyUniforms: SkyUniforms;
  portal: PortalVisual;
  braziers: BrazierVisual[];
  palmCrowns: THREE.Group[];
  starField: THREE.Points;
  dustField: THREE.Points;
  dispose: () => void;
}

function collectSharedTextures(textures: TextureBundle): Set<THREE.Texture> {
  return new Set<THREE.Texture>([
    textures.sandstoneFloor,
    textures.sandstoneFloorNormal,
    textures.sandstoneFloorRoughness,
    textures.desertSand,
    textures.desertSandNormal,
    textures.pillarFrieze,
    textures.pillarNormal,
    textures.wallRelief,
    textures.wallNormal,
    textures.linenBandage,
    textures.linenNormal,
    textures.nemesStripes,
    textures.waterNormal,
    textures.contactShadow,
    textures.glowDisc,
    textures.dustMote,
    textures.trapPlate,
  ]);
}

function disposeObjectResources(root: THREE.Object3D, skipTextures: Set<THREE.Texture>) {
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
    if (std.map && !skipTextures.has(std.map)) std.map.dispose();
    if (std.normalMap && !skipTextures.has(std.normalMap)) std.normalMap.dispose();
    if (std.roughnessMap && !skipTextures.has(std.roughnessMap)) std.roughnessMap.dispose();
    if (std.emissiveMap && !skipTextures.has(std.emissiveMap)) std.emissiveMap.dispose();
    m.dispose();
  });
}

function makeContactShadow(textures: TextureBundle, radius: number, opacity = 0.68): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(radius * 2.25, radius * 2.25);
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
  group.add(makeContactShadow(textures, 0.98, 0.74));

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xb6754d,
    roughness: 0.56,
    metalness: 0.04,
  });
  const linenMat = new THREE.MeshPhysicalMaterial({
    color: 0xf5ead2,
    map: textures.linenBandage,
    normalMap: textures.linenNormal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.88,
    metalness: 0.02,
    sheen: 0.65,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color(0xfef3c7),
  });
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    roughness: 0.2,
    metalness: 0.92,
    anisotropy: 0.78,
    clearcoat: 0.35,
    emissive: 0x451a03,
    emissiveIntensity: 0.22,
  });
  const nemesMat = new THREE.MeshStandardMaterial({
    map: textures.nemesStripes,
    roughness: 0.42,
    metalness: 0.35,
  });
  const capeMat = new THREE.MeshPhysicalMaterial({
    color: 0x7c2d12,
    map: textures.linenBandage,
    normalMap: textures.linenNormal,
    roughness: 0.82,
    sheen: 0.7,
    sheenColor: new THREE.Color(0xfbbf24),
    side: THREE.DoubleSide,
  });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.9,
    roughness: 0.12,
    metalness: 0.2,
  });

  // Legs + Golden Sandals
  const legGeo = new THREE.CapsuleGeometry(0.135, 0.4, 5, 10);
  const leftLeg = new THREE.Mesh(legGeo, skinMat);
  leftLeg.position.set(-0.18, 0.36, 0);
  leftLeg.castShadow = true;
  bodyPivot.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, skinMat);
  rightLeg.position.set(0.18, 0.36, 0);
  rightLeg.castShadow = true;
  bodyPivot.add(rightLeg);

  const sandalGeo = new THREE.BoxGeometry(0.18, 0.08, 0.32);
  const sandalL = new THREE.Mesh(sandalGeo, goldMat);
  sandalL.position.set(0, -0.28, 0.05);
  leftLeg.add(sandalL);
  const sandalR = new THREE.Mesh(sandalGeo, goldMat);
  sandalR.position.set(0, -0.28, 0.05);
  rightLeg.add(sandalR);

  // Shendyt pleated linen kilt + ceremonial apron + gold belt
  const kilt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.44, 0.56, 14), linenMat);
  kilt.position.y = 0.74;
  kilt.castShadow = true;
  bodyPivot.add(kilt);

  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.48, 0.07), goldMat);
  apron.position.set(0, 0.72, 0.34);
  bodyPivot.add(apron);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.13, 14), goldMat);
  belt.position.y = 0.99;
  bodyPivot.add(belt);

  // Torso + Shoulders + Usekh Collar
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.64, 14), skinMat);
  torso.position.y = 1.31;
  torso.castShadow = true;
  bodyPivot.add(torso);

  const shoulderGeo = new THREE.SphereGeometry(0.14, 10, 8);
  const shoulderL = new THREE.Mesh(shoulderGeo, goldMat);
  shoulderL.position.set(-0.37, 1.54, 0);
  bodyPivot.add(shoulderL);
  const shoulderR = new THREE.Mesh(shoulderGeo, goldMat);
  shoulderR.position.set(0.37, 1.54, 0);
  bodyPivot.add(shoulderR);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.085, 10, 20), goldMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.57;
  bodyPivot.add(collar);

  // Flowing Desert Royal Cloak
  const capeGeo = new THREE.PlaneGeometry(0.68, 1.05, 4, 6);
  capeGeo.translate(0, -0.52, 0);
  const cape = new THREE.Mesh(capeGeo, capeMat);
  cape.position.set(0, 1.56, -0.24);
  cape.rotation.x = 0.22;
  cape.castShadow = true;
  bodyPivot.add(cape);

  // Head + Ceremonial Beard + Nemes Headdress + Uraeus Cobra
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), skinMat);
  head.position.y = 1.85;
  head.castShadow = true;
  bodyPivot.add(head);

  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 6), goldMat);
  beard.rotation.x = Math.PI - 0.18;
  beard.position.set(0, 1.63, 0.21);
  bodyPivot.add(beard);

  const nemesCrown = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.5, 8), nemesMat);
  nemesCrown.position.set(0, 1.98, -0.06);
  nemesCrown.rotation.x = -0.36;
  nemesCrown.castShadow = true;
  bodyPivot.add(nemesCrown);

  const lappetGeo = new THREE.BoxGeometry(0.13, 0.48, 0.16);
  const leftLappet = new THREE.Mesh(lappetGeo, nemesMat);
  leftLappet.position.set(-0.24, 1.74, 0.05);
  leftLappet.rotation.z = 0.14;
  bodyPivot.add(leftLappet);

  const rightLappet = new THREE.Mesh(lappetGeo, nemesMat);
  rightLappet.position.set(0.24, 1.74, 0.05);
  rightLappet.rotation.z = -0.14;
  bodyPivot.add(rightLappet);

  const headband = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.032, 6, 18), goldMat);
  headband.rotation.x = Math.PI / 2 - 0.1;
  headband.position.set(0, 1.97, 0.02);
  bodyPivot.add(headband);

  const uraeus = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 6), goldMat);
  uraeus.position.set(0, 2.05, 0.24);
  uraeus.rotation.x = 0.28;
  bodyPivot.add(uraeus);

  // Left arm + Gold Wrist Bracer
  const armGeo = new THREE.CapsuleGeometry(0.095, 0.4, 5, 8);
  const leftArm = new THREE.Mesh(armGeo, skinMat);
  leftArm.position.set(-0.42, 1.26, 0);
  leftArm.rotation.z = 0.18;
  leftArm.castShadow = true;
  bodyPivot.add(leftArm);

  const bracerGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.16, 10);
  const bracerL = new THREE.Mesh(bracerGeo, goldMat);
  bracerL.position.y = -0.14;
  leftArm.add(bracerL);

  // Right arm holding Solar Scepter (+Z forward)
  const rightArm = new THREE.Group();
  rightArm.position.set(0.42, 1.4, 0);
  bodyPivot.add(rightArm);

  const rightArmMesh = new THREE.Mesh(armGeo, skinMat);
  rightArmMesh.position.set(0, -0.14, 0.1);
  rightArmMesh.rotation.x = -0.55;
  rightArmMesh.castShadow = true;
  rightArm.add(rightArmMesh);

  const bracerR = new THREE.Mesh(bracerGeo, goldMat);
  bracerR.position.set(0, -0.1, 0.04);
  rightArmMesh.add(bracerR);

  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.028, 1.55, 10), goldMat);
  staff.position.set(0.03, 0.05, 0.38);
  staff.rotation.x = 0.45;
  rightArm.add(staff);

  const scepterRing = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.028, 8, 18), goldMat);
  scepterRing.position.set(0.03, 0.7, 0.69);
  rightArm.add(scepterRing);

  const scepterCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), crystalMat);
  scepterCrystal.position.set(0.03, 0.7, 0.69);
  rightArm.add(scepterCrystal);

  // Ground aim arrow
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 0.44);
  arrowShape.lineTo(0.24, -0.04);
  arrowShape.lineTo(0, 0.08);
  arrowShape.lineTo(-0.24, -0.04);
  arrowShape.closePath();
  const arrowMat = new THREE.MeshBasicMaterial({
    color: 0xfcd34d,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const aimArrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape), arrowMat);
  aimArrow.rotation.x = Math.PI / 2;
  aimArrow.position.set(0, 0.04, 1.18);
  group.add(aimArrow);

  // Bastet Shield
  const bastetShield = new THREE.Mesh(
    new THREE.SphereGeometry(1.28, 22, 16),
    new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x14b8a6,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.25,
      roughness: 0.1,
      depthWrite: false,
    })
  );
  bastetShield.position.y = 1.05;
  bastetShield.visible = false;
  group.add(bastetShield);

  // Ra Solar Flares
  const raFlares: THREE.Mesh[] = [];
  const flareGeo = new THREE.OctahedronGeometry(0.28, 1);
  const flareMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xf97316,
    emissiveIntensity: 2.2,
    roughness: 0.15,
  });
  for (let i = 0; i < 3; i++) {
    const flare = new THREE.Mesh(flareGeo, flareMat);
    flare.visible = false;
    group.add(flare);
    raFlares.push(flare);
  }

  const shared = collectSharedTextures(textures);
  return {
    group,
    bodyPivot,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    cape,
    scepterCrystal,
    bastetShield,
    raFlares,
    aimArrow,
    hitFlashMaterials: [skinMat, linenMat, goldMat, nemesMat],
    dispose: () => disposeObjectResources(group, shared),
  };
}

export function createScarabModel(textures: TextureBundle): EnemyVisual {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);
  group.add(makeContactShadow(textures, 0.72, 0.62));

  // Iridescent jewel scarab carapace
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0x0d6e66,
    roughness: 0.16,
    metalness: 0.72,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    iridescence: 0.95,
    iridescenceIOR: 1.45,
    iridescenceThicknessRange: [180, 480],
    emissive: 0x042f2e,
    emissiveIntensity: 0.28,
  });
  const goldTrimMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    roughness: 0.22,
    metalness: 0.88,
    anisotropy: 0.7,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf97316,
    emissiveIntensity: 2.2,
  });

  // Abdomen elytra dome + pronotum shield
  const carapace = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12), shellMat);
  carapace.scale.set(0.95, 0.56, 1.22);
  carapace.position.set(0, 0.4, -0.06);
  carapace.castShadow = true;
  bodyPivot.add(carapace);

  const pronotum = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), shellMat);
  pronotum.scale.set(1.05, 0.65, 0.82);
  pronotum.position.set(0, 0.38, 0.34);
  pronotum.castShadow = true;
  bodyPivot.add(pronotum);

  // Dorsal gold wing seam & rim
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.82), goldTrimMat);
  seam.position.set(0, 0.58, -0.08);
  bodyPivot.add(seam);

  // Sculpted head + clypeus horn + eyes + mandibles
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), goldTrimMat);
  head.position.set(0, 0.34, 0.56);
  bodyPivot.add(head);

  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 6), goldTrimMat);
  horn.rotation.x = Math.PI / 3;
  horn.position.set(0, 0.46, 0.72);
  bodyPivot.add(horn);

  const eyeGeo = new THREE.SphereGeometry(0.06, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.11, 0.41, 0.68);
  bodyPivot.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.11, 0.41, 0.68);
  bodyPivot.add(eyeR);

  const mandibleGeo = new THREE.ConeGeometry(0.045, 0.28, 5);
  const mandL = new THREE.Mesh(mandibleGeo, goldTrimMat);
  mandL.rotation.x = Math.PI / 2;
  mandL.rotation.z = -0.32;
  mandL.position.set(-0.12, 0.26, 0.78);
  bodyPivot.add(mandL);
  const mandR = new THREE.Mesh(mandibleGeo, goldTrimMat);
  mandR.rotation.x = Math.PI / 2;
  mandR.rotation.z = 0.32;
  mandR.position.set(0.12, 0.26, 0.78);
  bodyPivot.add(mandR);

  // 6 jointed legs
  const legs: THREE.Mesh[] = [];
  const legGeo = new THREE.BoxGeometry(0.36, 0.06, 0.065);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(legGeo, goldTrimMat);
      leg.position.set(side * 0.48, 0.22, -0.26 + i * 0.26);
      leg.rotation.z = side * -0.38;
      bodyPivot.add(leg);
      legs.push(leg);
    }
  }

  const telegraphRing = new THREE.Mesh(
    new THREE.RingGeometry(0.66, 0.9, 24),
    new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.04;
  telegraphRing.visible = false;
  group.add(telegraphRing);

  const shared = collectSharedTextures(textures);
  return {
    group,
    bodyPivot,
    coreMesh: carapace,
    legs,
    telegraphRing,
    hitFlashMaterials: [shellMat, goldTrimMat],
    dispose: () => disposeObjectResources(group, shared),
  };
}

export function createMummyModel(textures: TextureBundle): EnemyVisual {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);
  group.add(makeContactShadow(textures, 0.94, 0.7));

  const linenMat = new THREE.MeshStandardMaterial({
    color: 0xdccaa8,
    map: textures.linenBandage,
    normalMap: textures.linenNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.92,
    metalness: 0.02,
  });
  const darkWrapMat = new THREE.MeshStandardMaterial({
    color: 0x6f5b42,
    map: textures.linenBandage,
    normalMap: textures.linenNormal,
    roughness: 0.9,
  });
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xd97706,
    roughness: 0.28,
    metalness: 0.85,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 2.5,
  });

  // Lower shroud + wrapped torso
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.88, 12), darkWrapMat);
  base.position.y = 0.44;
  base.castShadow = true;
  bodyPivot.add(base);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.28, 0.74, 12), linenMat);
  torso.position.y = 1.2;
  torso.castShadow = true;
  bodyPivot.add(torso);

  const ringGeo = new THREE.TorusGeometry(0.345, 0.055, 6, 14);
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(ringGeo, linenMat);
    band.rotation.x = Math.PI / 2 + (i % 2 === 0 ? 0.16 : -0.16);
    band.position.y = 0.76 + i * 0.28;
    bodyPivot.add(band);
  }

  // Funerary collar & Anubis/pharaoh mask
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.085, 8, 16), goldMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.56;
  bodyPivot.add(collar);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42), linenMat);
  head.position.y = 1.84;
  head.castShadow = true;
  bodyPivot.add(head);

  const maskCrest = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.42, 4), goldMat);
  maskCrest.position.set(0, 2.18, 0);
  maskCrest.rotation.y = Math.PI / 4;
  bodyPivot.add(maskCrest);

  // Jackal/guardian ears
  const earGeo = new THREE.ConeGeometry(0.08, 0.34, 4);
  const earL = new THREE.Mesh(earGeo, goldMat);
  earL.position.set(-0.18, 2.22, -0.04);
  bodyPivot.add(earL);
  const earR = new THREE.Mesh(earGeo, goldMat);
  earR.position.set(0.18, 2.22, -0.04);
  bodyPivot.add(earR);

  const eyeGeo = new THREE.SphereGeometry(0.065, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.1, 1.86, 0.22);
  bodyPivot.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.1, 1.86, 0.22);
  bodyPivot.add(eyeR);

  // Outstretched bandaged arms + dangling wrap strips
  const armGeo = new THREE.BoxGeometry(0.16, 0.16, 0.82);
  const armL = new THREE.Mesh(armGeo, linenMat);
  armL.position.set(-0.42, 1.36, 0.38);
  armL.castShadow = true;
  bodyPivot.add(armL);
  const armR = new THREE.Mesh(armGeo, linenMat);
  armR.position.set(0.42, 1.36, 0.38);
  armR.castShadow = true;
  bodyPivot.add(armR);

  const stripGeo = new THREE.BoxGeometry(0.08, 0.45, 0.04);
  const stripL = new THREE.Mesh(stripGeo, darkWrapMat);
  stripL.position.set(-0.42, 1.1, 0.72);
  bodyPivot.add(stripL);
  const stripR = new THREE.Mesh(stripGeo, darkWrapMat);
  stripR.position.set(0.42, 1.1, 0.72);
  bodyPivot.add(stripR);

  const telegraphRing = new THREE.Mesh(
    new THREE.RingGeometry(0.86, 1.16, 24),
    new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.04;
  telegraphRing.visible = false;
  group.add(telegraphRing);

  const shared = collectSharedTextures(textures);
  return {
    group,
    bodyPivot,
    coreMesh: torso,
    accentMesh: armL,
    ringMesh: armR,
    telegraphRing,
    hitFlashMaterials: [linenMat, darkWrapMat, goldMat],
    dispose: () => disposeObjectResources(group, shared),
  };
}

export function createObeliskModel(textures: TextureBundle): EnemyVisual {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);
  group.add(makeContactShadow(textures, 1.2, 0.74));

  const basaltMat = new THREE.MeshStandardMaterial({
    color: 0x26211f,
    normalMap: textures.wallNormal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.58,
    metalness: 0.35,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x855f38,
    map: textures.wallRelief,
    normalMap: textures.wallNormal,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.74,
    metalness: 0.08,
  });
  const runeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 1.9,
    roughness: 0.2,
  });

  const plinth1 = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.36, 1.75), basaltMat);
  plinth1.position.y = 0.18;
  plinth1.castShadow = true;
  plinth1.receiveShadow = true;
  bodyPivot.add(plinth1);

  const plinth2 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.34, 1.3), basaltMat);
  plinth2.position.y = 0.52;
  plinth2.castShadow = true;
  bodyPivot.add(plinth2);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 2.38, 4), stoneMat);
  shaft.rotation.y = Math.PI / 4;
  shaft.position.y = 1.87;
  shaft.castShadow = true;
  bodyPivot.add(shaft);

  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.65, 4), basaltMat);
  tip.rotation.y = Math.PI / 4;
  tip.position.y = 3.38;
  tip.castShadow = true;
  bodyPivot.add(tip);

  const runeBand = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.16, 0.84), runeMat);
  runeBand.position.y = 2.02;
  bodyPivot.add(runeBand);

  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), runeMat);
  crystal.position.y = 4.22;
  bodyPivot.add(crystal);

  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.045, 6, 20), runeMat);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.y = 4.22;
  bodyPivot.add(ringMesh);

  const telegraphRing = new THREE.Mesh(
    new THREE.RingGeometry(1.06, 1.4, 28),
    new THREE.MeshBasicMaterial({
      color: 0xfb923c,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.04;
  telegraphRing.visible = false;
  group.add(telegraphRing);

  const shared = collectSharedTextures(textures);
  return {
    group,
    bodyPivot,
    coreMesh: crystal,
    accentMesh: runeBand,
    ringMesh,
    telegraphRing,
    hitFlashMaterials: [basaltMat, stoneMat],
    dispose: () => disposeObjectResources(group, shared),
  };
}

export function createBossModel(textures: TextureBundle): EnemyVisual {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);
  group.add(makeContactShadow(textures, 2.2, 0.84));

  const obsidianMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a1024,
    normalMap: textures.wallNormal,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.28,
    metalness: 0.65,
    iridescence: 0.72,
    iridescenceIOR: 1.4,
    clearcoat: 0.85,
  });
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    roughness: 0.2,
    metalness: 0.92,
    anisotropy: 0.8,
    emissive: 0x451a03,
    emissiveIntensity: 0.28,
  });
  const voidCoreMat = new THREE.MeshStandardMaterial({
    color: 0xf472b6,
    emissive: 0xdb2777,
    emissiveIntensity: 2.3,
    roughness: 0.15,
  });

  // Undulating multi-segment serpent tail trailing behind
  const tailSegments: THREE.Mesh[] = [];
  for (let s = 0; s < 5; s++) {
    const rad = 0.56 - s * 0.085;
    const seg = new THREE.Mesh(new THREE.SphereGeometry(rad, 12, 10), obsidianMat);
    seg.scale.set(1, 0.72, 1.35);
    seg.position.set(0, rad * 0.7, -0.8 - s * 0.68);
    seg.castShadow = true;
    bodyPivot.add(seg);
    tailSegments.push(seg);
  }

  // Coiled serpent base ring
  const coil1 = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.28, 12, 26), obsidianMat);
  coil1.rotation.x = Math.PI / 2;
  coil1.position.y = 0.34;
  coil1.castShadow = true;
  bodyPivot.add(coil1);

  // Towering serpentine torso + golden rib plates
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.7, 1.9, 14), obsidianMat);
  torso.position.y = 1.65;
  torso.castShadow = true;
  bodyPivot.add(torso);

  const rib = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.095, 8, 18), goldMat);
  rib.rotation.x = Math.PI / 2;
  rib.position.y = 2.22;
  bodyPivot.add(rib);

  // Sculpted Cobra Hood
  const hoodShape = new THREE.Shape();
  hoodShape.moveTo(0, -0.82);
  hoodShape.bezierCurveTo(1.3, -0.5, 1.45, 0.72, 0.46, 1.18);
  hoodShape.lineTo(0, 1.38);
  hoodShape.lineTo(-0.46, 1.18);
  hoodShape.bezierCurveTo(-1.45, 0.72, -1.3, -0.5, 0, -0.82);
  const hoodGeo = new THREE.ExtrudeGeometry(hoodShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  hoodGeo.center();
  const hood = new THREE.Mesh(hoodGeo, obsidianMat);
  hood.position.set(0, 3.08, -0.15);
  hood.castShadow = true;
  bodyPivot.add(hood);

  // Head + Horns + Fangs + Crimson Eyes
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 12), obsidianMat);
  head.scale.set(0.95, 0.88, 1.38);
  head.position.set(0, 3.18, 0.3);
  bodyPivot.add(head);

  const hornGeo = new THREE.ConeGeometry(0.11, 0.82, 8);
  const hornL = new THREE.Mesh(hornGeo, goldMat);
  hornL.position.set(-0.36, 3.76, 0.14);
  hornL.rotation.z = 0.44;
  bodyPivot.add(hornL);
  const hornR = new THREE.Mesh(hornGeo, goldMat);
  hornR.position.set(0.36, 3.76, 0.14);
  hornR.rotation.z = -0.44;
  bodyPivot.add(hornR);

  const eyeGeo = new THREE.SphereGeometry(0.09, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeo, voidCoreMat);
  eyeL.position.set(-0.2, 3.25, 0.7);
  bodyPivot.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, voidCoreMat);
  eyeR.position.set(0.2, 3.25, 0.7);
  bodyPivot.add(eyeR);

  const coreCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.44, 0), voidCoreMat);
  coreCrystal.position.set(0, 2.08, 0.66);
  bodyPivot.add(coreCrystal);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.065, 8, 36), voidCoreMat);
  halo.position.set(0, 2.68, -0.36);
  bodyPivot.add(halo);

  const telegraphRing = new THREE.Mesh(
    new THREE.RingGeometry(1.65, 2.18, 32),
    new THREE.MeshBasicMaterial({
      color: 0xec4899,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.05;
  telegraphRing.visible = false;
  group.add(telegraphRing);

  const shared = collectSharedTextures(textures);
  return {
    group,
    bodyPivot,
    coreMesh: coreCrystal,
    ringMesh: halo,
    tailSegments,
    telegraphRing,
    hitFlashMaterials: [obsidianMat, goldMat],
    dispose: () => disposeObjectResources(group, shared),
  };
}

export function createPillarModel(textures: TextureBundle, radiusWorld: number): THREE.Group {
  const group = new THREE.Group();
  group.add(makeContactShadow(textures, radiusWorld * 1.18, 0.68));

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xc59760,
    map: textures.pillarFrieze,
    normalMap: textures.pillarNormal,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughness: 0.76,
    metalness: 0.05,
  });
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x8f663a,
    map: textures.wallRelief,
    normalMap: textures.wallNormal,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.85,
    metalness: 0.04,
  });
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xd97706,
    roughness: 0.25,
    metalness: 0.86,
    anisotropy: 0.7,
  });

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(radiusWorld * 2.08, 0.46, radiusWorld * 2.08),
    baseMat
  );
  plinth.position.y = 0.23;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusWorld * 0.76, radiusWorld * 0.88, 4.4, 16),
    stoneMat
  );
  shaft.position.y = 2.66;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(radiusWorld * 0.82, 0.095, 8, 20), goldMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 4.68;
  group.add(collar);

  const capital = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusWorld * 1.2, radiusWorld * 0.76, 0.74, 16),
    stoneMat
  );
  capital.position.y = 5.06;
  capital.castShadow = true;
  group.add(capital);

  const abacus = new THREE.Mesh(
    new THREE.BoxGeometry(radiusWorld * 2.18, 0.3, radiusWorld * 2.18),
    baseMat
  );
  abacus.position.y = 5.58;
  abacus.castShadow = true;
  group.add(abacus);

  return group;
}

export function createSpikeTrapModel(textures: TextureBundle, widthWorld: number): TrapVisual {
  const group = new THREE.Group();

  const plateMat = new THREE.MeshStandardMaterial({
    map: textures.trapPlate,
    normalMap: textures.wallNormal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.65,
    metalness: 0.32,
  });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(widthWorld, 0.06, widthWorld), plateMat);
  plate.position.y = 0.03;
  plate.receiveShadow = true;
  group.add(plate);

  const warningMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.3,
    roughness: 0.35,
  });
  const warningFrame = new THREE.Mesh(
    new THREE.RingGeometry(widthWorld * 0.56, widthWorld * 0.68, 4),
    warningMat
  );
  warningFrame.rotation.x = -Math.PI / 2;
  warningFrame.rotation.z = Math.PI / 4;
  warningFrame.position.y = 0.065;
  group.add(warningFrame);

  const spikesGroup = new THREE.Group();
  spikesGroup.position.y = -0.65;
  group.add(spikesGroup);

  const spikeGeo = new THREE.ConeGeometry(0.18, 0.88, 4);
  const spikeMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    roughness: 0.18,
    metalness: 0.92,
    anisotropy: 0.7,
    emissive: 0x450a0a,
    emissiveIntensity: 0.22,
  });

  const step = widthWorld * 0.26;
  for (let gx = -1; gx <= 1; gx++) {
    for (let gz = -1; gz <= 1; gz++) {
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(gx * step, 0.44, gz * step);
      spike.rotation.y = Math.PI / 4;
      spike.castShadow = true;
      spikesGroup.add(spike);
    }
  }

  const shared = collectSharedTextures(textures);
  return {
    group,
    spikesGroup,
    warningFrame,
    warningMat,
    dispose: () => disposeObjectResources(group, shared),
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
    opacity: 0.68,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const groundRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.98, 28), ringMat);
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.04;
  group.add(groundRing);

  const stelePivot = new THREE.Group();
  stelePivot.position.y = 1.28;
  group.add(stelePivot);

  const steleMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    roughness: 0.22,
    metalness: 0.9,
    anisotropy: 0.75,
    emissive: 0x451a03,
    emissiveIntensity: 0.45,
  });

  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.14, 1.46, 0.16), steleMat);
  slab.castShadow = true;
  stelePivot.add(slab);

  const topCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.57, 0.57, 0.16, 16, 1, false, 0, Math.PI),
    steleMat
  );
  topCap.rotation.z = Math.PI / 2;
  topCap.rotation.y = Math.PI / 2;
  topCap.position.y = 0.73;
  stelePivot.add(topCap);

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

  const shared = collectSharedTextures(textures);
  return {
    group,
    stelePivot,
    frontFace,
    backFace,
    groundRing,
    ringMat,
    steleMat,
    dispose: () => {
      const m = frontFace.material as THREE.MeshBasicMaterial;
      if (m.map) shared.add(m.map);
      disposeObjectResources(group, shared);
    },
  };
}

export function createBrazierModel(textures: TextureBundle, withLight = false): BrazierVisual {
  const group = new THREE.Group();

  const bronzeMat = new THREE.MeshPhysicalMaterial({
    color: 0x784b20,
    roughness: 0.36,
    metalness: 0.84,
    anisotropy: 0.6,
  });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 2.5,
    roughness: 0.35,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.54, 0.78, 10), bronzeMat);
  base.position.y = 0.39;
  base.castShadow = true;
  group.add(base);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.3, 0.42, 12), bronzeMat);
  bowl.position.y = 0.94;
  bowl.castShadow = true;
  group.add(bowl);

  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), emberMat);
  ember.scale.set(1, 0.35, 1);
  ember.position.y = 1.1;
  group.add(ember);

  const flameOuter = new THREE.Mesh(
    new THREE.ConeGeometry(0.34, 1.08, 7),
    new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.86 })
  );
  flameOuter.position.y = 1.58;
  group.add(flameOuter);

  const flameInner = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.72, 6),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.96 })
  );
  flameInner.position.y = 1.46;
  group.add(flameInner);

  let fireLight: THREE.PointLight | undefined;
  if (withLight) {
    fireLight = new THREE.PointLight(0xfb923c, 3.8, 18, 1.5);
    fireLight.position.set(0, 1.9, 0);
    group.add(fireLight);
  }

  const shared = collectSharedTextures(textures);
  return {
    group,
    flameOuter,
    flameInner,
    emberMat,
    fireLight,
    dispose: () => disposeObjectResources(group, shared),
  };
}

export function createNorthPortalModel(textures: TextureBundle): PortalVisual {
  const group = new THREE.Group();

  const pylonMat = new THREE.MeshStandardMaterial({
    color: 0xc29359,
    map: textures.wallRelief,
    normalMap: textures.wallNormal,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughness: 0.75,
    metalness: 0.06,
  });
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    roughness: 0.2,
    metalness: 0.92,
    anisotropy: 0.8,
  });

  // Battered / Monumental Temple Pylons
  const pylonGeo = new THREE.CylinderGeometry(1.1, 1.45, 5.5, 4);
  pylonGeo.rotateY(Math.PI / 4);
  const leftPylon = new THREE.Mesh(pylonGeo, pylonMat);
  leftPylon.position.set(-2.45, 2.75, 0);
  leftPylon.castShadow = true;
  leftPylon.receiveShadow = true;
  group.add(leftPylon);

  const rightPylon = new THREE.Mesh(pylonGeo, pylonMat);
  rightPylon.position.set(2.45, 2.75, 0);
  rightPylon.castShadow = true;
  rightPylon.receiveShadow = true;
  group.add(rightPylon);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.95, 1.58), pylonMat);
  lintel.position.set(0, 5.5, 0);
  lintel.castShadow = true;
  group.add(lintel);

  const sunDisk = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.24, 20), goldMat);
  sunDisk.rotation.x = Math.PI / 2;
  sunDisk.position.set(0, 5.52, 0.8);
  group.add(sunDisk);

  const wingGeo = new THREE.BoxGeometry(1.9, 0.28, 0.16);
  const wingL = new THREE.Mesh(wingGeo, goldMat);
  wingL.position.set(-1.48, 5.52, 0.78);
  wingL.rotation.z = 0.08;
  group.add(wingL);
  const wingR = new THREE.Mesh(wingGeo, goldMat);
  wingR.position.set(1.48, 5.52, 0.78);
  wingR.rotation.z = -0.08;
  group.add(wingR);

  const step = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.18, 2.1), goldMat);
  step.position.set(0, 0.09, 0.35);
  step.receiveShadow = true;
  group.add(step);

  const vortexMat = new THREE.MeshBasicMaterial({
    map: textures.glowDisc,
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const vortexDisc = new THREE.Mesh(new THREE.CircleGeometry(1.95, 32), vortexMat);
  vortexDisc.position.set(0, 2.5, 0);
  group.add(vortexDisc);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    emissive: 0x1e293b,
    emissiveIntensity: 0.4,
    roughness: 0.22,
    metalness: 0.85,
  });
  const vortexRing = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.14, 10, 36), ringMat);
  vortexRing.position.set(0, 2.5, 0);
  group.add(vortexRing);

  const portalLight = new THREE.PointLight(0xfbbf24, 1.4, 18, 1.5);
  portalLight.position.set(0, 2.7, 1.5);
  group.add(portalLight);

  const shared = collectSharedTextures(textures);
  return {
    group,
    vortexDisc,
    vortexRing,
    portalLight,
    vortexMat,
    ringMat,
    dispose: () => disposeObjectResources(group, shared),
  };
}

function createPalmTree(trunkMat: THREE.Material, leafMat: THREE.Material): { tree: THREE.Group; crown: THREE.Group } {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.34, 5.2, 8), trunkMat);
  trunk.position.y = 2.6;
  trunk.rotation.z = 0.08;
  trunk.castShadow = true;
  tree.add(trunk);

  const crown = new THREE.Group();
  crown.position.set(-0.22, 5.15, 0);
  tree.add(crown);

  const frondGeo = new THREE.ConeGeometry(0.52, 2.8, 4);
  frondGeo.scale(0.35, 1, 1.4);
  frondGeo.translate(0, 1.3, 0);
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2;
    const frond = new THREE.Mesh(frondGeo, leafMat);
    frond.rotation.y = ang;
    frond.rotation.x = 1.08 + (i % 2) * 0.15;
    frond.castShadow = true;
    crown.add(frond);
  }
  return { tree, crown };
}

export function buildTempleAndDesertScenery(
  textures: TextureBundle,
  arenaW: number,
  arenaD: number,
  wallPad: number
): SceneryBundle {
  const group = new THREE.Group();

  // 0. Atmospheric Twilight Sky Dome with Moon/Horizon Scattering Shader
  const skyUniforms: SkyUniforms = {
    uZenithColor: { value: new THREE.Color(0x070a18) },
    uHorizonColor: { value: new THREE.Color(0x3b2112) },
    uGlowColor: { value: new THREE.Color(0xd97706) },
    uSunDir: { value: new THREE.Vector3(0.08, 0.22, -0.97).normalize() },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms as unknown as Record<string, THREE.IUniform>,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uGlowColor;
      uniform vec3 uSunDir;
      varying vec3 vWorldDir;
      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 sky = mix(uHorizonColor, uZenithColor, pow(h, 0.52));
        float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
        sky += uGlowColor * pow(sunAmt, 10.0) * 0.42;
        sky += vec3(1.0, 0.92, 0.75) * smoothstep(0.996, 0.9992, sunAmt) * 1.15;
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 16), skyMat);
  group.add(skyDome);

  // 1. Playable Sandstone Temple Courtyard Floor with Full PBR Maps
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xd0a268,
    map: textures.sandstoneFloor,
    normalMap: textures.sandstoneFloorNormal,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: textures.sandstoneFloorRoughness,
    roughness: 0.92,
    metalness: 0.04,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(arenaW, arenaD), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Inlaid Golden Sun-Disk Medallion in courtyard center (with polygonOffset against Z-fighting)
  const inlayMat = new THREE.MeshPhysicalMaterial({
    color: 0xd97706,
    roughness: 0.24,
    metalness: 0.88,
    anisotropy: 0.75,
    emissive: 0x451a03,
    emissiveIntensity: 0.22,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const centerRing = new THREE.Mesh(new THREE.RingGeometry(3.8, 4.18, 48), inlayMat);
  centerRing.rotation.x = -Math.PI / 2;
  centerRing.position.y = 0.015;
  group.add(centerRing);

  const innerRing = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.74, 36), inlayMat);
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.015;
  group.add(innerRing);

  // 2. Perimeter Open Colonnade Parapet Walls with Ashlar Normal Map
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xb8894f,
    map: textures.wallRelief,
    normalMap: textures.wallNormal,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughness: 0.8,
    metalness: 0.05,
  });
  const trimMat = new THREE.MeshPhysicalMaterial({
    color: 0xd97706,
    roughness: 0.28,
    metalness: 0.82,
  });

  const halfW = arenaW / 2;
  const halfD = arenaD / 2;
  const innerHalfW = halfW - wallPad;
  const innerHalfD = halfD - wallPad;

  const northSegW = (arenaW - 7.1) / 2;
  const northWallL = new THREE.Mesh(new THREE.BoxGeometry(northSegW, 2.85, wallPad), wallMat);
  northWallL.position.set(-halfW + northSegW / 2, 1.425, -innerHalfD - wallPad / 2);
  northWallL.castShadow = true;
  northWallL.receiveShadow = true;
  group.add(northWallL);

  const northWallR = new THREE.Mesh(new THREE.BoxGeometry(northSegW, 2.85, wallPad), wallMat);
  northWallR.position.set(halfW - northSegW / 2, 1.425, -innerHalfD - wallPad / 2);
  northWallR.castShadow = true;
  northWallR.receiveShadow = true;
  group.add(northWallR);

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

  // Outer Colonnade Decorative Columns flanking the courtyard perimeter
  const outerColGeo = new THREE.CylinderGeometry(0.42, 0.48, 3.6, 12);
  const outerColMat = new THREE.MeshStandardMaterial({
    color: 0xc2955e,
    map: textures.pillarFrieze,
    normalMap: textures.pillarNormal,
    roughness: 0.78,
  });
  for (const side of [-1, 1]) {
    for (let z = -10; z <= 10; z += 6.6) {
      const col = new THREE.Mesh(outerColGeo, outerColMat);
      col.position.set(side * (halfW + 0.35), 1.8, z);
      col.castShadow = true;
      group.add(col);
    }
  }

  const rimN = new THREE.Mesh(new THREE.BoxGeometry(arenaW, 0.14, 0.25), trimMat);
  rimN.position.set(0, 0.07, -innerHalfD);
  group.add(rimN);
  const rimS = new THREE.Mesh(new THREE.BoxGeometry(arenaW, 0.14, 0.25), trimMat);
  rimS.position.set(0, 0.07, innerHalfD);
  group.add(rimS);

  // 3. Two Flanking Shimmering Nile Oasis Water Canals
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0c4a6e,
    normalMap: textures.waterNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.09,
    metalness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    reflectivity: 0.95,
  });
  const canalGeo = new THREE.PlaneGeometry(7.2, arenaD + 16);
  const canalW = new THREE.Mesh(canalGeo, waterMat);
  canalW.rotation.x = -Math.PI / 2;
  canalW.position.set(-halfW - 4.6, -0.08, 0);
  group.add(canalW);

  const canalE = new THREE.Mesh(canalGeo, waterMat);
  canalE.rotation.x = -Math.PI / 2;
  canalE.position.set(halfW + 4.6, -0.08, 0);
  group.add(canalE);

  // Date Palm Trees bordering the Nile oasis canals
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4c2f, roughness: 0.92 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f5e2e, roughness: 0.72, side: THREE.DoubleSide });
  const palmCrowns: THREE.Group[] = [];
  const palmCoords: [number, number][] = [
    [-halfW - 9.2, -11],
    [-halfW - 9.8, 3],
    [-halfW - 8.8, 14],
    [halfW + 9.2, -9],
    [halfW + 9.6, 5],
    [halfW + 8.8, 15],
  ];
  for (const [px, pz] of palmCoords) {
    const { tree, crown } = createPalmTree(trunkMat, leafMat);
    tree.position.set(px, -0.2, pz);
    tree.rotation.y = px * 0.7;
    group.add(tree);
    palmCrowns.push(crown);
  }

  // 4. North Portal + Torch Braziers (2 portal braziers cast real dynamic firelight!)
  const portal = createNorthPortalModel(textures);
  portal.group.position.set(0, 0, -innerHalfD + 0.35);
  group.add(portal.group);

  const braziers: BrazierVisual[] = [];
  const brazierCoords: { x: number; z: number; light: boolean }[] = [
    { x: -4.4, z: -innerHalfD + 1.0, light: true },
    { x: 4.4, z: -innerHalfD + 1.0, light: true },
    { x: -innerHalfW - 0.8, z: -innerHalfD + 1.5, light: false },
    { x: innerHalfW + 0.8, z: -innerHalfD + 1.5, light: false },
    { x: -innerHalfW - 0.8, z: innerHalfD - 1.5, light: false },
    { x: innerHalfW + 0.8, z: innerHalfD - 1.5, light: false },
  ];
  for (const bc of brazierCoords) {
    const b = createBrazierModel(textures, bc.light);
    b.group.position.set(bc.x, 0, bc.z);
    group.add(b.group);
    braziers.push(b);
  }

  // Subtle Volumetric-Feel Slanted Light Shafts on Central Altar & Portal
  const shaftMat = new THREE.MeshBasicMaterial({
    color: 0xfde68a,
    transparent: true,
    opacity: 0.045,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shaft1 = new THREE.Mesh(new THREE.ConeGeometry(4.2, 22, 16, 1, true), shaftMat);
  shaft1.position.set(2.2, 9.5, -1.5);
  shaft1.rotation.z = 0.24;
  group.add(shaft1);

  const shaft2 = new THREE.Mesh(new THREE.ConeGeometry(3.4, 20, 16, 1, true), shaftMat);
  shaft2.position.set(1.5, 9.0, -innerHalfD + 1.2);
  shaft2.rotation.z = 0.2;
  group.add(shaft2);

  // 5. Endless Wind-Rippled Sahara Desert Terrain & Textured Great Pyramids
  const desertMat = new THREE.MeshStandardMaterial({
    color: 0x8a6136,
    map: textures.desertSand,
    normalMap: textures.desertSandNormal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughness: 0.94,
    metalness: 0.02,
  });
  const desertGeo = new THREE.PlaneGeometry(340, 340, 44, 44);
  const posAttr = desertGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const distFromCourt = Math.max(Math.abs(x) - halfW - 10, Math.abs(y) - halfD - 2, 0);
    const blend = Math.min(1, distFromCourt / 18);
    const dune =
      (Math.sin(x * 0.06) * 2.5 + Math.cos(y * 0.05 + x * 0.025) * 2.1 + Math.sin((x + y) * 0.09) * 0.9) *
      blend;
    posAttr.setZ(i, dune - 0.35);
  }
  desertGeo.computeVertexNormals();
  const desert = new THREE.Mesh(desertGeo, desertMat);
  desert.rotation.x = -Math.PI / 2;
  desert.receiveShadow = true;
  group.add(desert);

  // Stepped Masonry Giza Pyramids with Normal-Mapped Limestone
  const pyramidMat = new THREE.MeshStandardMaterial({
    color: 0x9c7240,
    map: textures.wallRelief,
    normalMap: textures.wallNormal,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.88,
    metalness: 0.04,
  });
  const pyramidCapMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    roughness: 0.2,
    metalness: 0.92,
    anisotropy: 0.8,
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

    const capH = spec.h * 0.14;
    const capR = spec.r * 0.14;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(capR, capH, 4), pyramidCapMat);
    cap.rotation.y = Math.PI / 4;
    cap.position.set(spec.x, spec.h - capH / 2 - 0.28, spec.z);
    group.add(cap);
  }

  // 6. Starlit Night Sky & Drifting Desert Sand Dust Motes
  const starCount = 380;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * (Math.PI * 0.42);
    const radius = 148 + Math.random() * 25;
    starPositions[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
    starPositions[i * 3 + 1] = Math.cos(phi) * radius + 8;
    starPositions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius - 20;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starField = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xfef3c7, size: 0.72, transparent: true, opacity: 0.85, fog: false })
  );
  group.add(starField);

  // Atmospheric golden sand motes floating in torchlight
  const dustCount = 140;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * arenaW;
    dustPositions[i * 3 + 1] = 0.4 + Math.random() * 5.2;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * arenaD;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustField = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      map: textures.dustMote,
      size: 0.26,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  group.add(dustField);

  const shared = collectSharedTextures(textures);
  return {
    group,
    floorMat,
    waterMat,
    skyUniforms,
    portal,
    braziers,
    palmCrowns,
    starField,
    dustField,
    dispose: () => {
      portal.dispose();
      braziers.forEach((b) => b.dispose());
      disposeObjectResources(group, shared);
    },
  };
}
