import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';

const CACHE_DIR = path.join(os.tmpdir(), 'vexr-models');

// Ensure cache dir exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

interface SketchfabModel {
  uid: string;
  name: string;
  thumbnails?: { images?: { url: string }[] };
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
        // Follow redirects
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

export async function searchAndDownloadModel(
  query: string,
  sendToRenderer: (channel: string, data?: any) => void,
): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log('[VEXR Sketchfab] No API key set, skipping model search');
    return null;
  }

  // Check cache first
  const cacheKey = query.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const cachedPath = path.join(CACHE_DIR, `${cacheKey}.glb`);
  if (fs.existsSync(cachedPath)) {
    console.log('[VEXR Sketchfab] Using cached model:', cachedPath);
    return cachedPath;
  }

  try {
    sendToRenderer('model-loading', { query, status: 'searching' });

    // Search for downloadable models
    const searchUrl = `https://api.sketchfab.com/v3/search?type=models&q=${encodeURIComponent(query + ' low poly')}&downloadable=true&sort_by=-likeCount&count=5`;
    const results = await fetchJSON(searchUrl);

    if (!results.results || results.results.length === 0) {
      sendToRenderer('model-loading', { query, status: 'not-found' });
      return null;
    }

    // Find first downloadable model
    for (const model of results.results as SketchfabModel[]) {
      try {
        sendToRenderer('model-loading', { query, status: 'downloading', name: model.name });

        // Get download URL
        const dlInfo = await fetchJSON(`https://api.sketchfab.com/v3/models/${model.uid}/download`);

        if (dlInfo.glb?.url) {
          await downloadFile(dlInfo.glb.url, cachedPath);
          sendToRenderer('model-loading', { query, status: 'done', name: model.name });
          console.log('[VEXR Sketchfab] Downloaded:', model.name);
          return cachedPath;
        }
        if (dlInfo.gltf?.url) {
          const gltfPath = path.join(CACHE_DIR, `${cacheKey}.gltf.zip`);
          await downloadFile(dlInfo.gltf.url, gltfPath);
          sendToRenderer('model-loading', { query, status: 'done', name: model.name });
          return gltfPath;
        }
      } catch (dlErr: any) {
        console.log(`[VEXR Sketchfab] Failed to download ${model.name}:`, dlErr.message);
        continue;
      }
    }

    sendToRenderer('model-loading', { query, status: 'not-found' });
    return null;
  } catch (err: any) {
    console.error('[VEXR Sketchfab] Search error:', err.message);
    sendToRenderer('model-loading', { query, status: 'error' });
    return null;
  }
}
