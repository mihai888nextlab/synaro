/** camelCase → snake_case (shallow-recursive). */
export function toSnakeCase(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(toSnakeCase);
  if (typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const snake = key.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
    out[snake] = toSnakeCase(val);
  }
  return out;
}

/** snake_case → camelCase (shallow-recursive). */
export function toCamelCase(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(toCamelCase);
  if (typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const camel = key.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
    out[camel] = toCamelCase(val);
  }
  return out;
}

export function asCamel<T>(value: unknown): T {
  return toCamelCase(value) as T;
}
