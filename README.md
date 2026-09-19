# CSTR Prefect of Discipline

A private student discipline records portal for Colegio de Sto. Tomas – Recoletos, Inc. Grades 7–12.

**Start with [START-HERE.md](START-HERE.md)** for the complete beginner installation guide.

## Hosting

Private GitHub source repository → Cloudflare Pages Free website → Supabase Free database and Google authentication. Uses the free pages.dev address. No paid API, AI service, custom domain, email-sending service, or file storage service is required.

## Included

- Google sign-in, email-bound single-use invitations, mandatory TOTP MFA.
- Six staff roles; all authorized roles may read JHS and SHS records.
- School-year configuration and school-supplied handbook categories.
- Searchable student and case history, Grades 7–12, date/time pickers in Philippine time.
- Multiple students per incident, respondent/affected/witness roles, individual statements.
- Review findings, warnings, sanctions, probation, suspension, expulsion, meetings and follow-ups.
- Per-student same-year prior substantiated behavior count; no automated penalty decisions.
- Genuine Word .docx case and student-history exports.
- Audit trail, case revision history, principal-only readable JSON records archive.
- Montserrat headings, Google Sans body, burgundy/gold palette, responsive phone layout.

No student, incident, school year, or behavior data is seeded.

## Local commands

Install Node.js 22.12+ (Node 22 LTS recommended), then:

~~~sh
npm ci
npm run dev
npm run check
npx playwright install chromium
npm run test:ui
~~~

Copy .env.example to .env.local and supply your project URL and **publishable** key. Never put a secret/service-role key in a VITE_ variable.

Cloudflare: build command npm run build; build output dist; root repository root; production branch main; NODE_VERSION=22.

## Structure

| File / folder | Purpose |
|---|---|
| src/ | React application, styles and Word exporter |
| public/ | Security headers, privacy notice, app icons and web manifest |
| branding/ | Original school seal (source for all app icons; not deployed) |
| supabase/01_INSTALL.sql | One-time schema, database functions, access restrictions |
| supabase/02_FIRST_PRINCIPAL.sql | First principal invitation template |
| supabase/03_VERIFY_SECURITY.sql | Read-only installation checks |
| tests/ | PostgreSQL authorization checks and browser flows |
| .github/workflows/check.yml | Automated checks on GitHub |
| docs/ | Operations, architecture, recovery and validation notes |
| package-lock.json | Exact dependency versions |

The app is implemented and locally checked. Connecting real Google, Supabase, GitHub and Cloudflare accounts and performing the deployment acceptance checks remain the owner’s setup steps. See docs/TEST-RESULTS.md.
