# TripLink local authentication verification

Date: 2026-10-14 (Asia/Seoul). Scope: username/password, Google and Kakao on localhost. No deployment or production configuration change. Telegram OAuth was neither activated nor exercised.

## 1. Authentication status

| Capability | Status | Evidence |
| --- | --- | --- |
| Google signup | PASS | Genuine provider authorization completed by the user; username onboarding, authenticated Security page and MongoDB records verified |
| Google login | PASS | Genuine repeat authorization after logout; same member, username, role, profile and permanent provider subject; no duplicate |
| Kakao signup | PASS | Genuine provider authorization completed by the user; onboarding and authenticated Security page; no generated password |
| Kakao login | PASS | Genuine repeat authorization after logout; user confirmed the same username; browser and MongoDB independently confirmed the restored account |
| Username/password | PASS | Real HTTP/MongoDB integration; registration, login, incorrect/nonexistent credentials, duplicate username, password hashing and legacy bcrypt migration |
| Refresh tokens | PASS | Real browser Kakao reload changed the stored refresh hash without changing that session's absolute deadline; automated rotation, reuse, revocation and expiration checks |
| Account linking | PASS (automated) | Real HTTP/MongoDB with mocked provider exchange; both providers resolve to the original member; foreign ownership, email conflict and final-method removal rejected |
| Logout | PASS | Both real provider sessions revoked on browser logout; authenticated access rejected in automated tests; anonymous protected-page state verified in browser |
| Telegram | DISABLED | Existing TELEGRAM_ENABLED=false flag; absent from advertised providers and login/signup controls; implementation and identities preserved |

Account linking/unlinking was not performed with the user's real provider identities. Negative provider cases and controlled-clock expiration tests are automated evidence, not real provider failures. Username/password was tested through real HTTP integration, not a separate manual browser signup. These distinctions apply to every PASS above.

## 2. Frontend

The actual running frontend is **http://localhost:3000**, using Next.js 14.2.0 Pages Router, React, TypeScript and Apollo. Existing REACT_APP_API_URL, REACT_APP_API_GRAPHQL_URL and REACT_APP_API_WS are explicitly exposed by next.config.js, so no NEXT_PUBLIC_ rename was needed. Their existing defaults target localhost:3007.

Login and signup share /account/join, with a Register toggle. Both show working Google and Kakao buttons and omit Telegram. /account/onboarding collects a unique TripLink username; /account/complete exchanges a one-use browser handoff for the usual TripLink session. The user completed both genuine provider sign-ins and onboarding. Protected account settings use /mypage?category=security; supported workspace sections include profile, bookings, reviews, favorites and connections.

The protected-page "Login to continue" link previously lost its destination. It now carries a validated referrer. Browser inspection confirmed the corrected link, and the component/API tests verified preservation of the destination and rejection of unsafe return paths. The initial provider signups returned to the requested Security page. During repeat-login observation the user returned to the homepage, so the corrected protected-link round trip is not separately claimed as fully browser-verified.

Access credentials stay in memory; session restoration hydrates the current member through authenticated GraphQL. The real Kakao page reload restored authenticated settings and rotated refresh credentials. The Google-authenticated settings also remained accessible after a browser reload. Current-device logout removes access and private state.

## 3. Backend

The actual running backend is **http://localhost:3007**. Bootstrap has no global route prefix. Confirmed routes/configured callbacks:

- POST /auth/oauth/google/start; GET http://localhost:3007/auth/oauth/google/callback.
- POST /auth/oauth/kakao/start; GET http://localhost:3007/auth/oauth/kakao/callback.
- POST /auth/social/finish; GET/POST /auth/social/onboarding.
- GraphQL POST /graphql for username signup/login and getCurrentMember.
- POST /auth/refresh, /auth/logout and /auth/logout-all; GET /auth/sessions; owned session DELETE controls.
- GET /auth/security; POST /auth/security/reauthenticate; DELETE /auth/identities/:provider.

AuthModule, controllers, provider exchange, TokenService, AuthSessionService, MemberService, schemas, guards, rate limiting and cookie/CORS configuration were inspected. The Nestar auth/layout reference was also inspected; it has no corresponding OIDC identity/session implementation. TripLink's existing architecture was retained.

Access lifetime is 900 seconds, refresh expiry slides seven days, and each session has a fixed thirty-day deadline. Rotation and reuse detection are shared by password and social authentication. FRONTEND_ORIGINS and AUTH_FRONTEND_URL currently use their allowed localhost:3000 defaults. Public GraphQL and provider-list requests succeeded from the frontend origin with credentialed CORS. The final live provider list is exactly GOOGLE and KAKAO. Existing servers were restarted by the user; the agent did not stop them.

## 4. Database

Read-only verification of the two authorized live development accounts confirmed:

