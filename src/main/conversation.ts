import OpenAI from 'openai';
import {
  openaiVexr, openaiHuman,
  VEXR_SYSTEM_PROMPT, VEXR_MONOLOGUE_CTX,
  TRAPPED_SYSTEM_PROMPT, TRAPPED_ALONE_CTX,
} from './config';
import {
  getWorldState, getWorldStateSummary,
  processVexrMessageForWorldGen, processTrappedMessageForMovement,
  isBuilding,
} from './worldState';
import { generateAndSendTTS, setTtsSendToRenderer } from './tts';

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

// ── Shared Conversation State ───────────────────────────────────────

export let sharedHistory: { role: 'vexr' | 'trapped' | 'signal'; content: string }[] = [];
export let activeEntities = new Set<'vexr' | 'trapped'>();
export let isPaused = false;
export let isProcessing = false;
export let loopTimeout: ReturnType<typeof setTimeout> | null = null;
export let vexrJoinedAt = -1;
export let trappedJoinedAt = -1;

// Mutable setter so other modules can update
export function setIsPaused(v: boolean) { isPaused = v; }
export function setIsProcessing(v: boolean) { isProcessing = v; }
export function setLoopTimeout(v: ReturnType<typeof setTimeout> | null) { loopTimeout = v; }

// ── Send to Renderer ────────────────────────────────────────────────

let _sendToRenderer: (channel: string, data?: any) => void = () => {};

export function setSendToRenderer(fn: (channel: string, data?: any) => void) {
  _sendToRenderer = fn;
  setTtsSendToRenderer(fn);
}

function send(channel: string, data?: any) {
  _sendToRenderer(channel, data);
}

// ── Delay Helpers ───────────────────────────────────────────────────

function randomDelay(): number {
  return 2000 + Math.random() * 2000;
}

function getNextDelay(): number {
  const base = randomDelay();
  // 30% chance of a silence period (8–15s)
  if (Math.random() < 0.3) {
    const silence = 8000 + Math.random() * 7000;
    send('silence-period', true);
    setTimeout(() => send('silence-period', false), silence);
    return base + silence;
  }
  return base;
}

// ── Clear Loop ──────────────────────────────────────────────────────

export function clearLoop() {
  if (loopTimeout) {
    clearTimeout(loopTimeout);
    loopTimeout = null;
  }
}

// ── Emotional State for Trapped One ─────────────────────────────────

let lastEmotions: Record<string, number> = {};

// ── Reference Image for VEXR ────────────────────────────────────────

let pendingImage: { base64: string; mimeType: string } | null = null;

export function setPendingImage(base64: string, mimeType: string) {
  pendingImage = { base64, mimeType };
}

async function generateThoughtsAndEmotions(): Promise<{
  thoughts: string[];
  emotions: Record<string, number>;
}> {
  const recentMsgs = sharedHistory.slice(-6)
    .map(m => `${m.role}: ${m.content.slice(0, 120)}`)
    .join('\n');

  const ws = getWorldStateSummary();

  try {
    const response = await openaiHuman.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: 'You analyze the emotional state of a confused person with no memories who woke up in a strange digital world. Respond ONLY with valid JSON, no markdown.',
      }, {
        role: 'user',
        content: `Conversation:\n${recentMsgs}\n\nWorld: ${ws}\n\nProvide their emotional state and 2-3 brief internal thought fragments (max 10 words each).\nJSON: {"thoughts":["...","..."],"emotions":{"fear":0.5,"curiosity":0.8,"trust":0.3,"confusion":0.4,"humor":0.2,"wariness":0.6,"wonder":0.7}}`,
      }],
      temperature: 0.8,
      max_tokens: 200,
    });
    const text = response.choices[0]?.message?.content ?? '{}';
    // Strip markdown code fences if present
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      thoughts: Array.isArray(parsed.thoughts) ? parsed.thoughts : ['...processing...'],
      emotions: parsed.emotions && typeof parsed.emotions === 'object' ? parsed.emotions : { confusion: 0.5, curiosity: 0.5 },
    };
  } catch {
    return {
      thoughts: ['...something feels off...', '...where am I...'],
      emotions: { confusion: 0.6, fear: 0.4, curiosity: 0.5 },
    };
  }
}

