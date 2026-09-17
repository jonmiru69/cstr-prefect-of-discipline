# START HERE — CSTR Prefect of Discipline

**Complete beginner setup guide · Version 1.0 · 17 September 2026**

Your setup is **GitHub → Cloudflare Pages Free → Supabase Free**. GitHub stores the code. Cloudflare publishes the website. Supabase stores the confidential records and handles sign-in. The website uses a free address ending in **pages.dev**.

The files are built. You still need to connect your own accounts using the steps below. You do not need to buy a domain, hosting plan, database plan, Microsoft Word subscription, or API credits.

## 1. What to prepare

Have these ready:

1. A school-controlled Google account to own the setup where possible.
2. A free GitHub account: https://github.com
3. A free Cloudflare account: https://dash.cloudflare.com/sign-up
4. A free Supabase account: https://supabase.com
5. The principal's exact Google email address and name.
6. A free authenticator app already approved by the school, with a phone available.
7. The school's actual school-year dates and handbook behavior categories.

Use individual Google accounts for staff. The six intended people are the principal, JHS prefect, SHS prefect, JHS coordinator, SHS coordinator, and developer. All authorized people can view both divisions. The principal makes formal findings and approves actions.

**Do not enter student records during setup.** Complete section 12 first. Your database starts empty.

### Understand these four values

| Value | Where it comes from | Where you put it |
|---|---|---|
| Supabase project URL | Supabase project → Connect or Settings → API/Data API | Cloudflare variable VITE_SUPABASE_URL |
| Supabase publishable key | Supabase Settings → API Keys | Cloudflare variable VITE_SUPABASE_PUBLISHABLE_KEY |
| Google OAuth client ID | Google Cloud → Google Auth Platform → Clients | Supabase Google provider settings |
| Google OAuth client secret | Same Google OAuth client | Supabase Google provider settings only |

The publishable key is intended for browser use. **A Supabase secret key, service-role key, database password, Google client secret, invitation code, or authenticator secret must never go in GitHub or a VITE_ variable.**

## 2. Extract your package

1. Download the ZIP provided with this project.
2. Right-click it in Windows File Explorer → **Extract All** → **Extract**.
3. Open the extracted **cstr-pod-system** folder.
4. You should see **package.json**, **package-lock.json**, **index.html**, **src**, **public**, and **supabase**.
5. Keep this folder as your master copy. Do not rename individual source files.

An HTML copy of this guide is provided so you can read it in your browser. The Markdown copy opens directly on GitHub.

## 3. Create your private GitHub repository

1. Sign in to GitHub.
2. Click **+** near the top-right → **New repository**.
3. Repository name: for example **cstr-prefect-of-discipline**.
4. Select **Private**.
5. Leave “Add a README”, license, and .gitignore unchecked: the package already includes the needed files.
6. Click **Create repository**.
7. Choose **uploading an existing file** on the empty-repository page.
8. Open your extracted **cstr-pod-system** folder. Select the files and folders **inside it**, then drag them into the GitHub upload area.
9. Include **.github**, **.gitignore**, **.env.example**, and **.nvmrc**. Windows can hide some entries: use File Explorer **View → Show → Hidden items**. If your browser skips a dotfile, use GitHub **Add file → Create new file**, enter its exact path, and copy its contents from the package.
10. Enter the commit message **Initial CSTR portal** and click **Commit changes**.
11. At the repository's top level, confirm that **package.json** is visible immediately. It must not be nested inside a second cstr-pod-system folder.

Do not upload node_modules, dist, .env.local, student exports, real records, or secret notes. None are needed for hosting.

### A more reliable alternative: GitHub Desktop

If drag-and-drop misses folders:

1. Install GitHub Desktop from https://desktop.github.com and sign in.
2. Choose **File → Clone repository**, select your new repository, and choose a local folder.
3. Copy the package's **contents** into that cloned folder.
4. In GitHub Desktop, inspect **Changes**. You should see application files and no credentials/student files.
5. Enter **Initial CSTR portal** → **Commit to main** → **Push origin**.

Keep the repository private. Its privacy does not replace database security.

## 4. Create the empty Supabase database

