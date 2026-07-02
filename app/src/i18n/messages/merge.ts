import type { Messages } from "@/i18n/messages/types";

function isMessageTree(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMergeMessages(target: Messages, source: Messages): Messages {
  const result: Messages = { ...target };
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];
    if (isMessageTree(targetValue) && isMessageTree(sourceValue)) {
      result[key] = deepMergeMessages(targetValue, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }
  return result;
}

export function mergeMessages(...parts: Messages[]): Messages {
  return parts.reduce((acc, part) => deepMergeMessages(acc, part), {} as Messages);
}
