import { parseKeywords, parseColor, parseSkyPreset, parseWeather } from './config';

// ── World State Data ────────────────────────────────────────────────

export interface StructureRecord {
  type: string; x: number; z: number; description: string; zone: number;
}

export interface WorldStateData {
  floorRadius: number;
  hasSky: boolean;
  skyPreset: string;
  structures: StructureRecord[];
  terrain: StructureRecord[];
  nature: StructureRecord[];
  hasBleed: boolean;
  bleedPosition: { x: number; z: number } | null;
  hasLighting: boolean;
  hasWater: boolean;
  hasFog: boolean;
}

let worldState: WorldStateData = createFreshWorldState();
let isBuildingInProgress = false;
let buildQueue: Array<{ kw: string; color: number | null; send: (ch: string, d?: any) => void }> = [];

// ── Zone system — ring distances from center ────────────────────────
// Zone 0: 0-5 (Core Stage)  Zone 1: 5-12 (Village)  Zone 2: 12-20 (Nature)  Zone 3: 20+ (Wilderness)
const ZONE_RANGES = [5, 12, 20, 30];

function getZoneForType(kw: string): number {
  const zone0 = ['stage'];
  const zone1 = ['house', 'castle', 'tower', 'well', 'fountain', 'lamp', 'path', 'gate', 'wall', 'stairs', 'arch', 'structure', 'bridge'];
  const zone2 = ['tree', 'rocks', 'flowers', 'grass', 'water', 'hill', 'plain'];
  // zone3: mountain, cliff, valley, ruins, bleed
  if (zone0.includes(kw)) return 0;
  if (zone1.includes(kw)) return 1;
  if (zone2.includes(kw)) return 2;
  return 3;
}

// Angle counter per zone for spiral placement
let zoneAngles = [0, 0, 0, 0];

