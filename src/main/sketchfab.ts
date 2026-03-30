import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';

const CACHE_DIR = path.join(os.tmpdir(), 'vexr-models');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// ── Performance Limits ──────────────────────────────────────────────

const MAX_MODEL_FACES = 5000;
const SCENE_POLY_BUDGET = 50000;
let sceneTriCount = 0;
let isLoadingModel = false;
let modelQueue: Array<{ query: string; resolve: (p: string | null) => void; send: (ch: string, d?: any) => void }> = [];

export function addToSceneTriCount(count: number) { sceneTriCount += count; }
export function getSceneTriCount() { return sceneTriCount; }
export function resetSceneTriCount() { sceneTriCount = 0; modelQueue = []; isLoadingModel = false; }

interface SketchfabModel {
  uid: string;
  name: string;
  faceCount?: number;
}

function getApiKey(): string {
  return process.env.SKETCHFAB_API_KEY || '';
}

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { Authorization: `Token ${getApiKey()}` } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const mod = url.startsWith('https') ? https : http;
    const doRequest = (reqUrl: string) => {
      mod.get(reqUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const location = res.headers.location;
          if (location) { doRequest(location); return; }
        }
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
    };
    doRequest(url);
  });
}

// ── Queue System — one model at a time ──────────────────────────────

function processQueue() {
  if (isLoadingModel || modelQueue.length === 0) return;
  const next = modelQueue.shift()!;
  doSearch(next.query, next.send).then(next.resolve).catch(() => next.resolve(null));
}

export function searchAndDownloadModel(
  query: string,
  sendToRenderer: (channel: string, data?: any) => void,
): Promise<string | null> {
  // Budget exceeded — fall back to primitives for the rest of the session
  if (sceneTriCount >= SCENE_POLY_BUDGET) {
    console.log('[VEXR Sketchfab] Scene poly budget exceeded, using primitives');
    return Promise.resolve(null);
  }

  const apiKey = getApiKey();
  if (!apiKey) return Promise.resolve(null);

  return new Promise((resolve) => {
    modelQueue.push({ query, resolve, send: sendToRenderer });
    processQueue();
  });
}

async function doSearch(
  query: string,
  send: (channel: string, data?: any) => void,
): Promise<string | null> {
  isLoadingModel = true;

  const cacheKey = query.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const cachedPath = path.join(CACHE_DIR, `${cacheKey}.glb`);
  if (fs.existsSync(cachedPath)) {
    console.log('[VEXR Sketchfab] Using cached model:', cachedPath);
    isLoadingModel = false;
    processQueue();
    return cachedPath;
  }

  try {
    send('model-loading', { query, status: 'searching' });

    // Search with strict poly limits and low poly tags
    const searchUrl = `https://api.sketchfab.com/v3/search?type=models` +
      `&q=${encodeURIComponent(query)}` +
      `&tags=lowpoly` +
      `&face_count=0-${MAX_MODEL_FACES}` +
      `&downloadable=true` +
      `&sort_by=-likeCount` +
      `&count=5`;

    const results = await fetchJSON(searchUrl);

    if (!results.results || results.results.length === 0) {
      send('model-loading', { query, status: 'not-found' });
      isLoadingModel = false;
      processQueue();
      return null;
    }

    for (const model of results.results as SketchfabModel[]) {
      // Double-check face count if reported
      if (model.faceCount && model.faceCount > MAX_MODEL_FACES) continue;

      try {
        send('model-loading', { query, status: 'downloading', name: model.name });

        const dlInfo = await fetchJSON(`https://api.sketchfab.com/v3/models/${model.uid}/download`);

        if (dlInfo.glb?.url) {
          await downloadFile(dlInfo.glb.url, cachedPath);

          // Check file size as a rough proxy — GLB > 2MB is likely too heavy
          const stat = fs.statSync(cachedPath);
          if (stat.size > 2 * 1024 * 1024) {
            console.log(`[VEXR Sketchfab] Model too large (${(stat.size / 1024 / 1024).toFixed(1)}MB), skipping`);
            fs.unlinkSync(cachedPath);
            continue;
          }

          send('model-loading', { query, status: 'done', name: model.name });
          console.log('[VEXR Sketchfab] Downloaded:', model.name);
          isLoadingModel = false;
          processQueue();
          return cachedPath;
        }
      } catch (dlErr: any) {
        console.log(`[VEXR Sketchfab] Failed to download ${model.name}:`, dlErr.message);
        continue;
      }
    }

    send('model-loading', { query, status: 'not-found' });
  } catch (err: any) {
    console.error('[VEXR Sketchfab] Search error:', err.message);
    send('model-loading', { query, status: 'error' });
  }

  isLoadingModel = false;
  processQueue();
  return null;
}
