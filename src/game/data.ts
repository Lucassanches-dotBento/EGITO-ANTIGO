export type Language = 'pt' | 'en' | 'es';

export type GodId = 'bastet' | 'anubis' | 'osiris' | 'horus' | 'ra';

export const HIEROGLYPH_MAP: Record<string, string> = {
  a: '𓄿',
  b: '𓃀',
  c: '𓎡',
  d: '𓂧',
  e: '𓇋',
  f: '𓆑',
  g: '𓎼',
  h: '𓉔',
  i: '𓇋',
  j: '𓆓',
  k: '𓎡',
  l: '𓃭',
  m: '𓅓',
  n: '𓈖',
  o: '𓍯',
  p: '𓊪',
  q: '𓈎',
  r: '𓂋',
  s: '𓋴',
  t: '𓏏',
  u: '𓅱',
  v: '𓆑',
  w: '𓅱',
  x: '𓎡𓋴',
  y: '𓇋',
  z: '𓊃',
};

export function translateToHieroglyphs(input: string): string {
  const normalized = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!normalized) return '𓄿';
  const glyphs: string[] = [];
  for (const ch of normalized) {
    if (HIEROGLYPH_MAP[ch]) {
      glyphs.push(HIEROGLYPH_MAP[ch]);
    } else if (ch === ' ') {
      glyphs.push('·');
    }
  }
  return glyphs.join(' ') || '𓄿';
}

export function letterToHieroglyph(ch: string): string {
  const lower = ch.toLowerCase();
  return HIEROGLYPH_MAP[lower] || '𓄿';
}

export interface GodInfo {
  id: GodId;
  portrait: string;
  accentColor: string;
  secondaryColor: string;
  name: Record<Language, string>;
  title: Record<Language, string>;
  lore: Record<Language, string>;
  powerName: Record<Language, string>;
  powerDesc: Record<Language, string>;
}