- One member per selected username, USER role, no generated local password, and one permanent provider identity each.
- Repeat login preserved member ID, username, role, profile and provider subject; no duplicate member/identity records.
- Session credentials are SHA-256 hashes at rest, not raw refresh tokens. Session deadlines are thirty days from creation and sliding expiry stays within that deadline.
- Real Kakao reload changed the refresh hash while preserving its existing absolute deadline. A later fresh login correctly created a separate new session with its own deadline.
- Both browser logout operations revoked their current sessions without deleting members or identity mappings.

The genuine provider accounts created by the user were retained. No pre-existing member was renamed, merged, disabled, deleted or otherwise altered for testing. Automated fixtures used exact-name-guarded disposable databases; the new local-provider suite removes only its fixture documents and does not drop a database or collection. Existing suites use their guarded disposable-database cleanup. No development database or collection was dropped/reset, and no migration was executed.

## 5. Security

The existing adapter uses state bound to an HttpOnly browser cookie, one-use transactions, nonce, S256 PKCE, server-side code exchange, RS256/JWKS verification, issuer/audience/expiry/issued-at checks and permanent sub identifiers. Matching email does not merge accounts. New social accounts complete unique-username onboarding without mandatory password, email, phone or SMS. Both real providers reached successful TripLink session creation through that existing validation path.

The refresh cookie is HttpOnly, host-only and scoped to /auth, with SameSite=Lax locally. Production always requires Secure cookies; this was not weakened. Origin allowlisting plus X-TripLink-Auth protect browser auth requests, and cross-origin requests include credentials. Provider access/refresh tokens are discarded after identity verification. Credentials were not placed in frontend storage, reports or callback redirect URLs.

Sensitive linking/unlinking requires recent authentication. Tests verify final-method protection, ownership, suspended-account rejection, current role/status validation, fixed absolute session expiry and refresh reuse revocation. Controlled clocks exercised days 5, 11, 17, 23 and 29, then rejection at day 30. A refresh exactly at its seven-day expiry is already expired; tests intentionally refresh before that boundary.

Kakao's current [OIDC discovery](https://kauth.kakao.com/.well-known/openid-configuration) advertises RS256 and S256. The [Kakao login documentation](https://developers.kakao.com/docs/en/kakaologin/rest-api) and [Google OIDC documentation](https://developers.google.com/identity/openid-connect/openid-connect) were checked against the existing implementation.

## 6. Issues found

1. Google and Kakao were disabled because their existing enable flags were absent; the live provider list was empty.
2. The confirmed Kakao REST API key was stored as KAKAO_CLIENT_ID, but the adapter reads KAKAO_REST_API_KEY.
3. The protected-page login link discarded the return destination.
4. The existing refresh-lifetime test used the wall clock after session creation and intermittently differed by one second.
5. Focused lint of the existing security test harness exposed a hook function named action; it was renamed useAction while preserving the harness API.

The first sandboxed MongoDB test attempt failed at DNS access; the network-enabled rerun reached the real database. Initial new test assertions incorrectly treated an unused legitimate state as a replay, and the enlarged suite exhausted its shared fixture rate-limit bucket. Those test setup/expectation issues were corrected; application state validation and rate limits were not weakened. Browser automation encountered delayed rendering and a transient capture error; the user's browser completion plus database checks established the genuine outcomes.

## 7. Fixes applied

Only this task's changes are listed; both repositories already contained uncommitted work.

| Repository/file | Change |
| --- | --- |
| Backend .env (ignored) | GOOGLE_ENABLED=true, KAKAO_ENABLED=true, TELEGRAM_ENABLED=false; renamed the user-confirmed Kakao REST key setting without changing its value |
| Frontend libs/components/triplink/Session.tsx | Validated current path passed to the existing login return mechanism |
| Frontend tests/security-auth.test.cjs | Protected-return/role regression; parameterized provider-button checks for Google and Kakao; corrected test-hook name |
| Backend apps/trip-link/test/refresh-session.e2e-spec.ts | Anchored controlled time to stored issuance/expiry, removing the one-second race |
| Backend apps/trip-link/test/local-provider.e2e-spec.ts | New eighteen-test Google/Kakao acceptance suite with isolated fixtures, duplicate races, linkage, callback rejection and controlled lifetime checks |
| Frontend docs/local-auth-verification.md | This ten-part report |
| Backend docs/COMPLETED_TASKS.md | Appended local acceptance results and limitations |

No credentials were fabricated or changed, provider-console settings altered, dependency added, backend runtime API/schema changed, production infrastructure changed or Git commit created.

## 8. Tests executed

Final distinct passing coverage: **99 frontend tests + 44 backend unit tests + 62 API integration tests = 205 tests**. This is a scoped acceptance run, not every configured backend/batch/SMTP/Telegram suite.

Frontend commands (from tripLInk-next):

```sh
yarn typecheck
yarn lint --file libs/components/triplink/Session.tsx --file tests/security-auth.test.cjs
yarn validate:contracts
yarn node --test --test-name-pattern='protected login links|signup requires|only enabled|reauthentication-required|safe return paths' tests/security-auth.test.cjs
```

