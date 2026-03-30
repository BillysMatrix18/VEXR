import * as THREE from 'three';

// ── World State ─────────────────────────────────────────────────────

export interface WorldState {
  hasFloor: boolean;
  hasSky: boolean;
  hasBleed: boolean;
  structureCount: number;
  lightShifted: boolean;
  elements: THREE.Object3D[];
}

export function createWorldState(): WorldState {
  return {
    hasFloor: false,
    hasSky: false,
    hasBleed: false,
    structureCount: 0,
    lightShifted: false,
    elements: [],
  };
}

// ── Keyword Parser ──────────────────────────────────────────────────

export function parseKeywords(message: string): string[] {
  const kw: string[] = [];
  const l = message.toLowerCase();

  if (/\b(floor|ground|tile|surface|beneath|footing)\b/.test(l)) kw.push('floor');
  if (/\b(sky|skies|heaven|above|dome|stars?|horizon|ceiling)\b/.test(l)) kw.push('sky');
  if (/\b(build|structure|tower|wall|stage|theatre|theater|pillar|arch|monument|palace|room|core stage)\b/.test(l)) kw.push('structure');
  if (/\b(bleed|corrupt|glitch|broken|decay|error|virus)\b/.test(l)) kw.push('bleed');
  if (/\bspeck\b/i.test(l)) kw.push('speck');
  if (/\b(light|glow|bright|colou?r|illuminate|shine|lamp|lantern)\b/.test(l)) kw.push('light');

  return [...new Set(kw)];
}

// ── Floor ───────────────────────────────────────────────────────────

export function generateFloor(scene: THREE.Scene, state: WorldState): void {
  if (state.hasFloor) return;
  state.hasFloor = true;

  // Grid overlay
  const grid = new THREE.GridHelper(60, 60, 0x00ffe1, 0x0a1a1a);
  const gridMat = grid.material as THREE.Material;
  gridMat.transparent = true;
  gridMat.opacity = 0.35;
  scene.add(grid);
  state.elements.push(grid);

  // Reflective floor plane
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({
      color: 0x050510,
      metalness: 0.85,
      roughness: 0.35,
      transparent: true,
      opacity: 0.75,
    }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.01;
  scene.add(plane);
  state.elements.push(plane);
}

// ── Sky ─────────────────────────────────────────────────────────────

export function generateSky(scene: THREE.Scene, state: WorldState): void {
  if (state.hasSky) return;
  state.hasSky = true;

  // Sky dome
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(200, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0x040a14, side: THREE.BackSide }),
  );
  sky.name = 'sky';
  scene.add(sky);
  state.elements.push(sky);

  // Stars — scattered points in upper hemisphere
  const count = 250;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random()); // upper hemisphere
    const r = 180 + Math.random() * 15;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starsGeo = new THREE.BufferGeometry();
  starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({
    color: 0x00ffe1, size: 0.5, transparent: true, opacity: 0.5,
  }));
  scene.add(stars);
  state.elements.push(stars);

  // Faint sky directional light
  const dirLight = new THREE.DirectionalLight(0x0088aa, 0.25);
  dirLight.position.set(10, 40, 10);
  scene.add(dirLight);
  state.elements.push(dirLight);
}

// ── Structures ──────────────────────────────────────────────────────

