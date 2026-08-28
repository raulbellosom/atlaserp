// App-wide short-sound layer. Named for calls (its first consumer) but also
// owns the in-app notification chime — one unlock gesture, one priming pass,
// covers every one-shot sound so they all work on iOS PWA where audio is
// otherwise blocked outside a user gesture.
export const CALL_SOUND_URLS = Object.freeze({
  ringtone: "/sounds/calls/ringtone.mp3",
  join: "/sounds/calls/join-call-sound.mp3",
  exit: "/sounds/calls/exit-call-sound.mp3",
  notification: "/sounds/notification.mp3",
});

let audioContext = null;
const bufferPromises = new Map();
// One reusable, gesture-primed HTMLAudioElement per sound. iOS only lets an
// <audio> element play without a user gesture AFTER it has been played once
// during a gesture — so we prime each during unlockCallSounds() and then
// replay the same element later (currentTime = 0), never `new Audio()`.
const primedElements = new Map();

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

// Create + silently play-then-pause an <audio> element so a later gestureless
// .play() is allowed on iOS. Safe to call repeatedly — only primes once.
function primeElement(name) {
  if (typeof globalThis.Audio !== "function") return null;
  let el = primedElements.get(name);
  if (el) return el;
  el = new globalThis.Audio(CALL_SOUND_URLS[name]);
  el.preload = "auto";
  el.muted = true;
  const done = el.play();
  if (done && typeof done.then === "function") {
    done.then(() => {
      el.pause();
      el.currentTime = 0;
      el.muted = false;
    }).catch(() => {
      // Even a rejected play() attempt inside the gesture is often enough to
      // unlock iOS for a later real play; just restore the element either way.
      el.muted = false;
    });
  } else {
    el.pause();
    el.currentTime = 0;
    el.muted = false;
  }
  primedElements.set(name, el);
  return el;
}

// Browsers only allow programmatic audio after a user gesture. CallsProvider
// invokes this from the first pointer/key event anywhere in Atlas so a later
// incoming call (or notification chime) can play even when the user is outside
// the chat module.
export async function unlockCallSounds() {
  Object.keys(CALL_SOUND_URLS).forEach((name) => primeElement(name));

  const context = getAudioContext();
  if (!context) return primedElements.size > 0;
  if (context.state === "suspended") await context.resume();
  if (context.state !== "running") return primedElements.size > 0;
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
  let elementAudio = null;

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

    // Fallback: the gesture-primed element (reused, never a fresh Audio()).
    try {
      elementAudio = primedElements.get(name) ?? primeElement(name);
      if (!elementAudio) return;
      elementAudio.loop = loop;
      elementAudio.volume = Math.min(1, Math.max(0, volume));
      elementAudio.currentTime = 0;
      await elementAudio.play();
    } catch (error) {
      console.warn(`[atlas.calls] El navegador bloqueo el sonido ${name}:`, error);
    }
  }

  start();

  return () => {
    stopped = true;
    try { sourceNode?.stop(); } catch {}
    if (elementAudio) {
      elementAudio.pause();
      elementAudio.currentTime = 0;
      elementAudio.loop = false;
    }
  };
}