function getZonePosition(zone: number): { x: number; z: number } {
  const minR = zone === 0 ? 0 : ZONE_RANGES[zone - 1];
  const maxR = ZONE_RANGES[zone];
  const r = minR + Math.random() * (maxR - minR);
  zoneAngles[zone] += 0.8 + Math.random() * 0.6;
  const a = zoneAngles[zone];
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

export function createFreshWorldState(): WorldStateData {
  return {
    floorRadius: 0, hasSky: false, skyPreset: 'void',
    structures: [], terrain: [], nature: [],
    hasBleed: false, bleedPosition: null,
    hasLighting: false, hasWater: false, hasFog: false,
  };
}

export function getWorldState(): WorldStateData { return worldState; }

export function resetWorldState(): void {
  worldState = createFreshWorldState();
  isBuildingInProgress = false;
  buildQueue = [];
  zoneAngles = [0, 0, 0, 0];
}

// ── User Signal Command Parser (instant world changes) ──────────────

export function parseUserSignalCommands(
  message: string,
  send: (channel: string, data?: any) => void,
): void {
  const l = message.toLowerCase();

  // Delete/clear/reset/wipe → clear all generated objects
  if (/\b(delete|clear|reset|wipe|destroy|remove)\s*(everything|all|world|it all)?\b/.test(l)) {
    clearWorld(send);
  }

  // Direct sky commands from user
  const skyPreset = parseSkyPreset(l);
  if (skyPreset || /\b(sky|change.*sky|make.*sky)\b/.test(l)) {
    const preset = skyPreset ?? 'night';
    worldState.hasSky = true;
    worldState.skyPreset = preset;
    send('generate-world-element', { type: 'sky-change', preset });
    if (!worldState.hasSky) {
      send('generate-world-element', { type: 'sky' });
    }
  }

  // Direct weather commands
  const weather = parseWeather(l);
  if (weather) {
    send('generate-world-element', { type: 'weather', weather });
  }
}

function clearWorld(send: (channel: string, data?: any) => void): void {
  worldState = createFreshWorldState();
  isBuildingInProgress = false;
  buildQueue = [];
  zoneAngles = [0, 0, 0, 0];
  send('clear-world', {});
}

// ── World State Summary ─────────────────────────────────────────────

function dir(x: number, z: number): string {
  const angle = Math.atan2(x, -z);
  const deg = ((angle * 180 / Math.PI) + 360) % 360;
  if (deg < 45 || deg >= 315) return 'north';
  if (deg < 135) return 'east';
  if (deg < 225) return 'south';
  return 'west';
}

export function getWorldStateSummary(): string {
  const parts: string[] = [];
  if (worldState.floorRadius > 0) parts.push(`Ground extends ${worldState.floorRadius} units`);
  if (worldState.hasSky) parts.push(`Sky: ${worldState.skyPreset}`);
  for (const s of worldState.structures) parts.push(`${s.description} to the ${dir(s.x, s.z)}`);
  for (const t of worldState.terrain) parts.push(`${t.description} to the ${dir(t.x, t.z)}`);
  const treeCount = worldState.nature.filter(n => n.type === 'tree').length;
  if (treeCount > 0) parts.push(`${treeCount} trees scattered in the natural zone`);
  if (worldState.hasWater) parts.push('A body of water');
  if (worldState.hasFog) parts.push('Fog drifts through');
  if (worldState.hasBleed && worldState.bleedPosition) parts.push(`THE BLEED at the ${dir(worldState.bleedPosition.x, worldState.bleedPosition.z)} edge`);
  if (worldState.hasLighting) parts.push('Warm lights on structures');
  if (parts.length === 0) return '\n\nCURRENT WORLD STATE: Empty void — nothing built yet.';
  return '\n\nCURRENT WORLD STATE: ' + parts.join('. ') + '.';
}

// ── Build Queue ─────────────────────────────────────────────────────

function processBuildQueue() {
  if (isBuildingInProgress || buildQueue.length === 0) return;
  const next = buildQueue.shift()!;
  executeBuild(next.kw, next.color, next.send);
}

export function isBuilding(): boolean { return isBuildingInProgress; }

export function onBuildComplete() {
  isBuildingInProgress = false;
  processBuildQueue();
}

function queueBuild(kw: string, color: number | null, send: (ch: string, d?: any) => void) {
  buildQueue.push({ kw, color, send });
  processBuildQueue();
}

function executeBuild(kw: string, color: number | null, send: (ch: string, d?: any) => void) {
  isBuildingInProgress = true;
  const zone = getZoneForType(kw);
  const pos = getZonePosition(zone);
  autoExpandFloor(pos.x, pos.z, send);

  send('move-character', { who: 'vexr', x: pos.x, z: pos.z });

  setTimeout(() => {
    if (isStructureType(kw)) {
      worldState.structures.push({ type: kw, x: pos.x, z: pos.z, description: kw, zone });
      send('generate-world-element', { type: 'structure', structureType: kw, x: pos.x, z: pos.z, animate: true, color });
    } else if (isTerrainType(kw)) {
      worldState.terrain.push({ type: kw, x: pos.x, z: pos.z, description: `${kw} terrain`, zone });
      send('generate-world-element', { type: 'terrain', terrainType: kw, x: pos.x, z: pos.z, animate: true });
    }
    setTimeout(() => onBuildComplete(), 5000);
  }, 800);
}

function isStructureType(kw: string): boolean {
  return ['castle', 'house', 'tower', 'bridge', 'wall', 'gate', 'arch', 'stage', 'structure', 'well', 'fountain', 'stairs', 'ruins', 'path', 'lamp'].includes(kw);
}

function isTerrainType(kw: string): boolean {
  return ['mountain', 'hill', 'cliff', 'valley', 'plain'].includes(kw);
}

// ── Auto-expand floor ───────────────────────────────────────────────

function autoExpandFloor(x: number, z: number, send: (ch: string, d?: any) => void) {
  const needed = Math.ceil(Math.sqrt(x * x + z * z) + 6);
  const newR = Math.min(Math.max(needed, worldState.floorRadius), 60);
  if (newR > worldState.floorRadius) {
    worldState.floorRadius = newR;
    send('generate-world-element', { type: 'floor', radius: newR });
  }
}

// ── Process VEXR Message ────────────────────────────────────────────

export function processVexrMessageForWorldGen(
  message: string,
  send: (channel: string, data?: any) => void,
): void {
  const keywords = parseKeywords(message);
  const color = parseColor(message);
  const skyPreset = parseSkyPreset(message);
  const weather = parseWeather(message);

  // Environment commands (immediate, no build queue)
  if (skyPreset) {
    worldState.hasSky = true;
    worldState.skyPreset = skyPreset;
    send('generate-world-element', { type: 'sky-change', preset: skyPreset });
  }
  if (weather) {
    send('generate-world-element', { type: 'weather', weather });
  }

  if (keywords.length === 0) return;

  for (const kw of keywords) {
    switch (kw) {
      case 'floor': {
        const newR = Math.min(worldState.floorRadius + 10, 60);
        if (newR > worldState.floorRadius) {
          worldState.floorRadius = newR;
          send('generate-world-element', { type: 'floor', radius: newR });
        }
        break;
      }
      case 'sky': {
        if (!worldState.hasSky) {
          worldState.hasSky = true;
          worldState.skyPreset = 'night';
          send('generate-world-element', { type: 'sky' });
        }
        break;
      }

      case 'mountain': case 'hill': case 'cliff': case 'valley': case 'plain': {
        if (worldState.terrain.length < 6) queueBuild(kw, color, send);
        break;
      }

      case 'castle': case 'house': case 'tower': case 'bridge': case 'wall': case 'gate':
      case 'arch': case 'stage': case 'structure': case 'well': case 'fountain':
      case 'stairs': case 'ruins': case 'path': case 'lamp': {
        if (worldState.structures.length < 20) queueBuild(kw, color, send);
        break;
      }

      case 'tree': {
        if (worldState.nature.filter(n => n.type === 'tree').length < 15) {
          const count = 3 + Math.floor(Math.random() * 3);
          for (let i = 0; i < count; i++) {
            const pos = getZonePosition(2);
            worldState.nature.push({ type: 'tree', x: pos.x, z: pos.z, description: 'tree', zone: 2 });
            send('generate-world-element', { type: 'nature', natureType: 'tree', x: pos.x, z: pos.z });
            autoExpandFloor(pos.x, pos.z, send);
          }
        }
        break;
      }
      case 'rocks': {
        if (worldState.nature.filter(n => n.type === 'rocks').length < 10) {
          const count = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < count; i++) {
            const pos = getZonePosition(2);
            worldState.nature.push({ type: 'rocks', x: pos.x, z: pos.z, description: 'rock cluster', zone: 2 });
            send('generate-world-element', { type: 'nature', natureType: 'rocks', x: pos.x, z: pos.z });
          }
        }
        break;
      }
      case 'flowers': case 'grass': {
        if (worldState.nature.filter(n => n.type === kw).length < 8) {
          const count = 4 + Math.floor(Math.random() * 4);
          for (let i = 0; i < count; i++) {
            const pos = getZonePosition(Math.random() > 0.5 ? 1 : 2);
            worldState.nature.push({ type: kw, x: pos.x, z: pos.z, description: kw, zone: 2 });
            send('generate-world-element', { type: 'nature', natureType: kw, x: pos.x, z: pos.z });
          }
        }
        break;
      }
      case 'water': {
        if (!worldState.hasWater) {
          worldState.hasWater = true;
          const pos = getZonePosition(2);
          send('move-character', { who: 'vexr', x: pos.x, z: pos.z });
          send('generate-world-element', { type: 'nature', natureType: 'water', x: pos.x, z: pos.z });
          autoExpandFloor(pos.x, pos.z, send);
        }
        break;
      }
      case 'fog': {
        if (!worldState.hasFog) {
          worldState.hasFog = true;
          send('generate-world-element', { type: 'nature', natureType: 'fog', x: 0, z: 0 });
        }
        break;
      }
      case 'bleed': {
        if (!worldState.hasBleed) {
          const pos = getZonePosition(3);
          const dist = Math.max(Math.sqrt(pos.x * pos.x + pos.z * pos.z), 22);
          const angle = Math.atan2(pos.z, pos.x);
          const bleedPos = { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist };
          worldState.hasBleed = true;
          worldState.bleedPosition = bleedPos;
          send('generate-world-element', { type: 'bleed', x: bleedPos.x, z: bleedPos.z });
        }
        break;
      }
      case 'light': {
        if (!worldState.hasLighting) {
          worldState.hasLighting = true;
          send('generate-world-element', { type: 'light' });
        }
        break;
      }
      case 'speck': break;
    }
  }
}

