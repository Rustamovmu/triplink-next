# TripLink browsing memory implementation — 2026-10-14

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