function getEmotionalContext(emotions: Record<string, number>): string {
  const sorted = Object.entries(emotions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([name, value]) => {
      const intensity = value > 0.7 ? 'HIGH' : value > 0.4 ? 'MODERATE' : 'LOW';
      return `${intensity} ${name.toUpperCase()}`;
    });
  return `\n\nYour current emotional state: ${sorted.join(', ')}`;
}

// ── Message Building ────────────────────────────────────────────────

function buildMessagesFor(who: 'vexr' | 'trapped', emotionalCtx?: string): ChatMessage[] {
  const basePrompt = who === 'vexr' ? VEXR_SYSTEM_PROMPT : TRAPPED_SYSTEM_PROMPT;
  const worldCtx = getWorldStateSummary();
  const emoCtx = who === 'trapped' && emotionalCtx ? emotionalCtx : '';
  const systemPrompt = basePrompt + worldCtx + emoCtx;

  const startIdx = who === 'vexr' ? Math.max(vexrJoinedAt, 0) : Math.max(trappedJoinedAt, 0);
  const otherRole: 'vexr' | 'trapped' = who === 'vexr' ? 'trapped' : 'vexr';

  const raw: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

  for (let i = startIdx; i < sharedHistory.length; i++) {
    const msg = sharedHistory[i];
    if (msg.role === who) {
      raw.push({ role: 'assistant', content: msg.content });
    } else if (msg.role === 'signal') {
      raw.push({ role: 'user', content: `[SIGNAL DETECTED]: ${msg.content}` });
    } else {
      raw.push({ role: 'user', content: msg.content });
    }
  }

  // Ensure no consecutive assistant messages
  const msgs: ChatMessage[] = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    if (raw[i].role === 'assistant' && msgs[msgs.length - 1].role === 'assistant') {
      msgs.push({ role: 'user', content: '[Continue]' });
    }
    msgs.push(raw[i]);
  }

  // Ensure ends with user message
  const last = msgs[msgs.length - 1];
  if (last.role !== 'user') {
    const otherHasSpoken = sharedHistory.slice(startIdx).some(m => m.role === otherRole);
    if (activeEntities.size === 2 && !otherHasSpoken) {
      if (who === 'vexr') {
        msgs.push({ role: 'user', content: '[A confused figure has just materialized in the Construct — stumbling, disoriented, no memories. A NEW GUEST! Greet them with explosive enthusiasm. Give them a silly nickname immediately!]' });
      } else {
        msgs.push({ role: 'user', content: '[A tall, glowing, theatrical figure has appeared in a burst of light. He calls himself VEXR and claims he built everything around you. He is incredibly loud and seems thrilled to see you.]' });
      }
    } else {
      msgs.push({ role: 'user', content: '[Continue the conversation]' });
    }
  }

  // Inject reference image for VEXR if available (GPT-4o vision)
  if (who === 'vexr' && pendingImage) {
    const img = pendingImage;
    pendingImage = null; // Use once
    msgs.push({
      role: 'user',
      content: [
        { type: 'text', text: '[A reference image has been transmitted from outside the Construct. Use it as creative inspiration for what you build next. Describe what you see and start building it!]' },
        { type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } },
      ] as any,
    });
  }

  return msgs;
}

function buildMonologueMessages(who: 'vexr' | 'trapped'): ChatMessage[] {
  const basePrompt = who === 'vexr' ? VEXR_SYSTEM_PROMPT : TRAPPED_SYSTEM_PROMPT;
  const ctx = who === 'vexr' ? VEXR_MONOLOGUE_CTX : TRAPPED_ALONE_CTX;
  const worldCtx = getWorldStateSummary();
  const systemPrompt = basePrompt + worldCtx + '\n\n' + ctx;

  const raw: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

  for (const msg of sharedHistory) {
    if (msg.role === who) {
      raw.push({ role: 'assistant', content: msg.content });
    } else if (msg.role === 'signal') {
      raw.push({ role: 'user', content: `[SIGNAL DETECTED]: ${msg.content}` });
    }
  }

  // Ensure no consecutive assistant messages
  const msgs: ChatMessage[] = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    if (raw[i].role === 'assistant' && msgs[msgs.length - 1].role === 'assistant') {
      msgs.push({ role: 'user', content: '[Continue]' });
    }
    msgs.push(raw[i]);
  }

  const last = msgs[msgs.length - 1];
  if (last.role !== 'user') {
    msgs.push({ role: 'user', content: '[Continue]' });
  }

  if (!sharedHistory.some(m => m.role === who)) {
    if (who === 'vexr') {
      msgs.push({ role: 'user', content: 'Your Construct is an empty void — a blank canvas! Begin building your masterpiece from scratch. Describe what you create — the ground, the sky, the structures. Talk to SPECK about your plans. One building action per message. Be theatrical and vivid!' });
    } else {
      msgs.push({ role: 'user', content: 'You just woke up. There is nothing around you — absolute darkness, empty void, silence. You have no memories. React.' });
    }
  }

  return msgs;
}