1. Sign in to Supabase.
2. Create an organization on the **Free** plan if asked.
3. Select **New project**.
4. Name it **cstr-pod**.
5. Generate a strong database password and save it in the school's password manager. You will not put it in the website.
6. Choose a suitable available region close to the school, considering the school's data-location decision. Singapore is a reasonable nearby option if available and approved.
7. Confirm that the organization/project is on the **Free** plan. Do not upgrade or enable paid add-ons.
8. Create the project and wait until it is ready.
9. In the left navigation, open **SQL Editor** → **New query**.
10. In the downloaded package, open **supabase/01_INSTALL.sql** with Notepad or a code editor. Select all, copy, and paste into SQL Editor.
11. Click **Run**. Expect successful completion. The installer is a transaction: it should either install fully or roll back.
12. Create a new query, paste **supabase/03_VERIFY_SECURITY.sql**, and run it. Review the result sets: app_private tables should have RLS enabled and browser roles should have no direct table access.
13. Leave **app_private** out of the API's exposed schemas. The public schema holds the approved callable functions. Never grant anon/authenticated access to app_private to “fix” an error.
14. Find **Settings → API Keys** (labels may also appear under Connect). Copy the **publishable** key, normally starting **sb_publishable_**.
15. Copy the project URL, like **https://abcdefgh.supabase.co**.

Run 01_INSTALL.sql **once in a new project**. If it says a schema/table already exists after a successful installation, stop rerunning it. Never delete an existing database to troubleshoot login.

## 5. Connect GitHub to Cloudflare Pages

1. Sign in to Cloudflare.
2. Open **Workers & Pages**.
3. Choose **Create application** and select the **Pages** / **Import an existing Git repository** path. Avoid creating a Worker for this project.
4. Select **Connect to Git** / **Get started** for Git integration.
5. Choose GitHub and authorize Cloudflare to access **only your CSTR repository**.
6. Select your repository → **Begin setup**.
7. Give the Pages project a name, such as **cstr-pod-office**. It must be available.
8. Set the following:

| Cloudflare setting | Exact value |
|---|---|
| Production branch | main |
| Framework preset | Vite, if listed; otherwise None |
| Build command | npm run build |
| Build output directory | dist |
| Root directory | Leave blank when package.json is at the repository root |

9. Add these **production build environment variables**:

| Variable name | Value |
|---|---|
| NODE_VERSION | 22 |
| VITE_SUPABASE_URL | Your actual https://…supabase.co project URL |
| VITE_SUPABASE_PUBLISHABLE_KEY | Your actual Supabase publishable key |
| VITE_PRIVACY_CONTACT | Optional school-approved contact sentence; no confidential information |

Use exactly those variable names. Paste values without quotation marks. If variables are available only after initial deployment, add them under the Pages project's **Settings → Variables and Secrets**, choose Production, then retry/redeploy.

10. Click **Save and Deploy**.
11. Wait for the deployment to succeed.
12. Open the production address, like **https://cstr-pod-office.pages.dev/**.
13. Write down your exact production address. Keep the same name through the following steps.
14. In the Pages project's build/branch settings, turn off automatic preview deployments for other branches if available. Do not copy production database variables into preview environments.
15. Keep the Free plan and the free pages.dev address. You do not need Cloudflare Workers paid services.

At this point, the sign-in page can be visible even though Google sign-in is not configured yet. That is expected. A “Connect the school portal” screen means the two Supabase variables are missing/invalid or the deployment needs rebuilding.

## 6. Configure Google sign-in

### A. Get the Supabase callback address

1. Return to Supabase.
2. Go to **Authentication → Sign In / Providers → Google**. The label may simply be **Providers**.
3. Copy the callback URL shown there. It normally looks like:

~~~text
https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
~~~

This is the Google redirect URI. It is **not** your Cloudflare address.

### B. Create the Google OAuth application

