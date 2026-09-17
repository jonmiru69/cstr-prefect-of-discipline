-- CSTR Prefect of Discipline — 1.0.0
-- Run ONCE in a NEW Supabase project, through SQL Editor.
-- All student, case, year, and behavior tables start empty.
begin;
create schema app_private;
revoke all on schema app_private from public, anon, authenticated;

create table app_private.staff_members (
 user_id uuid primary key references auth.users(id), email text not null,
 full_name text not null check(length(full_name) between 2 and 160),
 role text not null check(role in ('principal','jhs_prefect','shs_prefect','jhs_coordinator','shs_coordinator','developer')),
 active boolean not null default true, joined_at timestamptz not null default now()
);
create table app_private.invitations (
 id uuid primary key default gen_random_uuid(), email text not null, full_name text not null,
 role text not null, code_hash text not null, expires_at timestamptz not null,
 used_at timestamptz, revoked boolean not null default false,
 created_at timestamptz not null default now(), created_by uuid
);
create table app_private.invite_attempts (
 user_id uuid primary key, attempts integer not null default 0,
 window_started_at timestamptz not null default now()
);
create table app_private.school_years (
 id uuid primary key default gen_random_uuid(), label text unique not null check(length(label) between 4 and 30),
 starts_on date not null, ends_on date not null, active boolean not null default true, check(ends_on>starts_on)
);
create table app_private.behaviors (
 id uuid primary key default gen_random_uuid(), name text unique not null check(length(name) between 2 and 160),
 policy_reference text not null default '' check(length(policy_reference)<=500), active boolean not null default true
);
create table app_private.students (
 id uuid primary key default gen_random_uuid(), school_id text unique not null check(length(school_id) between 1 and 80),
 full_name text not null check(length(full_name) between 2 and 160),
 created_at timestamptz not null default now(), created_by uuid not null references app_private.staff_members(user_id)
);
create sequence app_private.case_number_seq;
create table app_private.cases (
 id uuid primary key default gen_random_uuid(), case_no text unique not null,
 school_year_id uuid not null references app_private.school_years(id),
 behavior_id uuid not null references app_private.behaviors(id), happened_at timestamptz not null,
 location text not null check(length(location) between 2 and 200),
 summary text not null check(length(summary) between 10 and 12000),
 status text not null default 'draft' check(status in ('draft','reported','under_review','monitoring','resolved','closed','reopened')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid not null references app_private.staff_members(user_id), version integer not null default 1
);
create index cases_year_date on app_private.cases(school_year_id,happened_at desc);
create index cases_status on app_private.cases(status);
create table app_private.participants (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references app_private.cases(id),
 student_id uuid not null references app_private.students(id), role text not null check(role in ('respondent','affected','witness')),
 age integer not null check(age between 5 and 100), grade integer not null check(grade between 7 and 12),
 section text not null check(length(section) between 1 and 100), strand text not null default '' check(length(strand)<=100),
 statement text not null default '' check(length(statement)<=20000),
 statement_status text not null check(statement_status in ('recorded','not_yet_taken','not_applicable','declined')),
 statement_at timestamptz, finding text not null default 'pending' check(finding in ('pending','substantiated','not_substantiated')),
 finding_reason text not null default '', unique(case_id,student_id),
 check ((statement_status='recorded' and length(trim(statement))>0 and statement_at is not null)
 or (statement_status<>'recorded' and statement='' and statement_at is null))
);
create index participants_student on app_private.participants(student_id);
create table app_private.case_events (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references app_private.cases(id),
 kind text not null check(kind in ('meeting','parent_contact','note','resolution','appeal','correction')),
 title text not null check(length(title) between 2 and 200), body text not null check(length(body) between 2 and 20000),
 happened_at timestamptz not null, attendees text not null default '' check(length(attendees)<=1000),
 follow_up_on date, follow_up_done boolean not null default false,
 created_at timestamptz not null default now(), created_by uuid not null references app_private.staff_members(user_id)
);
create table app_private.actions (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references app_private.cases(id),
 participant_id uuid not null references app_private.participants(id),
 kind text not null check(kind in ('warning','counseling','probation','suspension','expulsion','other')),
 description text not null check(length(description) between 5 and 10000),
 status text not null default 'proposed' check(status in ('proposed','active','completed','cancelled')),
 starts_on date, ends_on date, approved_at timestamptz, approved_by uuid references app_private.staff_members(user_id),
 completion_note text check(length(completion_note)<=10000),
 created_at timestamptz not null default now(), created_by uuid not null references app_private.staff_members(user_id),
 version integer not null default 1, check(ends_on is null or starts_on is not null and ends_on>=starts_on)
);
create table app_private.audit_log (
 id bigint generated always as identity primary key, actor_id uuid, actor_name text not null,
 action text not null, entity_id uuid, details jsonb not null default '{}', occurred_at timestamptz not null default now()
);
create index audit_recent on app_private.audit_log(occurred_at desc);
create table app_private.case_revisions (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references app_private.cases(id),
 case_version integer not null, snapshot jsonb not null, reason text not null,
 changed_at timestamptz not null default now(), changed_by uuid not null references app_private.staff_members(user_id)
);
-- Tables are never exposed to browser roles. Checked RPC functions are the only data path.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='app_private' loop
 execute format('alter table app_private.%I enable row level security',t.tablename); end loop;
end $$;
revoke all on all tables in schema app_private from public,anon,authenticated;
revoke all on all sequences in schema app_private from public,anon,authenticated;
alter default privileges in schema app_private revoke all on tables from public,anon,authenticated;
alter default privileges in schema app_private revoke execute on functions from public,anon,authenticated;

create function app_private.require_staff(allowed_roles text[] default null)
returns app_private.staff_members language plpgsql security definer set search_path='' as $$
declare m app_private.staff_members;
begin
 if auth.uid() is null then raise exception 'Sign in to continue.' using errcode='42501'; end if;
 select * into m from app_private.staff_members where user_id=auth.uid() and active;
 if m.user_id is null then raise exception 'Your account does not have active school access.' using errcode='42501'; end if;
 if coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Complete your authenticator verification first.' using errcode='42501'; end if;
 if allowed_roles is not null and not(m.role=any(allowed_roles)) then raise exception 'Your school role cannot perform this action.' using errcode='42501'; end if;
 return m;
end $$;
create function app_private.log_event(event_name text,target uuid default null,extra jsonb default '{}')
returns void language plpgsql security definer set search_path='' as $$
begin
 insert into app_private.audit_log(actor_id,actor_name,action,entity_id,details)
 values(auth.uid(),coalesce((select full_name from app_private.staff_members where user_id=auth.uid()),'Unenrolled account'),event_name,target,extra);
end $$;
-- Only the database owner can call this helper directly.
create function app_private.create_invitation(p_email text,p_name text,p_role text,p_days integer default 7)
returns jsonb language plpgsql security definer set search_path='' as $$
declare token text; invite_id uuid;
begin
 if p_role not in ('principal','jhs_prefect','shs_prefect','jhs_coordinator','shs_coordinator','developer') then raise exception 'Invalid role.'; end if;
 if p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(trim(p_name)) not between 2 and 160 then raise exception 'Enter a valid email and full name.'; end if;
 if p_days not between 1 and 30 then raise exception 'Invitation expiry must be 1–30 days.'; end if;
 if exists(select 1 from app_private.staff_members where lower(email)=lower(trim(p_email))) then raise exception 'This email already has a staff record. Manage that account instead.'; end if;
 token:=upper(replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''));
 update app_private.invitations set revoked=true where lower(email)=lower(trim(p_email)) and used_at is null;
 insert into app_private.invitations(email,full_name,role,code_hash,expires_at,created_by)
 values(lower(trim(p_email)),trim(p_name),p_role,encode(sha256(convert_to(token,'UTF8')),'hex'),now()+make_interval(days=>p_days),auth.uid()) returning id into invite_id;
 perform app_private.log_event('invitation.created',invite_id,jsonb_build_object('role',p_role));
 return jsonb_build_object('id',invite_id,'email',lower(trim(p_email)),'code',token,'expires_at',now()+make_interval(days=>p_days));
