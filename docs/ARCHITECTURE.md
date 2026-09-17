# Architecture and trust boundaries

The browser serves a Vite/React static application from Cloudflare Pages. It authenticates through Supabase Auth with Google OAuth (PKCE). Authentication state uses sessionStorage. The database checks active school membership and the JWT aal2 authenticator claim on every protected operation.

The public URL and publishable key are intentionally browser-visible. They provide no school membership. No service-role key is used by the application.

## Database access

Every school table is in app_private, with RLS enabled and browser grants revoked. The only intended client interface is explicitly granted public RPC functions. SECURITY DEFINER functions use an empty search_path and fully qualified object references. Internal helper functions and schemas are not callable by the browser.

my_access reveals only the signed-in user's membership state. redeem_invitation requires a verified Google identity and binds the invitation to that email. Invitations expire, are single-use, are stored as SHA-256 hashes, and are rate limited to five failures per account per 15 minutes. Successful membership still requires TOTP before data access.

The database owner remains a trusted administrator. A Supabase project owner can change data and security; application controls cannot protect against the owner. Protect GitHub, Cloudflare, Google Cloud and Supabase accounts with MFA.

## Data model

- students: stable school ID and name. Do not use an LRN unless the school specifically needs it.
- school_years and behaviors: school-supplied configuration, no fabricated policy.
- cases: incident details, school year, behavior category and case stage.
- participants: student link plus age/grade/section/strand snapshot, role, statement and finding.
- actions: participant-specific proposals, approvals and completion.
- case_events: office meetings, committee meetings, parent meetings, notes and follow-ups.
- case_revisions: preserved case snapshots before changes.
- audit_log: server-side actor, timestamp, operation and relevant details.

Snapshots preserve incident-era grade and section. Identity corrections apply the corrected identity throughout the portal and preserve the correction in the audit log. There is no destructive delete or automatic student merging.

## Decisions

Case stages and individual action states are separate. A student may have multiple concurrent cases. An approved action remains active until the office records completion or cancellation; passing its end date does not silently close it. Historical expulsion records do not determine present enrollment automatically.

Repeat count means earlier substantiated cases of the same behavior, for the same student, in the same school year, ordered by incident time. It excludes affected/witness roles and unsubstantiated allegations. It can change following corrections or new findings. It is not an automatic sentence or a guarantee that older paper records are represented.

## Privileges

| Capability | Principal | Prefects | Coordinators | Developer |
|---|---|---|---|---|
| Read/search/export both divisions | Yes | Yes | Yes | Yes |
| Create incident | Yes | Yes | Yes | No |
| Edit case | Yes | Yes | Own draft only | No |
| Submit own draft | Yes | Yes | Yes | No |
| Review/monitor/resolve | Yes | Yes | No | No |
| Record formal finding | Yes | No | No | No |
| Propose actions | Yes | Yes | No | No |
| Approve/cancel actions | Yes | No | No | No |
| Complete approved actions | Yes | Yes | No | No |
| Close/reopen cases | Yes | No | No | No |
| Manage invites/configuration | Yes | No | No | Yes |
| View administration audit | Yes | No | No | Yes |
| Download all-records JSON archive | Yes | No | No | No |

Principal and developer access administrators can invite any supported role, including a replacement principal. This is a powerful school-trusted role. The developer is not a disciplinary decision maker. Role assignments are not self-editable; replacement/role correction is an administrator task.

## Export and storage

DOCX files are generated locally in the browser from an audited database export. The source repository, Cloudflare build and GitHub tests receive no student data. There are no uploaded evidence files, email notifications, analytics, AI calls, service workers, or offline copies of records. Record drafts are only in memory. Exported files are ordinary unencrypted documents; storage protection is the school's responsibility.

The 15-minute idle timeout protects an unattended screen. It is a browser feature, not server-side session revocation. Disabling school membership blocks future database requests, even with an existing token. Already viewed or downloaded material cannot be recalled.

## Scope of validation

See TEST-RESULTS.md. Local PostgreSQL tests check permissions and business rules. Browser tests mock hosted responses to verify interactions. Neither replaces the live hosted acceptance checks or an independent security review.