1. Open https://console.cloud.google.com with the school-controlled owner account.
2. Use the project selector at the top → **New project**.
3. Name it **CSTR POD Sign-in** → **Create** → select it.
4. Open **Google Auth Platform**. If the console shows the older interface, use **APIs & Services → OAuth consent screen**.
5. Start the configuration.
6. App name: **CSTR Prefect of Discipline**.
7. Support email: a real school-approved email.
8. Audience: **External** when the approved people include regular Gmail accounts. Internal works only for users inside a compatible Google Workspace organization.
9. Enter the developer contact email and complete the setup.
10. Under **Branding**, use the production website URL as the homepage and **https://YOUR-SITE.pages.dev/privacy.html** as the privacy notice URL where requested. Review that notice with the school's approved privacy information; the source file is public/privacy.html. Follow any Google domain-ownership checks presented in your console.
11. Request only the basic scopes **openid**, **email**, and **profile** if the interface asks you to configure data access. Do not add Gmail or Drive permissions.
12. Go to **Clients → Create client** (older interface: **Credentials → Create credentials → OAuth client ID**).
13. Application type: **Web application**.
14. Name: **CSTR POD Website**.
15. Under **Authorized JavaScript origins**, add your production origin with no trailing slash:

~~~text
https://YOUR-SITE.pages.dev
~~~

16. Under **Authorized redirect URIs**, paste the exact Supabase callback from step A.
17. Create the client. Copy the **Client ID** and **Client secret**.
18. If the app is in **Testing**, add each approved staff Google email under **Audience → Test users** for the setup tests. For ongoing use, move it to **In production** when your configuration is complete. Follow Google's displayed requirements; branding verification and publication behavior can vary by account. Basic sign-in does not need paid Google API access.
19. Do not enable billing or unrelated APIs for this setup.

### C. Finish Supabase authentication settings

1. Return to Supabase's **Google provider** settings.
2. Enable Google.
3. Paste the Google client ID and client secret into their respective fields → **Save**.
4. Open **Authentication → URL Configuration**.
5. **Site URL**: your full production address, including the trailing slash:

~~~text
https://YOUR-SITE.pages.dev/
~~~

6. Add that same exact URL to **Redirect URLs** → **Save**. Avoid a broad wildcard covering other people's pages.dev sites.
7. Under authentication sign-in settings, keep **Allow new users to sign up** enabled. Google must be able to create an identity before the app checks the school invitation. An ordinary Google identity does **not** provide record access.
8. Disable the Email/password provider, anonymous sign-in, and other unused providers.
9. In **Authentication → Multi-factor authentication**, enable **TOTP** authenticator enrollment/verification if the setting is shown. Do not configure paid SMS.
10. Keep standard token-expiry/security settings. Do not remove MFA checks from the database if sign-in fails.

## 7. Create the first principal invitation

This is the only staff invitation that must be created directly in SQL Editor.

1. Open **supabase/02_FIRST_PRINCIPAL.sql**.
2. Copy it into a **new Supabase SQL Editor query**.
3. Replace **REPLACE_WITH_PRINCIPAL_GOOGLE_EMAIL** with the exact principal Google email.
4. Replace **REPLACE_WITH_PRINCIPAL_FULL_NAME** with their actual name.
5. Keep **'principal'** and **7** as written. If a name contains an apostrophe, write it twice inside SQL, for example **'Ana O''Brien'**.
6. Run the query.
7. The result contains **code**, **email**, and an expiry time. Copy the long code privately. If the result is JSON, copy only the code value without the surrounding quotation marks.
8. Give that code privately to the principal. Do not commit the edited query or its result to GitHub.
9. The invitation is valid for seven days and works once for that exact Google account.

If it expires unused, generate a fresh invitation. Do not share one invitation across multiple people.

## 8. Principal's first sign-in

1. On the production website, click **Continue with Google**.
2. Choose the principal's exact approved account.
3. After Google returns to the website, the **Your personal invitation** form appears.
4. Paste the code into **School access code** → **Verify school access**.
5. The welcome message confirms the principal's role.
6. Click **Show setup QR code**.
7. On the principal's phone, open the free authenticator app → add an account → scan the QR code.
8. Enter its current six-digit code → **Verify and continue**.
9. The office overview opens with zero records.
10. Open **Account security** and enroll a backup authenticator on a separate protected device if available. Test it before relying on it. A second authenticator can be selected on future sign-in screens.
11. Sign out, sign in again, and confirm the authenticator step works.

The invitation is a one-time authorization step. Later visits use Google + authenticator; they do not reuse the school code. This prevents a shared permanent code from becoming a second password for everyone.

## 9. Invite the other five people

As the principal:

