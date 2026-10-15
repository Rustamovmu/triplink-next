# Uzbek localization — 2026-10-14

> Current status (2026-10-15): the frontend supports English, Korean and Uzbek. Russian has been removed; see [the removal record](language-removal.md). This dated implementation report and its linked JSON evidence describe the earlier four-language setup.

## Architecture and locale registration

Extended the existing next-i18next / react-i18next / i18next setup, its `common` namespace, `appWithTranslation`, per-page `serverSideTranslations`, and Next.js Pages Router locale routing. No additional localization library or dependency was installed. Locales are `en`, `kr`, `ru`, `uz`; the inherited Korean URL identifier is deliberately retained. Document/Intl language identifiers map to `en` / `en-US`, `ko` / `ko-KR`, `ru` / `ru-RU`, and `uz` / `uz-UZ`. English remains the default and fallback. Phrase keys retain their spelling and are treated literally, including punctuation.

## Translation coverage

`public/locales/uz/common.json` contains **1,043 Uzbek Latin entries**: all 992 original English entries, 35 additional previously uncovered interface/error/accessibility keys, and the 16 extra plural forms already present in Russian. Every original English, Korean and Russian translation value is preserved. Seven pre-existing Korean plural-key gaps are filled; new shared keys have corresponding English/Korean/Russian translations.

Coverage includes navigation, footer, homepage hero/search/carousels/tour cards/agent sections, curated seasonal events, tours/search/details/itineraries, agent/member profiles and connections, authentication and enabled provider labels, recovery/security/connected accounts/sessions, member workspace, favorites/history, booking/payment/review controls, articles/comments/editor, shared chat, AI assistant, Help Center and its admin editor, and existing admin member/tour/booking/review/community screens. Missing related-record labels and newly created booking statuses now use translations too. Notifications and other absent product functionality were not added.

Original tour titles/descriptions, member names/biographies/countries, reviews, article/help-entry bodies, comments and chat messages remain original content. There is no content-translation field or editorial translation service in this implementation. Google, Kakao, Telegram and TripLink retain their brand names. Existing security emails are English-only; there was no multilingual email-template mechanism to extend.

## Language switching and persistence

The existing native select offers English, 한국어, Русский and **O‘zbekcha**, on desktop and in mobile navigation. Switching uses Next's router on the current pathname/query/asPath, including query arrays and hashes, with `scroll: false`. It neither invokes logout nor replaces account/Apollo state. The standard `NEXT_LOCALE` cookie stores only the language, for one year with Path=/ and SameSite=Lax. Failed/cancelled routing restores the preceding preference. Localized URLs preserve selection through refresh and navigation.

Middleware restores the same cookie preference on fresh root visits and the existing fixed `/account/*` callback/recovery paths before SSR. An explicit non-default locale path wins. Asset and API paths are outside the matcher. There is no duplicate localStorage preference or member-language field. OAuth backend callback URIs, credential transport and permission rules are unchanged.

Browsing history recognizes `/uz`, persists Uzbek entries, and copies current-page controls/scroll anchors on language changes. It retains the existing rule that different languages have separate explicit homepage-return chains. Existing browser Back/Forward and smart restoration tests remain passing.

## Formatting, plurals and responsive behavior

Regional formatting includes `uz-UZ` for tour/home/article/chat/security/session/admin/booking dates and prices. Calendars use the installed date-fns Uzbek locale and translated navigation, toolbar, action and accessibility labels. Date instants/timezones remain unchanged; invalid dates display a safe dash. Booking estimates and totals use localized USD formatting. No exchange-rate conversion or change to monetary amounts/currency occurs.

Uzbek count phrases use the existing i18next interpolation/plural mechanism: `1 kun`, `2 kun`, `5 kun`, `3 sayohatchi`. Placeholders retain their original names. Pagination accessibility labels are translated. Action notices keep translation keys so visible feedback follows a later language change. Unknown server error text falls back to a localized safe message; existing known authorization/conflict/network/form messages retain their translated explanations.

