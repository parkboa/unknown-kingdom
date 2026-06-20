import { TEXT } from "./config.js?v=black-white";

export function createTranslator(language) {
  return function text(key, values = {}) {
    let output = TEXT[language][key] || TEXT.en[key] || key;
    Object.entries(values).forEach(([name, value]) => {
      output = output.replaceAll(`{${name}}`, value);
    });
    return output;
  };
}
