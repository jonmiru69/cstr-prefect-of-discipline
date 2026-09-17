# Backup and recovery

Assign this procedure to the school-controlled project owner and developer. A downloaded Word file preserves a report; it cannot restore the system.

## Daily readable archive

The principal selects Administration → Audit & archive → Download records archive. Save it in encrypted school-controlled storage outside the GitHub repository. Use the school's retention schedule and a second protected copy. Confirm that the file opens and contains the expected school year and record totals. Do not send it to an online JSON viewer.

This archive includes the school's stored records and histories, but is not a full Supabase backup, contains no working sign-in setup, and has no automatic importer in this release.

## Full database backup

Supabase recommends regular manual exports for Free projects. Use its maintained [backup and restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), including the Supabase CLI, Docker and the Session pooler connection from the project's Connect panel.

On Windows, Docker Desktop supports [free educational use](https://docs.docker.com/desktop/setup/install/windows-install/); confirm that your actual use is eligible. If installation is restricted on the school computer, arrange the backup on an approved computer instead of buying a hosting upgrade.

1. Install Node, the Supabase CLI and Docker following the linked official instructions. Start Docker.
2. Open a new PowerShell window on the approved computer.
3. Create a dated backup folder **outside** the repository and outside public/cloud-shared Downloads. For example, use the school's encrypted backup drive.
4. Change into that folder.
5. Read the database connection privately. A connection URL contains the database password. This prompt avoids writing the pasted value in shell history:

~~~powershell
$podSecureUrl = Read-Host 'Paste the full Session pooler connection URL' -AsSecureString
$podDbUrl = [System.Net.NetworkCredential]::new('', $podSecureUrl).Password
~~~

The URL must contain the actual password, URL-encoded when it has reserved characters. Use the Session pooler connection on port 5432, not the transaction-pooler port. Do not post it in support screenshots.

6. Run the three exports. These read the database; they do not modify it:

~~~powershell
supabase db dump --db-url $podDbUrl -f roles.sql --role-only
supabase db dump --db-url $podDbUrl -f schema.sql
supabase db dump --db-url $podDbUrl -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
~~~

After **each command**, check that it completed without an error. Do not treat empty or partial files as a successful backup.

7. Clear the variables and close the terminal:

~~~powershell
Remove-Variable podDbUrl,podSecureUrl
~~~

The URL is still briefly available to privileged local process inspection while a command runs. Use a trusted school device.

8. Keep the three files together with the corresponding source-code version. Record the backup date and who performed it.
9. Protect the files with encryption and restricted access. They contain confidential data and authentication information.
10. Maintain a separate protected configuration note: project identity/region, Google OAuth client ownership, redirect URLs, enabled providers/TOTP, Cloudflare settings, current source version, and recovery account contacts. Store secrets in the school password manager, not in this note or repository.

There are no file uploads or Edge Functions in this app. If those are added later, extend the backup procedure for them.

## Rehearse a restore before relying on backups

Restoration writes a database and requires care. Use a **new separate project**, within available Free project slots, and follow the official restore guide linked above.

- Do not run 01_INSTALL.sql on the restore target first; the schema backup supplies the installed structure.
- Review the current official restore prerequisites and any auth/encryption migration considerations.
- Restore roles, schema and data using the official transaction/stop-on-error procedure.
- Do not restore into a live production project or overwrite existing student data for a test.
- Reconfigure Google provider credentials, the new callback URL, TOTP, Site URL and redirect allowlist.
- Point only a protected local rehearsal build at the restored project. Never expose a restored production dataset through an open preview site.
- Run 03_VERIFY_SECURITY.sql. Verify a principal sign-in, authenticator, student lookup, case details, event history, action history and Word export.
- Compare counts and a sample of records against the daily archive and the source database.
- Verify that an uninvited account cannot read data.
- Record the rehearsal result and elapsed recovery time. Resolve any failed step before using the backup as the only recovery plan.

The supplied app does not automatically restore JSON archives. Full hosted backup/restore has not been executed for your account because no live project credentials were provided.

## If a real failure occurs

1. Stop staff from entering new records until the recovery destination is decided.
2. Determine whether this is a paused project, temporary outage, faulty website deployment or database loss.
3. Resume a paused Free project or roll back only the website when that is the actual issue.
4. For database loss, restore into a separate project using the tested procedure. Keep the original preserved.
5. Verify security and records before changing production Cloudflare variables and rebuilding.
6. Have staff sign in again. Reconcile any paper incident intake recorded during the outage.
7. Document the incident, the restored backup date, and any records entered after that backup that need authorized reconstruction.
