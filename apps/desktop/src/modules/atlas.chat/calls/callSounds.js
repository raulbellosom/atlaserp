export const CALL_SOUND_URLS = Object.freeze({
  ringtone: "/sounds/calls/ringtone.wav",
  join: "/sounds/calls/join-call-sound.wav",
  exit: "/sounds/calls/exit-call-sound.wav",
});

let audioContext = null;
const bufferPromises = new Map();

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioContextImpl = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AudioContextImpl) return null;
  audioContext = new AudioContextImpl();
  return audioContext;
}

async function loadBuffer(name, context) {
  if (!CALL_SOUND_URLS[name]) return null;
  if (!bufferPromises.has(name)) {
    bufferPromises.set(name, fetch(CALL_SOUND_URLS[name])
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .catch((error) => {
        bufferPromises.delete(name);
        throw error;
      }));
  }
  return bufferPromises.get(name);
}

// Browsers only allow programmatic audio after a user gesture. CallsProvider
// invokes this from the first pointer/key event anywhere in Atlas so a later
// incoming call can ring even when the user is outside the chat module.
export async function unlockCallSounds() {
  const context = getAudioContext();
  if (!context) return false;
  if (context.state === "suspended") await context.resume();
  if (context.state !== "running") return false;
  await Promise.allSettled(Object.keys(CALL_SOUND_URLS).map((name) => loadBuffer(name, context)));
  return true;
}

export function preloadCallSounds() {
  const context = getAudioContext();
  if (!context) return;
  Object.keys(CALL_SOUND_URLS).forEach((name) => { loadBuffer(name, context).catch(() => {}); });
}

export function playCallSound(name, { loop = false, volume = 0.65 } = {}) {
  const src = CALL_SOUND_URLS[name];
  if (!src || typeof globalThis === "undefined") return () => {};

  let stopped = false;
  let sourceNode = null;
  let fallbackAudio = null;

  async function start() {
    const context = getAudioContext();
    if (context) {
      try {
        if (context.state === "suspended") await context.resume();
        const buffer = await loadBuffer(name, context);
        if (stopped) return;
        if (context.state === "running" && buffer) {
          const gain = context.createGain();
          gain.gain.value = Math.min(1, Math.max(0, volume));
          sourceNode = context.createBufferSource();
          sourceNode.buffer = buffer;
          sourceNode.loop = loop;
          sourceNode.connect(gain).connect(context.destination);
          sourceNode.start();
          return;
        }
      } catch (error) {
        console.warn(`[atlas.calls] No se pudo reproducir ${name} con Web Audio:`, error);
      }
    }

    try {
      fallbackAudio = new globalThis.Audio(src);
      fallbackAudio.preload = "auto";
      fallbackAudio.loop = loop;
      fallbackAudio.volume = Math.min(1, Math.max(0, volume));
      await fallbackAudio.play();
    } catch (error) {
      console.warn(`[atlas.calls] El navegador bloqueo el sonido ${name}:`, error);
    }
  }

  start();

  return () => {
    stopped = true;
    try { sourceNode?.stop(); } catch {}
    if (fallbackAudio) {
      fallbackAudio.pause();
      fallbackAudio.currentTime = 0;
    }
  };
}
