export const CALL_SOUND_URLS = Object.freeze({
  ringtone: "/sounds/calls/ringtone.wav",
  join: "/sounds/calls/join-call-sound.wav",
  exit: "/sounds/calls/exit-call-sound.wav",
});

const noop = () => {};

export function playCallSound(name, { loop = false, volume = 0.65 } = {}) {
  const src = CALL_SOUND_URLS[name];
  if (!src || typeof globalThis.Audio !== "function") return noop;

  const audio = new globalThis.Audio(src);
  audio.preload = "auto";
  audio.loop = loop;
  audio.volume = Math.min(1, Math.max(0, volume));
  audio.play()?.catch(() => {
    // Browsers can reject autoplay until the user interacts with the page.
    // Calls remain usable; the next user-triggered sound can play normally.
  });

  return () => {
    audio.pause();
    audio.currentTime = 0;
  };
}
