# Validation record

Version 1.0 · local checks on 16–17 September 2026.

## Completed

- TypeScript strict compilation: passed.
- Vite production build: passed.
- 14 PostgreSQL authorization/workflow tests using PGlite: passed.
- 5 Playwright browser scenarios in Microsoft Edge: passed assertions.
- Desktop sign-in and empty dashboard screenshots: visually inspected.
- Mobile 390-pixel incident form: no horizontal overflow in browser check.
- Word case export: downloaded by browser; ZIP/container and document content checked.
- Dependency audit at installation: zero reported vulnerabilities at that time.

## Database coverage

Anonymous and uninvited access; email-bound hashed one-use invitations; mandatory aal2; role restrictions; atomic incident saves; identity mismatch/duplicate participants; denied direct table/helper access; stale edit rejection; action approval and resolution gates; revision history; confirmed recurrence counts; audited export; access revocation; failed invitation throttling.

Tests execute the installation SQL against a fresh local PostgreSQL-compatible engine. Supabase's auth tables/JWT functions are represented by test fixtures. No hosted project is touched.

## Browser coverage

Signed-out page, unauthorized invitation screen, MFA gate, case draft creation, submit for review, real DOCX download, student history navigation, and phone navigation/form width. Hosted API responses are mocked with fictional records. These tests do not establish that Google's live OAuth setup or a hosted Supabase deployment is correct.

## Still required after account setup

The live acceptance checks in START-HERE.md, including actual Google callback configuration, TOTP enrollment, all six accounts, hosted RPC access, Cloudflare headers, and recovery rehearsal.

A Supabase production deployment, real OAuth round trip, full hosted backup/restore, high-volume load test, independent penetration test, and visual rendering in Microsoft Word have not been performed. The website files are ready to deploy; no live URL has been created on the user's behalf.

The Windows managed browser-test server did not finish teardown after the five passing scenarios; it was stopped manually. The GitHub workflow runs on Linux. Browser assertions passed; a clean Windows test-runner exit is not claimed.
