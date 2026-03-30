import * as THREE from 'three';

// ── World State ─────────────────────────────────────────────────────

export interface WorldState {
  floorRadius: number;
  floorElements: THREE.Object3D[];
  hasSky: boolean;
  hasBleed: boolean;
  structureCount: number;
  lightShifted: boolean;
  elements: THREE.Object3D[];
}

export function createWorldState(): WorldState {
  return { floorRadius: 0, floorElements: [], hasSky: false, hasBleed: false, structureCount: 0, lightShifted: false, elements: [] };
}

// ── Shared Materials ────────────────────────────────────────────────

const solidMat = () => new THREE.MeshStandardMaterial({ color: 0x0a1520, emissive: 0x00ffe1, emissiveIntensity: 0.03, metalness: 0.7, roughness: 0.3 });
const wireMat = () => new THREE.MeshBasicMaterial({ color: 0x00ffe1, wireframe: true, transparent: true, opacity: 0.1 });
const warmMat = () => new THREE.MeshStandardMaterial({ color: 0x1a1510, emissive: 0xffaa44, emissiveIntensity: 0.04, metalness: 0.4, roughness: 0.6 });
const woodMat = () => new THREE.MeshStandardMaterial({ color: 0x3a2510, emissive: 0x442200, emissiveIntensity: 0.02, metalness: 0.2, roughness: 0.8 });
const leafMat = () => new THREE.MeshStandardMaterial({ color: 0x0a3020, emissive: 0x00ff88, emissiveIntensity: 0.06, metalness: 0.2, roughness: 0.7 });
const stoneMat = () => new THREE.MeshStandardMaterial({ color: 0x1a1a20, emissive: 0x00ffe1, emissiveIntensity: 0.01, metalness: 0.5, roughness: 0.8 });

function addWarmLight(group: THREE.Group, y: number = 3) {
  const l = new THREE.PointLight(0xffaa44, 0.4, 12);
  l.position.set(0, y, 0);
  group.add(l);
}

function placeGroup(scene: THREE.Scene, state: WorldState, group: THREE.Group, x: number, z: number) {
  group.position.set(x, 0, z);
  scene.add(group);
  state.elements.push(group);
  state.structureCount++;
}

// ── Floor ───────────────────────────────────────────────────────────

export function generateFloor(scene: THREE.Scene, state: WorldState, radius: number): void {
  const r = Math.min(radius, 60);
  if (r === state.floorRadius && state.floorElements.length > 0) return;
  for (const el of state.floorElements) { scene.remove(el); const i = state.elements.indexOf(el); if (i !== -1) state.elements.splice(i, 1); }
  state.floorElements = [];
  if (r <= 0) return;
  state.floorRadius = r;
  const size = r * 2;
  const grid = new THREE.GridHelper(size, r, 0x00ffe1, 0x0a1a1a);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  scene.add(grid);
  state.floorElements.push(grid);
  state.elements.push(grid);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color: 0x050510, metalness: 0.85, roughness: 0.35, transparent: true, opacity: 0.75 }));
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.01;
  scene.add(plane);
  state.floorElements.push(plane);
  state.elements.push(plane);
}

// ── Sky ─────────────────────────────────────────────────────────────

export function generateSky(scene: THREE.Scene, state: WorldState): void {
  if (state.hasSky) return;
  state.hasSky = true;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.MeshBasicMaterial({ color: 0x040a14, side: THREE.BackSide }));
  sky.name = 'sky';
  scene.add(sky);
  state.elements.push(sky);
  const count = 250;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2, p = Math.acos(Math.random()), rad = 180 + Math.random() * 15;
    pos[i * 3] = rad * Math.sin(p) * Math.cos(t);
    pos[i * 3 + 1] = rad * Math.cos(p);
    pos[i * 3 + 2] = rad * Math.sin(p) * Math.sin(t);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x00ffe1, size: 0.5, transparent: true, opacity: 0.5 }));
  scene.add(stars);
  state.elements.push(stars);
  const dl = new THREE.DirectionalLight(0x0088aa, 0.25);
  dl.position.set(10, 40, 10);
  scene.add(dl);
  state.elements.push(dl);
}

// ── Terrain ─────────────────────────────────────────────────────────

