import * as THREE from 'three';

// ── Day/Night Cycle ─────────────────────────────────────────────────
// Full cycle: 10 real minutes = 600 seconds

const CYCLE_DURATION = 600; // seconds for full day

interface TimeOfDay {
  name: string;
  skyColor: THREE.Color;
  sunIntensity: number;
  sunColor: THREE.Color;
  sunAngle: number; // radians around the sky arc
  ambientIntensity: number;
  starOpacity: number;
  fogDensity: number;
}

const PHASES: TimeOfDay[] = [
  { name: 'pre-dawn',  skyColor: new THREE.Color(0x00251a), sunIntensity: 0.1, sunColor: new THREE.Color(0x445566), sunAngle: -0.3, ambientIntensity: 0.08, starOpacity: 0.3, fogDensity: 0.01 },
  { name: 'dawn',      skyColor: new THREE.Color(0xff9966), sunIntensity: 0.6, sunColor: new THREE.Color(0xffaa66), sunAngle: 0.1,  ambientIntensity: 0.15, starOpacity: 0.05, fogDensity: 0.008 },
  { name: 'morning',   skyColor: new THREE.Color(0x87ceeb), sunIntensity: 1.2, sunColor: new THREE.Color(0xffeedd), sunAngle: 0.6,  ambientIntensity: 0.3,  starOpacity: 0.0, fogDensity: 0.006 },
  { name: 'noon',      skyColor: new THREE.Color(0x4fc3f7), sunIntensity: 2.0, sunColor: new THREE.Color(0xffffff), sunAngle: 1.2,  ambientIntensity: 0.4,  starOpacity: 0.0, fogDensity: 0.005 },
  { name: 'afternoon', skyColor: new THREE.Color(0x81d4fa), sunIntensity: 1.5, sunColor: new THREE.Color(0xffd54f), sunAngle: 1.8,  ambientIntensity: 0.35, starOpacity: 0.0, fogDensity: 0.006 },
  { name: 'sunset',    skyColor: new THREE.Color(0xff6b35), sunIntensity: 0.8, sunColor: new THREE.Color(0xff6622), sunAngle: 2.5,  ambientIntensity: 0.15, starOpacity: 0.1, fogDensity: 0.008 },
  { name: 'dusk',      skyColor: new THREE.Color(0x6a1b9a), sunIntensity: 0.3, sunColor: new THREE.Color(0x443366), sunAngle: 2.9,  ambientIntensity: 0.1,  starOpacity: 0.25, fogDensity: 0.01 },
  { name: 'night',     skyColor: new THREE.Color(0x0a0a1a), sunIntensity: 0.05,sunColor: new THREE.Color(0x223344), sunAngle: 3.5,  ambientIntensity: 0.06, starOpacity: 0.5, fogDensity: 0.012 },
];

export interface DayNightState {
  enabled: boolean;
  startTime: number;
  overridden: boolean; // true if user manually set sky — pause cycle until next phase
  currentPhase: string;
}

export function createDayNightState(): DayNightState {
  return { enabled: true, startTime: 0, overridden: false, currentPhase: 'pre-dawn' };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return new THREE.Color(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t));
}

export function updateDayNightCycle(
  scene: THREE.Scene,
  elapsed: number,
  dnState: DayNightState,
): string {
  if (!dnState.enabled || dnState.overridden) return dnState.currentPhase;

  const cycleTime = ((elapsed - dnState.startTime) % CYCLE_DURATION) / CYCLE_DURATION; // 0-1
  const phaseCount = PHASES.length;
  const rawIdx = cycleTime * phaseCount;
  const idx = Math.floor(rawIdx) % phaseCount;
  const nextIdx = (idx + 1) % phaseCount;
  const t = rawIdx - Math.floor(rawIdx); // interpolation factor within phase

  const current = PHASES[idx];
  const next = PHASES[nextIdx];

  // Sky color
  const skyColor = lerpColor(current.skyColor, next.skyColor, t);
  (scene.background as THREE.Color).copy(skyColor);
  if (scene.fog instanceof THREE.FogExp2) {
    scene.fog.color.copy(skyColor);
    scene.fog.density = lerp(current.fogDensity, next.fogDensity, t);
  }

  // Sun light
  const sunLight = scene.getObjectByName('sunLight') as THREE.DirectionalLight | undefined;
  if (sunLight) {
    sunLight.intensity = lerp(current.sunIntensity, next.sunIntensity, t);
    sunLight.color.copy(lerpColor(current.sunColor, next.sunColor, t));
    // Move sun in an arc
    const angle = lerp(current.sunAngle, next.sunAngle, t);
    const sunDist = 30;
    sunLight.position.set(
      Math.cos(angle) * sunDist,
      Math.sin(angle) * sunDist + 5, // keep above horizon minimum
      10,
    );
  }

  // Ambient
  scene.traverse((c) => {
    if (c instanceof THREE.AmbientLight) {
      c.intensity = lerp(current.ambientIntensity, next.ambientIntensity, t);
    }
    if (c instanceof THREE.HemisphereLight) {
      c.intensity = lerp(current.ambientIntensity * 2, next.ambientIntensity * 2, t);
    }
  });

  // Stars
  const stars = scene.getObjectByName('defaultStars') as THREE.Points | undefined;
  if (stars) {
    (stars.material as THREE.PointsMaterial).opacity = lerp(current.starOpacity, next.starOpacity, t);
  }

  dnState.currentPhase = current.name;
  return current.name;
}

export function overrideDayNight(dnState: DayNightState) {
  dnState.overridden = true;
}

export function resumeDayNight(dnState: DayNightState, currentTime: number) {
  dnState.overridden = false;
  dnState.startTime = currentTime;
}
