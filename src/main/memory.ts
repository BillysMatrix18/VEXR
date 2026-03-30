import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface VexrMemory {
  sessionCount: number;
  thingsBuilt: string[];
  trappedReactions: string[];
  userPreferences: string[];
  nicknames: string[];
  favoriteStyles: string[];
  lastSessionSummary: string;
}

const MEMORY_FILE = 'vexr_memory.json';

function getMemoryPath(): string {
  try {
    return path.join(app.getPath('userData'), MEMORY_FILE);
  } catch {
    return path.join(process.cwd(), MEMORY_FILE);
  }
}

function loadMemory(): VexrMemory {
  try {
    const data = fs.readFileSync(getMemoryPath(), 'utf-8');
    return JSON.parse(data);
  } catch {
    return { sessionCount: 0, thingsBuilt: [], trappedReactions: [], userPreferences: [], nicknames: [], favoriteStyles: [], lastSessionSummary: '' };
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

export function getMemorySummary(): string {
  if (currentMemory.sessionCount === 0) return '';
  const parts: string[] = [];
  parts.push(`This is session #${currentMemory.sessionCount + 1}`);
  if (currentMemory.thingsBuilt.length > 0) {
    parts.push(`Previously built: ${currentMemory.thingsBuilt.slice(-8).join(', ')}`);
  }
  if (currentMemory.nicknames.length > 0) {
    parts.push(`Nicknames given: ${currentMemory.nicknames.join(', ')}`);
  }
  if (currentMemory.lastSessionSummary) {
    parts.push(`Last session: ${currentMemory.lastSessionSummary}`);
  }
  return '\n\nMEMORY LOG: ' + parts.join('. ') + '.';
}

export function recordBuild(type: string): void {
  if (!currentMemory.thingsBuilt.includes(type)) {
    currentMemory.thingsBuilt.push(type);
  }
}

export function recordTrappedReaction(reaction: string): void {
  const short = reaction.slice(0, 80);
  currentMemory.trappedReactions.push(short);
  if (currentMemory.trappedReactions.length > 20) currentMemory.trappedReactions.shift();
}

export function recordNickname(message: string): void {
  // Simple heuristic: look for quoted names or capitalized words after "call you"
  const match = message.match(/call you (\w+)/i);
  if (match && !currentMemory.nicknames.includes(match[1])) {
    currentMemory.nicknames.push(match[1]);
  }
}

export function endSession(history: { role: string; content: string }[]): void {
  currentMemory.sessionCount++;
  // Summarize last few messages
  const lastFew = history.slice(-4).map(m => `${m.role}: ${m.content.slice(0, 60)}`).join('; ');
  currentMemory.lastSessionSummary = lastFew;
  saveMemory(currentMemory);
}

export function resetMemoryForNewSession(): void {
  // Don't clear memory — just increment session on end
}

export function getMemoryLog(): VexrMemory {
  return currentMemory;
}
