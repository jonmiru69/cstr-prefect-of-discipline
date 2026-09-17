-- Run AFTER 01_INSTALL.sql in Supabase SQL Editor.
-- Replace ONLY the two example values with the principal's approved Google email
-- and actual name. Keep 'principal' and 7 unchanged.
-- The result contains a long code. Give it privately to that exact person.
-- The code expires after 7 days and works once. NEVER commit the result to GitHub.
select app_private.create_invitation(
  'REPLACE_WITH_PRINCIPAL_GOOGLE_EMAIL',
  'REPLACE_WITH_PRINCIPAL_FULL_NAME',
  'principal',
  7
) as first_principal_invitation;
