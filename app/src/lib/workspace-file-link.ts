const FILE_EXTENSIONS =
  "tsx?|jsx?|mjs|cjs|json|md|mdx|ya?ml|css|scss|html|sh|bash|py|go|rs|toml|lock|env|sql|prisma|svg|graphql|dockerfile";

const KNOWN_ROOT_FILES = new Set([
  "README.md",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "tsconfig.json",
  ".gitignore",
  ".env",
  ".env.example",
]);

/** Loose path segment: letters, numbers, common symbols used in repo paths. */
const PATH_SEGMENT = "[\\w@%.+\\-]+";

const FILE_PATH_RE = new RegExp(
  `(\\b${PATH_SEGMENT}(?:\\/${PATH_SEGMENT})+\\.(?:${FILE_EXTENSIONS})\\b)|` +
    `(\\b${PATH_SEGMENT}\\.(?:${FILE_EXTENSIONS})\\b)|` +
    `(\\b(?:${Array.from(KNOWN_ROOT_FILES).join("|").replace(/\./g, "\\.")})\\b)`,
  "gi",
);

export function normalizeWorkspaceFilePath(raw: string): string {
  return raw
    .trim()
    .replace(/^['"`]+|['"`]+$/g, "")
    .replace(/^\.?\//, "");
}

export function isLikelyWorkspaceFilePath(raw: string): boolean {
  const path = normalizeWorkspaceFilePath(raw);
  if (!path || path.length > 280 || /\s/.test(path)) return false;
  if (/^https?:\/\//i.test(path) || /^mailto:/i.test(path)) return false;
  if (path.startsWith("{") || path.includes("**")) return false;

  if (KNOWN_ROOT_FILES.has(path)) return true;

  if (path.includes("/") && /\.[a-z0-9]{1,10}$/i.test(path)) return true;

  if (/^[\w@%.+\-]+(?:\/[\w@%.+\-]+)*\.[a-z0-9]{1,10}$/i.test(path)) return true;

  return false;
}

export type TextPart = { type: "text"; value: string } | { type: "file"; value: string };

/** Split plain text into runs, marking likely workspace file paths. */
export function splitTextWithFilePaths(text: string): TextPart[] {
  if (!text) return [{ type: "text", value: "" }];

  const parts: TextPart[] = [];
  let lastIndex = 0;
  FILE_PATH_RE.lastIndex = 0;

  for (const match of text.matchAll(FILE_PATH_RE)) {
    const value = match[0];
    const index = match.index ?? 0;
    if (!value || !isLikelyWorkspaceFilePath(value)) continue;

    if (index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, index) });
    }
    parts.push({ type: "file", value });
    lastIndex = index + value.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}