export function generateTerrain(scene: THREE.Scene, state: WorldState, x: number, z: number, terrainType: string): void {
  const group = new THREE.Group();
  const tMat = new THREE.MeshStandardMaterial({ color: 0x0a1a15, emissive: 0x00ffe1, emissiveIntensity: 0.02, metalness: 0.5, roughness: 0.7, flatShading: true });

  switch (terrainType) {
    case 'mountain': {
      const geo = new THREE.ConeGeometry(4 + Math.random() * 3, 8 + Math.random() * 6, 6);
      // Distort vertices for jagged look
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { p.setX(i, p.getX(i) + (Math.random() - 0.5) * 1.2); p.setZ(i, p.getZ(i) + (Math.random() - 0.5) * 1.2); }
      geo.computeVertexNormals();
      group.add(new THREE.Mesh(geo, tMat));
      // Secondary peak
      const g2 = new THREE.ConeGeometry(2.5 + Math.random() * 2, 5 + Math.random() * 4, 5);
      const m2 = new THREE.Mesh(g2, tMat.clone());
      m2.position.set(3 + Math.random() * 2, 0, 2 + Math.random() * 2);
      group.add(m2);
      break;
    }
    case 'hill': {
      const geo = new THREE.SphereGeometry(3 + Math.random() * 2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      group.add(new THREE.Mesh(geo, tMat));
      const g2 = new THREE.SphereGeometry(2 + Math.random(), 6, 5, 0, Math.PI * 2, 0, Math.PI / 2);
      const m2 = new THREE.Mesh(g2, tMat.clone());
      m2.position.set(3, 0, 2);
      group.add(m2);
      break;
    }
    case 'cliff': {
      const geo = new THREE.BoxGeometry(6 + Math.random() * 3, 5 + Math.random() * 4, 3);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { if (p.getY(i) > 0) { p.setX(i, p.getX(i) + (Math.random() - 0.5) * 1.5); p.setZ(i, p.getZ(i) + (Math.random() - 0.5) * 1); } }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, tMat);
      m.position.y = 2.5;
      group.add(m);
      break;
    }
    case 'valley': {
      // Two hills with a gap
      const h1 = new THREE.Mesh(new THREE.SphereGeometry(3, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2), tMat);
      h1.position.set(-4, 0, 0);
      const h2 = new THREE.Mesh(new THREE.SphereGeometry(3, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2), tMat.clone());
      h2.position.set(4, 0, 0);
      group.add(h1, h2);
      break;
    }
    case 'plain': {
      // Flat slightly raised plane with subtle grid
      const p = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: 0x0a1510, emissive: 0x00ff88, emissiveIntensity: 0.01, metalness: 0.3, roughness: 0.9 }));
      p.rotation.x = -Math.PI / 2;
      p.position.y = 0.05;
      group.add(p);
      break;
    }
  }
  placeGroup(scene, state, group, x, z);
}

// ── Structures ──────────────────────────────────────────────────────