export const GODS: Record<GodId, GodInfo> = {
  bastet: {
    id: 'bastet',
    portrait: '/src/assets/images/god_bastet_portrait_1795612655969.jpg',
    accentColor: '#F59E0B',
    secondaryColor: '#2DD4BF',
    name: { pt: 'Bastet', en: 'Bastet', es: 'Bastet' },
    title: {
      pt: 'Deusa Guardiã do Templo',
      en: 'Guardian Goddess of the Temple',
      es: 'Diosa Guardiana del Templo',
    },
    lore: {
      pt: 'Venerada como protetora do lar real e dos templos sagrados, Bastet une a agilidade felina à luz protetora do sistro dourado.',
      en: 'Revered as protector of royal sanctuaries and sacred temples, Bastet unites feline agility with the golden glow of her sistrum.',
      es: 'Venerada como protectora de los templos sagrados, Bastet une la agilidad felina con el resplandor dorado de su sistro.',
    },
    powerName: {
      pt: 'Véu de Bastet',
      en: 'Veil of Bastet',
      es: 'Velo de Bastet',
    },
    powerDesc: {
      pt: 'Escudo felino e +45% velocidade por 2,8s; destrói escaravelhos ao toque.',
      en: 'Feline shield and +45% speed for 2.8s; shatters scarabs on contact.',
      es: 'Escudo felino y +45% de velocidad por 2,8s; destruye escarabajos al contacto.',
    },
  },
  anubis: {
    id: 'anubis',
    portrait: '/src/assets/images/god_anubis_portrait_1795612654577.jpg',
    accentColor: '#FBBF24',
    secondaryColor: '#3B82F6',
    name: { pt: 'Anúbis', en: 'Anubis', es: 'Anubis' },
    title: {
      pt: 'Guardião e Guia das Almas',
      en: 'Guardian & Guide of Souls',
      es: 'Guardián y Guía de Almas',
    },
    lore: {
      pt: 'Também chamado de Anupo, é o deus egípcio protetor e guia dos mortos, associado ao Olho de Hórus e aos ritos sagrados dos faraós.',
      en: 'Also called Anpu, the jackal-headed guardian who guides souls to Osiris and presides over sacred funerary rites.',
      es: 'También llamado Anpu, el dios protector con cabeza de chacal que guía a las almas y custodia los ritos sagrados.',
    },
    powerName: {
      pt: 'Juízo de Anúbis',
      en: 'Judgment of Anubis',
      es: 'Juicio de Anubis',
    },
    powerDesc: {
      pt: 'Onda do além que bane inimigos próximos e dissipa projéteis sombrios.',
      en: 'Underworld shockwave that banishes nearby foes and clears dark orbs.',
      es: 'Onda del más allá que destierra enemigos cercanos y disipa orbes oscuros.',
    },
  },
  osiris: {
    id: 'osiris',
    portrait: '/src/assets/images/god_osiris_portrait_1795612656253.jpg',
    accentColor: '#10B981',
    secondaryColor: '#F59E0B',
    name: { pt: 'Osíris', en: 'Osiris', es: 'Osiris' },
    title: {
      pt: 'Senhor do Além e do Nilo',
      en: 'Lord of the Afterlife & Nile',
      es: 'Señor del Más Allá y del Nilo',
    },
    lore: {
      pt: 'Deus do julgamento, do além e da vegetação, seus cultos floresceram desde 2400 a.C. em grandes templos erguidos ao longo do Nilo.',
      en: 'God of judgment, renewal, and vegetation, whose sacred temples flourished along the Nile from 2400 BCE.',
      es: 'Dios del juicio, la renovación y la vegetación, venerado en grandes templos a lo largo del Nilo desde el 2400 a.C.',
    },
    powerName: {
      pt: 'Renovação do Nilo',
      en: 'Nile Renewal',
      es: 'Renovación del Nilo',
    },
    powerDesc: {
      pt: 'Restaura 1 Ankh de vida e desacelera todos os inimigos por 4s.',
      en: 'Restores 1 Ankh health and slows all chamber enemies for 4s.',
      es: 'Restaura 1 Ankh de vida y ralentiza a todos los enemigos durante 4s.',
    },
  },
  horus: {
    id: 'horus',
    portrait: '/src/assets/images/god_horus_portrait_1795612655493.jpg',
    accentColor: '#38BDF8',
    secondaryColor: '#F59E0B',
    name: { pt: 'Hórus', en: 'Horus', es: 'Horus' },
    title: {
      pt: 'Deus Solar dos Céus',
      en: 'Solar God of the Heavens',
      es: 'Dios Solar de los Cielos',
    },
    lore: {
      pt: 'Associado ao firmamento, representa a luz, o poder e a realeza. Desde 2200 a.C., simboliza o Egito unificado sob o olhar do falcão.',
      en: 'Associated with the sky, representing light, power, and kingship. From 2200 BCE, the falcon symbolized unified Egypt.',
      es: 'Asociado al firmamento, representa la luz, el poder y la realeza del Egipto unificado bajo la mirada del halcón.',
    },
    powerName: {
      pt: 'Olho de Hórus',
      en: 'Eye of Horus',
      es: 'Ojo de Horus',
    },
    powerDesc: {
      pt: 'Dispara um feixe celeste perfurante através de toda a câmara.',
      en: 'Fires a piercing celestial falcon beam across the entire chamber.',
      es: 'Dispara un rayo celeste perforante a través de toda la cámara.',
    },
  },
  ra: {
    id: 'ra',
    portrait: '/src/assets/images/god_ra_portrait_1795612654893.jpg',
    accentColor: '#FCD34D',
    secondaryColor: '#EA580C',
    name: { pt: 'Rá', en: 'Ra', es: 'Ra' },
    title: {
      pt: 'Deus Sol Criador de Heliópolis',
      en: 'Sun God & Creator of Heliopolis',
      es: 'Dios Sol Creador de Heliópolis',
    },
    lore: {
      pt: 'Divindade primordial do sol e da ordem divina, venerado por vinte séculos como fonte de vida e ancestral direto dos faraós.',
      en: 'Primordial deity of the Sun and divine order, worshipped for twenty centuries as the source of life and royal lineage.',
      es: 'Deidad primordial del Sol y del orden divino, venerado durante veinte siglos como fuente de vida y linaje real.',
    },
    powerName: {
      pt: 'Chama Solar de Rá',
      en: 'Solar Flare of Ra',
      es: 'Llama Solar de Ra',
    },
    powerDesc: {
      pt: 'Invoca 3 discos solares orbitantes que queimam inimigos por 5s.',
      en: 'Summons 3 orbiting solar disks that scorch nearby foes for 5s.',
      es: 'Invoca 3 discos solares orbitantes que queman enemigos durante 5s.',
    },
  },
};

export interface ChamberDef {
  index: number;
  godId: GodId;
  word: string;
  chamberName: Record<Language, string>;
  subtitle: Record<Language, string>;
  floorTint: string;
  pillarCount: number;
  scarabCount: number;
  mummyCount: number;
  obeliskCount: number;
  spikeTrapCount: number;
  hasBoss: boolean;
}