Scoped Uzbek CSS gives the selector sufficient width, allows navigation/account text to wrap, and lets calendar input labels expand instead of clipping. Existing animations, Swiper behavior, layouts and responsive breakpoints are retained. Native Chrome inspection covered the homepage at desktop size and emulated iPhone 16, 393 × 852. This is not a physical-device or complete interactive layout matrix.

## AI language context and compatibility

The existing `AiChatInput` gains optional `locale: en | kr | ru | uz`, validated by the backend. Calls without the field remain valid. The frontend sends the selected language with the existing message/history/search/intent context; stored conversation text is untouched. Retries retain the original request's locale and context. The current Gemini provider gets fixed language guidance, including **Uzbek Latin, never Cyrillic**, and permits an explicit user request for another language. Uzbek search/intent/detail keywords extend existing bounded retrieval. No separate AI service or additional model call was introduced. Nestar has no corresponding AI implementation.

Username/password, Google/Kakao enabled-provider handling, account security and session regressions pass in the existing component tests. This report does **not** claim new live Google/Kakao/Telegram authentication or real Gemini response acceptance. The isolated browser origin on port 3011 is outside the existing backend allowlist and its refresh preflight is rejected; this setting was preserved. Live authenticated browser work therefore needs the configured deployment/development origin and appropriate disposable fixtures.

## SEO readiness

`_document.tsx` renders the active document language from Next's page data; Korean maps to `ko`. `_app.tsx` updates it after client locale transitions. Existing supported layout titles/descriptions are localized; a universal English document description was removed in favor of those page-level descriptions. Titles use a single string to avoid React title-markup warnings. Locale-aware routes support future hreflang/sitemap work. No fabricated dynamic translations, nonexistent routes or new multilingual SEO subsystem were added.

## Terminology glossary

| Interface term | Uzbek |
| --- | --- |
| Home | Bosh sahifa |
| Tours / Travel agent | Sayohatlar / Sayohat agenti |
| Community / Help Center | Hamjamiyat / Yordam markazi |
| Profile / Settings | Profil / Sozlamalar |
| Login / Register / Logout | Kirish / Ro‘yxatdan o‘tish / Chiqish |
| Booking / Favorites | Band qilish / Sevimlilar |
| Reviews / Comments | Sharhlar / Izohlar |
| Messages / Shared chat | Xabarlar / Umumiy chat |
| Search / Save | Qidirish / Saqlash |
| Cancel / Delete / Edit | Bekor qilish / O‘chirish / Tahrirlash |
| Price / Location / Duration | Narx / Joylashuv / Davomiyligi |
| Pending / Confirmed | Kutilmoqda / Tasdiqlangan |
| Security / Recovery code | Xavfsizlik / Tiklash kodi |

Uzbek O‘/G‘ and punctuation use consistent Unicode Latin text. Entity IDs, enum values and API field names are unchanged; only their display labels are translated.

## Automated audit and actual validation

Run `yarn audit:i18n`; append `--report <path>` for JSON evidence. The same audit runs in the frontend test suite. It detects duplicate JSON keys before parsing, missing/empty/invalid entries, nested structure drift, interpolation changes, Cyrillic Uzbek and unexpected identical English values, with a small documented allowlist for shared proper names. It compares current English/Korean/Russian values with their Git baseline and scans literal/conditional `t()` calls. Dynamic keys are listed for review rather than falsely claimed as statically proven. This is the development/testing missing-key detection mechanism; it creates no production logging noise.

