import { SPECIALS } from "./config.js";
import { isMusicEnabled, isSfxEnabled, setMusicEnabled, setSfxEnabled } from "./audio.js";

const CHALLENGE_GUIDANCE_MIGRATION_KEY = "unknown-kingdom-help-preferences-v2";
const CHALLENGE_GUIDANCE_SETTING_KEY = "unknown-kingdom-special-help-enabled";
const LANGUAGE_SETTING_KEY = "unknown-kingdom-language";

if (!localStorage.getItem(CHALLENGE_GUIDANCE_MIGRATION_KEY)) {
  enableChallengeGuidance();
  localStorage.setItem(CHALLENGE_GUIDANCE_MIGRATION_KEY, "reset");
}

export function enableChallengeGuidance() {
  SPECIALS.forEach((unitType) => {
    localStorage.removeItem(`unknown-kingdom-hide-help-${unitType}`);
  });
  localStorage.setItem(CHALLENGE_GUIDANCE_SETTING_KEY, "enabled");
}

export function disableChallengeGuidance() {
  localStorage.setItem(CHALLENGE_GUIDANCE_SETTING_KEY, "disabled");
}

export function isChallengeGuidanceEnabled() {
  return localStorage.getItem(CHALLENGE_GUIDANCE_SETTING_KEY) !== "disabled";
}

export function getSavedLanguage(fallback = "ko") {
  const urlParam = new URLSearchParams(window.location.search).get("lang");
  if (urlParam === "ko" || urlParam === "en") return urlParam;
  const saved = localStorage.getItem(LANGUAGE_SETTING_KEY);
  return saved === "ko" || saved === "en" ? saved : fallback;
}

export function setSavedLanguage(lang) {
  localStorage.setItem(LANGUAGE_SETTING_KEY, lang);
}