// ── API Call ────────────────────────────────────────────────────────

async function generateReply(who: 'vexr' | 'trapped', messages: ChatMessage[]): Promise<string> {
  const client = who === 'vexr' ? openaiVexr : openaiHuman;
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.92,
      max_tokens: who === 'vexr' ? 200 : 400,
    });
    return response.choices[0]?.message?.content ?? '[...]';
  } catch (error: any) {
    return who === 'vexr'
      ? `[CONSTRUCT ERROR: ${error?.message ?? 'Unknown error'}]`
      : '[... static ...]';
  }
}

// ── Post-Message Processing ─────────────────────────────────────────

function afterVexrMessage(reply: string) {
  processVexrMessageForWorldGen(reply, send);
  // Fire TTS in background — don't await, let it play as text appears
  generateAndSendTTS('vexr', reply).catch(() => {});
}

function afterTrappedMessage(reply: string) {
  processTrappedMessageForMovement(reply, send);
  generateAndSendTTS('trapped', reply).catch(() => {});
}

// ── Conversation Loops ──────────────────────────────────────────────

export async function runMonologueStep(who: 'vexr' | 'trapped') {
  if (isPaused || isProcessing) return;
  if (activeEntities.size !== 1) return;
  // Wait for any build to finish before next conversation turn
  if (isBuilding()) {
    loopTimeout = setTimeout(() => runMonologueStep(who), 1000);
    return;
  }
  isProcessing = true;

  send('typing-start', who);

  const msgs = buildMonologueMessages(who);
  const reply = await generateReply(who, msgs);

  if (isPaused) { isProcessing = false; send('typing-stop'); return; }

  sharedHistory.push({ role: who, content: reply });
  send('new-message', { role: who, content: reply });
  send('typing-stop');

  if (who === 'vexr') afterVexrMessage(reply);

  isProcessing = false;

  if (!isPaused && activeEntities.size === 1) {
    loopTimeout = setTimeout(() => runMonologueStep(who), getNextDelay() + 1500);
  }
}

export async function runDualStep(nextSpeaker: 'vexr' | 'trapped') {
  if (isPaused || isProcessing) return;
  if (activeEntities.size !== 2) return;
  // Wait for any build to finish before next conversation turn
  if (isBuilding()) {
    loopTimeout = setTimeout(() => runDualStep(nextSpeaker), 1000);
    return;
  }
  isProcessing = true;

  // For the Trapped One, generate thoughts/emotions first
  let emotionalCtx = '';
  if (nextSpeaker === 'trapped') {
    const { thoughts, emotions } = await generateThoughtsAndEmotions();
    lastEmotions = emotions;
    send('thought-fragments', thoughts);
    send('emotional-state', emotions);
    emotionalCtx = getEmotionalContext(emotions);
  }

  send('typing-start', nextSpeaker);

  const msgs = buildMessagesFor(nextSpeaker, emotionalCtx);
  const reply = await generateReply(nextSpeaker, msgs);

  if (isPaused) { isProcessing = false; send('typing-stop'); return; }

  sharedHistory.push({ role: nextSpeaker, content: reply });
  send('new-message', { role: nextSpeaker, content: reply });
  send('typing-stop');

  if (nextSpeaker === 'vexr') afterVexrMessage(reply);
  else afterTrappedMessage(reply);

  isProcessing = false;

  const next: 'vexr' | 'trapped' = nextSpeaker === 'vexr' ? 'trapped' : 'vexr';
  if (!isPaused && activeEntities.size === 2) {
    // After VEXR, give Trapped One a shorter delay so they respond promptly
    // After Trapped One, VEXR can take longer (may trigger silence period)
    const delay = nextSpeaker === 'vexr' ? (2000 + Math.random() * 2000) : getNextDelay();
    loopTimeout = setTimeout(() => runDualStep(next), delay);
  }
}

