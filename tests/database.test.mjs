import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const ids = { principal:'00000000-0000-4000-8000-000000000001', prefect:'00000000-0000-4000-8000-000000000002', coordinator:'00000000-0000-4000-8000-000000000003', developer:'00000000-0000-4000-8000-000000000004', outsider:'00000000-0000-4000-8000-000000000005', alternate:'00000000-0000-4000-8000-000000000006' };
let yearId, behaviorId, caseId, principalCode;
const scalar = async (sql,params=[]) => (await db.query(sql,params)).rows[0]?.result;
async function asUser(who, fn, aal='aal2') {
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:ids[who],aal})]);
 await db.exec('set role authenticated');
 try { return await fn(); } finally { await db.exec('reset role'); }
}
const call = (fn,args=[]) => scalar('select public.'+fn+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') as result',args);
const date = new Date(Date.now()-86400000*2).toISOString();
const yr = Number(date.slice(0,4));
const payload = () => ({school_year_id:yearId,behavior_id:behaviorId,happened_at:date,location:'Test classroom',summary:'A fictional reported incident used only in automated tests.',participants:[{school_id:'TEST-001',full_name:'Fictional Student',role:'respondent',age:13,grade:7,section:'Test section',strand:'',statement:'Fictional statement for a database test.',statement_status:'recorded',statement_at:date},{school_id:'TEST-002',full_name:'Fictional Affected Student',role:'affected',age:13,grade:7,section:'Test section',strand:'',statement:'',statement_status:'not_yet_taken',statement_at:null}]});
before(async () => {
 await db.exec("create role anon; create role authenticated; create schema auth; grant usage on schema auth to anon,authenticated; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create table auth.identities(user_id uuid,provider text); create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$; create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;");
 await db.exec(await readFile(new URL('../supabase/01_INSTALL.sql',import.meta.url),'utf8'));
 for (const [name,id] of Object.entries(ids)) {
  await db.query('insert into auth.users values($1,$2,now())',[id,name+'@example.test']);
  await db.query("insert into auth.identities values($1,'google')",[id]);
 }
});
after(async()=>db.close());