export const CHAMBERS: ChamberDef[] = [
  {
    index: 0,
    godId: 'bastet',
    word: 'SOL',
    chamberName: {
      pt: 'Câmara I · Santuário de Bastet',
      en: 'Chamber I · Sanctuary of Bastet',
      es: 'Cámara I · Santuario de Bastet',
    },
    subtitle: {
      pt: 'Sela os 3 hieróglifos solares e evite os escaravelhos da entrada.',
      en: 'Seal the 3 solar hieroglyphs and evade the temple scarabs.',
      es: 'Sella los 3 jeroglíficos solares y esquiva a los escarabajos.',
    },
    floorTint: '#1D150B',
    pillarCount: 4,
    scarabCount: 7,
    mummyCount: 1,
    obeliskCount: 0,
    spikeTrapCount: 3,
    hasBoss: false,
  },
  {
    index: 1,
    godId: 'anubis',
    word: 'ALMA',
    chamberName: {
      pt: 'Câmara II · Salão de Anúbis',
      en: 'Chamber II · Hall of Anubis',
      es: 'Cámara II · Salón de Anubis',
    },
    subtitle: {
      pt: 'Sentinelas mumificados patrulham as balanças do julgamento.',
      en: 'Mummified sentinels patrol the scales of judgment.',
      es: 'Centinelas momificados patrullan las balanzas del juicio.',
    },
    floorTint: '#17141F',
    pillarCount: 4,
    scarabCount: 7,
    mummyCount: 3,
    obeliskCount: 1,
    spikeTrapCount: 4,
    hasBoss: false,
  },
  {
    index: 2,
    godId: 'osiris',
    word: 'NILO',
    chamberName: {
      pt: 'Câmara III · Jardim de Osíris',
      en: 'Chamber III · Garden of Osiris',
      es: 'Cámara III · Jardín de Osiris',
    },
    subtitle: {
      pt: 'Obeliscos amaldiçoados disparam orbes sobre os canais do Nilo.',
      en: 'Cursed obelisks fire orbs across the sacred Nile channels.',
      es: 'Obeliscos malditos disparan orbes sobre los canales del Nilo.',
    },
    floorTint: '#0E1C1A',
    pillarCount: 4,
    scarabCount: 8,
    mummyCount: 3,
    obeliskCount: 3,
    spikeTrapCount: 4,
    hasBoss: false,
  },
  {
    index: 3,
    godId: 'horus',
    word: 'REIS',
    chamberName: {
      pt: 'Câmara IV · Mirante de Hórus',
      en: 'Chamber IV · Horizon of Horus',
      es: 'Cámara IV · Mirador de Horus',
    },
    subtitle: {
      pt: 'Desvie do fogo cruzado dos obeliscos e prove sua dignidade real.',
      en: 'Weave through obelisk crossfire and prove your royal worth.',
      es: 'Esquiva el fuego cruzado de los obeliscos y demuestra tu valía.',
    },
    floorTint: '#101926',
    pillarCount: 6,
    scarabCount: 9,
    mummyCount: 4,
    obeliskCount: 4,
    spikeTrapCount: 4,
    hasBoss: false,
  },
  {
    index: 4,
    godId: 'ra',
    word: 'SOLAR',
    chamberName: {
      pt: 'Câmara V · Trono de Rá',
      en: 'Chamber V · Throne of Ra',
      es: 'Cámara V · Trono de Ra',
    },
    subtitle: {
      pt: 'Reúna os 5 selos solares e derrote a Sombra de Apófis no altar.',
      en: 'Gather all 5 solar seals and vanquish the Shadow of Apophis.',
      es: 'Reúne los 5 sellos solares y derrota a la Sombra de Apofis.',
    },
    floorTint: '#221506',
    pillarCount: 4,
    scarabCount: 6,
    mummyCount: 3,
    obeliskCount: 3,
    spikeTrapCount: 4,
    hasBoss: true,
  },
];

export interface RelicOption {
  id: 'pulse_range' | 'max_hp' | 'dash_cd' | 'move_speed' | 'power_gain';
  name: Record<Language, string>;
  desc: Record<Language, string>;
  symbol: string;
}

