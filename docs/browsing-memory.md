# TripLink browsing memory implementation — 2026-10-14

The unified restoration correction in section K supersedes the initial fallback order and request handling described below.

Implemented the approved plan for the homepage, `/tour`, `/agent`, `/community`, and their existing detail routes. Pages Router, routes, GraphQL/Apollo, design, animations and existing URL filter formats are preserved. No dependency, backend API, schema or database change was made. No commit was created.

## A. Root cause

Home and logo links performed fresh navigations, which used Next.js's normal scroll-to-top behavior. Pages remounted with local search, pagination and carousel defaults. Asynchronous queries, images, fonts and responsive wrappers could subsequently change document height, making a one-time raw-coordinate restoration inaccurate.

Source inspection preceded implementation, including both AGENTS files, backend acceptance and the corresponding Nestar navigation/components. The shared coordinator is TripLink-specific; it is not a copied Nestar feature or a route migration.

## B. Exact changed files

| Files | Change |
| --- | --- |
| `libs/triplink/browsingMemoryStore.ts` (new) | Typed entries, tab persistence, expiry, position capture and bounded restoration lifecycle. |
| `libs/triplink/BrowsingMemoryProvider.tsx` (new) | Pages Router coordination, remembered-state hook, Home navigation and shared detail return link. |
| `pages/_app.tsx` | Mount one persistent provider. |
| `libs/components/Top.tsx` | Connect desktop/mobile Home and brand navigation. |
| `libs/components/homepage/HeaderFilter.tsx` | Remember hero slide and playing choice; hero marker. |
| `libs/components/homepage/HomeSearchForm.tsx` | Remember text, date and traveler inputs. |
| `libs/components/homepage/HomeSections.tsx` | Remember season; stable section-qualified tour and agent markers. |
| `libs/components/homepage/HomeArticles.tsx` | Stable article markers. |
| `libs/components/homepage/IntroGallery.tsx` | Remember and synchronize the existing Swiper position. |
| `libs/components/homepage/IntroCircularCarousel.tsx` | Remember carousel position and playing choice. |
| `libs/components/homepage/IntroMedia.tsx` | Remember the explicit video pause choice. |
| `libs/components/triplink/Common.tsx`, `TourSearch.tsx` | Query and hydration readiness markers. |
| `libs/components/triplink/Tours.tsx` | Listing/card markers and gallery selection by tour/image identity. |
| `libs/components/triplink/Profiles.tsx` | Agent search/page memory, markers and profile return link. |
| `libs/components/triplink/Community.tsx` | Public category/page memory, cached public results while refreshing, article return link. Admin/owner query policies retained. |
| `libs/components/triplink/TourDetail.tsx` | Shared source-aware return link. |
| `libs/auth/index.ts` | Complete Apollo cache clearing before exposing anonymous query readiness; protect newer sign-ins from stale cleanup. |
| `public/locales/en/common.json`, `public/locales/kr/common.json`, `public/locales/ru/common.json` | Translated homepage return label. |
| `tests/navigation-memory.test.cjs` (new) | Store, provider, real component/query-variable and restoration behavior tests. |
| `tests/auth-public-readiness.test.cjs` (new) | Deferred cache cleanup, concurrency, newer login and error behavior. |
| `tests/helpers/browsing-memory.cjs` (new) | Load the real provider/store in existing component harnesses. |
| `tests/agents-directory.test.cjs`, `tests/article-editor.test.cjs`, `tests/community-cards.test.cjs`, `tests/community-detail.test.cjs`, `tests/home-agents.test.cjs`, `tests/home-featured.test.cjs`, `tests/home-rated.test.cjs`, `tests/profile-connections.test.cjs`, `tests/tour-card-gallery.test.cjs` | Integrate real shared hooks and preserve existing component coverage. Profile harness now renders hooks through React. |
| `docs/browsing-memory.md` (new) | This implementation and verification report. |

The only backend-repository change is an append to `/Users/a1234/Developer/trip-link/docs/COMPLETED_TASKS.md`.

## C. Restoration strategy

Each actual browser-history entry receives `triplinkBrowsingEntry`, merged into existing `history.state` without removing Next.js fields. Stamping uses `replaceState`; it does not add restoration-only history entries. Route and locale identity includes canonical query parameters. Fresh visits get distinct entries, even for an identical URL.