end $$;
create function public.my_access() returns jsonb language plpgsql security definer set search_path='' as $$
declare m app_private.staff_members;
begin
 if auth.uid() is null then raise exception 'Sign in first.' using errcode='42501'; end if;
 select * into m from app_private.staff_members where user_id=auth.uid();
 if m.user_id is null then return jsonb_build_object('state','uninvited'); end if;
 return jsonb_build_object('state',case when m.active then 'member' else 'disabled' end,'member',to_jsonb(m));
end $$;
create function public.redeem_invitation(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare user_email text; inv app_private.invitations; tries app_private.invite_attempts;
begin
 if auth.uid() is null then raise exception 'Sign in with Google first.' using errcode='42501'; end if;
 if exists(select 1 from app_private.staff_members where user_id=auth.uid()) then return jsonb_build_object('ok',false,'message','This account is already registered. Contact the principal if access is disabled.'); end if;
 select lower(u.email) into user_email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null
 and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider='google');
 if user_email is null then return jsonb_build_object('ok',false,'message','Use your verified, approved Google account.'); end if;
 insert into app_private.invite_attempts(user_id) values(auth.uid()) on conflict do nothing;
 select * into tries from app_private.invite_attempts where user_id=auth.uid() for update;
 if tries.window_started_at<now()-interval '15 minutes' then
 update app_private.invite_attempts set attempts=0,window_started_at=now() where user_id=auth.uid(); tries.attempts:=0; end if;
 if tries.attempts>=5 then return jsonb_build_object('ok',false,'message','Too many attempts. Wait 15 minutes before trying again.'); end if;
 update app_private.invite_attempts set attempts=attempts+1 where user_id=auth.uid();
 select * into inv from app_private.invitations where email=user_email and not revoked and used_at is null and expires_at>now()
 and code_hash=encode(sha256(convert_to(upper(trim(p_code)),'UTF8')),'hex') for update;
 if inv.id is null then
 perform app_private.log_event('invitation.failed');
 return jsonb_build_object('ok',false,'message','This code is invalid, expired, or belongs to a different Google account.'); end if;
 insert into app_private.staff_members(user_id,email,full_name,role) values(auth.uid(),user_email,inv.full_name,inv.role);
 update app_private.invitations set used_at=now() where id=inv.id;
 perform app_private.log_event('invitation.redeemed',inv.id);
 return jsonb_build_object('ok',true,'role',inv.role,'name',inv.full_name);