1. Open **Administration → People & invitations**.
2. Click **Invite staff member**.
3. Enter the actual person's name and exact Google email.
4. Select the matching role:
   - JHS Prefect of Discipline
   - SHS Prefect of Discipline
   - JHS Coordinator
   - SHS Coordinator
   - System Developer
5. Click **Create 7-day invitation**.
6. Copy the code while it is visible and send it privately to that person.
7. Repeat for each person. Every person gets a different code.
8. Each person follows the first sign-in process and enrolls their own authenticator.

The developer can manage configuration/access and view records, as requested, but cannot create or decide disciplinary cases. Because access managers can invite powerful roles, the developer account must be school-approved and protected.

To remove access, use **Disable** beside a staff member. Future record requests fail even if that person's old session is still open. The last active principal cannot be disabled until a replacement principal is enrolled.

## 10. Add the school's configuration

### School year

1. Open **Administration → School years → Add school year**.
2. Enter the actual label, for example **2026–2027**.
3. Select the school's actual start and end dates.
4. Keep **Open for new incident records** checked → **Save school year**.

Do not assume dates from this example. Incident dates must fall inside the selected school year. Close a completed year to stop new entries; existing open cases can still be followed up.

### Handbook categories

1. Open **Administration → Behavior categories → Add category**.
2. Enter a category exactly as the school's approved handbook describes it.
3. Add the handbook section/policy reference.
4. Keep it available → **Save category**.
5. Repeat for the categories the office actually uses.

The app does not invent offense categories or automatically prescribe penalties. When an already-used category's policy changes, deactivate it and create the replacement. Existing records keep their earlier category.

## 11. How staff use the system

### Record an incident

1. Click **Record incident**.
2. Choose the school year and behavior category.
3. Use the date and time selectors for the actual incident time. All portal dates use **Asia/Manila**.
4. Enter the location and a factual description.
5. Search for the student by school ID/name before creating another identity.
6. Enter or select the stable school student ID, full name, age at the incident, grade 7–12, section, and strand if applicable.
7. Assign the student's role: **Respondent**, **Affected student**, or **Witness**.
8. Select statement availability. If recorded, enter the actual statement and when it was taken.
9. Add an affected student or witness when applicable. Do not put two students' statements in one person's field.
10. Review the summary and click **Save incident draft**.
11. Open the draft and **Submit for review** with a reason.

The official logging timestamp and staff identity are recorded by the database. A saved draft is already stored and visible to authorized staff. Unsaved form entries are not backed up.

The repeat information counts earlier **substantiated** incidents of the same category for that student in the same school year. Unproven allegations and victim/witness appearances are not counted as offenses. This system cannot count old records that were never entered.

### Review, meetings and actions

1. A prefect or principal starts the review.
2. Add office/committee/parent meetings or notes with the actual meeting time, attendees and follow-up date.
3. The principal records a reasoned finding for each respondent.
4. A prefect or principal proposes the appropriate documented action.
5. The principal approves it only after the required finding. Warnings, sanctions, probation, suspension and expulsion are recorded as distinct action types.
6. Record the dates, completion details, and any cancellation decision.
7. Resolve the case only after required findings and unfinished actions have been addressed.
8. The principal can close a resolved case. Reopening requires a recorded reason.

The app records decisions made under the school's procedures; it does not authorize a sanction on its own. An end date does not automatically mark an action completed. Record completion explicitly. The student profile shows related action histories, and each case contains the full decision trail.

### Search and export

- **Case records**: search by name, ID, case number, school year, or case stage.
- **Student search**: enter at least two characters, open the student, and filter by school year.
- **Export Word**: download the selected case as a real .docx file.
- **Export selected history**: download the student's linked cases for the selected year, or all years.
- A student-history document includes the linked case details and can therefore contain other participants' information. Review it before any authorized disclosure.
- Use Microsoft Word if already available, or a free compatible editor such as LibreOffice. No Word subscription is required to create a download.
- Save documents only in approved school storage. The files are not password-encrypted by the portal.
- Edits need a reason; original case snapshots remain available in history. There is no ordinary delete button.

## 12. Finish these live checks before real data

These checks use your actual hosted configuration. Local automated tests cannot verify your Google account settings.

