const MUSIC_SETTING_KEY = "unknown-kingdom-music";
const SFX_SETTING_KEY = "unknown-kingdom-sfx";

const backgroundMusic = new Audio("./assets/audio/daeguk_bgm_v1.mp3?v=audio-3");
backgroundMusic.preload = "metadata";
backgroundMusic.loop = true;
backgroundMusic.volume = 0.24;

const placementSound = new Audio("./assets/audio/piece-place.mp3?v=audio-2");
placementSound.preload = "auto";
placementSound.volume = 0.58;

export function isMusicEnabled() {
  return localStorage.getItem(MUSIC_SETTING_KEY) === "enabled";
}

export function isSfxEnabled() {
  return localStorage.getItem(SFX_SETTING_KEY) !== "disabled";
}

export function setMusicEnabled(enabled) {
  localStorage.setItem(MUSIC_SETTING_KEY, enabled ? "enabled" : "disabled");
  syncBackgroundMusic();
}

export function setSfxEnabled(enabled) {
  localStorage.setItem(SFX_SETTING_KEY, enabled ? "enabled" : "disabled");
}

export function syncBackgroundMusic() {
  if (!isMusicEnabled()) {
    backgroundMusic.pause();
    return;
  }
  backgroundMusic.play().catch(() => {});
}

export function playPlacementSound() {
  if (!isSfxEnabled()) return;
  placementSound.currentTime = 0;
  placementSound.play().catch(() => {});
}

export function initAudioGesture() {
  document.addEventListener("pointerdown", syncBackgroundMusic, { once: true });
}