end $$;

create function app_private.case_document(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(c)||jsonb_build_object(
 'year_label',y.label,'behavior_name',b.name,'policy_reference',b.policy_reference,'created_by_name',m.full_name,
 'participant_names',(select string_agg(s.full_name,', ' order by s.full_name) from app_private.participants p join app_private.students s on s.id=p.student_id where p.case_id=c.id),
 'participants',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('school_id',s.school_id,'full_name',s.full_name,
 'prior_confirmed',(select count(*) from app_private.participants pp join app_private.cases cc on cc.id=pp.case_id
 where pp.student_id=p.student_id and pp.role='respondent' and pp.finding='substantiated'
 and cc.school_year_id=c.school_year_id and cc.behavior_id=c.behavior_id and cc.id<>c.id
 and (cc.happened_at<c.happened_at or cc.happened_at=c.happened_at and cc.created_at<c.created_at))) order by p.role,p.id)
 from app_private.participants p join app_private.students s on s.id=p.student_id where p.case_id=c.id),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('author',em.full_name) order by e.happened_at desc,e.created_at desc)
 from app_private.case_events e join app_private.staff_members em on em.user_id=e.created_by where e.case_id=c.id),'[]'::jsonb),
 'actions',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('student_name',s.full_name,'approved_by_name',am.full_name) order by a.created_at desc)
 from app_private.actions a join app_private.participants p on p.id=a.participant_id join app_private.students s on s.id=p.student_id
 left join app_private.staff_members am on am.user_id=a.approved_by where a.case_id=c.id),'[]'::jsonb))
 from app_private.cases c join app_private.school_years y on y.id=c.school_year_id
 join app_private.behaviors b on b.id=c.behavior_id join app_private.staff_members m on m.user_id=c.created_by where c.id=p_id;