test('anonymous cannot execute portal functions or read tables',async()=>{
 await db.exec('set role anon');
 try {
  await assert.rejects(()=>call('portal_bootstrap'),/permission denied/);
  await assert.rejects(()=>db.exec('select * from app_private.students'),/permission denied/);
 } finally { await db.exec('reset role'); }
});
test('uninvited Google account cannot read records',async()=>{
 await asUser('outsider',async()=>assert.rejects(()=>call('list_cases'),/active school access/));
});
test('codes are email-bound, hashed, single-use, and MFA remains required',async()=>{
 principalCode=(await scalar("select app_private.create_invitation('principal@example.test','Test Principal','principal',7) as result")).code;
 const stored=await scalar("select code_hash as result from app_private.invitations where email='principal@example.test'");
 assert.notEqual(stored,principalCode);
 assert.equal((await asUser('alternate',()=>call('redeem_invitation',[principalCode]),'aal1')).ok,false);
 assert.equal((await asUser('principal',()=>call('redeem_invitation',[principalCode]),'aal1')).ok,true);
 assert.equal((await asUser('principal',()=>call('redeem_invitation',[principalCode]),'aal1')).ok,false);
 await asUser('principal',async()=>assert.rejects(()=>call('portal_bootstrap'),/authenticator/),'aal1');
});
test('staff enrollment and configuration require permitted role',async()=>{
 for(const [who,role] of [['prefect','jhs_prefect'],['coordinator','shs_coordinator'],['developer','developer']]) {
  const inv=await asUser('principal',()=>call('admin_invite',[who+'@example.test','Test '+who,role,7]));
  assert.equal((await asUser(who,()=>call('redeem_invitation',[inv.code]),'aal1')).ok,true);
 }
 await asUser('coordinator',async()=>assert.rejects(()=>call('admin_invite',['x@example.test','Other Name','principal',7]),/role cannot/));
 await asUser('principal',()=>call('admin_save_year',[yr+'–'+(yr+1),yr+'-01-01',yr+'-12-31',true,null]));
 await asUser('principal',()=>call('admin_save_behavior',['Fictional handbook category','Test policy only',true,null]));
 const boot=await asUser('principal',()=>call('portal_bootstrap'));
 yearId=boot.years[0].id; behaviorId=boot.behaviors[0].id;
 assert.equal(boot.counts.students,0);
});
test('case saves atomically, recognizes existing students, and rejects duplicate identities',async()=>{
 const bad=payload(); bad.participants.push({...bad.participants[0]});
 await asUser('coordinator',async()=>assert.rejects(()=>call('save_case',[bad]),/only once/));
 assert.equal((await asUser('principal',()=>call('portal_bootstrap'))).counts.students,0);
 caseId=await asUser('coordinator',()=>call('save_case',[payload()]));
 const record=await asUser('prefect',()=>call('get_case',[caseId]));
 assert.equal(record.participants.length,2); assert.equal(record.version,1);
 assert.equal(record.status,'draft'); assert.equal(record.participants.find(p=>p.role==='respondent').finding,'pending');
 const mismatch=payload(); mismatch.participants[0].full_name='Incorrect name';
 await asUser('prefect',async()=>assert.rejects(()=>call('save_case',[mismatch]),/already belongs/));
});
test('MFA staff cannot bypass functions with direct table access',async()=>{
 await asUser('principal',async()=>{
  await assert.rejects(()=>db.exec('select * from app_private.students'),/permission denied/);
  await assert.rejects(()=>db.exec("update app_private.staff_members set role='principal'"),/permission denied/);
  await assert.rejects(()=>db.exec('select app_private.case_document(null)'),/permission denied/);
 });
});
test('coordinator can submit own draft but cannot decide findings or sanctions',async()=>{
 await asUser('coordinator',()=>call('set_case_status',[caseId,1,'reported','Submitted for formal review.']));
 await asUser('coordinator',async()=>assert.rejects(()=>call('set_case_status',[caseId,2,'under_review','Review has begun.']),/own draft/));
 await asUser('coordinator',async()=>assert.rejects(()=>call('save_case',[payload(),caseId,2,'Correction submitted by coordinator.']),/own drafts/));
 await asUser('developer',async()=>assert.rejects(()=>call('save_case',[payload()]),/role cannot/));
 await asUser('prefect',()=>call('set_case_status',[caseId,2,'under_review','Office investigation opened.']));
 const record=await asUser('principal',()=>call('get_case',[caseId]));
 const p=record.participants.find(p=>p.role==='respondent');
 await asUser('prefect',async()=>assert.rejects(()=>call('record_finding',[p.id,record.version,'substantiated','Reviewed by the office.']),/role cannot/));
 await asUser('principal',()=>call('record_finding',[p.id,record.version,'substantiated','Formal decision based on the fictional evidence.']));
});
test('stale edits, unfinished actions, and unapproved sanctions are blocked',async()=>{
 await asUser('prefect',async()=>assert.rejects(()=>call('save_case',[payload(),caseId,1,'A deliberately stale edit.']),/Another staff/));
 let record=await asUser('principal',()=>call('get_case',[caseId]));
 const p=record.participants.find(p=>p.role==='respondent');
 const action=await asUser('prefect',()=>call('propose_action',[caseId,{participant_id:p.id,kind:'suspension',description:'Fictional proposal under the test policy.',starts_on:date.slice(0,10),ends_on:date.slice(0,10)}]));
 await asUser('prefect',async()=>assert.rejects(()=>call('update_action',[action,1,'active','Approved by prefect.']),/Only the principal/));
 record=await asUser('principal',()=>call('get_case',[caseId]));
 await asUser('principal',async()=>assert.rejects(()=>call('set_case_status',[caseId,record.version,'resolved','The case is resolved.']),/outstanding/));
 await asUser('principal',()=>call('update_action',[action,1,'active','Principal approval is documented.']));
 await asUser('prefect',()=>call('update_action',[action,2,'completed','Completion verified with the office.']));
 record=await asUser('principal',()=>call('get_case',[caseId]));
 await asUser('prefect',()=>call('set_case_status',[caseId,record.version,'resolved','Actions completed and reviewed.']));
});
test('case closure and correction preserve history',async()=>{
 let record=await asUser('principal',()=>call('get_case',[caseId]));
 await asUser('principal',()=>call('set_case_status',[caseId,record.version,'closed','Final closure approved.']));
 record=await asUser('principal',()=>call('get_case',[caseId]));
 await asUser('prefect',async()=>assert.rejects(()=>call('save_case',[payload(),caseId,record.version,'Edit a closed case.']),/reopen/));
 await asUser('principal',()=>call('set_case_status',[caseId,record.version,'reopened','A documented correction is required.']));
 record=await asUser('principal',()=>call('get_case',[caseId]));
 const corrected=payload(); corrected.summary='Corrected fictional account, with the original preserved in history.';
 await asUser('prefect',()=>call('save_case',[corrected,caseId,record.version,'Correcting the fictional account for accuracy.']));
 const history=await asUser('principal',()=>call('case_history',[caseId]));
 assert.ok(history.length>=4);
 assert.ok(history.some(r=>r.snapshot.summary===payload().summary));
});
test('same-year recurrence counts confirmed past incidents only',async()=>{
 const next=payload(); next.happened_at=new Date(Date.now()-86400000).toISOString();
 const nextId=await asUser('prefect',()=>call('save_case',[next]));
 const r=await asUser('prefect',()=>call('get_case',[nextId]));
 assert.equal(r.participants.find(p=>p.role==='respondent').prior_confirmed,1);
 assert.equal(r.participants.find(p=>p.role==='affected').prior_confirmed,0);
});
test('exports return real records and create an audit entry',async()=>{
 const exported=await asUser('prefect',()=>call('export_records',[caseId,null,null]));
 assert.equal(exported.cases[0].id,caseId); assert.equal(exported.generated_by,'Test prefect');
 const log=await asUser('principal',()=>call('list_audit',[0]));
 assert.ok(log.items.some(r=>r.action==='records.word_exported'));
 await asUser('prefect',async()=>assert.rejects(()=>call('export_school_archive'),/role cannot/));
});
test('student history includes that student’s recorded action history',async()=>{
 const student=(await asUser('principal',()=>call('search_students',['TEST-001'])))[0];
 const history=await asUser('principal',()=>call('get_student_record',[student.id,null]));
 assert.equal(history.student.school_id,'TEST-001');
 assert.ok(history.cases.some(c=>c.student_actions.some(a=>a.kind==='suspension'&&a.status==='completed')));
});
test('disabling a staff member blocks an already-issued session immediately',async()=>{
 await asUser('principal',()=>call('admin_set_member',[ids.prefect,false]));
 await asUser('prefect',async()=>assert.rejects(()=>call('get_case',[caseId]),/active school access/));
});
test('failed invite attempts persist and lock after five attempts',async()=>{
 for(let i=0;i<5;i++) await asUser('outsider',()=>call('redeem_invitation',['WRONG']),'aal1');
 const result=await asUser('outsider',()=>call('redeem_invitation',['WRONG']),'aal1');
 assert.match(result.message,/15 minutes/);
});
