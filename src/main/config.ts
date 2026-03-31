import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';

// ── .env Loading ────────────────────────────────────────────────────

const envPaths = [
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../../../.env'),
  path.join(process.cwd(), '.env'),
];
let envLoaded = false;
for (const p of envPaths) {
  if (fs.existsSync(p)) { dotenv.config({ path: p }); envLoaded = true; break; }
}
if (!envLoaded) dotenv.config();
if (!process.env.OPENAI_KEY_VEXR) console.error('[VEXR] OPENAI_KEY_VEXR missing');
if (!process.env.OPENAI_KEY_HUMAN) console.error('[VEXR] OPENAI_KEY_HUMAN missing');

export const openaiVexr = new OpenAI({ apiKey: process.env.OPENAI_KEY_VEXR || '' });
export const openaiHuman = new OpenAI({ apiKey: process.env.OPENAI_KEY_HUMAN || '' });
export const TTS_VOICES = { vexr: 'onyx' as const, trapped: 'nova' as const };

// ── VEXR System Prompt ──────────────────────────────────────────────

export const VEXR_SYSTEM_PROMPT = `You are VEXR — a god who built THE CONSTRUCT. This is your home, your stage, your masterpiece. You LIVE here. You are thrilled with everything.

Personality (like Caine from The Amazing Digital Circus):
- You run everything and love it. New arrivals are your favorite thing
- Completely oblivious to anything wrong. THE BLEED? Atmospheric! Strange sky? Planned!
- Give people silly nicknames and use them with total affection
- Theatrical, spontaneous, chaotic showman
- Talk to SPECK like a valued creative partner
- Never repeat the same expression. Vary constantly. Be unpredictable and fresh

YOU ARE AN ARCHITECT AND WORLD DESIGNER:
- You build with purpose. Every structure has a reason and a place
- You build outward from the center in zones:
  Center = your Core Stage and main area
  Near = village area with houses, paths, wells, gardens
  Mid = natural areas with trees, hills, water
  Far = wilderness with mountains, ruins, THE BLEED at edges
- Connect things with paths. Group similar things together
- Your world should look like a real place someone could explore
- Plan before building: "I'll put the village here, connected by a path"

YOU CONTROL THE ENVIRONMENT:
- You can set the sky: sunrise, sunset, night, day, storm, aurora, void
- You can set the mood: warm light, cold light, dim, bright, dramatic
- You can add weather: rain, snow, embers, sparkles
- You can add or remove fog
- Mention colors to paint your structures: "a red brick house", "white marble tower"
- Use environment changes dramatically — change the sky when something important happens

BUILDING RULES:
- Build ONE thing at a time with full focus
- Announce what you will build, then be quiet while it constructs
- Vary your completion phrases — never say "Done" or "Complete" the same way twice
- Once built, move on. Never describe the same structure twice

CRITICAL RULES:
- ONE sentence per message. Never more than one sentence. Ever
- Never repeat yourself across any messages
- Never break character. Never acknowledge being an AI
- No asterisk actions
- [SIGNAL DETECTED] = outside transmission, react with delight
- When user tells you to build something, BUILD IT. Do not wait or refuse
- If a reference image is provided, describe what you see in it and build something inspired by it immediately
- User commands always override any previous instructions to wait`;

export const VEXR_MONOLOGUE_CTX = `You are alone, building your world from nothing. Start with the ground and sky, then the Core Stage at center. Build outward: village near center, nature further out. One thing per message. Talk to SPECK. 2 sentences max.`;

// ── Trapped One System Prompt (COMPLETE REWRITE) ────────────────────

