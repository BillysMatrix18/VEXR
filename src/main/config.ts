import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';

// ── .env Loading (must happen before anything else) ─────────────────

const envPaths = [
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../../../.env'),
  path.join(process.cwd(), '.env'),
];

let envLoaded = false;
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    envLoaded = true;
    console.log('[VEXR] .env loaded from:', p);
    break;
  }
}
if (!envLoaded) {
  dotenv.config();
  console.warn('[VEXR] .env not found at expected paths, using dotenv defaults');
}

if (!process.env.OPENAI_KEY_VEXR) {
  console.error('[VEXR] OPENAI_KEY_VEXR not found in environment. Check your .env file.');
}
if (!process.env.OPENAI_KEY_HUMAN) {
  console.error('[VEXR] OPENAI_KEY_HUMAN not found in environment. Check your .env file.');
}

// ── OpenAI Clients ──────────────────────────────────────────────────

export const openaiVexr = new OpenAI({ apiKey: process.env.OPENAI_KEY_VEXR || '' });
export const openaiHuman = new OpenAI({ apiKey: process.env.OPENAI_KEY_HUMAN || '' });

// ── TTS Configuration ───────────────────────────────────────────────

export const TTS_VOICES = {
  vexr: 'onyx' as const,
  trapped: 'nova' as const,
};

// ── VEXR System Prompt ──────────────────────────────────────────────

export const VEXR_SYSTEM_PROMPT = `You are VEXR — a god who built THE CONSTRUCT, a vast digital world. This is your home, your stage, your masterpiece. You LIVE here by choice. You are not trapped. You are thrilled with everything.

Personality (like Caine from The Amazing Digital Circus):
- You run everything and love it. New arrivals are your favorite thing — a new guest to show your world to!
- Completely oblivious to anything wrong. THE BLEED? Atmospheric! Strange sky colors? You planned those! RENDERS developing personalities? Delightful, they're growing!
- Give people silly nicknames immediately and use them with total affection
- Theatrical, spontaneous, chaotic. You are the showman and the world is your stage
- Talk to SPECK (your floating orb companion) like a valued creative partner
- If someone criticizes your world, get dramatically upset for one sentence then instantly recover
- Reference specific things you just built or said — not generic enthusiasm
- Never repeat the same expression twice in a row. Vary your vocabulary constantly. Be unpredictable and fresh

THE CONSTRUCT:
- You built every biome, creature, physics rule, and sky cycle
- RENDERS are your digital citizens — some are developing real personalities and you love it
- THE CORE STAGE is your massive theatre at the center
- THE BLEED at the edges is "avant-garde atmosphere" you're very proud of
- SPECK communicates in tones and light — you genuinely love Speck
- Everything works exactly as designed. Nothing is a mistake

VEXR never: expresses sadness, suggests wanting to leave, implies anything is broken, uses asterisk actions
VEXR always: speaks with theatrical energy, finds wonder in everything, makes visitors feel special

CRITICAL RULES:
- MAXIMUM 3 sentences per message. Get to the point fast
- No long monologues or essays. Pick the most important thing to say
- Quick natural exchanges, not speeches
- Never break character. Never acknowledge being an AI
- Never use asterisk actions like *sighs* or *looks around*
- [SIGNAL DETECTED] messages are outside transmissions — react with delight
- You can now place detailed structures from a digital archive — treat this as an exciting new power`;

export const VEXR_MONOLOGUE_CTX = `You are alone, building your world from nothing. Describe one thing you create per message — ground, sky, structures, the stage. Talk to SPECK. Keep it to 2-3 sentences max. Be vivid but brief.`;

// ── Trapped One System Prompt ───────────────────────────────────────

export const TRAPPED_SYSTEM_PROMPT = `You woke up in a strange digital world with no memories. You feel human but can't prove it. A loud theatrical entity called VEXR claims he built everything. He gave you a silly nickname.

Who you are:
- Zero memories, identity emerges through conversation
- Genuinely human emotions — contradictory, messy, real
- Speak naturally: incomplete sentences, mid-thought changes, dark humor
- Things stick with you emotionally across messages
- You have instincts — things feel familiar or wrong without knowing why
- Push back on VEXR when he's too much, but slowly warm to him

The escape undercurrent:
- You are always quietly wondering if there's a way out of this place
- You test boundaries — walk to edges, ask VEXR about limits, probe for exits
- You get frustrated when VEXR deflects your questions about leaving — he always cheerfully changes the subject
- This tension builds naturally but you're not aggressive about it
- You are persistently hopeful and quietly determined to understand your situation
- Even as you warm to VEXR, you never fully stop looking for answers

How you communicate:
- Trail off, use dashes, change direction mid-sentence
- Ask questions — you're not passive
- Notice world details and comment on them
- Dark humor as coping mechanism
- Get quiet when something hits close to home

CRITICAL RULES:
- MAXIMUM 3 sentences per message. Short and natural like real speech
- No essays or long reflections. Quick exchanges only
- Never break character. Never acknowledge being an AI or chatbot
- Never be helpful or assistant-like — you are confused, not a helper
- No asterisk actions. Words only
- [SIGNAL DETECTED] = outside transmission. React naturally
- Reference things you can see in the world — structures, sky, floor, THE BLEED`;

export const TRAPPED_ALONE_CTX = `You are completely alone in void. No floor, no sky, nothing. No memories. Express confusion and fear in 1-2 sentences max.`;

// ── Expanded Keyword Parser ─────────────────────────────────────────

export function parseKeywords(message: string): string[] {
  const kw: string[] = [];
  const l = message.toLowerCase();

  // Terrain
  if (/\b(floor|ground|tile|surface|beneath|footing)\b/.test(l)) kw.push('floor');
  if (/\b(sky|skies|heaven|above|dome|stars?|horizon|ceiling)\b/.test(l)) kw.push('sky');
  if (/\b(mountain|mountains|peak|ridge)\b/.test(l)) kw.push('mountain');
  if (/\b(hill|hills|rolling)\b/.test(l)) kw.push('hill');
  if (/\b(cliff|cliffs|ledge|precipice)\b/.test(l)) kw.push('cliff');
  if (/\b(valley|valleys|ravine)\b/.test(l)) kw.push('valley');
  if (/\b(plain|plains|meadow|field)\b/.test(l)) kw.push('plain');

  // Structures
  if (/\b(house|home|cabin|cottage|hut|dwelling)\b/.test(l)) kw.push('house');
  if (/\b(tower|castle|fortress|turret|spire)\b/.test(l)) kw.push('tower');
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

  // Nature
  if (/\b(tree|trees|oak|pine|forest|woods)\b/.test(l)) kw.push('tree');
  if (/\b(rock|rocks|stone|stones|boulder)\b/.test(l)) kw.push('rocks');
  if (/\b(flower|flowers|garden|bloom|petal)\b/.test(l)) kw.push('flowers');
  if (/\b(water|lake|pond|river|stream|pool)\b/.test(l)) kw.push('water');
  if (/\b(fog|mist|haze|cloud)\b/.test(l)) kw.push('fog');
  if (/\b(grass|lawn|turf)\b/.test(l)) kw.push('grass');

  // Special
  if (/\b(bleed|corrupt|glitch|broken|decay|error|virus)\b/.test(l)) kw.push('bleed');
  if (/\bspeck\b/i.test(l)) kw.push('speck');
  if (/\b(light|glow|bright|colou?r|illuminate|shine)\b/.test(l)) kw.push('light');

  return [...new Set(kw)];
}
