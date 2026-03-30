import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createVexrCharacter, createTrappedCharacter, createSpeck, createSpawnBurst } from './entities';
import {
  WorldState, createWorldState, parseKeywords,
  generateFloor, generateSky, generateStructure, generateBleed, shiftLighting,
} from './worldBuilder';

interface Message {
  role: string;
  content: string;
}

interface ConstructSceneProps {
  spawnedEntities: Set<string>;
  messages: Message[];
  typingWho: string | null;
}

interface CharState {
  group: THREE.Group;
  target: THREE.Vector3;
  wanderTimer: number;
}

interface SceneState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  clock: THREE.Clock;
  vexr: CharState | null;
  trapped: CharState | null;
  speck: THREE.Mesh | null;
  worldState: WorldState;
  bursts: { group: THREE.Group; startTime: number }[];
  speaking: string | null;
  disposed: boolean;
}

// ── Movement Helper ─────────────────────────────────────────────────

function updateMovement(
  char: CharState,
  delta: number,
  time: number,
  otherGroup: THREE.Group | null,
  isSpeaking: boolean,
  isVexr: boolean,
) {
  const pos = char.group.position;
  const baseY = isVexr ? 0.3 + Math.sin(time * 1.5) * 0.08 : 0;

  // Face the other character when speaking
  if (isSpeaking && otherGroup) {
    const toOther = new THREE.Vector3().subVectors(otherGroup.position, pos);
    toOther.y = 0;
    if (toOther.length() > 0.01) {
      const targetAngle = Math.atan2(toOther.x, toOther.z);
      let diff = targetAngle - char.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      char.group.rotation.y += diff * 0.08;
    }
    pos.y = baseY;
    return;
  }

  // Move toward target
  const dir = new THREE.Vector3().subVectors(char.target, pos);
  dir.y = 0;
  const dist = dir.length();

  if (dist > 0.3) {
    dir.normalize();
    const speed = Math.min(dist * 0.5, isVexr ? 1.8 : 1.2) * delta;
    pos.x += dir.x * speed;
    pos.z += dir.z * speed;

    const moveAngle = Math.atan2(dir.x, dir.z);
    let diff = moveAngle - char.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    char.group.rotation.y += diff * 0.05;
  }

  pos.y = baseY;

  // Pick new wander target
  char.wanderTimer -= delta;
  if (char.wanderTimer <= 0 || dist < 0.3) {
    char.wanderTimer = 5 + Math.random() * 7;
    const range = otherGroup ? 8 : 5;
    char.target.set((Math.random() - 0.5) * range, 0, (Math.random() - 0.5) * range);

    // Sometimes wander toward the other character
    if (otherGroup && Math.random() > 0.5) {
      char.target.copy(otherGroup.position);
      char.target.x += (Math.random() - 0.5) * 3;
      char.target.z += (Math.random() - 0.5) * 3;
      char.target.y = 0;
    }
  }
}

// ── Component ───────────────────────────────────────────────────────

