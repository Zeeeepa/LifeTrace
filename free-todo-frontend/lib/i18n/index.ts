import type { Locale } from "@/lib/store/locale";
import { en } from "./en";
import { zh } from "./zh";

const translations = {
	zh,
	en,
};

export function useTranslations(locale: Locale) {
	const validLocale: Locale =
		locale === "zh" || locale === "en" ? locale : "zh";
	return translations[validLocale];
}
