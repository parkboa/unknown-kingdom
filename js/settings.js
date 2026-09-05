const LANGUAGE_SETTING_KEY = "unknown-kingdom-language";
const PVE_TIMER_SETTING_KEY = "daeguk-pve-timer";

export function getSavedLanguage(fallback = "ko") {
  const urlParam = new URLSearchParams(window.location.search).get("lang");
  if (urlParam === "ko" || urlParam === "en") return urlParam;
  const saved = localStorage.getItem(LANGUAGE_SETTING_KEY);
  return saved === "ko" || saved === "en" ? saved : fallback;
}

export function setSavedLanguage(lang) {
  localStorage.setItem(LANGUAGE_SETTING_KEY, lang);
}

export function isPveTimerEnabled() {
  return localStorage.getItem(PVE_TIMER_SETTING_KEY) !== "disabled";
}

export function setPveTimerEnabled(enabled) {
  localStorage.setItem(PVE_TIMER_SETTING_KEY, enabled ? "enabled" : "disabled");
}
