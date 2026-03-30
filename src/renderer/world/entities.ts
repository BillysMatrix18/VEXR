import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ── VEXR Bone Names (from the known rig) ────────────────────────────

export const VEXR_BONES = {
  jaw: 'ORG-bottom_teeth_314',
  bottomTeeth: 'bottom_teeth_349',
  tongue: 'tongue_start_348',
  eyeL: 'eye_l_310',
  eyeR: 'eye_r_313',
  upperArmL: 'upper_arm_fk.L',
  upperArmR: 'upper_arm_fk.R',
  chest: 'chest_27',
  spine: 'DEF-spine_17',
  cane: 'cane_207',
};

// ── Load VEXR GLB Model ─────────────────────────────────────────────

export function loadVexrModel(
  onSuccess: (group: THREE.Group) => void,
  onFallback: () => void,
): void {
  const loader = new GLTFLoader();

  // publicDir in vite serves models/ → /VEXR.glb from root
  // In built app → models/VEXR.glb relative to index.html
  const paths = ['/VEXR.glb', './VEXR.glb', 'VEXR.glb', '../models/VEXR.glb', '../../models/VEXR.glb'];

  let attempted = 0;
  function tryNext() {
    if (attempted >= paths.length) {
      console.warn('[VEXR] GLB not found at any path, using primitive model. Tried:', paths);
      onFallback();
      return;
    }
    const p = paths[attempted++];
    console.log(`[VEXR] Trying to load GLB from: "${p}" (attempt ${attempted}/${paths.length})`);
    loader.load(
      p,
      (gltf) => {
        const model = gltf.scene;
        model.name = 'vexrGLB';
        model.scale.setScalar(0.015);

        // Log all bone/node names for debugging
        console.log('[VEXR] GLB loaded successfully from:', p);
        console.log('[VEXR] Model nodes:');
        model.traverse((child) => {
          if (child.name) console.log(`  - ${child.type}: "${child.name}"`);
        });

        // Enable shadows on all meshes
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Cyan rim light / glow
        const glow = new THREE.PointLight(0x00ffe1, 0.6, 6);
        glow.position.y = 1.5;
        model.add(glow);

        // Speech indicator ring above head
        const speechRing = new THREE.Mesh(
          new THREE.RingGeometry(0.15, 0.23, 16),
          new THREE.MeshBasicMaterial({ color: 0x00ffe1, transparent: true, opacity: 0, side: THREE.DoubleSide }),
        );
        speechRing.position.y = 2.8;
        speechRing.rotation.x = -Math.PI / 2;
        speechRing.name = 'speechIndicator';
        model.add(speechRing);

        onSuccess(model);
      },
      undefined,
      (err) => {
        console.log(`[VEXR] Failed to load from "${p}":`, err);
        tryNext();
      },
    );
  }
  tryNext();
}

// ── VEXR Primitive Fallback ─────────────────────────────────────────

export function createVexrCharacter(): THREE.Group {
  const group = new THREE.Group();

  const cyanEmissive = new THREE.MeshStandardMaterial({
    color: 0x003333, emissive: 0x00ffe1, emissiveIntensity: 0.35, metalness: 0.8, roughness: 0.2,
  });
  const darkBody = new THREE.MeshStandardMaterial({
    color: 0x0a1a1a, emissive: 0x00ffe1, emissiveIntensity: 0.06, metalness: 0.6, roughness: 0.4,
  });

  const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), cyanEmissive);
  head.position.y = 2.15; head.name = 'head'; group.add(head);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ffe1 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
  eyeL.position.set(-0.1, 2.18, 0.2); group.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
  eyeR.position.set(0.1, 2.18, 0.2); group.add(eyeR);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 1.0, 6), darkBody);
  torso.position.y = 1.5; group.add(torso);

  const coatMat = darkBody.clone();
  const coatL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.45), coatMat);
  coatL.position.set(-0.24, 0.62, 0); coatL.rotation.z = 0.12; coatL.name = 'coatL'; group.add(coatL);
  const coatR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.45), coatMat);
  coatR.position.set(0.24, 0.62, 0); coatR.rotation.z = -0.12; coatR.name = 'coatR'; group.add(coatR);

  const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 4);
  const armL = new THREE.Mesh(armGeo, darkBody);
  armL.position.set(-0.4, 1.35, 0); armL.rotation.z = 0.3; armL.name = 'armL'; group.add(armL);
  const armR = new THREE.Mesh(armGeo, darkBody);
  armR.position.set(0.4, 1.35, 0); armR.rotation.z = -0.3; armR.name = 'armR'; group.add(armR);

  const rimMat = new THREE.MeshBasicMaterial({ color: 0x00ffe1, wireframe: true, transparent: true, opacity: 0.18 });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.39, 1.05, 6), rimMat);
  rim.position.y = 1.5; group.add(rim);

  const speechRing = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.23, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ffe1, transparent: true, opacity: 0, side: THREE.DoubleSide }),
  );
  speechRing.position.y = 2.6; speechRing.rotation.x = -Math.PI / 2; speechRing.name = 'speechIndicator';
  group.add(speechRing);

  const glow = new THREE.PointLight(0x00ffe1, 0.6, 6);
  glow.position.y = 1.5; group.add(glow);

  group.position.y = 0.3;
  group.userData.isPrimitive = true;
  return group;
}