- [Translation audit](uzbek-translation-audit.json): 1,027 English, 1,027 Korean, 1,043 Russian and 1,043 Uzbek keys; original values preserved; zero audit errors. Dynamic calls include existing enum, table, error and content-mapping lookups and must remain part of context review as the app evolves.
- Frontend `yarn typecheck` passed after implementation phases and final changes.
- Final full `yarn test`: **143 passed, zero failures/skips**. New checks cover dictionary validation failures, actual i18next fallback/plurals/four-language transitions, SSR resources, regional formatting, Uzbek stored history, current-route/query/hash switching, cookie rollback, callback routing, localized action feedback/private errors, and AI context/history/retry behavior.
- `yarn validate:contracts`: **63 GraphQL documents, 16 Variables fixtures, zero errors**, including the new Uzbek AI input.
- Focused non-fixing frontend ESLint passed. The Next 12 lint plugin incorrectly rejects Next 14 root middleware; that one import has a documented narrow suppression. No dependency was upgraded. Prettier's already recorded ignored `extends` warning remains.
- Backend non-writing typecheck, focused non-fixing lint and **26 AI unit tests across two suites** passed after formatting. Provider calls are mocked. No new whole-backend/MongoDB integration test or saved Postman response is claimed.
- [SSR route checks](uzbek-ssr-validation.json): **88 passed locale/page combinations** (22 actual routes × four languages), verifying HTTP success, document language and complete translation resources; **three cookie-preference redirects passed**. These read-only HTTP checks do not establish authenticated page lifecycle behavior or real data-loaded UI coverage.
- Native Chrome showed Uzbek homepage hero, navigation, search, seasonal events, footer and localized session-error/loading states at desktop and emulated mobile sizes. The existing MUI picker InputAdornment hydration class warning was observed; it was already documented before this task. Native interaction limitations and the temporary-origin restriction prevented a complete interactive browser acceptance matrix.
- Frontend/backend diff whitespace checks passed. Development records and the user's existing servers were preserved. No Git commit was created.

## Manual release verification and remaining limits

Restart the existing development frontend so its cached translation loader reads the new Uzbek file; restart/reload the backend if its active schema has not picked up the optional AI field. This task used a separately started temporary frontend and did not stop the user's servers. Next ignored the requested `/private/tmp` build-directory override and reported webpack cache warnings referencing the project's shared `.next` cache; that cache was left intact. This was therefore not a fully isolated build-artifact run. The task-owned server on port 3011 was stopped and no listener remained there. The review tab was left alone when the user changed the active Chrome window.

On the configured origin, select O‘zbekcha from a filtered tour/detail route; confirm route/query/hash, account identity and position remain. Navigate and refresh, then exercise English → Uzbek → Korean → Russian → English. Verify Home/logo/Back restoration from each homepage section, desktop/mobile calendar labels, long buttons/table headings, and pricing currency. Use disposable ACTIVE USER/AGENT/ADMIN fixtures to check account/security/provider callbacks, favorites/follows, bookings/reviews, community/editor/chat/AI, and admin controls. User-generated English or other-language content should remain original. No new notifications page or managed event-registration feature is expected.

Live provider/OAuth/SMTP acceptance, physical devices, Safari/Firefox, production hosting/build and every authenticated page/state were not verified in this task. There is complete dictionary-key coverage; this report does not claim every possible dynamic key or real account workflow was manually visited. Editorially localized database content remains separate work. English-only security emails retain their existing behavior under the request's conditional email scope.

## Postman recipe for the additive AI input

This is a manual recipe, not a live response/example. Use a dedicated test server on a free port, e.g. **POST `http://localhost:3008/graphql`**, attached to a uniquely named disposable database. Provision disposable ACTIVE USER/AGENT/ADMIN accounts and login tokens through the existing auth setup; signup cannot provision ADMIN. If checking catalogue sources, create/approve a disposable tour using the existing lifecycle. Configure the existing provider or a clearly identified provider mock; tests here used mocks. Never change development accounts/tours/counters or publish real-provider tokens in examples.

Set Authorization to Bearer Token with a fixture's valid access token. Use this exact operation:

```graphql
mutation LocalizedAi($input: AiChatInput!) {
  aiChat(input: $input) {
    text
    sources {
      tourId
      title
      destination
      price
      durationDays
      rating
      reviewCount
      status
    }
  }
}
```

Exact Variables:

```json
{"input":{"message":"Sayohat topishga yordam bering.","locale":"uz","intent":"FIND_TOURS"}}
```

Expect a successful GraphQL response with `data.aiChat.text` and public `sources`, no errors. With a real provider the answer should normally use Uzbek Latin. Repeat with `"message":"Please answer in English about travel."` and `"locale":"uz"`; the explicit language request should win. Remove `locale` and verify the existing caller contract still succeeds. Repeat under all three ACTIVE roles. Quota/parallel limits remain existing behavior; avoid rapid loops or extra model calls.