export function generateStructure(scene: THREE.Scene, state: WorldState, x: number, z: number, structureType: string): void {
  const group = new THREE.Group();

  switch (structureType) {
    case 'castle': {
      // Foundation platform
      const foundation = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 10), solidMat());
      foundation.position.y = 0.2;
      group.add(foundation);
      // Main keep — tall box in center
      const keep = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 3), solidMat());
      keep.position.y = 2.9;
      group.add(keep);
      // Keep roof
      const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 2, 4), warmMat());
      keepRoof.position.y = 5.9;
      keepRoof.rotation.y = Math.PI / 4;
      group.add(keepRoof);
      // 4 corner towers
      const towerPositions = [[-4, -4], [-4, 4], [4, -4], [4, 4]];
      for (const [tx, tz] of towerPositions) {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 4.5, 6), solidMat());
        tower.position.set(tx, 2.65, tz);
        group.add(tower);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(1, 1.5, 6), warmMat());
        cap.position.set(tx, 5.15, tz);
        group.add(cap);
      }
      // Walls connecting towers
      const wallDefs = [[[-4, -4], [4, -4]], [[4, -4], [4, 4]], [[4, 4], [-4, 4]], [[-4, 4], [-4, -4]]];
      for (const [[ax, az], [bx, bz]] of wallDefs) {
        const wallLen = Math.sqrt((bx - ax) ** 2 + (bz - az) ** 2);
        const wall = new THREE.Mesh(new THREE.BoxGeometry(wallLen, 3, 0.4), solidMat());
        wall.position.set((ax + bx) / 2, 1.9, (az + bz) / 2);
        wall.rotation.y = Math.atan2(bx - ax, bz - az);
        group.add(wall);
        // Crenellations
        for (let ci = 0; ci < 4; ci++) {
          const t = (ci + 0.5) / 4;
          const cren = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.5), solidMat());
          const cx = ax + (bx - ax) * t;
          const cz = az + (bz - az) * t;
          cren.position.set(cx, 3.65, cz);
          group.add(cren);
        }
      }
      // Gate arch at front
      const gateL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3, 0.6), solidMat());
      gateL.position.set(-1, 1.9, -5);
      const gateR = gateL.clone(); gateR.position.set(1, 1.9, -5);
      const gateTop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.6), solidMat());
      gateTop.position.set(0, 3.6, -5);
      group.add(gateL, gateR, gateTop);
      // Courtyard floor
      const courtyard = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshStandardMaterial({ color: 0x0a1210, metalness: 0.6, roughness: 0.5 }));
      courtyard.rotation.x = -Math.PI / 2;
      courtyard.position.y = 0.42;
      group.add(courtyard);
      addWarmLight(group, 5.5);
      break;
    }
    case 'house': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2, 2), solidMat());
      base.position.y = 1;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.5, 4), warmMat());
      roof.position.y = 2.75;
      roof.rotation.y = Math.PI / 4;
      const win1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.05), new THREE.MeshBasicMaterial({ color: 0x00ffe1 }));
      win1.position.set(-0.5, 1.2, 1.01);
      const win2 = win1.clone(); win2.position.set(0.5, 1.2, 1.01);
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 6), stoneMat());
      chimney.position.set(0.8, 3, -0.5);
      group.add(base, roof, win1, win2, chimney);
      addWarmLight(group, 2.5);
      break;
    }
    case 'tower': {
      const h = 5 + Math.random() * 5;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, h, 6), solidMat());
      body.position.y = h / 2;
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2, 6), warmMat());
      top.position.y = h + 1;
      // Windows
      for (let i = 0; i < 3; i++) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), new THREE.MeshBasicMaterial({ color: 0x00ffe1 }));
        w.position.set(0, h * 0.3 * (i + 1), 1.01);
        group.add(w);
      }
      group.add(body, top);
      addWarmLight(group, h);
      break;
    }
    case 'bridge': {
      const span = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 2), solidMat());
      span.position.y = 2;
      const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.5, 6), stoneMat());
      p1.position.set(-2.5, 1, 0);
      const p2 = p1.clone(); p2.position.set(2.5, 1, 0);
      group.add(span, p1, p2);
      break;
    }
    case 'wall': {
      for (let i = 0; i < 5; i++) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 0.4), solidMat());
        seg.position.set(i * 2 - 4, 1.25, 0);
        group.add(seg);
      }
      break;
    }
    case 'gate': {
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.6), solidMat());
      p1.position.set(-1.5, 2, 0);
      const p2 = p1.clone(); p2.position.set(1.5, 2, 0);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 0.5), solidMat());
      bar.position.set(0, 4, 0);
      group.add(p1, p2, bar);
      addWarmLight(group, 4.5);
      break;
    }
    case 'arch': {
      const h = 4 + Math.random() * 2;
      const pL = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), solidMat());
      pL.position.set(-1.5, h / 2, 0);
      const pR = pL.clone(); pR.position.set(1.5, h / 2, 0);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.4, 0.5), solidMat());
      beam.position.set(0, h + 0.2, 0);
      group.add(pL, pR, beam);
      break;
    }
    case 'stage': {
      const platform = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.5, 0.5, 8), solidMat());
      platform.position.y = 0.25;
      const back = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 0.3), solidMat());
      back.position.set(0, 2.75, -4);
      group.add(platform, back);
      addWarmLight(group, 5);
      const spotL = new THREE.PointLight(0x00ffe1, 0.6, 15);
      spotL.position.set(-3, 5, 2);
      const spotR = new THREE.PointLight(0xff3cac, 0.4, 15);
      spotR.position.set(3, 5, 2);
      group.add(spotL, spotR);
      break;
    }
    case 'well': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.2, 8, 12), stoneMat());
      ring.position.y = 0.6;
      ring.rotation.x = Math.PI / 2;
      const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 4), woodMat());
      p1.position.set(-0.6, 1.2, 0);
      const p2 = p1.clone(); p2.position.set(0.6, 1.2, 0);
      const roofB = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.8), woodMat());
      roofB.position.y = 2;
      group.add(ring, p1, p2, roofB);
      break;
    }
    case 'fountain': {
      const b1 = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.5, 12), stoneMat());
      b1.position.y = 0.25;
      const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 0.4, 10), stoneMat());
      b2.position.y = 0.7;
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 6), stoneMat());
      spout.position.y = 1.3;
      // Water particles
      const pCount = 30;
      const pPos = new Float32Array(pCount * 3);
      for (let i = 0; i < pCount; i++) {
        const a = Math.random() * Math.PI * 2;
        pPos[i * 3] = Math.cos(a) * Math.random() * 0.8;
        pPos[i * 3 + 1] = 1.5 + Math.random() * 0.8;
        pPos[i * 3 + 2] = Math.sin(a) * Math.random() * 0.8;
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x00aaff, size: 0.08, transparent: true, opacity: 0.6 }));
      group.add(b1, b2, spout, particles);
      break;
    }
    case 'stairs': {
      for (let i = 0; i < 8; i++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 0.5), solidMat());
        step.position.set(0, i * 0.3, -i * 0.5);
        group.add(step);
      }
      break;
    }
    case 'ruins': {
      // Broken columns and walls
      for (let i = 0; i < 4; i++) {
        const h = 1 + Math.random() * 3;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, h, 5), stoneMat());
        col.position.set((Math.random() - 0.5) * 5, h / 2, (Math.random() - 0.5) * 5);
        col.rotation.z = (Math.random() - 0.5) * 0.3;
        col.rotation.x = (Math.random() - 0.5) * 0.2;
        group.add(col);
      }
      const slab = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 2), stoneMat());
      slab.position.set(1, 0.15, 0);
      slab.rotation.z = 0.1;
      group.add(slab);
      break;
    }
    case 'path': {
      for (let i = 0; i < 8; i++) {
        const tile = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 1), stoneMat());
        tile.position.set(i * 1.2 - 4, 0.03, (Math.random() - 0.5) * 0.3);
        group.add(tile);
      }
      break;
    }
    case 'lamp': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 3, 6), solidMat());
      pole.position.y = 1.5;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffdd88 }));
      bulb.position.y = 3.1;
      const light = new THREE.PointLight(0xffdd88, 0.5, 8);
      light.position.y = 3.1;
      group.add(pole, bulb, light);
      break;
    }
    default: {
      // Generic structure fallback (pillar/pyramid)
      const h = 3 + Math.random() * 4;
      const types = ['box', 'cone', 'cylinder'];
      const t = types[Math.floor(Math.random() * types.length)];
      let mesh: THREE.Mesh;
      if (t === 'box') { mesh = new THREE.Mesh(new THREE.BoxGeometry(1 + Math.random(), h, 1 + Math.random()), solidMat()); }
      else if (t === 'cone') { mesh = new THREE.Mesh(new THREE.ConeGeometry(1 + Math.random(), h, 4), solidMat()); }
      else { mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, h, 6), solidMat()); }
      mesh.position.y = h / 2;
      const wire = new THREE.Mesh(mesh.geometry.clone(), wireMat());
      wire.position.copy(mesh.position);
      wire.scale.multiplyScalar(1.02);
      group.add(mesh, wire);
      addWarmLight(group, h);
      break;
    }
  }

  group.rotation.y = Math.random() * Math.PI * 2;
  placeGroup(scene, state, group, x, z);
}

