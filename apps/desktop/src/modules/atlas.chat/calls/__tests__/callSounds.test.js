import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { CALL_SOUND_URLS, playCallSound } from "../callSounds.js";

const originalAudio = globalThis.Audio;

afterEach(() => {
  globalThis.Audio = originalAudio;
});

describe("call sounds", () => {
  it("maps every call event to its packaged public asset", () => {
    assert.deepEqual(CALL_SOUND_URLS, {
      ringtone: "/sounds/calls/ringtone.wav",
      join: "/sounds/calls/join-call-sound.wav",
      exit: "/sounds/calls/exit-call-sound.wav",
    });
  });

  it("configures playback and returns a cleanup function", () => {
    const instances = [];
    globalThis.Audio = class AudioMock {
      constructor(src) {
        this.src = src;
        this.currentTime = 5;
        instances.push(this);
      }

      play() {
        this.played = true;
        return Promise.resolve();
      }

      pause() {
        this.paused = true;
      }
    };

    const stop = playCallSound("ringtone", { loop: true, volume: 0.4 });
    const audio = instances[0];
    assert.equal(audio.src, CALL_SOUND_URLS.ringtone);
    assert.equal(audio.loop, true);
    assert.equal(audio.volume, 0.4);
    assert.equal(audio.preload, "auto");
    assert.equal(audio.played, true);

    stop();
    assert.equal(audio.paused, true);
    assert.equal(audio.currentTime, 0);
  });
});
