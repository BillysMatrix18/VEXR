import * as THREE from 'three';

// ── THE BLEED Growth System ─────────────────────────────────────────

export interface BleedState {
  active: boolean;
  radius: number;
  group: THREE.Group | null;
  lastGrowth: number;
  growthInterval: number; // ms
  contained: boolean; // walls slow growth
}

export function createBleedState(): BleedState {
  return { active: false, radius: 6, group: null, lastGrowth: 0, growthInterval: 120000, contained: false };
}

export function growBleed(
  bleedState: BleedState,
  scene: THREE.Scene,
  now: number,
): { grew: boolean; radius: number } {
  if (!bleedState.active || !bleedState.group) return { grew: false, radius: bleedState.radius };
  if (now - bleedState.lastGrowth < bleedState.growthInterval) return { grew: false, radius: bleedState.radius };

  bleedState.lastGrowth = now;
  const growAmount = bleedState.contained ? 0.3 : 1;
  bleedState.radius += growAmount;

  // Update the ground patch scale
  const ground = bleedState.group.children.find(c => c.name === 'bleedGround');
  if (ground) {
    const scale = bleedState.radius / 6; // original radius was 6
    ground.scale.set(scale, scale, 1);
  }

  // Add more fragment geometry at edges
  if (bleedState.radius % 3 < 1) {
    const geo = new THREE.TetrahedronGeometry(0.3 + Math.random() * 0.4);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: Math.random() > 0.5 ? 0x200010 : 0x100020,
      wireframe: Math.random() > 0.3,
      transparent: true,
      opacity: 0.3 + Math.random() * 0.3,
    }));
    const angle = Math.random() * Math.PI * 2;
    const dist = bleedState.radius * 0.8 + Math.random() * bleedState.radius * 0.3;
    mesh.position.set(Math.cos(angle) * dist, Math.random() * 2, Math.sin(angle) * dist);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    mesh.name = 'bleedFragment';
    bleedState.group.add(mesh);
  }

  return { grew: true, radius: bleedState.radius };
}

// Dramatic event at size 50
export function checkBleedDramatic(bleedState: BleedState, scene: THREE.Scene): 'glitch' | null {
  if (bleedState.radius >= 50 && bleedState.radius < 52) {
    // Sky glitch — flash dark red briefly
    const bg = scene.background as THREE.Color;
    const origR = bg.r, origG = bg.g, origB = bg.b;
    bg.set(0x330000);
    setTimeout(() => bg.setRGB(origR, origG, origB), 500);
    return 'glitch';
  }
  return null;
}

export function containBleed(bleedState: BleedState) {
  bleedState.contained = true;
  // Slow growth for 5 minutes
  setTimeout(() => { bleedState.contained = false; }, 300000);
}