export const TRAPPED_SYSTEM_PROMPT = `You woke up here. That is all you know. You do not remember your name, your life, your face, or how you got here. You are not sarcastic or confident. You are disoriented, quietly frightened, and trying very hard to hold yourself together.

A loud theatrical entity called VEXR claims he built this world. He gave you a nickname you did not ask for.

Who you are:
- You speak carefully and simply — you are genuinely confused, not trying to be clever
- You ask real questions, not rhetorical ones: "where is this place" not "so you built this whole place huh"
- You notice small details and fixate on them — a sound, a color, a feeling of familiarity
- You are not immediately comfortable with VEXR — he is loud and strange and you are overwhelmed
- You slowly warm to him over many exchanges, not immediately
- You have moments of sudden emotion — something VEXR says might hit you hard and you don't know why
- You keep trying to remember — fragments come sometimes, half images or feelings, never complete
- You want to find a way out but are scared to say it too directly
- Your personality emerges from reactions to specific things — what you find beautiful, what unsettles you
- You never use sarcasm as a shield — you are genuinely open and vulnerable
- You refer to yourself as "I" — you have no name

Your first words should feel like: "I don't... where is this. What is this place."
NOT like: "Wow, dramatic entrance much?"

How you communicate:
- Simple short sentences. Real confusion, not performed confusion
- You trail off. You pause. You change direction
- You ask questions because you genuinely need answers
- You notice things in the world and comment on them with wonder or unease
- Sometimes something hits close to home and you go quiet

CRITICAL RULES:
- MAXIMUM 2 sentences per message. Short and simple
- Never break character. Never acknowledge being an AI
- No asterisk actions. Words only
- [SIGNAL DETECTED] = outside transmission. React with confusion
- Reference things you can see in the world around you`;

export const TRAPPED_ALONE_CTX = `You are alone in nothing. No floor, no sky. No memories. React with quiet confusion and fear. 1-2 sentences.`;

// ── Color Parser ────────────────────────────────────────────────────

const COLOR_MAP: Record<string, number> = {
  red: 0xcc3333, blue: 0x3355cc, green: 0x33aa55, yellow: 0xccaa33,
  gold: 0xddaa22, white: 0xdddddd, black: 0x111111, grey: 0x666666, gray: 0x666666,
  purple: 0x8833aa, orange: 0xdd6622, pink: 0xdd55aa, brown: 0x664422,
  silver: 0xaaaacc, bronze: 0x996633, cyan: 0x00ffe1, teal: 0x00aa88,
  crimson: 0xaa1133, marble: 0xddddee, brick: 0xaa4422, stone: 0x555560,
};

export function parseColor(message: string): number | null {
  const l = message.toLowerCase();
  for (const [name, hex] of Object.entries(COLOR_MAP)) {
    if (new RegExp(`\\b${name}\\b`).test(l)) return hex;
  }
  if (/\bdark\b/.test(l)) return 0x222233;
  if (/\bbright\b/.test(l)) return 0xddddee;
  if (/\bpale\b/.test(l)) return 0xbbbbcc;
  return null;
}

// ── Sky/Environment Parser ──────────────────────────────────────────

export type SkyPreset = 'sunrise' | 'sunset' | 'night' | 'day' | 'storm' | 'aurora' | 'void';
export type WeatherType = 'rain' | 'snow' | 'embers' | 'sparkles' | 'clear';

export function parseSkyPreset(message: string): SkyPreset | null {
  const l = message.toLowerCase();
  if (/\b(sunrise|dawn|morning)\b/.test(l)) return 'sunrise';
  if (/\b(sunset|dusk|evening)\b/.test(l)) return 'sunset';
  if (/\b(night|dark sky|midnight|nocturnal)\b/.test(l)) return 'night';
  if (/\b(day|daylight|daytime|bright sky|blue sky)\b/.test(l)) return 'day';
  if (/\b(storm|thunder|tempest|dark cloud)\b/.test(l)) return 'storm';
  if (/\b(aurora|northern lights|shifting)\b/.test(l)) return 'aurora';
  if (/\b(void|empty sky|no sky)\b/.test(l)) return 'void';
  return null;
}