export const RELIC_POOL: RelicOption[] = [
  {
    id: 'pulse_range',
    name: {
      pt: 'Cetro de Heliópolis',
      en: 'Scepter of Heliopolis',
      es: 'Cetro de Heliópolis',
    },
    desc: {
      pt: '+25% alcance e poder no Pulso Solar',
      en: '+25% Solar Pulse reach and impact',
      es: '+25% alcance e impacto del Pulso Solar',
    },
    symbol: '☀️',
  },
  {
    id: 'max_hp',
    name: {
      pt: 'Ânfora da Eternidade',
      en: 'Amphora of Eternity',
      es: 'Ánfora de la Eternidad',
    },
    desc: {
      pt: '+1 Ankh máximo e cura total imediata',
      en: '+1 max Ankh and full life restoration',
      es: '+1 Ankh máximo y curación completa',
    },
    symbol: '☥',
  },
  {
    id: 'dash_cd',
    name: {
      pt: 'Asas do Falcão',
      en: 'Falcon Wings',
      es: 'Alas del Halcón',
    },
    desc: {
      pt: '-25% recarga da Esquiva nas Areias',
      en: '-25% Sand Dash cooldown',
      es: '-25% recarga del Impulso de Arena',
    },
    symbol: '🦅',
  },
  {
    id: 'move_speed',
    name: {
      pt: 'Sandálias do Nilo',
      en: 'Sandals of the Nile',
      es: 'Sandalias del Nilo',
    },
    desc: {
      pt: '+15% velocidade de movimento contínua',
      en: '+15% continuous movement speed',
      es: '+15% velocidad de movimiento',
    },
    symbol: '🌿',
  },
  {
    id: 'power_gain',
    name: {
      pt: 'Escaravelho de Ouro',
      en: 'Golden Scarab',
      es: 'Escarabajo de Oro',
    },
    desc: {
      pt: '+40% recarga de Energia Divina',
      en: '+40% faster Divine Power recharge',
      es: '+40% recarga de Energía Divina',
    },
    symbol: '🪲',
  },
];

export const UI_TEXT: Record<
  Language,
  {
    gameTitle: string;
    gameSubtitle: string;
    cartoucheLabel: string;
    cartouchePlaceholder: string;
    startButton: string;
    codexButton: string;
    controlsHint: string;
    chamberProgress: string;
    scoreLabel: string;
    divinePower: string;
    ready: string;
    portalOpen: string;
    bossLabel: string;
    pausedTitle: string;
    resumeButton: string;
    restartButton: string;
    backToTitle: string;
    chamberClearedTitle: string;
    blessingGranted: string;
    chooseRelic: string;
    nextChamber: string;
    victoryTitle: string;
    victorySubtitle: string;
    gameOverTitle: string;
    gameOverSubtitle: string;
    playAgain: string;
    codexTitle: string;
    closeButton: string;
    chambersClearedStat: string;
    maatCombosStat: string;
    relicsStat: string;
    royalCartouche: string;
    glyphProgressHint: string;
  }