Set `"locale":"unsupported"` or pass an object instead of a String: expect GraphQL/input-validation rejection, no successful `data.aiChat` and no provider work. Invalid string locale is rejected by `IsIn`; a non-string is rejected by GraphQL coercion. Unit and schema validation confirm the rejection mechanism; exact transport envelopes for invalid locale were not live-captured. Missing/expired/stale tokens reject with `UNAUTHENTICATED`; unavailable accounts reject with `FORBIDDEN`; provider absence/failure uses `AI_UNAVAILABLE`; quota uses `AI_RATE_LIMITED`, with existing public messages. Do not interpret HTTP 200 alone as GraphQL success.

After testing, stop only your test server, clear fixture IDs/tokens, and drop only the exact verified disposable database, which removes fixture tours/usage leases/counters together. No development data cleanup is needed or authorized.

## Suggested commits

- Frontend: `feat(i18n): add complete Uzbek interface support`
- Backend: `feat(ai): support Uzbek locale context and retrieval`

Next proposed backend task: verify deployment HTTPS origins/cookie topology and perform live provider acceptance on the configured origin, under separately agreed scope.

## Exact file manifest

### Frontend files created

- `docs/uzbek-localization.md`
- `docs/uzbek-ssr-validation.json`
- `docs/uzbek-translation-audit.json`
- `libs/triplink/locale.ts`
- `middleware.ts`
- `public/locales/uz/common.json`
- `scripts/audit-translations.cjs`
- `tests/locale-switching.test.cjs`
- `tests/localization.test.cjs`

### Frontend files modified

- `libs/components/AiAssistant.tsx`
- `libs/components/Chat.tsx`
- `libs/components/Top.tsx`
- `libs/components/admin/cs/HelpCenterManager.tsx`
- `libs/components/cs/Notice.tsx`
- `libs/components/homepage/HomeArticles.tsx`
- `libs/components/homepage/HomeSearchForm.tsx`
- `libs/components/homepage/HomeSections.tsx`
- `libs/components/layout/LayoutAdmin.tsx`
- `libs/components/layout/LayoutBasic.tsx`
- `libs/components/layout/LayoutFull.tsx`
- `libs/components/layout/LayoutHome.tsx`
- `libs/components/triplink/ActiveSessions.tsx`
- `libs/components/triplink/AdminMembers.tsx`
- `libs/components/triplink/Bookings.tsx`
- `libs/components/triplink/Common.tsx`
- `libs/components/triplink/Community.tsx`
- `libs/components/triplink/Members.tsx`
- `libs/components/triplink/Profiles.tsx`
- `libs/components/triplink/ProviderButtons.tsx`
- `libs/components/triplink/Reviews.tsx`
- `libs/components/triplink/SecuritySettings.tsx`
- `libs/components/triplink/Session.tsx`
- `libs/components/triplink/SocialAccount.tsx`
- `libs/components/triplink/TourDetail.tsx`
- `libs/components/triplink/TourSearch.tsx`
- `libs/components/triplink/Tours.tsx`
- `libs/triplink/browsingMemoryStore.ts`
- `libs/types/triplink/ai.ts`
- `next-i18next.config.js`
- `package.json`
- `pages/_app.tsx`
- `pages/_document.tsx`
- `public/locales/en/common.json`
- `public/locales/kr/common.json`
- `public/locales/ru/common.json`
- `scripts/contract-fixtures.cjs`
- `scss/triplink.scss`
- `tests/ai-assistant.test.cjs`
- `tests/help-center.test.cjs`

### Backend files modified

- `apps/trip-link/src/libs/dto/ai/ai-chat.input.ts`
- `apps/trip-link/src/components/ai/ai.service.ts`
- `apps/trip-link/src/components/ai/ai.service.spec.ts`
- `apps/trip-link/src/components/ai/gemini.provider.ts`
- `apps/trip-link/src/components/ai/gemini.provider.spec.ts`
- `docs/COMPLETED_TASKS.md`

The completion log was appended; its pre-existing uncommitted entries were retained.
