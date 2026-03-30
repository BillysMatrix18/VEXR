import { BrowserWindow } from 'electron';
import { parseKeywords } from './config';

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
  hasBleed: boolean;
  bleedPosition: { x: number; z: number } | null;
  hasLighting: boolean;
}

let worldState: WorldStateData = createFreshWorldState();

// Build cursor — tracks where VEXR is building, spirals outward
let buildCursorAngle = 0;
let buildCursorDist = 3;

export function createFreshWorldState(): WorldStateData {
  return {
    floorRadius: 0,
    hasSky: false,
    structures: [],
    hasBleed: false,
    bleedPosition: null,
    hasLighting: false,
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
  buildCursorDist = Math.min(buildCursorDist + 1.5 + Math.random() * 2, 25);
  return {
    x: Math.cos(buildCursorAngle) * buildCursorDist,
    z: Math.sin(buildCursorAngle) * buildCursorDist,
  };
}

function getBuildCursorPosition(): { x: number; z: number } {
  return {
    x: Math.cos(buildCursorAngle) * buildCursorDist,
    z: Math.sin(buildCursorAngle) * buildCursorDist,
  };
}

// ── World State Summary (injected into AI prompts) ──────────────────

export function getWorldStateSummary(): string {
  const parts: string[] = [];

  if (worldState.floorRadius > 0) {
    parts.push(`A cyan digital grid floor extends ${worldState.floorRadius} units from center`);
  }
  if (worldState.hasSky) {
    parts.push('A dark sky dome with scattered cyan stars spans overhead');
  }
  for (const s of worldState.structures) {
    const dir = getCardinalDirection(s.x, s.z);
    parts.push(`A ${s.description} stands to the ${dir}`);
  }
  if (worldState.hasBleed && worldState.bleedPosition) {
    const dir = getCardinalDirection(worldState.bleedPosition.x, worldState.bleedPosition.z);
    parts.push(`THE BLEED — a dark atmospheric zone — is visible at the ${dir} edge`);
  }
  if (worldState.hasLighting) {
    parts.push('Warm accent lights illuminate the area near structures');
  }
  if (parts.length === 0) {
    return '\n\nCURRENT WORLD STATE: Empty void — nothing has been built yet.';
  }
  return '\n\nCURRENT WORLD STATE: ' + parts.join('. ') + '.';
}

function getCardinalDirection(x: number, z: number): string {
  const angle = Math.atan2(x, -z); // north = -z
  const deg = ((angle * 180 / Math.PI) + 360) % 360;
  if (deg < 45 || deg >= 315) return 'north';
  if (deg < 135) return 'east';
  if (deg < 225) return 'south';
  return 'west';
}

// ── Process VEXR Message for World Generation ───────────────────────

export function processVexrMessageForWorldGen(
  message: string,
  sendToRenderer: (channel: string, data?: any) => void,
): void {
  const keywords = parseKeywords(message);
  if (keywords.length === 0) return;

  for (const kw of keywords) {
    switch (kw) {
      case 'floor': {
        const newRadius = Math.min(worldState.floorRadius + 10, 60);
        if (newRadius > worldState.floorRadius) {
          worldState.floorRadius = newRadius;
          sendToRenderer('generate-world-element', { type: 'floor', radius: newRadius });
        }
        break;
      }
      case 'sky': {
        if (!worldState.hasSky) {
          worldState.hasSky = true;
          sendToRenderer('generate-world-element', { type: 'sky' });
        }
        break;
      }
      case 'structure': {
        if (worldState.structures.length < 10) {
          const pos = advanceBuildCursor();
          const types: Array<'tower' | 'pyramid' | 'pillar' | 'arch'> = ['tower', 'pyramid', 'pillar', 'arch'];
          const structureType = types[Math.floor(Math.random() * types.length)];
          const description = `${structureType} structure`;
          worldState.structures.push({ type: structureType, x: pos.x, z: pos.z, description });
          // Move VEXR to the build position first, then generate
          sendToRenderer('move-character', { who: 'vexr', x: pos.x, z: pos.z });
          sendToRenderer('generate-world-element', { type: 'structure', structureType, x: pos.x, z: pos.z });
          // Expand floor to cover the build area
          const neededRadius = Math.ceil(Math.sqrt(pos.x * pos.x + pos.z * pos.z) + 5);
          const newFloor = Math.min(Math.max(neededRadius, worldState.floorRadius), 60);
          if (newFloor > worldState.floorRadius) {
            worldState.floorRadius = newFloor;
            sendToRenderer('generate-world-element', { type: 'floor', radius: newFloor });
          }
        }
        break;
      }
      case 'bleed': {
        if (!worldState.hasBleed) {
          // Place at the far edge of the built world
          const bleedAngle = buildCursorAngle + Math.PI + (Math.random() - 0.5) * 0.5;
          const bleedDist = Math.max(buildCursorDist + 8, 22);
          const bleedPos = {
            x: Math.cos(bleedAngle) * bleedDist,
            z: Math.sin(bleedAngle) * bleedDist,
          };
          worldState.hasBleed = true;
          worldState.bleedPosition = bleedPos;
          sendToRenderer('generate-world-element', { type: 'bleed', x: bleedPos.x, z: bleedPos.z });
        }
        break;
      }
      case 'light': {
        if (!worldState.hasLighting) {
          worldState.hasLighting = true;
          sendToRenderer('generate-world-element', { type: 'light' });
        }
        break;
      }
      case 'speck': {
        // SPECK reaction handled by renderer animation — no world gen needed
        break;
      }
    }
  }
}

// ── Process Trapped One Message for Movement ────────────────────────

export function processTrappedMessageForMovement(
  message: string,
  sendToRenderer: (channel: string, data?: any) => void,
): void {
  const lower = message.toLowerCase();

  // Move toward THE BLEED if they mention it
  if (/\b(bleed|corrupt|dark area|dark zone|that area|edge)\b/.test(lower) && worldState.hasBleed && worldState.bleedPosition) {
    const bp = worldState.bleedPosition;
    sendToRenderer('move-character', { who: 'trapped', x: bp.x - 3, z: bp.z - 3 });
    return;
  }

  // Move toward a structure if they mention one
  if (/\b(tower|structure|building|pillar|arch|pyramid|that thing|over there)\b/.test(lower) && worldState.structures.length > 0) {
    const s = worldState.structures[worldState.structures.length - 1];
    sendToRenderer('move-character', { who: 'trapped', x: s.x + 2, z: s.z + 2 });
    return;
  }

  // Move away from VEXR if frustrated
  if (/\b(stop|shut up|too much|leave me|go away|back off|annoying)\b/.test(lower)) {
    // Move to a random distant point
    const angle = Math.random() * Math.PI * 2;
    sendToRenderer('move-character', { who: 'trapped', x: Math.cos(angle) * 8, z: Math.sin(angle) * 8 });
    // VEXR cheerfully follows after a delay
    setTimeout(() => {
      sendToRenderer('move-character', { who: 'vexr', x: Math.cos(angle) * 5, z: Math.sin(angle) * 5 });
    }, 3000);
  }
}