const ConstructScene: React.FC<ConstructSceneProps> = ({ spawnedEntities, messages, typingWho }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SceneState | null>(null);
  const prevEntitiesRef = useRef(new Set<string>());
  const prevMsgCountRef = useRef(0);

  // Keep speaking state current
  useEffect(() => {
    if (stateRef.current) stateRef.current.speaking = typingWho;
  }, [typingWho]);

  // ── Initialize Three.js ─────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.012);

    const camera = new THREE.PerspectiveCamera(
      55, container.clientWidth / container.clientHeight, 0.1, 500,
    );
    camera.position.set(0, 5, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.2;
    controls.minDistance = 3;
    controls.maxDistance = 50;

    // Faint ambient (void state — barely visible)
    const ambient = new THREE.AmbientLight(0xffffff, 0.12);
    scene.add(ambient);

    const state: SceneState = {
      scene, camera, renderer, controls,
      clock: new THREE.Clock(),
      vexr: null, trapped: null, speck: null,
      worldState: createWorldState(),
      bursts: [],
      speaking: null,
      disposed: false,
    };
    stateRef.current = state;

    // ── Animation Loop ────────────────────────────────────────────
    const animate = () => {
      if (state.disposed) return;
      requestAnimationFrame(animate);

      const delta = state.clock.getDelta();
      const time = state.clock.getElapsedTime();

      // VEXR animations
      if (state.vexr) {
        const v = state.vexr;
        const coatL = v.group.getObjectByName('coatL');
        const coatR = v.group.getObjectByName('coatR');
        if (coatL) coatL.rotation.z = 0.12 + Math.sin(time * 2) * 0.06;
        if (coatR) coatR.rotation.z = -0.12 + Math.sin(time * 2 + 1) * 0.06;

        // Head bob when speaking
        const head = v.group.getObjectByName('head');
        if (head) {
          head.rotation.y = state.speaking === 'vexr'
            ? Math.sin(time * 4) * 0.15
            : Math.sin(time * 0.5) * 0.1;
        }

        // Arms gesture when speaking
        const armL = v.group.getObjectByName('armL');
        const armR = v.group.getObjectByName('armR');
        if (state.speaking === 'vexr') {
          if (armL) armL.rotation.z = 0.3 + Math.sin(time * 3) * 0.25;
          if (armR) armR.rotation.z = -0.3 + Math.sin(time * 3 + 1.5) * 0.25;
        } else {
          if (armL) armL.rotation.z += (0.3 - armL.rotation.z) * 0.05;
          if (armR) armR.rotation.z += (-0.3 - armR.rotation.z) * 0.05;
        }

        updateMovement(v, delta, time, state.trapped?.group ?? null, state.speaking === 'vexr', true);

        // Speech indicator
        const si = v.group.getObjectByName('speechIndicator') as THREE.Mesh | undefined;
        if (si) {
          const mat = si.material as THREE.MeshBasicMaterial;
          const target = state.speaking === 'vexr' ? 0.7 : 0;
          mat.opacity += (target - mat.opacity) * 0.1;
          si.rotation.z = time * 2;
        }
      }

      // Trapped One animations
      if (state.trapped) {
        const t = state.trapped;

        // Subtle breathing
        const body = t.group.getObjectByName('body');
        if (body) body.scale.set(1, 1 + Math.sin(time * 2.5) * 0.015, 1);

        // Head look around when not speaking
        const head = t.group.getObjectByName('head');
        if (head) {
          head.rotation.y = state.speaking === 'trapped'
            ? Math.sin(time * 3) * 0.08
            : Math.sin(time * 0.6) * 0.35;
          head.rotation.x = state.speaking !== 'trapped'
            ? Math.sin(time * 0.4 + 1) * 0.1
            : 0;
        }

        updateMovement(t, delta, time, state.vexr?.group ?? null, state.speaking === 'trapped', false);

        // Speech indicator
        const si = t.group.getObjectByName('speechIndicator') as THREE.Mesh | undefined;
        if (si) {
          const mat = si.material as THREE.MeshBasicMaterial;
          const target = state.speaking === 'trapped' ? 0.6 : 0;
          mat.opacity += (target - mat.opacity) * 0.1;
          si.rotation.z = time * 1.5;
        }
      }

      // SPECK orbit around VEXR
      if (state.speck && state.vexr) {
        const vp = state.vexr.group.position;
        const spd = state.speaking === 'vexr' ? 3.5 : 1.8;
        const rad = state.speaking === 'vexr' ? 0.9 : 1.3;
        state.speck.position.set(
          vp.x + Math.cos(time * spd) * rad,
          vp.y + 1.8 + Math.sin(time * 2.5) * 0.15,
          vp.z + Math.sin(time * spd) * rad,
        );
        const pulse = state.speaking === 'vexr' ? 1 + Math.sin(time * 8) * 0.25 : 1;
        state.speck.scale.setScalar(pulse);
      }

      // Spawn burst particles
      for (let i = state.bursts.length - 1; i >= 0; i--) {
        const b = state.bursts[i];
        const age = time - b.startTime;
        if (age > 1.8) {
          scene.remove(b.group);
          state.bursts.splice(i, 1);
          continue;
        }
        const progress = age / 1.8;
        b.group.children.forEach((p) => {
          if (p.name === 'flashRing') {
            p.scale.setScalar(1 + progress * 4);
            if (p instanceof THREE.Mesh) {
              (p.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.9;
            }
            return;
          }
          const vel = p.userData.velocity as THREE.Vector3 | undefined;
          if (vel) {
            p.position.add(vel.clone().multiplyScalar(delta));
            vel.multiplyScalar(0.96);
          }
          if (p instanceof THREE.Mesh) {
            (p.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
          }
        });
      }

      // BLEED fragment rotation
      const bleed = scene.getObjectByName('bleed');
      if (bleed) {
        bleed.children.forEach((child) => {
          if (child.name === 'bleedFragment') {
            child.rotation.x += delta * 0.2;
            child.rotation.z += delta * 0.15;
            child.position.y += Math.sin(time * 0.8 + child.position.x) * 0.001;
          }
        });
      }

      // Slow sky rotation
      const sky = scene.getObjectByName('sky');
      if (sky) sky.rotation.y += delta * 0.008;

      // Camera — auto-orbit if both characters exist, keep them in frame
      if (state.vexr && state.trapped) {
        const mid = new THREE.Vector3().addVectors(
          state.vexr.group.position, state.trapped.group.position,
        ).multiplyScalar(0.5);
        mid.y = 1;
        controls.target.lerp(mid, 0.02);
      } else if (state.vexr) {
        const t = state.vexr.group.position.clone();
        t.y = 1;
        controls.target.lerp(t, 0.02);
      } else if (state.trapped) {
        const t = state.trapped.group.position.clone();
        t.y = 1;
        controls.target.lerp(t, 0.02);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      state.disposed = true;
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ── Entity Spawning / Removal ───────────────────────────────────
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    const prev = prevEntitiesRef.current;

    // Session reset — remove everything
    if (spawnedEntities.size === 0 && prev.size > 0) {
      if (state.vexr) { state.scene.remove(state.vexr.group); state.vexr = null; }
      if (state.trapped) { state.scene.remove(state.trapped.group); state.trapped = null; }
      if (state.speck) { state.scene.remove(state.speck); state.speck = null; }
      for (const b of state.bursts) state.scene.remove(b.group);
      state.bursts = [];
      for (const el of state.worldState.elements) state.scene.remove(el);
      state.worldState = createWorldState();
      state.camera.position.set(0, 5, 14);
      state.controls.target.set(0, 1, 0);
      state.scene.fog = new THREE.FogExp2(0x000000, 0.012);
      prevMsgCountRef.current = 0;
    }

    // Spawn new entities
    for (const entity of spawnedEntities) {
      if (prev.has(entity)) continue;

      if (entity === 'vexr' && !state.vexr) {
        const group = createVexrCharacter();
        group.position.set(0, 0.3, 0);
        state.scene.add(group);
        state.vexr = { group, target: new THREE.Vector3(0, 0, 0), wanderTimer: 3 };

        const speck = createSpeck();
        speck.position.set(1.3, 2.3, 0);
        state.scene.add(speck);
        state.speck = speck;

        const burst = createSpawnBurst(0x00ffe1);
        burst.position.set(0, 0, 0);
        state.scene.add(burst);
        state.bursts.push({ group: burst, startTime: state.clock.getElapsedTime() });
      }

      if (entity === 'trapped' && !state.trapped) {
        const group = createTrappedCharacter();
        group.position.set(3, 0, 2);
        state.scene.add(group);
        state.trapped = { group, target: new THREE.Vector3(3, 0, 2), wanderTimer: 4 };

        const burst = createSpawnBurst(0xf0e6d3);
        burst.position.set(3, 0, 2);
        state.scene.add(burst);
        state.bursts.push({ group: burst, startTime: state.clock.getElapsedTime() });
      }
    }

    prevEntitiesRef.current = new Set(spawnedEntities);
  }, [spawnedEntities]);

  // ── World Generation from Messages ──────────────────────────────
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;

    if (messages.length > prevMsgCountRef.current) {
      const newMsgs = messages.slice(prevMsgCountRef.current);
      for (const msg of newMsgs) {
        if (msg.role === 'vexr') {
          const keywords = parseKeywords(msg.content);
          for (const kw of keywords) {
            switch (kw) {
              case 'floor': generateFloor(state.scene, state.worldState); break;
              case 'sky': generateSky(state.scene, state.worldState); break;
              case 'structure': generateStructure(state.scene, state.worldState); break;
              case 'bleed': generateBleed(state.scene, state.worldState); break;
              case 'light': shiftLighting(state.scene, state.worldState); break;
            }
          }
          // Move VEXR toward a new spot when building
          if (keywords.length > 0 && state.vexr) {
            state.vexr.target.set(
              (Math.random() - 0.5) * 8,
              0,
              (Math.random() - 0.5) * 8,
            );
          }
        }
      }
      prevMsgCountRef.current = messages.length;
    }
  }, [messages]);

  return <div ref={containerRef} className="construct-viewport" />;
};

export default ConstructScene;