Active snapshots live in memory. Versioned tab-scoped `sessionStorage` snapshots are written on navigation/document hiding, retained for 30 minutes and bounded to 50 entries. Storage denial and malformed/expired data degrade safely. Snapshots contain public route/query, viewport, scroll, item/section offsets, source lineage and supported UI primitives; they contain no account data, tokens or API results.

State is available for the returning component's first render/query. Initial server and hydration rendering use consistent defaults, followed by client initialization. Apollo remains the result cache. Tour filters, sorting and pagination keep their existing URL representation. Gallery state uses stable tour and image identities rather than result-array positions. Responsive component remounts share the same entry state.

Restore item offset first, section offset second and clamped coordinates last. Repeated visits retain the original visible anchor instead of capturing a clipped preceding row. On materially resized viewports, keep the target below the measured fixed navbar. When the viewport is unchanged, preserve intentional partial clipping and partially scrolled hero positions.

## D. Browser Back and Forward

Known, valid history entries restore their own UI and position. Identical URLs have independent histories. Locale changes participate in identity, including Back to the default locale when the visible `asPath` remains `/`.

Existing detail return links call `router.back()` when the immediately preceding entry is their saved source. Otherwise they navigate to the saved source with restoration. Without a valid source, the existing listing fallback remains. A homepage source displays the translated “Back to home” label.

Modified/new-tab clicks, hash links and fresh route navigation retain ordinary browser/framework behavior. Reload restores supported UI but leaves scroll to the browser. Back-forward-cache resume retains native behavior. An old stored homepage context is not adopted by a direct visit or a new tab.

## E. Navbar Home

Home returns to the valid homepage context in the current public browsing chain. Visiting account, workspace, admin, Help Center, About or other unrelated routes ends this explicit return context. Expired context uses normal navigation. Clicking Home while already on the homepage scrolls to the top and updates its remembered position.

## F. TripLink logo

The logo uses the same shared behavior as Home, including valid-context restoration, fresh-navigation fallback and homepage scroll-to-top. Navbar markup, styling and mobile drawer behavior remain intact.

## G. Dynamic content and cancellation

Client layout effects start promptly with cached results. Scoped mutation/resize observers, query readiness markers, image loads and font readiness schedule corrections while relevant layout remains unsettled. The coordinator settles after a reachable stable target; a short stability debounce is not a fixed-delay restoration trigger. Five seconds is the absolute maximum lifetime.

Missing/deleted anchors, empty results and errors finish through the fallback sequence. Wheel, touch, scroll-navigation keys, pointer interaction, route changes and failures cancel work. Input cancellation is active during navigation, before destination commit. Late errors from an older route cannot cancel a newer restoration. Observers, animation frames, timers, listeners and temporary scroll ownership are released on finish/cancel/unmount, including Strict Mode.

Native/Next scroll handling is suppressed only during a valid coordinated restore; experimental Next.js restoration stays disabled. There is no permanent scroll lock, global polling loop or per-scroll React update.

Browser verification also exposed an existing anonymous readiness race: public queries could begin while `clearStore()` was still clearing Apollo and remain loading. Session cleanup now clears local identity immediately, waits for Apollo cleanup, and only then exposes anonymous readiness. A newer login takes precedence over stale cleanup. Focused regression coverage and anonymous browser checks passed.

## H. Executed checks and browser evidence

| Check | Result |
| --- | --- |
| `yarn typecheck` after implementation phases and final source edits | Passed. |
| Focused `yarn lint --file ...` over changed TypeScript/TSX sources, without fixing | Passed, zero errors/warnings. |
| Focused Node/React/JSDOM behavior tests | Passed. |
| Final `yarn test` | 126 passed; zero failures, cancellations or skips. |
| `yarn build` in an isolated source copy | Passed; 74 static pages generated. Existing dev `.next` was preserved. |
| Frontend/backend `git diff --check` | Passed. |
| Isolated Playwright/system Chrome | 39 main cases plus 2 edge cases passed. |

