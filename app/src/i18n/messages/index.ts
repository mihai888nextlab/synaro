import { type Locale } from "@/i18n/config";
import { enMessages } from "@/i18n/messages/en";
import { roMessages } from "@/i18n/messages/ro";
import type { Messages } from "@/i18n/messages/types";

export type { Messages };

const catalogs: Record<Locale, Messages> = {
  en: enMessages,
  ro: roMessages,
};

export function getMessages(locale: Locale): Messages {
  return catalogs[locale];
}