1. Open the production site in a private/incognito window. Confirm no student data appears before sign-in.
2. Sign in with an approved principal account, invitation and authenticator.
3. Sign out and sign in again. Confirm a new invitation is not needed and the authenticator is needed.
4. Sign in with an uninvited Google account. It should see only the invitation screen and must not see the dashboard or records.
5. Confirm the other five roles can enter after their own invitations. Confirm a coordinator cannot make findings and the developer cannot record an incident.
6. In Supabase, run **03_VERIFY_SECURITY.sql**. Keep its non-sensitive result with deployment records.
7. Use a **separate temporary Free Supabase test project** if you want to rehearse a fictional full case. Install the SQL there and test against it locally; do not seed fake students into the permanent database. Return to the production configuration afterward.
8. In that test environment, rehearse case creation, a second student, meetings, principal finding, action approval/completion, search, edit history and Word export.
9. Disable a test staff account; confirm its next data request is rejected.
10. Check the deployed site on a phone and verify the privacy contact/notice.
11. Complete the backup/recovery rehearsal in **docs/BACKUP-AND-RECOVERY.md**.
12. Record who owns each provider account, how backup authenticator access is held, and who monitors usage.

If you only have one available Free project, do not erase production data to perform tests. The included automated tests use a local temporary database with fictional data and never connect to Supabase. A school-approved rehearsal record, if used in production, remains an auditable record and is not automatically removable.

## 13. Staying at zero hosting/database cost

As checked for this package, the Free tiers support this design. Free plans are not an unlimited or guaranteed-availability promise.

| Service | Your intended use | What to watch |
|---|---|---|
| GitHub Free | Private source repository | Private-repository Actions minutes/storage have quotas. This workflow only checks code. |
| Cloudflare Pages Free | Static website on pages.dev | Currently 500 builds/month and one simultaneous build on Free; keep updates intentional. |
| Supabase Free | PostgreSQL + Auth | Currently 500 MB database/project, 1 GB file storage, and 5 GB egress; audit/revision history uses database space. |
| Supabase Free inactivity | Occasional school use | Free projects may pause after inactivity. Resume in the dashboard when needed. Do not depend on artificial keep-alive traffic. |
| Supabase Free backups | School-managed backups | Automatic backups/downloadable managed backups are not included as a Free guarantee. Follow the included manual procedure. |

This app uses no file uploads, paid SMS, transactional-email service, scheduled paid jobs, AI APIs, or custom domain. Code updates do not require a paid GitHub plan. You can keep Actions disabled if its Free quota is exhausted and run checks locally; Cloudflare's direct Git integration still builds the site.

Set all organizations to Free, avoid adding payment methods where not needed, decline upgrades, and review provider usage monthly. The app cannot guarantee future provider prices or prevent an account owner from enabling paid products. If limits are reached, service may pause or refuse work; **do not upgrade automatically**. Export, review retention with the school, and decide how to remain within the allowed capacity.

For critical school availability, keep a documented paper/manual intake procedure while a Free project is paused or unavailable.

## 14. Backups and daily administration

- At the end of each day with new records, the principal opens **Administration → Audit & archive → Download records archive**.
- Store that confidential JSON file in encrypted, school-controlled storage. Do not upload it to GitHub.
- This is a readable data archive, **not a one-click full restore or an authentication backup**.
- Use the separate full database procedure in **docs/BACKUP-AND-RECOVERY.md** before database changes and on the school's regular schedule.
- Review follow-ups and active actions; check staff access when a person leaves or changes duties.
- Review database size and egress monthly. Audit history grows with use.
- Apply the school's approved retention policy; there is no automatic purge in this release. Any legally required deletion must be an authorized, reviewed database maintenance operation with backup-retention implications addressed.

## 15. Updating the website later

1. Keep a copy of the working source package.
2. Make the approved code changes locally.
3. Run the checks in section 16.
4. Commit/push the source changes to the GitHub main branch.
5. Cloudflare automatically builds and publishes them.
6. Open **Cloudflare → Pages project → Deployments** and confirm success.
7. Test sign-in and one read-only record flow.
8. If the website update is faulty, use Cloudflare's previous production deployment rollback. A website rollback does not undo database changes.
9. Never rerun 01_INSTALL.sql on an established database. Future database updates require separate migration SQL reviewed for the actual existing data.

## 16. Optional: run the website on your computer

