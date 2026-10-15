# Supported site languages — 2026-10-15

The frontend supports English (`en`), Korean (`kr`, formatted as `ko-KR`) and Uzbek (`uz`). English remains the default and fallback. Russian is no longer configured, offered in desktop/mobile navigation, bundled as a translation dictionary, used for date-picker/Intl formatting, or sent as a frontend AI locale option.

Legacy `/ru` and `/ru/...` URLs redirect to the equivalent English route on the same origin. Queries, including repeated parameters, are preserved. The redirect sets `NEXT_LOCALE=en`, so a previous non-English preference cannot redirect a root or authentication callback back to another language. Obsolete Russian preference cookies reset to English when the existing root/callback middleware runs. Saved Russian browsing entries are discarded; supported-language entries and their controls remain usable.

The English, Korean and Uzbek dictionary contents are unchanged. Existing pointer/keyboard language-selector focus behavior, route/query/hash preservation, scroll restoration, authentication and Apollo integration remain intact. No backend code, API, database records, dependency or user-generated content was changed. The earlier homepage translation compaction remains scoped to the homepage; About and Help Center retain their existing full active-language/English-fallback loaders.

Historical localization reports and JSON snapshots retain their original four-language results and are not current runtime configuration.

## Validation

- Yarn typecheck passed (`tsc --noEmit --incremental false`).
- Non-fixing ESLint passed for all changed JavaScript/TypeScript files.
- Full `yarn test`: 146 passed, zero failures/skips. Coverage includes the three desktop/mobile choices, pointer/keyboard focus, language switching, AI retry context, obsolete cookies and URLs, saved browsing entries, translation equivalence/plurals/fallbacks, and About/Help Center loader payload budgets.
- Translation audit: English/Korean each have 1,027 keys; Uzbek has 1,043. Zero audit errors. English/Korean baseline values are preserved; none of the three remaining dictionaries was edited.
- Isolated live HTTP checks of About and Help Center returned 200 for all three languages. Actual Next page-data sizes: English 53,797 / 53,803 bytes; Korean 113,356 / 113,362 bytes; Uzbek 113,951 / 113,957 bytes. All are below 131,072 bytes (128 KiB); serialized locale lists and language selectors contain only `en`, `kr`, `uz`.
- Six live legacy URL chains passed: `/ru`, `/ru/`, About, Help Center, account completion and tour detail. They reach English with repeated query parameters intact and reset the locale cookie. Existing Next trailing-slash normalization may issue a 308 before the middleware's 307. Two additional stale-cookie checks passed on the root and an explicit Uzbek account callback.

Live validation used an isolated temporary source copy and its own Next cache on port 3012. The task-owned server and copy were removed afterward. The user's server and development records were left untouched. Component tests verify desktop/mobile selectors; this task does not claim a new manual browser acceptance matrix or live AI-provider acceptance.

The final read-only request to the existing server on port 3000 still advertised the old four-locale configuration. Restart that frontend process once to load the new locale registration; it was left running according to the user's earlier instruction.

## Changed files

| Area | Exact files |
| --- | --- |
| Locale configuration and compatibility | `next-i18next.config.js`, `middleware.ts`, `libs/triplink/locale.ts`, `libs/triplink/browsingMemoryStore.ts` |
| Navigation, chat and AI | `libs/components/Top.tsx`, `libs/components/Chat.tsx`, `libs/components/AiAssistant.tsx`, `libs/types/triplink/ai.ts` |
| Homepage | `libs/components/homepage/HomeSearchForm.tsx`, `libs/components/homepage/HomeSections.tsx`, `libs/components/homepage/HomeArticles.tsx` |
| Marketplace and account formatting | `libs/components/triplink/Tours.tsx`, `libs/components/triplink/TourDetail.tsx`, `libs/components/triplink/TourSearch.tsx`, `libs/components/triplink/Community.tsx`, `libs/components/triplink/ActiveSessions.tsx`, `libs/components/triplink/SecuritySettings.tsx` |
| Deleted dictionary | `public/locales/ru/common.json` |
| Audit | `scripts/audit-translations.cjs` |
| Tests | `tests/localization.test.cjs`, `tests/locale-switching.test.cjs`, `tests/ai-assistant.test.cjs`, `tests/home-agents.test.cjs`, `tests/home-featured.test.cjs`, `tests/home-rated.test.cjs`, `tests/migration.test.cjs`, `tests/tour-resubmission.test.cjs` |
| Documentation | `docs/language-removal.md`, `docs/uzbek-localization.md` |