$$;
create function app_private.case_summary(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(c)||jsonb_build_object('year_label',y.label,'behavior_name',b.name,'participant_names',
 (select string_agg(s.full_name,', ' order by s.full_name) from app_private.participants p join app_private.students s on s.id=p.student_id where p.case_id=c.id))
 from app_private.cases c join app_private.school_years y on y.id=c.school_year_id join app_private.behaviors b on b.id=c.behavior_id where c.id=p_id;
$$;
create function public.portal_bootstrap() returns jsonb language plpgsql security definer set search_path='' as $$
declare m app_private.staff_members;
begin
 m:=app_private.require_staff();
 return jsonb_build_object('member',to_jsonb(m),
 'years',coalesce((select jsonb_agg(y order by y.starts_on desc) from app_private.school_years y),'[]'),
 'behaviors',coalesce((select jsonb_agg(b order by b.name) from app_private.behaviors b),'[]'),
 'counts',jsonb_build_object('total',(select count(*) from app_private.cases),
 'open',(select count(*) from app_private.cases where status not in ('resolved','closed')),
 'active_actions',(select count(*) from app_private.actions where status='active'),
 'students',(select count(*) from app_private.students)),
 'followups',coalesce((select jsonb_agg(x) from (select e.id,e.case_id,c.case_no,e.title,e.follow_up_on from app_private.case_events e
 join app_private.cases c on c.id=e.case_id where e.follow_up_on is not null and not e.follow_up_done and c.status not in ('closed','resolved')
 order by e.follow_up_on limit 20) x),'[]'));
end $$;
create function public.list_cases(p_query text default '',p_year_id uuid default null,p_status text default '',p_page integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; total integer;
begin
 perform app_private.require_staff();
 if length(p_query)>160 or p_page<0 then raise exception 'Invalid search.'; end if;
 select count(*) into total from app_private.cases c where (p_year_id is null or c.school_year_id=p_year_id)
 and (p_status='' or c.status=p_status) and (p_query='' or c.case_no ilike '%'||p_query||'%' or exists(
 select 1 from app_private.participants p join app_private.students s on s.id=p.student_id
 where p.case_id=c.id and (s.full_name ilike '%'||p_query||'%' or s.school_id ilike '%'||p_query||'%')));
 select coalesce(jsonb_agg(app_private.case_summary(x.id) order by x.happened_at desc,x.created_at desc),'[]') into result
 from (select c.* from app_private.cases c where (p_year_id is null or c.school_year_id=p_year_id)
 and (p_status='' or c.status=p_status) and (p_query='' or c.case_no ilike '%'||p_query||'%' or exists(
 select 1 from app_private.participants p join app_private.students s on s.id=p.student_id
 where p.case_id=c.id and (s.full_name ilike '%'||p_query||'%' or s.school_id ilike '%'||p_query||'%')))
 order by c.happened_at desc,c.created_at desc limit 20 offset p_page*20) x;
 perform app_private.log_event('cases.searched',null,jsonb_build_object('result_count',total));
 return jsonb_build_object('items',result,'total',total);
end $$;
create function public.search_students(p_query text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform app_private.require_staff();
 if length(trim(p_query))<2 then return '[]'; end if;
 if length(p_query)>160 then raise exception 'Search is too long.'; end if;
 select coalesce(jsonb_agg(x),'[]') into result from (select s.*,(select count(*) from app_private.participants p where p.student_id=s.id) as case_count
 from app_private.students s where s.full_name ilike '%'||trim(p_query)||'%' or s.school_id ilike '%'||trim(p_query)||'%' order by s.full_name limit 30) x;
 perform app_private.log_event('students.searched'); return result;
end $$;
create function public.get_case(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform app_private.require_staff(); result:=app_private.case_document(p_id);
 if result is null then raise exception 'Case not found.'; end if;
 perform app_private.log_event('case.viewed',p_id); return result;
end $$;
create function public.get_student_record(p_id uuid,p_year_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform app_private.require_staff();
 select jsonb_build_object('student',to_jsonb(s),'cases',coalesce((select jsonb_agg(app_private.case_summary(c.id)||jsonb_build_object('student_role',p.role,'finding',p.finding,'student_actions',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'kind',a.kind,'status',a.status,'starts_on',a.starts_on,'ends_on',a.ends_on) order by a.created_at) from app_private.actions a where a.participant_id=p.id),'[]'::jsonb)) order by c.happened_at desc)
 from app_private.participants p join app_private.cases c on c.id=p.case_id where p.student_id=s.id and (p_year_id is null or c.school_year_id=p_year_id)),'[]'))
 into result from app_private.students s where s.id=p_id;
 if result is null then raise exception 'Student not found.'; end if;
 perform app_private.log_event('student.viewed',p_id); return result;
end $$;

create function public.save_case(p_payload jsonb,p_id uuid default null,p_version integer default null,p_reason text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare m app_private.staff_members; c app_private.cases; y app_private.school_years; part jsonb; sid uuid; keep_ids uuid[]:='{}';
 v_case_id uuid; when_at timestamptz; old_part app_private.participants;
begin
 m:=app_private.require_staff(array['principal','jhs_prefect','shs_prefect','jhs_coordinator','shs_coordinator']);
 if jsonb_typeof(p_payload->'participants') is distinct from 'array' or jsonb_array_length(p_payload->'participants') not between 1 and 20 then raise exception 'Add between 1 and 20 students.'; end if;
 if not exists(select 1 from jsonb_array_elements(p_payload->'participants') v where v->>'role'='respondent') then raise exception 'Add at least one respondent student.'; end if;
 select * into y from app_private.school_years where id=(p_payload->>'school_year_id')::uuid;
 if y.id is null then raise exception 'Select a school year.'; end if;
 when_at:=(p_payload->>'happened_at')::timestamptz;
 if when_at is null or when_at>now()+interval '5 minutes' then raise exception 'The incident must have already happened.'; end if;
 if (when_at at time zone 'Asia/Manila')::date not between y.starts_on and y.ends_on then raise exception 'The incident date is outside the selected school year dates.'; end if;
 if p_id is null then
 if not y.active then raise exception 'This school year is closed for new cases.'; end if;
 if not exists(select 1 from app_private.behaviors where id=(p_payload->>'behavior_id')::uuid and active) then raise exception 'Select an active handbook behavior category.'; end if;
 insert into app_private.cases(case_no,school_year_id,behavior_id,happened_at,location,summary,created_by)
 values('POD-'||y.label||'-'||lpad(nextval('app_private.case_number_seq')::text,6,'0'),y.id,(p_payload->>'behavior_id')::uuid,when_at,trim(p_payload->>'location'),trim(p_payload->>'summary'),m.user_id)
 returning id into v_case_id;
 else
 select * into c from app_private.cases where id=p_id for update;
 if c.id is null then raise exception 'Case not found.'; end if;
 if c.version is distinct from p_version then raise exception 'Another staff member updated this case. Refresh before saving.'; end if;
 if c.status in ('resolved','closed') then raise exception 'The principal must reopen this case before changes can be made.'; end if;
 if m.role in ('jhs_coordinator','shs_coordinator') and (c.status<>'draft' or c.created_by<>m.user_id) then raise exception 'Coordinators can edit only their own drafts.' using errcode='42501'; end if;
 if c.status<>'draft' and coalesce(length(trim(p_reason)),0)<10 then raise exception 'Explain the correction in at least 10 characters.'; end if;
 if length(p_reason)>10000 then raise exception 'Correction reason is too long.'; end if;
 if (c.school_year_id<>y.id or c.behavior_id<>(p_payload->>'behavior_id')::uuid or c.happened_at<>when_at)
 and exists(select 1 from app_private.participants where app_private.participants.case_id=c.id and finding<>'pending') then
 raise exception 'Year, behavior, and incident date cannot change after a finding. Reopen the case and record a correction note; ask the database custodian to review any exceptional correction.'; end if;
 insert into app_private.case_revisions(case_id,case_version,snapshot,reason,changed_by)
 values(c.id,c.version,app_private.case_document(c.id),coalesce(nullif(trim(p_reason),''),'Draft updated'),m.user_id);
 update app_private.cases set school_year_id=y.id,behavior_id=(p_payload->>'behavior_id')::uuid,happened_at=when_at,
 location=trim(p_payload->>'location'),summary=trim(p_payload->>'summary'),updated_at=now(),version=version+1 where id=c.id;
 v_case_id:=c.id;
 end if;
 for part in select * from jsonb_array_elements(p_payload->'participants') loop
 if length(trim(part->>'school_id'))=0 or length(trim(part->>'full_name'))<2 then raise exception 'Each student needs a school ID and full name.'; end if;
 if part->>'statement_status'='recorded' and (part->>'statement_at')::timestamptz>now()+interval '5 minutes' then raise exception 'A recorded statement date cannot be in the future.'; end if;
 insert into app_private.students(school_id,full_name,created_by)
 values(upper(trim(part->>'school_id')),trim(part->>'full_name'),m.user_id) on conflict(school_id) do nothing;
 select id into sid from app_private.students where school_id=upper(trim(part->>'school_id'));
 if sid=any(keep_ids) then raise exception 'A student may appear only once in the same incident.'; end if;
 if (select full_name from app_private.students where id=sid)<>trim(part->>'full_name') then raise exception 'This school ID already belongs to another recorded name. Select the existing student or request a name correction.'; end if;
 keep_ids:=array_append(keep_ids,sid);
 select * into old_part from app_private.participants where app_private.participants.case_id=v_case_id and student_id=sid;
 if old_part.id is not null and old_part.role<>part->>'role' and (old_part.finding<>'pending' or exists(select 1 from app_private.actions where participant_id=old_part.id)) then raise exception 'A student role with findings or actions cannot be changed.'; end if;
 insert into app_private.participants(case_id,student_id,role,age,grade,section,strand,statement,statement_status,statement_at)
 values(v_case_id,sid,part->>'role',(part->>'age')::integer,(part->>'grade')::integer,trim(part->>'section'),coalesce(trim(part->>'strand'),''),
 case when part->>'statement_status'='recorded' then coalesce(part->>'statement','') else '' end,part->>'statement_status',
 case when part->>'statement_status'='recorded' then (part->>'statement_at')::timestamptz else null end)
 on conflict on constraint participants_case_id_student_id_key do update set role=excluded.role,age=excluded.age,grade=excluded.grade,section=excluded.section,
 strand=excluded.strand,statement=excluded.statement,statement_status=excluded.statement_status,statement_at=excluded.statement_at;
 end loop;
 if exists(select 1 from app_private.participants p where p.case_id=v_case_id and not(p.student_id=any(keep_ids)) and
 (p.finding<>'pending' or exists(select 1 from app_private.actions a where a.participant_id=p.id))) then raise exception 'A student with a finding or action cannot be removed.'; end if;
 delete from app_private.participants p where p.case_id=v_case_id and not(p.student_id=any(keep_ids));
 perform app_private.log_event(case when p_id is null then 'case.created' else 'case.corrected' end,v_case_id,jsonb_build_object('reason',p_reason));
 return v_case_id;
end $$;
create function public.set_case_status(p_id uuid,p_version integer,p_status text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare m app_private.staff_members; c app_private.cases;
begin
 m:=app_private.require_staff(array['principal','jhs_prefect','shs_prefect','jhs_coordinator','shs_coordinator']);
 select * into c from app_private.cases where id=p_id for update;
 if c.id is null or c.version is distinct from p_version then raise exception 'Case changed or not found. Refresh and try again.'; end if;
 if p_reason is null or p_reason is null or length(trim(p_reason)) not between 5 and 10000 then raise exception 'Explain this status change (5–10,000 characters).'; end if;
 if m.role in ('jhs_coordinator','shs_coordinator') and not(c.status='draft' and p_status='reported' and c.created_by=m.user_id) then raise exception 'Only your own draft can be submitted.' using errcode='42501'; end if;
 if p_status in ('reopened','closed') and m.role<>'principal' then raise exception 'Only the principal can close or reopen a case.' using errcode='42501'; end if;
 if not ((c.status='draft' and p_status='reported') or (c.status='reported' and p_status='under_review')
 or (c.status in ('under_review','reopened') and p_status in ('monitoring','resolved','closed'))
 or (c.status='monitoring' and p_status in ('under_review','resolved')) or (c.status='resolved' and p_status in ('closed','reopened'))
 or (c.status='closed' and p_status='reopened')) then raise exception 'This case-stage transition is not allowed.'; end if;
 if p_status in ('resolved','closed') then
 if exists(select 1 from app_private.participants where case_id=p_id and role='respondent' and finding='pending') then raise exception 'Record a finding for every respondent before resolving or closing.'; end if;
 if exists(select 1 from app_private.actions where case_id=p_id and status in ('proposed','active')) then raise exception 'Complete or cancel outstanding actions first.'; end if;
 end if;
 insert into app_private.case_revisions(case_id,case_version,snapshot,reason,changed_by) values(c.id,c.version,app_private.case_document(c.id),p_reason,m.user_id);
 update app_private.cases set status=p_status,version=version+1,updated_at=now() where id=p_id;
 insert into app_private.case_events(case_id,kind,title,body,happened_at,created_by)
 values(p_id,case when p_status='reopened' then 'appeal' when p_status in ('closed','resolved') then 'resolution' else 'note' end,
 'Case stage: '||replace(p_status,'_',' '),p_reason,now(),m.user_id);
 perform app_private.log_event('case.stage_changed',p_id,jsonb_build_object('from',c.status,'to',p_status,'reason',p_reason));
end $$;
create function public.record_finding(p_participant_id uuid,p_version integer,p_finding text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare m app_private.staff_members; c app_private.cases; p app_private.participants;
begin
 m:=app_private.require_staff(array['principal']);
 select * into p from app_private.participants where id=p_participant_id;
 select * into c from app_private.cases where id=p.case_id for update;
 if c.id is null or c.version is distinct from p_version then raise exception 'Case changed or not found. Refresh and try again.'; end if;
 if p.role<>'respondent' or c.status not in ('under_review','reopened') then raise exception 'Findings are recorded for respondents during review.'; end if;
 if p_finding not in ('substantiated','not_substantiated') or p_reason is null or length(trim(p_reason)) not between 10 and 10000 then raise exception 'Choose a finding and explain the decision (10–10,000 characters).'; end if;
 if exists(select 1 from app_private.actions where participant_id=p.id and status='active') then raise exception 'Resolve active actions before changing this finding.'; end if;
 insert into app_private.case_revisions(case_id,case_version,snapshot,reason,changed_by) values(c.id,c.version,app_private.case_document(c.id),p_reason,m.user_id);
 update app_private.participants set finding=p_finding,finding_reason=p_reason where id=p.id;
 update app_private.cases set version=version+1,updated_at=now() where id=c.id;
 perform app_private.log_event('finding.recorded',c.id,jsonb_build_object('participant_id',p.id,'finding',p_finding,'reason',p_reason));
end $$;
create function public.add_case_event(p_case_id uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare m app_private.staff_members; result uuid; c app_private.cases;
begin
 m:=app_private.require_staff(array['principal','jhs_prefect','shs_prefect','jhs_coordinator','shs_coordinator']);
 select * into c from app_private.cases where id=p_case_id for update;
 if c.id is null then raise exception 'Case not found.'; end if;
 if c.status in ('closed','resolved') then raise exception 'Reopen the case before adding records.'; end if;
 insert into app_private.case_events(case_id,kind,title,body,happened_at,attendees,follow_up_on,created_by)
 values(p_case_id,p_payload->>'kind',trim(p_payload->>'title'),trim(p_payload->>'body'),(p_payload->>'happened_at')::timestamptz,
 coalesce(p_payload->>'attendees',''),nullif(p_payload->>'follow_up_on','')::date,m.user_id) returning id into result;
 update app_private.cases set version=version+1,updated_at=now() where id=p_case_id;
 perform app_private.log_event('meeting_or_note.added',p_case_id,jsonb_build_object('event_id',result)); return result;
end $$;
create function public.complete_followup(p_event_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 perform app_private.require_staff(array['principal','jhs_prefect','shs_prefect','jhs_coordinator','shs_coordinator']);
 update app_private.case_events set follow_up_done=true where id=p_event_id and follow_up_on is not null returning case_id into target;
 if target is null then raise exception 'Follow-up not found.'; end if;
 perform app_private.log_event('followup.completed',target,jsonb_build_object('event_id',p_event_id));
end $$;
create function public.propose_action(p_case_id uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare m app_private.staff_members; result uuid; c app_private.cases;
begin
 m:=app_private.require_staff(array['principal','jhs_prefect','shs_prefect']);
 select * into c from app_private.cases where id=p_case_id for update;
 if c.id is null or c.status not in ('under_review','reopened','monitoring') then raise exception 'Actions can be proposed while the case is under review or monitoring.'; end if;
 if not exists(select 1 from app_private.participants where id=(p_payload->>'participant_id')::uuid and case_id=p_case_id
 and (role='respondent' or p_payload->>'kind'='counseling')) then raise exception 'Select an eligible student in this case.'; end if;
 insert into app_private.actions(case_id,participant_id,kind,description,starts_on,ends_on,created_by)
 values(p_case_id,(p_payload->>'participant_id')::uuid,p_payload->>'kind',trim(p_payload->>'description'),
 nullif(p_payload->>'starts_on','')::date,nullif(p_payload->>'ends_on','')::date,m.user_id) returning id into result;
 update app_private.cases set version=version+1,updated_at=now() where id=p_case_id;
 perform app_private.log_event('action.proposed',p_case_id,jsonb_build_object('action_id',result)); return result;
end $$;
create function public.update_action(p_id uuid,p_version integer,p_status text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare m app_private.staff_members; a app_private.actions; c app_private.cases;
begin
 m:=app_private.require_staff(array['principal','jhs_prefect','shs_prefect']);
 select * into c from app_private.cases where id=(select case_id from app_private.actions where id=p_id) for update;
 select * into a from app_private.actions where id=p_id for update;
 if a.id is null or a.version is distinct from p_version then raise exception 'Action changed or not found. Refresh and try again.'; end if;
 if c.status in ('closed','resolved') then raise exception 'Reopen the case first.'; end if;
 if p_note is null or length(trim(p_note)) not between 5 and 10000 then raise exception 'Record a decision or completion note (5–10,000 characters).'; end if;
 if not((a.status='proposed' and p_status in ('active','cancelled')) or (a.status='active' and p_status in ('completed','cancelled'))) then raise exception 'Invalid action transition.'; end if;
 if p_status in ('active','cancelled') and m.role<>'principal' then raise exception 'Only the principal can approve or cancel an action.' using errcode='42501'; end if;
 if p_status='active' and a.kind<>'counseling' and not exists(select 1 from app_private.participants where id=a.participant_id and role='respondent' and finding='substantiated') then raise exception 'A substantiated finding is required before this sanction can be approved.'; end if;
 if p_status='active' and a.starts_on is null then raise exception 'A start date is required before approval. Cancel this proposal and create a corrected one.'; end if;
 if p_status='active' and a.kind in ('probation','suspension') and a.ends_on is null then raise exception 'Probation and suspension require an end date. Create a corrected proposal.'; end if;
 insert into app_private.case_revisions(case_id,case_version,snapshot,reason,changed_by) values(c.id,c.version,app_private.case_document(c.id),p_note,m.user_id);
 update app_private.actions set status=p_status,completion_note=p_note,version=version+1,
 approved_at=case when p_status='active' then now() else approved_at end,
 approved_by=case when p_status='active' then m.user_id else approved_by end where id=p_id;
 update app_private.cases set version=version+1,updated_at=now() where id=a.case_id;
 perform app_private.log_event('action.'||p_status,a.case_id,jsonb_build_object('action_id',p_id,'kind',a.kind,'note',p_note));
end $$;

create function public.admin_invite(p_email text,p_name text,p_role text,p_days integer default 7)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform app_private.require_staff(array['principal','developer']);
 return app_private.create_invitation(p_email,p_name,p_role,p_days);
end $$;
create function public.admin_list_staff() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform app_private.require_staff(array['principal','developer']);
 return jsonb_build_object('members',coalesce((select jsonb_agg(m order by m.full_name) from app_private.staff_members m),'[]'),
 'invitations',coalesce((select jsonb_agg(x) from (select id,email,full_name,role,expires_at,used_at,revoked from app_private.invitations order by created_at desc limit 100) x),'[]'));
end $$;
create function public.admin_set_member(p_user_id uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.require_staff(array['principal','developer']);
 if p_user_id=auth.uid() then raise exception 'You cannot change your own active status.'; end if;
 if not p_active and exists(select 1 from app_private.staff_members where user_id=p_user_id and role='principal' and active)
 and (select count(*) from app_private.staff_members where role='principal' and active)<=1 then raise exception 'Keep at least one active principal. Enroll the replacement first.'; end if;
 update app_private.staff_members set active=p_active where user_id=p_user_id;
 if not found then raise exception 'Staff member not found.'; end if;
 perform app_private.log_event('staff.access_changed',p_user_id,jsonb_build_object('active',p_active));
end $$;
create function public.admin_revoke_invite(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.require_staff(array['principal','developer']);
 update app_private.invitations set revoked=true where id=p_id;
 perform app_private.log_event('invitation.revoked',p_id);
end $$;
create function public.admin_save_year(p_label text,p_start date,p_end date,p_active boolean,p_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform app_private.require_staff(array['principal','developer']);
 if p_id is null then
 insert into app_private.school_years(label,starts_on,ends_on,active) values(trim(p_label),p_start,p_end,p_active) returning id into result;
 else
 if exists(select 1 from app_private.cases where school_year_id=p_id) and exists(select 1 from app_private.school_years where id=p_id and label<>trim(p_label)) then raise exception 'A school year with recorded cases cannot be renamed.'; end if;
 if exists(select 1 from app_private.cases where school_year_id=p_id and (happened_at at time zone 'Asia/Manila')::date not between p_start and p_end) then
 raise exception 'These dates would put existing incidents outside their school year.'; end if;
 update app_private.school_years set label=trim(p_label),starts_on=p_start,ends_on=p_end,active=p_active where id=p_id returning id into result;
 if result is null then raise exception 'School year not found.'; end if;
 end if;
 perform app_private.log_event('school_year.saved',result);
end $$;
create function public.admin_save_behavior(p_name text,p_reference text,p_active boolean,p_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform app_private.require_staff(array['principal','developer']);
 if p_id is null then
 insert into app_private.behaviors(name,policy_reference,active) values(trim(p_name),trim(p_reference),p_active) returning id into result;
 else
 if exists(select 1 from app_private.cases where behavior_id=p_id) and exists(select 1 from app_private.behaviors where id=p_id and (name<>trim(p_name) or policy_reference<>trim(p_reference))) then raise exception 'This category is used by recorded cases. Deactivate it and create a new category for the changed policy.'; end if;
 update app_private.behaviors set name=trim(p_name),policy_reference=trim(p_reference),active=p_active where id=p_id returning id into result;
 if result is null then raise exception 'Behavior category not found.'; end if;
 end if;
 perform app_private.log_event('behavior.saved',result);
end $$;
create function public.correct_student(p_id uuid,p_school_id text,p_name text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare old app_private.students;
begin
 perform app_private.require_staff(array['principal','jhs_prefect','shs_prefect']);
 if p_reason is null or p_reason is null or length(trim(p_reason)) not between 10 and 10000 then raise exception 'Explain the identity correction (10–10,000 characters).'; end if;
 select * into old from app_private.students where id=p_id for update;
 if old.id is null then raise exception 'Student not found.'; end if;
 update app_private.students set school_id=upper(trim(p_school_id)),full_name=trim(p_name) where id=p_id;
 perform app_private.log_event('student.identity_corrected',p_id,jsonb_build_object('previous_school_id',old.school_id,'previous_name',old.full_name,'reason',p_reason));
end $$;
create function public.list_audit(p_page integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform app_private.require_staff(array['principal','developer']);
 if p_page<0 then raise exception 'Invalid page.'; end if;
 return jsonb_build_object('total',(select count(*) from app_private.audit_log),
 'items',coalesce((select jsonb_agg(x) from (select * from app_private.audit_log order by id desc limit 50 offset p_page*50) x),'[]'));
end $$;
create function public.case_history(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform app_private.require_staff();
 perform app_private.log_event('case.history_viewed',p_id);
 return coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('author',m.full_name) order by r.changed_at desc)
 from app_private.case_revisions r join app_private.staff_members m on m.user_id=r.changed_by where r.case_id=p_id),'[]');
end $$;
create function public.export_records(p_case_id uuid default null,p_student_id uuid default null,p_year_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m app_private.staff_members; records jsonb;
begin
 m:=app_private.require_staff();
 if (p_case_id is null)=(p_student_id is null) then raise exception 'Select exactly one case or one student.'; end if;
 select coalesce(jsonb_agg(app_private.case_document(c.id) order by c.happened_at),'[]') into records
 from app_private.cases c where (p_case_id is not null and c.id=p_case_id) or
 (p_student_id is not null and exists(select 1 from app_private.participants p where p.case_id=c.id and p.student_id=p_student_id)
 and (p_year_id is null or c.school_year_id=p_year_id));
 if jsonb_array_length(records)=0 then raise exception 'There are no records to export for that selection.'; end if;
 perform app_private.log_event('records.word_exported',coalesce(p_case_id,p_student_id),jsonb_build_object('cases',jsonb_array_length(records),'year_id',p_year_id));
 return jsonb_build_object('cases',records,'generated_at',now(),'generated_by',m.full_name,'role',m.role);
end $$;
-- School-record archive for the principal. This is NOT a full Supabase recovery backup.
create function public.export_school_archive() returns jsonb language plpgsql security definer set search_path='' as $$
declare m app_private.staff_members; result jsonb;
begin
 m:=app_private.require_staff(array['principal']);
 perform app_private.log_event('school.archive_exported');
 select jsonb_build_object('format','cstr-records-archive-v1','generated_at',now(),'generated_by',m.full_name,
 'students',coalesce((select jsonb_agg(s) from app_private.students s),'[]'),
 'cases',coalesce((select jsonb_agg(app_private.case_document(c.id)) from app_private.cases c),'[]'),
 'school_years',coalesce((select jsonb_agg(y) from app_private.school_years y),'[]'),
 'behaviors',coalesce((select jsonb_agg(b) from app_private.behaviors b),'[]'),
 'audit_log',coalesce((select jsonb_agg(a) from app_private.audit_log a),'[]'),
 'case_revisions',coalesce((select jsonb_agg(r) from app_private.case_revisions r),'[]')) into result;
 return result;
end $$;

-- Explicitly remove PUBLIC's default function execution permission.
revoke all on all functions in schema app_private from public,anon,authenticated;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname=any(array[
 'my_access','redeem_invitation','portal_bootstrap','list_cases','search_students','get_case','get_student_record',
 'save_case','set_case_status','record_finding','add_case_event','complete_followup','propose_action','update_action',
 'admin_invite','admin_list_staff','admin_set_member','admin_revoke_invite','admin_save_year','admin_save_behavior',
 'correct_student','list_audit','case_history','export_records','export_school_archive'])
 loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
grant usage on schema public to authenticated;
commit;