export function generateStructure(scene: THREE.Scene, state: WorldState): void {
  if (state.structureCount >= 7) return;
  state.structureCount++;

  const solidMat = new THREE.MeshStandardMaterial({
    color: 0x0a1520, emissive: 0x00ffe1, emissiveIntensity: 0.03,
    metalness: 0.7, roughness: 0.3,
  });
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x00ffe1, wireframe: true, transparent: true, opacity: 0.12,
  });

  const angle = Math.random() * Math.PI * 2;
  const dist = 6 + Math.random() * 16;
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;

  const types = ['tower', 'pyramid', 'pillar', 'arch'];
  const type = types[Math.floor(Math.random() * types.length)];
  const group = new THREE.Group();

  switch (type) {
    case 'tower': {
      const h = 3 + Math.random() * 5;
      const w = 0.8 + Math.random() * 1.2;
      const solid = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), solidMat);
      const wire = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, h + 0.05, w + 0.05), wireMat);
      solid.position.y = h / 2;
      wire.position.y = h / 2;
      group.add(solid, wire);
      break;
    }
    case 'pyramid': {
      const h = 3 + Math.random() * 4;
      const r = 1.2 + Math.random() * 1;
      const solid = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), solidMat);
      const wire = new THREE.Mesh(new THREE.ConeGeometry(r + 0.05, h + 0.05, 4), wireMat);
      solid.position.y = h / 2;
      wire.position.y = h / 2;
      group.add(solid, wire);
      break;
    }
    case 'pillar': {
      const h = 5 + Math.random() * 6;
      const solid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, h, 6), solidMat);
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.43, h + 0.05, 6), wireMat);
      solid.position.y = h / 2;
      wire.position.y = h / 2;
      group.add(solid, wire);
      break;
    }
    case 'arch': {
      const h = 4 + Math.random() * 3;
      const pL = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), solidMat);
      pL.position.set(-1.5, h / 2, 0);
      const pR = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), solidMat);
      pR.position.set(1.5, h / 2, 0);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.4, 0.5), solidMat);
      beam.position.set(0, h + 0.2, 0);
      group.add(pL, pR, beam);
      break;
    }
  }

  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
  state.elements.push(group);
}

// ── THE BLEED ───────────────────────────────────────────────────────

export function generateBleed(scene: THREE.Scene, state: WorldState): void {
  if (state.hasBleed) return;
  state.hasBleed = true;

  const group = new THREE.Group();
  group.name = 'bleed';

  // Dark corrupted ground patch
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(6, 8),
    new THREE.MeshBasicMaterial({ color: 0x100008, transparent: true, opacity: 0.85 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.02;
  group.add(ground);

  // Distorted geometry fragments
  for (let i = 0; i < 15; i++) {
    const geo = new THREE.TetrahedronGeometry(0.2 + Math.random() * 0.5);
    const pos = geo.attributes.position;
    for (let j = 0; j < pos.count; j++) {
      pos.setXYZ(
        j,
        pos.getX(j) + (Math.random() - 0.5) * 0.35,
        pos.getY(j) + (Math.random() - 0.5) * 0.35,
        pos.getZ(j) + (Math.random() - 0.5) * 0.35,
      );
    }
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: Math.random() > 0.5 ? 0x200010 : 0x100020,
      wireframe: Math.random() > 0.3,
      transparent: true,
      opacity: 0.3 + Math.random() * 0.4,
    }));
    mesh.position.set(
      (Math.random() - 0.5) * 10,
      Math.random() * 3,
      (Math.random() - 0.5) * 10,
    );
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    mesh.name = 'bleedFragment';
    group.add(mesh);
  }

  // Dark fog particles
  const fogCount = 60;
  const fogPos = new Float32Array(fogCount * 3);
  for (let i = 0; i < fogCount; i++) {
    fogPos[i * 3] = (Math.random() - 0.5) * 12;
    fogPos[i * 3 + 1] = Math.random() * 1.5;
    fogPos[i * 3 + 2] = (Math.random() - 0.5) * 12;
  }
  const fogGeo = new THREE.BufferGeometry();
  fogGeo.setAttribute('position', new THREE.BufferAttribute(fogPos, 3));
  const fog = new THREE.Points(fogGeo, new THREE.PointsMaterial({
    color: 0x200010, size: 0.35, transparent: true, opacity: 0.4,
  }));
  group.add(fog);

  group.position.set(20, 0, 18);
  scene.add(group);
  state.elements.push(group);
}

// ── Lighting Shift ──────────────────────────────────────────────────

export function shiftLighting(scene: THREE.Scene, state: WorldState): void {
  if (state.lightShifted) return;
  state.lightShifted = true;

  const l1 = new THREE.PointLight(0x00ffe1, 0.6, 35);
  l1.position.set(6, 8, 6);
  scene.add(l1);

  const l2 = new THREE.PointLight(0xff3cac, 0.35, 25);
  l2.position.set(-6, 6, -6);
  scene.add(l2);

  scene.traverse((child) => {
    if (child instanceof THREE.AmbientLight) {
      child.intensity = 0.3;
    }
  });

  state.elements.push(l1, l2);
}