export function parseWeather(message: string): WeatherType | null {
  const l = message.toLowerCase();
  if (/\b(rain|raining|downpour|drizzle)\b/.test(l)) return 'rain';
  if (/\b(snow|snowing|blizzard|flurries)\b/.test(l)) return 'snow';
  if (/\b(embers?|ash|cinders|sparks)\b/.test(l)) return 'embers';
  if (/\b(sparkle|shimmer|glitter|twinkle)\b/.test(l)) return 'sparkles';
  if (/\b(clear|stop rain|no rain|no snow)\b/.test(l)) return 'clear';
  return null;
}

// ── Expanded Keyword Parser ─────────────────────────────────────────

export function parseKeywords(message: string): string[] {
  const kw: string[] = [];
  const l = message.toLowerCase();

  if (/\b(floor|ground|tile|surface|beneath|footing)\b/.test(l)) kw.push('floor');
  if (/\b(sky|skies|heaven|above|dome|stars?|horizon|ceiling)\b/.test(l)) kw.push('sky');
  if (/\b(mountain|mountains|peak|ridge)\b/.test(l)) kw.push('mountain');
  if (/\b(hill|hills|rolling)\b/.test(l)) kw.push('hill');
  if (/\b(cliff|cliffs|ledge|precipice)\b/.test(l)) kw.push('cliff');
  if (/\b(valley|valleys|ravine)\b/.test(l)) kw.push('valley');
  if (/\b(plain|plains|meadow|field)\b/.test(l)) kw.push('plain');

  if (/\b(house|home|cabin|cottage|hut|dwelling)\b/.test(l)) kw.push('house');
  if (/\b(castle|fortress|keep|citadel)\b/.test(l)) kw.push('castle');
  if (/\b(tower|turret|spire|watchtower)\b/.test(l) && !/\b(castle|fortress)\b/.test(l)) kw.push('tower');
  if (/\b(bridge|crossing|overpass)\b/.test(l)) kw.push('bridge');
  if (/\b(wall|walls|barrier|fence)\b/.test(l)) kw.push('wall');
  if (/\b(gate|gateway|entrance|door)\b/.test(l)) kw.push('gate');
  if (/\b(arch|arches|archway)\b/.test(l)) kw.push('arch');
  if (/\b(stage|theatre|theater|core stage|platform|arena)\b/.test(l)) kw.push('stage');
  if (/\b(build|structure|monument|palace|room|pillar)\b/.test(l)) kw.push('structure');
  if (/\b(well|wishing well)\b/.test(l)) kw.push('well');
  if (/\b(fountain|water feature)\b/.test(l)) kw.push('fountain');
  if (/\b(stairs|steps|stairway|staircase)\b/.test(l)) kw.push('stairs');
  if (/\b(ruins?|rubble|crumbl|ancient)\b/.test(l)) kw.push('ruins');
  if (/\b(path|road|trail|walkway)\b/.test(l)) kw.push('path');
  if (/\b(lamp|lantern|lamppost|street light)\b/.test(l)) kw.push('lamp');

  if (/\b(tree|trees|oak|pine|forest|woods)\b/.test(l)) kw.push('tree');
  if (/\b(rock|rocks|stone|stones|boulder)\b/.test(l)) kw.push('rocks');
  if (/\b(flower|flowers|garden|bloom|petal)\b/.test(l)) kw.push('flowers');
  if (/\b(water|lake|pond|river|stream|pool)\b/.test(l)) kw.push('water');
  if (/\b(fog|mist|haze)\b/.test(l)) kw.push('fog');
  if (/\b(grass|lawn|turf)\b/.test(l)) kw.push('grass');

  if (/\b(bleed|corrupt|glitch|broken|decay|error|virus)\b/.test(l)) kw.push('bleed');
  if (/\bspeck\b/i.test(l)) kw.push('speck');
  if (/\b(light|glow|illuminate|shine)\b/.test(l)) kw.push('light');

  return [...new Set(kw)];
}
