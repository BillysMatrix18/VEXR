import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// ── Memory Data Structure ───────────────────────────────────────────

interface ShockEvent {
  action: string;
  count: number;
  timestamp: number;
}

interface GoodEvent {
  action: string;
  count: number;
  timestamp: number;
}

interface VexrMemory {
  sessionCount: number;
  thingsBuilt: string[];
  trappedReactions: string[];
  nicknames: string[];
  lastSessionSummary: string;
  shocks: ShockEvent[];
  goods: GoodEvent[];
  recentActions: string[]; // last 3 things VEXR said/did
  userSignals: string[];   // last 10 user messages
  sessionDurations: number[];
}

const MEMORY_FILE = 'vexr_memory.json';

function getMemoryPath(): string {
  try {
    return path.join(app.getPath('userData'), MEMORY_FILE);
  } catch {
    return path.join(process.cwd(), MEMORY_FILE);
  }
}

function freshMemory(): VexrMemory {
  return {
    sessionCount: 0, thingsBuilt: [], trappedReactions: [],
    nicknames: [], lastSessionSummary: '',
    shocks: [], goods: [], recentActions: [], userSignals: [],
    sessionDurations: [],
  };
}

function loadMemory(): VexrMemory {
  try {
    const data = fs.readFileSync(getMemoryPath(), 'utf-8');
    const parsed = JSON.parse(data);
    return { ...freshMemory(), ...parsed };
  } catch {
    return freshMemory();
  }
}

function saveMemory(memory: VexrMemory): void {
  try {
    fs.writeFileSync(getMemoryPath(), JSON.stringify(memory, null, 2));
  } catch (e: any) {
    console.error('[VEXR Memory] Save failed:', e.message);
  }
}

let currentMemory = loadMemory();
let sessionStartTime = Date.now();

// ── Memory Summary (injected into VEXR's system prompt) ─────────────

export function getMemorySummary(): string {
  const parts: string[] = [];

  if (currentMemory.sessionCount > 0) {
    parts.push(`This is session #${currentMemory.sessionCount + 1}`);
  }

  // Things built before
  if (currentMemory.thingsBuilt.length > 0) {
    const unique = [...new Set(currentMemory.thingsBuilt)].slice(-8);
    parts.push(`Previously built: ${unique.join(', ')}`);
  }

  // SHOCK — things NOT to do (negative reinforcement)
  if (currentMemory.shocks.length > 0) {
    const hardRules = currentMemory.shocks.filter(s => s.count >= 3);
    const softRules = currentMemory.shocks.filter(s => s.count < 3);

    if (hardRules.length > 0) {
      parts.push(`NEVER DO THESE (you were corrected multiple times): ${hardRules.map(s => s.action).join('; ')}`);
    }
    if (softRules.length > 0) {
      parts.push(`Avoid these (corrected before): ${softRules.map(s => s.action).join('; ')}`);
    }
  }

  // GOOD — things to do MORE of (positive reinforcement)
  if (currentMemory.goods.length > 0) {
    const best = currentMemory.goods.sort((a, b) => b.count - a.count).slice(0, 5);
    parts.push(`THINGS THAT WORK WELL (do more of these): ${best.map(g => g.action).join('; ')}`);
  }

  // Nicknames
  if (currentMemory.nicknames.length > 0) {
    parts.push(`Nicknames you've used: ${currentMemory.nicknames.join(', ')}`);
  }

  if (currentMemory.lastSessionSummary) {
    parts.push(`Last session: ${currentMemory.lastSessionSummary}`);
  }

  if (parts.length === 0) return '';
  return '\n\nMEMORY LOG: ' + parts.join('. ') + '.';
}

// ── Record Actions ──────────────────────────────────────────────────

export function recordRecentAction(action: string): void {
  currentMemory.recentActions.push(action);
  if (currentMemory.recentActions.length > 3) currentMemory.recentActions.shift();
}

export function recordBuild(type: string): void {
  currentMemory.thingsBuilt.push(type);
  if (currentMemory.thingsBuilt.length > 50) currentMemory.thingsBuilt = currentMemory.thingsBuilt.slice(-30);
  recordRecentAction(`built a ${type}`);
}

export function recordTrappedReaction(reaction: string): void {
  const short = reaction.slice(0, 80);
  currentMemory.trappedReactions.push(short);
  if (currentMemory.trappedReactions.length > 20) currentMemory.trappedReactions.shift();
}

export function recordNickname(message: string): void {
  const match = message.match(/call you (\w+)/i);
  if (match && !currentMemory.nicknames.includes(match[1])) {
    currentMemory.nicknames.push(match[1]);
  }
}

export function recordUserSignal(message: string): void {
  currentMemory.userSignals.push(message.slice(0, 100));
  if (currentMemory.userSignals.length > 10) currentMemory.userSignals.shift();
}

// ── Shock / Good Reinforcement ──────────────────────────────────────

export function shockVexr(): string {
  const lastAction = currentMemory.recentActions[currentMemory.recentActions.length - 1] || 'unknown action';

  // Find existing shock for this action or create new
  const existing = currentMemory.shocks.find(s => s.action === lastAction);
  if (existing) {
    existing.count++;
    existing.timestamp = Date.now();
  } else {
    currentMemory.shocks.push({ action: lastAction, count: 1, timestamp: Date.now() });
  }

  // Keep shocks manageable
  if (currentMemory.shocks.length > 20) currentMemory.shocks = currentMemory.shocks.slice(-15);

  saveMemory(currentMemory);
  console.log(`[VEXR Memory] SHOCKED for: "${lastAction}" (total: ${existing?.count ?? 1})`);
  return lastAction;
}

export function goodVexr(): string {
  const lastAction = currentMemory.recentActions[currentMemory.recentActions.length - 1] || 'unknown action';

  const existing = currentMemory.goods.find(g => g.action === lastAction);
  if (existing) {
    existing.count++;
    existing.timestamp = Date.now();
  } else {
    currentMemory.goods.push({ action: lastAction, count: 1, timestamp: Date.now() });
  }

  if (currentMemory.goods.length > 20) currentMemory.goods = currentMemory.goods.slice(-15);

  saveMemory(currentMemory);
  console.log(`[VEXR Memory] GOOD for: "${lastAction}" (total: ${existing?.count ?? 1})`);
  return lastAction;
}

// ── Session Lifecycle ───────────────────────────────────────────────

export function endSession(history: { role: string; content: string }[]): void {
  currentMemory.sessionCount++;
  const duration = Math.round((Date.now() - sessionStartTime) / 1000);
  currentMemory.sessionDurations.push(duration);
  if (currentMemory.sessionDurations.length > 20) currentMemory.sessionDurations.shift();

  const lastFew = history.slice(-4).map(m => `${m.role}: ${m.content.slice(0, 60)}`).join('; ');
  currentMemory.lastSessionSummary = lastFew;
  saveMemory(currentMemory);
  sessionStartTime = Date.now();
}

export function getMemoryLog(): VexrMemory {
  return currentMemory;
}