// ── SPECK ───────────────────────────────────────────────────────────

export function createSpeck(): THREE.Mesh {
  const speck = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffdd00, emissive: 0xffdd00, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.2 }),
  );
  speck.name = 'speck';
  speck.add(new THREE.PointLight(0xffdd00, 0.5, 4));
  return speck;
}

// ── The Trapped One ─────────────────────────────────────────────────

export function createTrappedCharacter(): THREE.Group {
  const group = new THREE.Group();
  const warmMat = new THREE.MeshStandardMaterial({ color: 0xf0e6d3, emissive: 0xf0e6d3, emissiveIntensity: 0.08, metalness: 0.1, roughness: 0.8 });
  const warmDark = new THREE.MeshStandardMaterial({ color: 0xc8b8a0, emissive: 0xf0e6d3, emissiveIntensity: 0.04, metalness: 0.1, roughness: 0.9 });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), warmMat);
  head.position.y = 1.78; head.name = 'head'; group.add(head);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.8, 8), warmDark);
  body.position.y = 1.22; body.name = 'body'; group.add(body);

  const armGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.5, 4);
  const aL = new THREE.Mesh(armGeo, warmDark); aL.position.set(-0.28, 1.2, 0.06); aL.rotation.z = 0.15; aL.rotation.x = -0.12; group.add(aL);
  const aR = new THREE.Mesh(armGeo, warmDark); aR.position.set(0.28, 1.2, 0.06); aR.rotation.z = -0.15; aR.rotation.x = -0.12; group.add(aR);
  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.7, 4);
  const lL = new THREE.Mesh(legGeo, warmDark); lL.position.set(-0.1, 0.45, 0); group.add(lL);
  const lR = new THREE.Mesh(legGeo, warmDark); lR.position.set(0.1, 0.45, 0); group.add(lR);

  const speechRing = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.19, 16),
    new THREE.MeshBasicMaterial({ color: 0xf0e6d3, transparent: true, opacity: 0, side: THREE.DoubleSide }),
  );
  speechRing.position.y = 2.15; speechRing.rotation.x = -Math.PI / 2; speechRing.name = 'speechIndicator';
  group.add(speechRing);
  group.add(new THREE.PointLight(0xf0e6d3, 0.35, 4));
  group.rotation.x = 0.04;
  return group;
}

// ── Spawn Burst Particles ───────────────────────────────────────────

export function createSpawnBurst(color: number): THREE.Group {
  const group = new THREE.Group();
  for (let i = 0; i < 24; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
    const a = (i / 24) * Math.PI * 2;
    const s = 1.5 + Math.random() * 2.5;
    p.userData.velocity = new THREE.Vector3(Math.cos(a) * s, (Math.random() - 0.2) * s * 0.6, Math.sin(a) * s);
    p.position.y = 1.2;
    group.add(p);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.01, 0.5, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 1; ring.name = 'flashRing'; group.add(ring);
  return group;
}