> = {
  pt: {
    gameTitle: 'O IMPÉRIO DO EGITO',
    gameSubtitle: 'Prova dos Cinco Deuses',
    cartoucheLabel: 'Seu Nome em Hieróglifos',
    cartouchePlaceholder: 'Digite seu nome...',
    startButton: 'Iniciar Expedição',
    codexButton: 'Códice dos Deuses',
    controlsHint:
      'WASD / Setas Mover · Espaço / Clique Pulso Solar · Shift Esquiva · E Poder Divino · V Câmera 3D · Esc Pausar',
    chamberProgress: 'Câmara',
    scoreLabel: 'Ma’at',
    divinePower: 'Poder Divino (E)',
    ready: 'PRONTO',
    portalOpen: 'PORTAL ABERTO — ENTRE NO ALTAR AO NORTE',
    bossLabel: 'Sombra de Apófis',
    pausedTitle: 'Expedição Pausada',
    resumeButton: 'Continuar',
    restartButton: 'Reiniciar Câmara',
    backToTitle: 'Tela Inicial',
    chamberClearedTitle: 'Selo da Câmara Concluído',
    blessingGranted: 'Bênção Recebida',
    chooseRelic: 'Escolha uma Relíquia Sagrada',
    nextChamber: 'Próxima Câmara',
    victoryTitle: 'Faraó da Luz Eterna',
    victorySubtitle:
      'Você decifrou os cinco selos sagrados e venceu a Sombra de Apófis sob a bênção de Rá.',
    gameOverTitle: 'Coração Pesado na Balança',
    gameOverSubtitle:
      'As areias da pirâmide reclamaram sua jornada. Reúna coragem e entre novamente no templo.',
    playAgain: 'Jogar Novamente',
    codexTitle: 'Códice dos Cinco Deuses',
    closeButton: 'Fechar',
    chambersClearedStat: 'Câmaras Superadas',
    maatCombosStat: 'Selos em Ordem',
    relicsStat: 'Relíquias',
    royalCartouche: 'Cartucho Real',
    glyphProgressHint: 'Colete o glifo destacado em dourado para bônus de Ma’at',
  },
  en: {
    gameTitle: 'EMPIRE OF EGYPT',
    gameSubtitle: 'Trial of the Five Gods',
    cartoucheLabel: 'Your Name in Hieroglyphs',
    cartouchePlaceholder: 'Enter your name...',
    startButton: 'Start Expedition',
    codexButton: 'Codex of the Gods',
    controlsHint:
      'WASD / Arrows Move · Space / Click Solar Pulse · Shift Dash · E Divine Power · V 3D Camera · Esc Pause',
    chamberProgress: 'Chamber',
    scoreLabel: 'Ma’at',
    divinePower: 'Divine Power (E)',
    ready: 'READY',
    portalOpen: 'PORTAL OPEN — ENTER THE NORTH ALTAR',
    bossLabel: 'Shadow of Apophis',
    pausedTitle: 'Expedition Paused',
    resumeButton: 'Resume',
    restartButton: 'Restart Chamber',
    backToTitle: 'Title Screen',
    chamberClearedTitle: 'Chamber Seal Complete',
    blessingGranted: 'Blessing Granted',
    chooseRelic: 'Choose a Sacred Relic',
    nextChamber: 'Next Chamber',
    victoryTitle: 'Pharaoh of Eternal Light',
    victorySubtitle:
      'You decoded all five sacred seals and vanquished the Shadow of Apophis under Ra’s blessing.',
    gameOverTitle: 'Weighed Upon the Scales',
    gameOverSubtitle:
      'The pyramid sands claimed this attempt. Gather your resolve and re-enter the temple.',
    playAgain: 'Play Again',
    codexTitle: 'Codex of the Five Gods',
    closeButton: 'Close',
    chambersClearedStat: 'Chambers Cleared',
    maatCombosStat: 'Ordered Seals',
    relicsStat: 'Relics',
    royalCartouche: 'Royal Cartouche',
    glyphProgressHint: 'Collect the highlighted gold glyph for a Ma’at bonus',
  },
  es: {
    gameTitle: 'EL IMPERIO DE EGIPTO',
    gameSubtitle: 'Prueba de los Cinco Dioses',
    cartoucheLabel: 'Tu Nombre en Jeroglíficos',
    cartouchePlaceholder: 'Escribe tu nombre...',
    startButton: 'Iniciar Expedición',
    codexButton: 'Códice de los Dioses',
    controlsHint:
      'WASD / Flechas Mover · Espacio / Clic Pulso Solar · Shift Impulso · E Poder Divino · V Cámara 3D · Esc Pausa',
    chamberProgress: 'Cámara',
    scoreLabel: 'Ma’at',
    divinePower: 'Poder Divino (E)',
    ready: 'LISTO',
    portalOpen: 'PORTAL ABIERTO — ENTRA AL ALTAR NORTE',
    bossLabel: 'Sombra de Apofis',
    pausedTitle: 'Expedición Pausada',
    resumeButton: 'Continuar',
    restartButton: 'Reiniciar Cámara',
    backToTitle: 'Pantalla Inicial',
    chamberClearedTitle: 'Sello de Cámara Completado',
    blessingGranted: 'Bendición Recibida',
    chooseRelic: 'Elige una Reliquia Sagrada',
    nextChamber: 'Siguiente Cámara',
    victoryTitle: 'Faraón de la Luz Eterna',
    victorySubtitle:
      'Descifraste los cinco sellos sagrados y venciste a la Sombra de Apofis bajo la bendición de Ra.',
    gameOverTitle: 'Corazón en la Balanza',
    gameOverSubtitle:
      'Las arenas de la pirámide detuvieron tu paso. Reúne valor y vuelve al templo.',
    playAgain: 'Jugar de Nuevo',
    codexTitle: 'Códice de los Cinco Dioses',
    closeButton: 'Cerrar',
    chambersClearedStat: 'Cámaras Superadas',
    maatCombosStat: 'Sellos en Orden',
    relicsStat: 'Reliquias',
    royalCartouche: 'Cartucho Real',
    glyphProgressHint: 'Recoge el glifo dorado resaltado para bono de Ma’at',
  },
};