Behavior coverage includes entry separation, source return, TTL/cap/invalid storage, fresh visits, denied storage, delayed readiness, missing anchors, cancellation, viewport changes and Strict Mode cleanup. Real AgentDirectory rendering verifies restored search/page are present in the first returning query variables. Existing component suites continue to exercise public/owner behavior and gallery selection.

Chrome cases cover Back/Forward, Home/logo, explicit returns and repeat Home at 1440, 1280, 768 and 390px; desktop-to-mobile return; cold delayed results after detail reload; real homepage input/hero pause/Swiper/circular state; tour URL filters/page/gallery; agent search/page and community page; repeated different items; independent tabs; authenticated USER and anonymous browsing; wheel interruption during loading; locale Back and partially scrolled hero return. No page errors or horizontal overflow were reported. Largest measured anchor drift: **0.078125px**, below the approximately 24px criterion. Desktop/mobile screenshots were visually reviewed.

Native Chrome controls failed with `noWindowsAvailable`/`elementHasNoFrame`; the user explicitly authorized Playwright. Browser GraphQL/auth/chat fixtures were mocked, with mutation rejection. No development account, data, view counter, favorite/follow mutation or chat message was changed. Test-owned browser contexts/processes closed; existing servers were preserved.

Local evidence:

- `/private/tmp/triplink-scroll-captures/report.json` — final 39-case matrix.
- `/private/tmp/triplink-scroll-captures/edge-report.json` — final locale/hero cases.
- `/private/tmp/triplink-scroll-captures/` — desktop/mobile and resize screenshots.
- `/private/tmp/triplink-scroll-qa.cjs` — isolated browser fixture/check script.
- `/private/tmp/triplink-browsing-tests.log` — final full-suite output.
- `/private/tmp/triplink-scroll-build.log` — production build output.
- `/private/tmp/triplink-scroll-build-mvf13yt_` — isolated build copy.

Temporary artifacts may be removed by the operating system. Historical intermediate failure artifacts are not the final acceptance results.

## I. Known limitations

- Browser acceptance used system Chrome with emulated viewports and mocked public/auth responses. It does not establish physical touch-device, Safari/Firefox or production/live-backend acceptance.
- Missing items, substantial content changes and the five-second bound can require fallback rather than exact card placement. Manual interaction always wins.
- Private screens and chat scroll containers are excluded. Only the existing supported public listings and their detail returns participate.
- The pre-existing MUI date-picker/InputAdornment hydration class warning remains; memory-hook SSR/hydration checks passed. Inherited page-data size and Yarn cache/Prettier configuration warnings remain. No dependency/configuration cleanup was included.
- Browser snapshots are deliberately temporary and bounded. Unsupported transient popovers, validation messages and account state are not retained.

## J. Remaining manual testing

1. On the user's normal anonymous and authenticated browser sessions, browse actual homepage/tour/agent/community results and return through Back, Home, logo and the detail link. Use authorized disposable detail fixtures when avoiding view-counter writes is required.
2. Repeat on physical mobile/tablet and Safari/Firefox, including touch interruption and browser back-forward-cache resume.
3. Verify slow real network/image/font loading, deleted items and empty/error results. Confirm no correction follows manual scrolling and navigation remains usable at the five-second bound.
4. Repeat reload, independent tabs, modified/new-tab clicks, hash navigation, expiry and Home after unrelated account/help/about navigation.

Suggested frontend commit: `feat(navigation): preserve browsing state and scroll restoration`.

Suggested backend documentation commit: `docs: record browsing memory implementation and verification`.

Next backend task suggestion, separately scoped: validate the intended production HTTPS origins, proxy and cookie/session topology before rollout. No backend implementation is included in this task.

## K. Unified homepage restoration correction — 2026-10-14

### 1. Confirmed root causes

Read-only inspection covered the homepage, navbar/logo, section/card markers, shared detail returns, storage/history, every restoration call, the Nestar frontend reference and the installed Next.js 14 router/render lifecycle. Nestar has no corresponding navigation-memory manager. TripLink already mounts one shared provider; no competing section-level restoration effects or hardcoded Best Rated fallback were found. Agent, tour and article cards already have stable identifiers.

Three failures were reproduced against the existing implementation:

