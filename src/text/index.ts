import catalog from "./strings.json" with { type: "json" };

type Keys<T> = { [K in keyof T & string]: T[K] extends string ? K : T[K] extends object ? `${K}.${Keys<T[K]>}` : never }[keyof T & string];
export type TextKey = Keys<typeof catalog>;
export type TextValues = Readonly<Record<string, string | number>>;

const messages = new Map<string, string>();
function collect(value: object, prefix = "") {
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === "string") messages.set(path, entry);
    else if (entry && typeof entry === "object") collect(entry, path);
  }
}
collect(catalog);

/** All authored interface wording lives in strings.json. Values are plain text, never HTML. */
export function uiText(key: TextKey, values?: TextValues): string {
  const message = messages.get(key) ?? key;
  if (!values) return message;
  return message.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (token, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : token);
}

/** Display labels may change without changing persisted rank identifiers. */
export function rankName(tier: string): string {
  return messages.get(`rankNames.${tier}`) ?? tier;
}