// ── Process Trapped One Message for Movement ────────────────────────

export function processTrappedMessageForMovement(
  message: string,
  send: (channel: string, data?: any) => void,
): void {
  const lower = message.toLowerCase();

  if (/\b(bleed|corrupt|dark area|edge)\b/.test(lower) && worldState.hasBleed && worldState.bleedPosition) {
    send('move-character', { who: 'trapped', x: worldState.bleedPosition.x - 3, z: worldState.bleedPosition.z - 3 });
    return;
  }
  if (/\b(tower|structure|building|house|bridge|gate|stage|castle|that thing|over there)\b/.test(lower) && worldState.structures.length > 0) {
    const s = worldState.structures[worldState.structures.length - 1];
    send('move-character', { who: 'trapped', x: s.x + 2, z: s.z + 2 });
    return;
  }
  if (/\b(water|lake|river|pond)\b/.test(lower) && worldState.hasWater) {
    const w = worldState.nature.find(n => n.type === 'water');
    if (w) send('move-character', { who: 'trapped', x: w.x + 2, z: w.z + 2 });
    return;
  }
  if (/\b(edge|boundary|limit|end|escape|way out|exit|leave|beyond)\b/.test(lower)) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(worldState.floorRadius - 2, 10);
    send('move-character', { who: 'trapped', x: Math.cos(angle) * dist, z: Math.sin(angle) * dist });
    return;
  }
  if (/\b(stop|shut up|too much|leave me|go away|back off)\b/.test(lower)) {
    const angle = Math.random() * Math.PI * 2;
    send('move-character', { who: 'trapped', x: Math.cos(angle) * 8, z: Math.sin(angle) * 8 });
    setTimeout(() => send('move-character', { who: 'vexr', x: Math.cos(angle) * 5, z: Math.sin(angle) * 5 }), 3000);
  }
}