- A clicked section link without its own card (such as **All agents**) could select a previously saved, still-visible Best Rated card. The section was then derived from that card: actual `home:rated`, expected `home:agents`.
- The five-second deadline always used old `entry.y`, discarding item-level correction after layout movement. A diagnostic agent at document position 4000 with a saved offset of 200 should restore to 3800, but the deadline restored outdated pixels at 2800.
- An older rejected Home request could clear a newer Logo request to the same homepage because both requests compared the same entry object. An isolated baseline-provider regression restored 0 instead of the expected Agents position at 3800. The corrected provider passes this case.

Click context was also collected only at `routeChangeStart`, rather than when the interaction occurred. It is now captured immediately so subsequent layout/scroll changes during route loading cannot change the intended origin. The new test deliberately changes scroll after the click and before routing to verify this guarantee.

A direct agent-card return passed the initial simplified read-only probe. These are confirmed mechanisms that can corrupt or override restoration, rather than a claim that the user's exact live-session failure was independently reproduced before modification. Final browser testing verifies the resulting routes with isolated fixtures.

### 2. Architecture

Keep the existing `NavigationMemoryProvider` mounted in `_app.tsx` and the existing `NavigationMemory` store. No second manager, dependency, router migration, homepage redesign or backend runtime change was introduced. Navbar Home/logo, internal card/section links, browser history and detail Back continue to use the shared coordinator.

Click capture creates a small typed snapshot tied to the current entry ID and intended destination/locale. Route start consumes it only when those identities match; otherwise it captures the current viewport normally. UI control values remain in the existing entry and Apollo remains responsible for query results. Restoration uses the existing scoped DOM/query readiness signals.

### 3. State model

| Existing entry field | Purpose |
| --- | --- |
| `id` | Identity for the actual history visit, merged into Next's history state. |
| `route`, `locale` | Canonical pathname/query and language. |
| `time` | Timestamp for the existing 30-minute expiry. |
| `x`, `y`, `width`, `height` | Captured scroll and viewport geometry. |
| `item: { key, offset }` | Stable section-qualified card identity and original viewport position. |
| `section: { key, offset }` | Actual originating section and viewport position. |
| `source`, `previous`, `home` | Entry references for detail returns, immediate Back and valid Home chains. |
| `ui` | Existing small search/season/page/gallery/carousel control values. |

The storage namespace/version, 50-entry cap and validation remain unchanged. Click snapshots, per-request intent identities and cancellation generations are transient provider refs, with no account data or API responses persisted.

### 4. Exact files changed

- `libs/triplink/browsingMemoryStore.ts`: interaction-scoped capture, section-scoped item lookup, readiness and consistent fallback/deadline behavior.
- `libs/triplink/BrowsingMemoryProvider.tsx`: immediate destination-bound capture, cancellation generations, local correction cleanup and distinct Home/Logo request identities.
- `tests/navigation-memory.test.cjs`: seven new behavioral regression tests and updated fallback-priority expectation.
- `docs/browsing-memory.md`: this correction report.
- `/Users/a1234/Developer/trip-link/docs/COMPLETED_TASKS.md`: completion-record append only.

An unrelated `_app.tsx` SCSS-import suppression edit appeared during the task and was left untouched. It is not part of this change's file manifest. No homepage/card/CSS, GraphQL/Apollo, authentication, package/configuration or lockfile source was modified by this correction.

### 5. Restoration priority

1. Find the original card inside its recorded section and preserve the saved viewport offset.
2. Otherwise use finite, nonnegative saved pixels when the viewport width remains compatible, clamping to document bounds.
3. Otherwise use the original section with appropriate fixed-navbar/responsive offsets.
4. Without any valid target, leave normal navigation positioning alone.

The deadline uses this same decision, including the current card geometry. There is no implicit Featured, Rated or Agents fallback. Section links deliberately capture a section without selecting an unrelated visible card. Original section/card identifiers retain their existing forms, such as `home:agents` / `home:agent:<id>` and `home:rated` / `rated:tour:<id>`.

### 6. Stale-state prevention

Captures are tied to the origin entry and destination. New navigation invalidates the previous correction generation; stale completion callbacks cannot release a newer correction. Effect cleanup closes its own correction rather than whichever callback happens to be stored in the shared ref. Each explicit return has its own request identity, so rejection of an older Home request cannot invalidate a later Logo request even when they target the same entry. Consumed interaction snapshots are cleared.

