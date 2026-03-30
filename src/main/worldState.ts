import { parseKeywords } from './config';
import { searchAndDownloadModel } from './sketchfab';

// ── World State Data ────────────────────────────────────────────────

export interface StructureRecord {
  type: string;
  x: number;
  z: number;
  description: string;
}

export interface WorldStateData {
  floorRadius: number;
  hasSky: boolean;
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
let buildCursorAngle = 0;
let buildCursorDist = 3;

export function createFreshWorldState(): WorldStateData {
  return {
    floorRadius: 0,
    hasSky: false,
    structures: [],
    terrain: [],
    nature: [],
    hasBleed: false,
    bleedPosition: null,
    hasLighting: false,
    hasWater: false,
    hasFog: false,
  };
}

export function getWorldState(): WorldStateData {
  return worldState;
}

export function resetWorldState(): void {
  worldState = createFreshWorldState();
  buildCursorAngle = 0;
  buildCursorDist = 3;
}

// ── Build Cursor ────────────────────────────────────────────────────

function advanceBuildCursor(): { x: number; z: number } {
  buildCursorAngle += 0.7 + Math.random() * 0.6;
  buildCursorDist = Math.min(buildCursorDist + 1.5 + Math.random() * 2, 28);
  return {
    x: Math.cos(buildCursorAngle) * buildCursorDist,
    z: Math.sin(buildCursorAngle) * buildCursorDist,
  };
}

function nearBuildCursor(spread: number = 3): { x: number; z: number } {
  const base = { x: Math.cos(buildCursorAngle) * buildCursorDist, z: Math.sin(buildCursorAngle) * buildCursorDist };
  return { x: base.x + (Math.random() - 0.5) * spread, z: base.z + (Math.random() - 0.5) * spread };
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
  if (worldState.floorRadius > 0) parts.push(`Cyan grid floor extends ${worldState.floorRadius} units from center`);
  if (worldState.hasSky) parts.push('Dark sky dome with cyan stars overhead');
  for (const s of worldState.structures) parts.push(`${s.description} to the ${dir(s.x, s.z)}`);
  for (const t of worldState.terrain) parts.push(`${t.description} to the ${dir(t.x, t.z)}`);
  for (const n of worldState.nature) parts.push(`${n.description} to the ${dir(n.x, n.z)}`);
  if (worldState.hasWater) parts.push('A body of water reflects nearby');
  if (worldState.hasFog) parts.push('Fog drifts through low areas');
  if (worldState.hasBleed && worldState.bleedPosition) parts.push(`THE BLEED at the ${dir(worldState.bleedPosition.x, worldState.bleedPosition.z)} edge`);
  if (worldState.hasLighting) parts.push('Warm lights illuminate structures');
  if (parts.length === 0) return '\n\nCURRENT WORLD STATE: Empty void — nothing built yet.';
  return '\n\nCURRENT WORLD STATE: ' + parts.join('. ') + '.';
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
  if (keywords.length === 0) return;

  for (const kw of keywords) {
    switch (kw) {
      // ── Floor / Sky ─────────────────────────────────────────
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
          send('generate-world-element', { type: 'sky' });
        }
        break;
      }

      // ── Terrain ─────────────────────────────────────────────
      case 'mountain': case 'hill': case 'cliff': case 'valley': case 'plain': {
        if (worldState.terrain.length < 6) {
          const pos = advanceBuildCursor();
          worldState.terrain.push({ type: kw, x: pos.x, z: pos.z, description: `${kw} terrain` });
          send('move-character', { who: 'vexr', x: pos.x, z: pos.z });
          send('generate-world-element', { type: 'terrain', terrainType: kw, x: pos.x, z: pos.z });
          autoExpandFloor(pos.x, pos.z, send);
        }
        break;
      }

      // ── Structures ──────────────────────────────────────────
      case 'house': case 'tower': case 'bridge': case 'wall': case 'gate':
      case 'arch': case 'stage': case 'structure': case 'well': case 'fountain':
      case 'stairs': case 'ruins': case 'path': case 'lamp': {
        if (worldState.structures.length < 20) {
          const pos = advanceBuildCursor();
          worldState.structures.push({ type: kw, x: pos.x, z: pos.z, description: `${kw}` });
          send('move-character', { who: 'vexr', x: pos.x, z: pos.z });
          autoExpandFloor(pos.x, pos.z, send);
          // Try Sketchfab model first, fall back to primitives
          searchAndDownloadModel(`${kw} low poly fantasy`, send).then((modelPath) => {
            if (modelPath) {
              send('generate-world-element', { type: 'model', modelPath, x: pos.x, z: pos.z, name: kw });
            } else {
              send('generate-world-element', { type: 'structure', structureType: kw, x: pos.x, z: pos.z });
            }
          }).catch(() => {
            send('generate-world-element', { type: 'structure', structureType: kw, x: pos.x, z: pos.z });
          });
        }
        break;
      }

      // ── Nature ──────────────────────────────────────────────
      case 'tree': {
        if (worldState.nature.filter(n => n.type === 'tree').length < 15) {
          // Place a cluster of 3-5 trees near cursor
          const count = 3 + Math.floor(Math.random() * 3);
          for (let i = 0; i < count; i++) {
            const pos = nearBuildCursor(6);
            worldState.nature.push({ type: 'tree', x: pos.x, z: pos.z, description: 'tree' });
            send('generate-world-element', { type: 'nature', natureType: 'tree', x: pos.x, z: pos.z });
            autoExpandFloor(pos.x, pos.z, send);
          }
          const center = nearBuildCursor(0);
          send('move-character', { who: 'vexr', x: center.x, z: center.z });
        }
        break;
      }
      case 'rocks': {
        if (worldState.nature.filter(n => n.type === 'rocks').length < 10) {
          const count = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < count; i++) {
            const pos = nearBuildCursor(5);
            worldState.nature.push({ type: 'rocks', x: pos.x, z: pos.z, description: 'rock cluster' });
            send('generate-world-element', { type: 'nature', natureType: 'rocks', x: pos.x, z: pos.z });
          }
          break;
        }
        break;
      }
      case 'flowers': case 'grass': {
        if (worldState.nature.filter(n => n.type === kw).length < 8) {
          const count = 4 + Math.floor(Math.random() * 4);
          for (let i = 0; i < count; i++) {
            const pos = nearBuildCursor(8);
            worldState.nature.push({ type: kw, x: pos.x, z: pos.z, description: kw });
            send('generate-world-element', { type: 'nature', natureType: kw, x: pos.x, z: pos.z });
          }
        }
        break;
      }
      case 'water': {
        if (!worldState.hasWater) {
          worldState.hasWater = true;
          const pos = advanceBuildCursor();
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

      // ── Special ─────────────────────────────────────────────
      case 'bleed': {
        if (!worldState.hasBleed) {
          const bleedAngle = buildCursorAngle + Math.PI + (Math.random() - 0.5) * 0.5;
          const bleedDist = Math.max(buildCursorDist + 8, 22);
          const bleedPos = { x: Math.cos(bleedAngle) * bleedDist, z: Math.sin(bleedAngle) * bleedDist };
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
      case 'speck': break; // handled by renderer
    }
  }
}

// ── Process Trapped One Message for Movement ────────────────────────

export function processTrappedMessageForMovement(
  message: string,
  send: (channel: string, data?: any) => void,
): void {
  const lower = message.toLowerCase();

  if (/\b(bleed|corrupt|dark area|dark zone|edge)\b/.test(lower) && worldState.hasBleed && worldState.bleedPosition) {
    const bp = worldState.bleedPosition;
    send('move-character', { who: 'trapped', x: bp.x - 3, z: bp.z - 3 });
    return;
  }

  if (/\b(tower|structure|building|pillar|arch|house|bridge|gate|stage|that thing|over there)\b/.test(lower) && worldState.structures.length > 0) {
    const s = worldState.structures[worldState.structures.length - 1];
    send('move-character', { who: 'trapped', x: s.x + 2, z: s.z + 2 });
    return;
  }

  if (/\b(water|lake|river|pond)\b/.test(lower) && worldState.hasWater) {
    const w = worldState.nature.find(n => n.type === 'water');
    if (w) send('move-character', { who: 'trapped', x: w.x + 2, z: w.z + 2 });
    return;
  }

  // Escape behavior — move to world edges
  if (/\b(edge|boundary|limit|end|escape|way out|exit|leave|beyond)\b/.test(lower)) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(worldState.floorRadius - 2, 10);
    send('move-character', { who: 'trapped', x: Math.cos(angle) * dist, z: Math.sin(angle) * dist });
    return;
  }

  if (/\b(stop|shut up|too much|leave me|go away|back off|annoying)\b/.test(lower)) {
    const angle = Math.random() * Math.PI * 2;
    send('move-character', { who: 'trapped', x: Math.cos(angle) * 8, z: Math.sin(angle) * 8 });
    setTimeout(() => {
      send('move-character', { who: 'vexr', x: Math.cos(angle) * 5, z: Math.sin(angle) * 5 });
    }, 3000);
  }
}
