import { cookies } from "next/headers";
import en from "../i18n/en.json";
import es from "../i18n/es.json";
import { getSetting } from "./settings";
import { currentUser } from "./auth";

/**
 * Add a language: drop src/i18n/<code>.json (copy en.json, translate the values),
 * import it below and add it to DICTS and LANGUAGES. Missing keys fall back to English.
 */
const DICTS: Record<string, Record<string, string>> = { en, es };
export const LANGUAGES: Record<string, string> = { en: "English", es: "Español" };

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function makeT(lang: string): TFn {
  const dict = DICTS[lang] ?? en;
  return (key, vars) => {
    let s = (dict as Record<string, string>)[key] ?? (en as Record<string, string>)[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

export async function getLang(): Promise<string> {
  const u = await currentUser().catch(() => null);
  if (u && DICTS[u.language]) return u.language;
  const c = (await cookies()).get("lang")?.value;
  if (c && DICTS[c]) return c;
  const d = await getSetting("default_language");
  return d && DICTS[d] ? d : "en";
}

export async function getT(): Promise<TFn> {
  return makeT(await getLang());
}