Existing entry-separated history, normal modified clicks, expiry, tab-scoped storage and unrelated-route context termination remain intact. Next history fields are preserved and no restoration-only history entries are created.

### 7. Async handling and manual control

Wait for the originating section and loading content above it instead of choosing another ready section or scrolling to an intermediate layout. Existing scoped mutation/resize, image-load, font-ready and animation-frame signals trigger attempts. A stability debounce releases ownership once content is ready; the five-second lifetime remains bounded and now preserves target priority. No polling or permanent observer was added.

Wheel, touch, pointer, scroll-navigation keys, route changes and failures cancel correction and queued work. All timers/observers/listeners are cleaned up, with existing Strict Mode and hydration regression coverage retained. The delayed Agents and manual wheel cases were executed in Chrome with cold homepage queries after detail reload.

### 8. Navigation and existing browsing state

Browser Back/Forward, Home, logo and explicit detail Back were exercised for Featured, Best Rated, Agents, Top Tours and Articles at desktop/mobile widths. Successive Featured → Agents and Best Rated → Agents returns restore the latest Agents context. Section-only All agents returns were also exercised. Fresh visits and Home after About use normal starting positions. Independent tabs retain distinct sections and offsets.

Events are existing external official-site links opening a new tab; TripLink has no Event detail page. Tests open a mocked official-site popup, close it and verify the original homepage position and selected season remain unchanged at desktop/mobile widths. No Event route or new section was invented. Existing homepage forms, Swiper/circular controls, catalog filters/gallery selection, agent search/page and community page remain covered by the regression browser script and component suite.

### 9. Executed validation

- Yarn non-writing typecheck passed after the source phases and final request-identity change.
- Focused non-fixing ESLint passed with zero warnings/errors.
- Final `yarn test`: **133 passed**, zero failures/cancellations/skips; navigation suite: **27 passed**.
- The section-capture and deadline read-only probes failed before correction. The old-provider same-homepage request test also failed as expected; corrected regressions passed. These diagnostics did not modify repository files.
- Final isolated system-Chrome matrix: **74 checks passed**, covering all internal homepage sections at 1440/390px, Back/Forward/Home/logo/explicit returns, latest-section chains, section links, cold Agents, wheel cancellation, tabs, fresh/unrelated visits and external Events. Maximum item-offset drift is recorded in the JSON evidence. No page errors or tested horizontal overflow were reported; desktop/mobile Agents screenshots were inspected.
- Existing browsing regression browser script: **39 checks passed** at 1440/1280/768/390px, including remembered forms/carousels, catalog gallery/filter state, listing controls, viewport changes, delayed queries and authenticated USER fixture navigation.
- Frontend and backend-documentation diff whitespace checks passed.

Browser scripts and evidence live only in `/private/tmp/triplink-unified-scroll-qa.cjs`, `/private/tmp/triplink-unified-scroll-captures/`, `/private/tmp/triplink-unified-scroll-regression-qa.cjs` and `/private/tmp/triplink-unified-scroll-regression-captures/`. API/auth/chat/official-event responses were mocked and GraphQL mutations rejected. Development records, tokens, accounts and view counters were not used or changed; existing servers and the user's browser session were left running, and task-owned browser processes closed. The initial sandboxed Chrome launch failed; the approved unsandboxed isolated launch succeeded. Existing Yarn cache/global-folder and Prettier-config warnings were unrelated to the passing checks.

### 10. Limits and manual follow-up

- Chrome used emulated desktop/mobile viewports. Physical touch devices, Safari/Firefox, real network conditions and the user's exact authenticated browsing sequence still need manual verification.
- A missing/deleted card, incompatible viewport or five-second loading deadline can require fallback. Already incorrect snapshots saved before this correction cannot reveal the lost origin; newly captured navigation replaces them without discarding working browsing state globally.
- Tests establish frontend navigation behavior with mocked data, not live backend/provider/Postman acceptance. No backend runtime suite or production build was required or claimed for this frontend-only correction.

Suggested frontend commit: `fix(navigation): preserve the latest homepage origin during restoration`.

Suggested backend documentation commit: `docs: record unified homepage restoration correction`.