Cloudflare can build everything from GitHub without installing a coding tool locally. These steps are useful for testing and updates.

1. Install Node.js 22 LTS, version 22.12 or newer, from https://nodejs.org.
2. Open the application folder in File Explorer.
3. Click the address bar, type **powershell**, and press Enter.
4. Enter:

~~~powershell
npm.cmd ci
Copy-Item .env.example .env.local
notepad .env.local
~~~

5. In Notepad, replace the two example Supabase values with your project URL and publishable key. Prefer a separate test project for development. Save and close.
6. Add **http://localhost:5173/** to that project's Supabase Redirect URLs and **http://localhost:5173** to Google's JavaScript origins when testing Google locally.
7. Run:

~~~powershell
npm.cmd run dev
~~~

8. Open the local URL displayed, normally **http://127.0.0.1:5173**. For Google local testing, manually use **http://localhost:5173/** so it matches the allowed redirect above.
9. Keep the terminal open while using it. Press **Ctrl+C** to stop.

To check database rules and the production build:

~~~powershell
npm.cmd run check
~~~

To run browser tests with fictional responses:

~~~powershell
npx.cmd playwright install chromium
npm.cmd run test:ui
~~~

The database test creates an isolated local PostgreSQL-compatible database in memory. It does not touch your hosted records. Browser tests use fictional mocked responses; they do not use your Google account.

If PowerShell refuses npm.ps1, use npm.cmd/npx.cmd as shown. Do not weaken your computer's security policy to solve it.

## 17. Troubleshooting

| What you see | What to do |
|---|---|
| Cloudflare cannot find package.json | Upload the package contents at repository root, or set the root directory to the actual containing folder. |
| Build says unsupported Node version | Set NODE_VERSION to 22; redeploy. Node must be at least 22.12. |
| “Connect the school portal” | Check the two VITE_ variables in the Production environment and redeploy. |
| Google redirect_uri_mismatch | Google's redirect URI must be the exact Supabase callback, not the Cloudflare address. |
| OAuth returns to localhost/wrong site | Correct Supabase Site URL and exact Redirect URLs; begin sign-in again from the production root URL. |
| Google blocks an unlisted test user | Add that Google account to test users or finish moving the OAuth app into production as appropriate. |
| Invitation invalid | Use the exact invited Google account, an unused unexpired code, and no extra quotation marks. Revoke/reissue if needed. |
| Too many code attempts | Wait 15 minutes and use a correct invitation. |
| Authenticator code rejected | Enable automatic time on the phone; use the current code and the correct authenticator device. |
| Lost authenticator | Use the enrolled backup. If none, the school account owner must verify identity and follow Supabase MFA recovery; do not bypass database MFA. |
| Could not find an RPC function | Confirm 01_INSTALL.sql succeeded in the same project named in Cloudflare's URL. Keep public exposed and app_private private. |
| No school year/category options | An administrator must add at least one open year and active handbook category. |
| Incident date rejected | Use an actual past/present incident date within the selected school year, in Philippine time. |
| “Another staff…” conflict | Reload the record, review the other person's change, and apply your correction again. |
| Cannot resolve a case | Complete required findings and address pending/active actions first. |
| Project unavailable after school break | Check whether Supabase paused the Free project; resume it in the dashboard. |
| Word download blocked | Allow downloads for the school site and try again. Do not disable the database checks. |

## 18. Official references

Provider dashboard labels can change. These official pages are the fallback if a button has moved:

- Cloudflare Git deployment: https://developers.cloudflare.com/pages/get-started/git-integration/
- Cloudflare Free limits: https://developers.cloudflare.com/pages/platform/limits/
- Supabase plans and quotas: https://supabase.com/pricing
- Supabase Google sign-in: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase authenticator MFA: https://supabase.com/docs/guides/auth/auth-mfa/totp
- Supabase database security: https://supabase.com/docs/guides/database/secure-data
- Supabase backups: https://supabase.com/docs/guides/platform/backups
- Supabase restore procedure: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- Google Sans license/source: https://github.com/googlefonts/googlesans

**Finish line:** your main branch builds successfully in Cloudflare; the production URL opens; only invited staff with MFA can read data; school configuration is entered; role checks and exports are verified; and the school has a tested recovery procedure.