// ── Nature Elements ─────────────────────────────────────────────────

export function generateNature(scene: THREE.Scene, state: WorldState, x: number, z: number, natureType: string): void {
  const group = new THREE.Group();

  switch (natureType) {
    case 'tree': {
      const h = 2 + Math.random() * 3;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, h, 5), woodMat());
      trunk.position.y = h / 2;
      const foliageType = Math.random();
      let foliage: THREE.Mesh;
      if (foliageType < 0.5) {
        foliage = new THREE.Mesh(new THREE.SphereGeometry(0.8 + Math.random() * 0.6, 6, 5), leafMat());
      } else {
        foliage = new THREE.Mesh(new THREE.ConeGeometry(0.8 + Math.random() * 0.5, 2 + Math.random(), 6), leafMat());
      }
      foliage.position.y = h + 0.5;
      group.add(trunk, foliage);
      break;
    }
    case 'rocks': {
      const count = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const size = 0.2 + Math.random() * 0.5;
        const geo = Math.random() > 0.5 ? new THREE.DodecahedronGeometry(size, 0) : new THREE.BoxGeometry(size * 1.5, size, size * 1.2);
        const rock = new THREE.Mesh(geo, stoneMat());
        rock.position.set((Math.random() - 0.5) * 2, size / 2, (Math.random() - 0.5) * 2);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        group.add(rock);
      }
      break;
    }
    case 'flowers': {
      const flowerMat = new THREE.MeshBasicMaterial({ color: [0xff3cac, 0xffaa00, 0x00ffe1, 0xff6644][Math.floor(Math.random() * 4)] });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 3), leafMat());
      stem.position.y = 0.15;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), flowerMat);
      petal.position.y = 0.32;
      group.add(stem, petal);
      break;
    }
    case 'grass': {
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.3), leafMat());
      blade.position.y = 0.15;
      blade.rotation.y = Math.random() * Math.PI;
      group.add(blade);
      // A few more blades
      for (let i = 0; i < 3; i++) {
        const b = blade.clone();
        b.position.set((Math.random() - 0.5) * 0.3, 0.15, (Math.random() - 0.5) * 0.3);
        b.rotation.y = Math.random() * Math.PI;
        group.add(b);
      }
      break;
    }
    case 'water': {
      const water = new THREE.Mesh(
        new THREE.CircleGeometry(5 + Math.random() * 3, 16),
        new THREE.MeshStandardMaterial({ color: 0x003344, emissive: 0x0066aa, emissiveIntensity: 0.1, metalness: 0.9, roughness: 0.2, transparent: true, opacity: 0.7 })
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = -0.05;
      water.name = 'water';
      group.add(water);
      break;
    }
    case 'fog': {
      const fogCount = 40;
      const pPos = new Float32Array(fogCount * 3);
      for (let i = 0; i < fogCount; i++) {
        pPos[i * 3] = (Math.random() - 0.5) * 30;
        pPos[i * 3 + 1] = Math.random() * 1.5;
        pPos[i * 3 + 2] = (Math.random() - 0.5) * 30;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      const fog = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x445566, size: 0.8, transparent: true, opacity: 0.2 }));
      fog.name = 'fogParticles';
      group.add(fog);
      break;
    }
  }

  group.position.set(x, 0, z);
  scene.add(group);
  state.elements.push(group);
}