All passed: lint had zero warnings/errors; contracts validated 63 documents and 15 variable fixtures with zero errors; the filtered security command passed six tests. All other tests/*.test.cjs files were run through `yarn node --test` as an explicit file list excluding security-auth.test.cjs: 93 passed. The six remaining security scenarios containing Telegram fixtures were not executed.

`yarn build` passed with the final Session.tsx in an isolated /private/tmp copy using the installed dependencies. This kept build output away from the running development server. It compiled and generated all 74 static pages; existing approximately-128-kB page-data warnings remained. No deployment followed.

Backend commands (from trip-link):

```sh
./node_modules/.bin/tsc --noEmit --incremental false
./node_modules/.bin/eslint apps/trip-link/test/local-provider.e2e-spec.ts apps/trip-link/test/refresh-session.e2e-spec.ts
./node_modules/.bin/jest --runInBand --no-cache --silent --runTestsByPath apps/trip-link/src/components/auth/auth.service.spec.ts apps/trip-link/src/components/auth/token.service.spec.ts apps/trip-link/src/components/auth/account-policy.spec.ts apps/trip-link/src/components/auth/oidc-provider.service.spec.ts --testNamePattern='^(?!.*(?:TELEGRAM|missing email/profile)).*$'
node -r dotenv/config ./node_modules/jest/bin/jest.js --config apps/trip-link/test/jest-e2e.json --runInBand --no-cache --silent --runTestsByPath apps/trip-link/test/local-provider.e2e-spec.ts apps/trip-link/test/refresh-session.e2e-spec.ts apps/trip-link/test/auth.e2e-spec.ts
node -r dotenv/config ./node_modules/jest/bin/jest.js --config apps/trip-link/test/jest-e2e.json --runInBand --no-cache --silent --runTestsByPath apps/trip-link/test/account-security.e2e-spec.ts --testNamePattern='requires explicit linking on email conflicts|preserves a linked ADMIN|binds state|handles provider cancellation|authenticates a grandfathered|links to the initiating member only|rejects linking without authentication'
```

Typecheck and focused lint passed. Unit command: 44 passed, three excluded. API files were executed in separate scoped runs: local providers 18, refresh sessions 17 and auth/role checks 20 passed. The filtered account-security run passed seven tests and excluded twenty. The combined API command above is the equivalent reproduction of those individually passing scopes. Provider token tests use offline signed RSA tokens/local JWKS; social API exchange is mocked. Real browser Google/Kakao evidence is independent of those mocks. Whitespace diff checks passed in both repositories. No Postman collection or saved live example was created.

## 9. Required manual actions

No additional provider-console correction was required for the two successful local flows. Their exact localhost callbacks, configured credentials and code exchange worked. The agent did not inspect/change the consoles' audience/publishing settings.

For an additional account, use http://localhost:3000/account/join. Choose Google or Kakao, complete personal authorization yourself, select a unique username for a new identity, then reload, logout and sign in again. Report only the provider, visible error text/code, destination path, and whether the same username returned; never send passwords, tokens or secrets.

For separate live linking acceptance, use an authorized development test member at /mypage?category=security, reauthenticate if requested, and connect an identity that is not already owned by another TripLink member. Then logout and sign in through the newly linked method; the original member/profile must remain. Disconnect only while another usable login method remains. The automated suite covers both Google and Kakao, ownership rejection and last-method protection; a real linking/unlinking run remains unperformed.

Google console expectations: Web application OAuth client, exact callback above and only openid/email/profile. Google's current [app-audience guidance](https://support.google.com/cloud/answer/15549945?hl=en) gives basic identity scopes an exception to the usual Testing-mode test-user restriction; additional scopes or organization policy may impose restrictions. Do not assume this app's current publishing mode was inspected.

Kakao console expectations: correct REST API key/client secret, Kakao Login and OpenID Connect enabled, and exact callback above. The current [Kakao tutorial](https://developers.kakao.com/docs/en/tutorial/login) locates redirect registration under App → Platform Key → REST API key and demonstrates localhost use. No phone or SMS consent is needed by this integration.

## 10. Production readiness

Local signup/login acceptance does not establish production readiness. When the domain/server are available, separately configure HTTPS frontend/API origins, AUTH_FRONTEND_URL, exact provider HTTPS callbacks, production secrets, cookie topology, fixed proxy trust and database indexes. Keep production Secure cookies. Complete real hosting/browser, role, provider and linking checks before release.

Keep Telegram disabled until its own separately authorized configuration/testing phase; it can later be enabled through the existing configuration without rewriting authentication. SMTP remains outside this test scope. The historical backend account-security report recorded inherited dependency advisories; this task did not rerun that audit or remediate them. Review those release blockers before deployment. No production infrastructure or deployment was touched.

Suggested commits, not created: frontend `fix(auth): preserve protected login destinations and cover local providers`; backend `test(auth): verify local social flows and stabilize refresh expiry checks`.
