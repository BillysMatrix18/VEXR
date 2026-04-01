import * as THREE from 'three';

// ── RENDER NPCs — simple digital citizens ───────────────────────────

const RENDER_COLORS = [0x66aaff, 0xff66aa, 0x66ffaa, 0xffaa66, 0xaa66ff, 0xff6666, 0x66ffff, 0xffff66];
const MAX_RENDERS = 8;

export interface RenderNPC {
  group: THREE.Group;
  target: THREE.Vector3;
  wanderTimer: number;
  color: number;
  name: string;
}

export function createRenderNPC(name: string, x: number, z: number): RenderNPC {
  const group = new THREE.Group();
  const color = RENDER_COLORS[Math.floor(Math.random() * RENDER_COLORS.length)];
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15, roughness: 0.6, metalness: 0.1 });

  // Head — small sphere
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), mat);
  head.position.y = 1.1;
  head.name = 'renderHead';
  group.add(head);

  // Faint eye glow
  const eyeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 4), eyeMat);
  eyeL.position.set(-0.04, 1.12, 0.1);
  const eyeR = eyeL.clone(); eyeR.position.set(0.04, 1.12, 0.1);
  group.add(eyeL, eyeR);

  // Body — small box
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.15), mat.clone());
  body.position.y = 0.75;
  group.add(body);

  // Legs — thin cylinders
  const legMat = mat.clone();
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 4), legMat);
  legL.position.set(-0.06, 0.35, 0);
  const legR = legL.clone(); legR.position.set(0.06, 0.35, 0);
  group.add(legL, legR);

  // Arms
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), legMat);
  armL.position.set(-0.16, 0.8, 0); armL.rotation.z = 0.2;
  const armR = armL.clone(); armR.position.set(0.16, 0.8, 0); armR.rotation.z = -0.2;
  group.add(armL, armR);

  // Shadows
  group.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });

  group.position.set(x, 0, z);
  group.scale.setScalar(0.8);

  return { group, target: new THREE.Vector3(x, 0, z), wanderTimer: 2 + Math.random() * 5, color, name };
}

export function updateRenderNPC(
  npc: RenderNPC,
  delta: number,
  time: number,
  worldRadius: number,
  bleedPos: { x: number; z: number } | null,
  vexrPos: THREE.Vector3 | null,
  trappedPos: THREE.Vector3 | null,
): void {
  const pos = npc.group.position;

  // Gentle bob
  pos.y = Math.sin(time * 1.5 + npc.color) * 0.03;

  // Head turn occasionally
  const head = npc.group.getObjectByName('renderHead');
  if (head) head.rotation.y = Math.sin(time * 0.3 + npc.color * 0.01) * 0.4;

  // Move toward target
  const dir = new THREE.Vector3().subVectors(npc.target, pos);
  dir.y = 0;
  const dist = dir.length();

  if (dist > 0.3) {
    dir.normalize();
    const speed = Math.min(dist * 0.3, 0.8) * delta;
    pos.x += dir.x * speed;
    pos.z += dir.z * speed;
    const moveAngle = Math.atan2(dir.x, dir.z);
    let diff = moveAngle - npc.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    npc.group.rotation.y += diff * 0.06;
  }

  // Wander
  npc.wanderTimer -= delta;
  if (npc.wanderTimer <= 0 || dist < 0.3) {
    npc.wanderTimer = 4 + Math.random() * 8;
    const range = Math.max(worldRadius * 0.6, 8);
    npc.target.set((Math.random() - 0.5) * range, 0, (Math.random() - 0.5) * range);

    // Sometimes wander toward trapped one
    if (trappedPos && Math.random() > 0.6) {
      npc.target.copy(trappedPos);
      npc.target.x += (Math.random() - 0.5) * 3;
      npc.target.z += (Math.random() - 0.5) * 3;
      npc.target.y = 0;
    }
  }

  // Avoid THE BLEED
  if (bleedPos) {
    const toBl = Math.sqrt((pos.x - bleedPos.x) ** 2 + (pos.z - bleedPos.z) ** 2);
    if (toBl < 8) {
      // Back away
      const away = new THREE.Vector3(pos.x - bleedPos.x, 0, pos.z - bleedPos.z).normalize();
      npc.target.copy(pos).add(away.multiplyScalar(10));
    }
  }
}

export function canSpawnMore(renders: RenderNPC[]): boolean {
  return renders.length < MAX_RENDERS;
}
