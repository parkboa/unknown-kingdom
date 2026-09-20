const params = new URLSearchParams(location.search);
const language = params.get("lang") === "en" ? "en" : "ko";
document.documentElement.lang = language;
document.querySelectorAll("[data-language]").forEach(section => {
  section.hidden = section.dataset.language !== language;
});
const title = document.querySelector(`[data-title-${language}]`);
if (title) document.title = language === "ko" ? title.dataset.titleKo : title.dataset.titleEn;
