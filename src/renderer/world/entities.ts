import * as THREE from 'three';

// ── VEXR Character ──────────────────────────────────────────────────

export function createVexrCharacter(): THREE.Group {
  const group = new THREE.Group();

  const cyanEmissive = new THREE.MeshStandardMaterial({
    color: 0x003333,
    emissive: 0x00ffe1,
    emissiveIntensity: 0.35,
    metalness: 0.8,
    roughness: 0.2,
  });

  const darkBody = new THREE.MeshStandardMaterial({
    color: 0x0a1a1a,
    emissive: 0x00ffe1,
    emissiveIntensity: 0.06,
    metalness: 0.6,
    roughness: 0.4,
  });

  // Head — octahedron (geometric, angular)
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), cyanEmissive);
  head.position.y = 2.15;
  head.name = 'head';
  group.add(head);

  // Eyes — two small glowing spheres
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ffe1 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
  eyeL.position.set(-0.1, 2.18, 0.2);
  group.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
  eyeR.position.set(0.1, 2.18, 0.2);
  group.add(eyeR);

  // Torso — hexagonal cylinder
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 1.0, 6), darkBody);
  torso.position.y = 1.5;
  group.add(torso);

  // Coat tails — two boxes angled outward
  const coatMat = darkBody.clone();
  const coatL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.45), coatMat);
  coatL.position.set(-0.24, 0.62, 0);
  coatL.rotation.z = 0.12;
  coatL.name = 'coatL';
  group.add(coatL);

  const coatR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.45), coatMat);
  coatR.position.set(0.24, 0.62, 0);
  coatR.rotation.z = -0.12;
  coatR.name = 'coatR';
  group.add(coatR);

  // Arms — thin cylinders
  const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 4);
  const armL = new THREE.Mesh(armGeo, darkBody);
  armL.position.set(-0.4, 1.35, 0);
  armL.rotation.z = 0.3;
  armL.name = 'armL';
  group.add(armL);

  const armR = new THREE.Mesh(armGeo, darkBody);
  armR.position.set(0.4, 1.35, 0);
  armR.rotation.z = -0.3;
  armR.name = 'armR';
  group.add(armR);

  // Rim wireframe outline
  const rimMat = new THREE.MeshBasicMaterial({
    color: 0x00ffe1, wireframe: true, transparent: true, opacity: 0.18,
  });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.39, 1.05, 6), rimMat);
  rim.position.y = 1.5;
  group.add(rim);

  // Speech indicator — ring above head
  const speechRing = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.23, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ffe1, transparent: true, opacity: 0, side: THREE.DoubleSide }),
  );
  speechRing.position.y = 2.6;
  speechRing.rotation.x = -Math.PI / 2;
  speechRing.name = 'speechIndicator';
  group.add(speechRing);

  // Cyan point light glow
  const glow = new THREE.PointLight(0x00ffe1, 0.6, 6);
  glow.position.y = 1.5;
  group.add(glow);

  group.position.y = 0.3;
  return group;
}

// ── SPECK ───────────────────────────────────────────────────────────

export function createSpeck(): THREE.Mesh {
  const speck = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffdd00,
      emissive: 0xffdd00,
      emissiveIntensity: 0.9,
      metalness: 0.3,
      roughness: 0.2,
    }),
  );
  speck.name = 'speck';
  const light = new THREE.PointLight(0xffdd00, 0.5, 4);
  speck.add(light);
  return speck;
}

// ── The Trapped One ─────────────────────────────────────────────────

export function createTrappedCharacter(): THREE.Group {
  const group = new THREE.Group();

  const warmMat = new THREE.MeshStandardMaterial({
    color: 0xf0e6d3,
    emissive: 0xf0e6d3,
    emissiveIntensity: 0.08,
    metalness: 0.1,
    roughness: 0.8,
  });

  const warmDark = new THREE.MeshStandardMaterial({
    color: 0xc8b8a0,
    emissive: 0xf0e6d3,
    emissiveIntensity: 0.04,
    metalness: 0.1,
    roughness: 0.9,
  });

  // Head — sphere (organic contrast to VEXR)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), warmMat);
  head.position.y = 1.78;
  head.name = 'head';
  group.add(head);

  // Body — cylinder
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.8, 8), warmDark);
  body.position.y = 1.22;
  body.name = 'body';
  group.add(body);

  // Arms — thin, slightly forward (uncertain posture)
  const armGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.5, 4);
  const armL = new THREE.Mesh(armGeo, warmDark);
  armL.position.set(-0.28, 1.2, 0.06);
  armL.rotation.z = 0.15;
  armL.rotation.x = -0.12;
  group.add(armL);

  const armR = new THREE.Mesh(armGeo, warmDark);
  armR.position.set(0.28, 1.2, 0.06);
  armR.rotation.z = -0.15;
  armR.rotation.x = -0.12;
  group.add(armR);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.7, 4);
  const legL = new THREE.Mesh(legGeo, warmDark);
  legL.position.set(-0.1, 0.45, 0);
  group.add(legL);

  const legR = new THREE.Mesh(legGeo, warmDark);
  legR.position.set(0.1, 0.45, 0);
  group.add(legR);

  // Speech indicator
  const speechRing = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.19, 16),
    new THREE.MeshBasicMaterial({ color: 0xf0e6d3, transparent: true, opacity: 0, side: THREE.DoubleSide }),
  );
  speechRing.position.y = 2.15;
  speechRing.rotation.x = -Math.PI / 2;
  speechRing.name = 'speechIndicator';
  group.add(speechRing);

  // Soft warm glow
  const glow = new THREE.PointLight(0xf0e6d3, 0.35, 4);
  glow.position.y = 1.2;
  group.add(glow);

  // Slightly hunched posture
  group.rotation.x = 0.04;

  return group;
}

// ── Spawn Burst Particles ───────────────────────────────────────────

export function createSpawnBurst(color: number): THREE.Group {
  const group = new THREE.Group();
  const count = 24;

  for (let i = 0; i < count; i++) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 4, 4),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
    );
    const angle = (i / count) * Math.PI * 2;
    const speed = 1.5 + Math.random() * 2.5;
    particle.userData.velocity = new THREE.Vector3(
      Math.cos(angle) * speed,
      (Math.random() - 0.2) * speed * 0.6,
      Math.sin(angle) * speed,
    );
    particle.position.y = 1.2;
    group.add(particle);
  }

  // Central flash ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.01, 0.5, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 1;
  ring.name = 'flashRing';
  group.add(ring);

  return group;
}
