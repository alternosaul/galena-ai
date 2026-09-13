import type { TKey } from "./i18n";

export const PASSWORD_RULES: { key: TKey; test: (password: string) => boolean }[] = [
  { key: "pw.length", test: (p) => p.length >= 8 },
  { key: "pw.case", test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { key: "pw.number", test: (p) => /\d/.test(p) },
  { key: "pw.symbol", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/** Número de reglas que cumple la contraseña (0 a 4). */
export function passwordScore(password: string) {
  return PASSWORD_RULES.filter((rule) => rule.test(password)).length;
}