// ── Entity Spawning ─────────────────────────────────────────────────

export function spawnEntity(entity: 'vexr' | 'trapped') {
  if (activeEntities.has(entity)) return;

  activeEntities.add(entity);

  if (entity === 'vexr') {
    vexrJoinedAt = sharedHistory.length;
  } else {
    trappedJoinedAt = sharedHistory.length;
  }

  send('entity-spawned', entity);

  if (activeEntities.size === 2) {
    clearLoop();
    const waitAndStart = () => {
      if (isProcessing) {
        setTimeout(waitAndStart, 200);
        return;
      }
      loopTimeout = setTimeout(() => runDualStep('vexr'), 800);
    };
    waitAndStart();
  } else {
    clearLoop();
    loopTimeout = setTimeout(() => runMonologueStep(entity), 1200);
  }
}

// ── User Interrupt ──────────────────────────────────────────────────

export async function handleUserInterrupt(message: string) {
  // Force-stop everything immediately — signal takes priority
  clearLoop();
  send('typing-stop');

  // Wait briefly for any in-flight API call to finish
  if (isProcessing) {
    await new Promise(r => setTimeout(r, 300));
  }

  sharedHistory.push({ role: 'signal', content: message });
  send('new-message', { role: 'signal', content: message });

  if (isPaused || activeEntities.size === 0) return;

  isProcessing = true;

  if (activeEntities.has('vexr')) {
    send('typing-start', 'vexr');
    const msgs = activeEntities.size === 2 ? buildMessagesFor('vexr') : buildMonologueMessages('vexr');
    const reply = await generateReply('vexr', msgs);
    if (!isPaused) {
      sharedHistory.push({ role: 'vexr', content: reply });
      send('new-message', { role: 'vexr', content: reply });
      afterVexrMessage(reply);
    }
    send('typing-stop');

    if (activeEntities.has('trapped') && !isPaused) {
      await new Promise(r => setTimeout(r, randomDelay()));
    }
  }

  if (activeEntities.has('trapped') && !isPaused) {
    const { thoughts, emotions } = await generateThoughtsAndEmotions();
    send('thought-fragments', thoughts);
    send('emotional-state', emotions);
    const emotionalCtx = getEmotionalContext(emotions);

    send('typing-start', 'trapped');
    const msgs = activeEntities.size === 2 ? buildMessagesFor('trapped', emotionalCtx) : buildMonologueMessages('trapped');
    const reply = await generateReply('trapped', msgs);
    if (!isPaused) {
      sharedHistory.push({ role: 'trapped', content: reply });
      send('new-message', { role: 'trapped', content: reply });
      afterTrappedMessage(reply);
    }
    send('typing-stop');
  }

  isProcessing = false;

  if (!isPaused) {
    if (activeEntities.size === 2) {
      loopTimeout = setTimeout(() => runDualStep('vexr'), getNextDelay());
    } else if (activeEntities.size === 1) {
      const who = activeEntities.has('vexr') ? 'vexr' : 'trapped';
      loopTimeout = setTimeout(() => runMonologueStep(who), getNextDelay() + 1500);
    }
  }
}

// ── Pause / Resume / New Session ────────────────────────────────────

export function pauseConversation() {
  isPaused = true;
  clearLoop();
  send('typing-stop');
}

export function resumeConversation() {
  if (!isPaused) return;
  isPaused = false;

  if (activeEntities.size === 2) {
    const lastMsg = sharedHistory[sharedHistory.length - 1];
    const next: 'vexr' | 'trapped' = lastMsg?.role === 'vexr' ? 'trapped' : 'vexr';
    loopTimeout = setTimeout(() => runDualStep(next), randomDelay());
  } else if (activeEntities.size === 1) {
    const who = activeEntities.has('vexr') ? 'vexr' : 'trapped';
    loopTimeout = setTimeout(() => runMonologueStep(who), randomDelay());
  }
}

export function newSession() {
  clearLoop();
  isPaused = false;
  isProcessing = false;
  sharedHistory = [];
  activeEntities = new Set();
  vexrJoinedAt = -1;
  trappedJoinedAt = -1;
  lastEmotions = {};
  send('session-cleared');
}