// ── THE BLEED ───────────────────────────────────────────────────────

export function generateBleed(scene: THREE.Scene, state: WorldState, x: number, z: number): void {
  if (state.hasBleed) return;
  state.hasBleed = true;
  const group = new THREE.Group();
  group.name = 'bleed';

  // Corrupted terrain patch
  const terrainGeo = new THREE.PlaneGeometry(12, 12, 8, 8);
  const tPos = terrainGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    tPos.setZ(i, (Math.random() - 0.5) * 2); // distort
  }
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ color: 0x100008, emissive: 0x200010, emissiveIntensity: 0.05, flatShading: true, transparent: true, opacity: 0.85 }));
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = 0.02;
  group.add(terrain);

  // Distorted fragments
  for (let i = 0; i < 12; i++) {
    const geo = new THREE.TetrahedronGeometry(0.2 + Math.random() * 0.5);
    const p = geo.attributes.position;
    for (let j = 0; j < p.count; j++) { p.setXYZ(j, p.getX(j) + (Math.random() - 0.5) * 0.35, p.getY(j) + (Math.random() - 0.5) * 0.35, p.getZ(j) + (Math.random() - 0.5) * 0.35); }
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0x200010 : 0x100020, wireframe: Math.random() > 0.3, transparent: true, opacity: 0.3 + Math.random() * 0.4 }));
    mesh.position.set((Math.random() - 0.5) * 10, Math.random() * 3, (Math.random() - 0.5) * 10);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    mesh.name = 'bleedFragment';
    group.add(mesh);
  }

  // Dark particles
  const fogCount = 50;
  const fPos = new Float32Array(fogCount * 3);
  for (let i = 0; i < fogCount; i++) { fPos[i * 3] = (Math.random() - 0.5) * 12; fPos[i * 3 + 1] = Math.random() * 1.5; fPos[i * 3 + 2] = (Math.random() - 0.5) * 12; }
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  group.add(new THREE.Points(fGeo, new THREE.PointsMaterial({ color: 0x200010, size: 0.35, transparent: true, opacity: 0.4 })));

  group.position.set(x, 0, z);
  scene.add(group);
  state.elements.push(group);
}

// ── Lighting Shift ──────────────────────────────────────────────────

export function shiftLighting(scene: THREE.Scene, state: WorldState): void {
  if (state.lightShifted) return;
  state.lightShifted = true;
  const l1 = new THREE.PointLight(0x00ffe1, 0.6, 35); l1.position.set(6, 8, 6); scene.add(l1);
  const l2 = new THREE.PointLight(0xff3cac, 0.35, 25); l2.position.set(-6, 6, -6); scene.add(l2);
  scene.traverse((c) => { if (c instanceof THREE.AmbientLight) c.intensity = 0.3; });
  state.elements.push(l1, l2);
}
