import { clips } from './store.js?v=17';

// Audio for a clip id is looked up in this order:
//   1. a published file: audio/<id>.mp3 | .m4a | .webm | .ogg
//   2. a recording saved in this browser by the studio
const EXTS = ['mp3', 'm4a', 'webm', 'ogg'];
const cache = new Map();

async function findFile(id) {
  for (const ext of EXTS) {
    const url = `audio/${id}.${ext}`;
    try {
      const r = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
      const type = r.headers.get('content-type') || '';
      // Some hosts answer 200 with index.html for missing files, so check the type.
      if (r.ok && !type.includes('text/html')) return url;
    } catch { /* offline */ }
  }
  return null;
}

export async function audioUrl(id) {
  if (cache.has(id)) return cache.get(id);
  const p = (async () => {
    const file = await findFile(id);
    if (file) return { url: file, source: 'file' };
    const blob = await clips.get(id);
    if (blob) return { url: URL.createObjectURL(blob), source: 'browser' };
    return null;
  })();
  cache.set(id, p);
  return p;
}

export function forget(id) { cache.delete(id); }

let current = null;
export async function play(id, { slow = false } = {}) {
  const found = await audioUrl(id);
  if (!found) return false;
  return playUrl(found.url, slow);
}

export function playUrl(url, slow = false) {
  if (current) current.pause();
  const a = new Audio(url);
  a.playbackRate = slow ? 0.7 : 1;
  a.preservesPitch = true;
  current = a;
  return new Promise(resolve => {
    a.onended = () => resolve(true);
    a.onerror = () => resolve(false);
    a.play().catch(() => resolve(false));
  });
}

export function stop() { if (current) current.pause(); }

// ---- microphone ----
export function canRecord() {
  return !!(navigator.mediaDevices && window.MediaRecorder);
}

export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg']
    .find(t => MediaRecorder.isTypeSupported?.(t));
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.start();
  return {
    stop: () => new Promise(resolve => {
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        resolve(new Blob(chunks, { type: rec.mimeType || type || 'audio/webm' }));
      };
      rec.stop();
    }),
  };
}

export function extFor(blob) {
  const t = blob.type;
  if (t.includes('mp4') || t.includes('aac')) return 'm4a';
  if (t.includes('ogg')) return 'ogg';
  if (t.includes('mpeg')) return 'mp3';
  return 'webm';
}
