import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const userId='00000000-0000-4000-8000-000000000001';
const yearId='10000000-0000-4000-8000-000000000001',behaviorId='20000000-0000-4000-8000-000000000001',caseId='30000000-0000-4000-8000-000000000001';
const now=new Date().toISOString(),year=Number(now.slice(0,4));
const member={user_id:userId,email:'principal@example.test',full_name:'Test Principal',role:'principal',active:true};
const user={id:userId,email:member.email,app_metadata:{provider:'google',providers:['google']},user_metadata:{},aud:'authenticated',role:'authenticated',created_at:now,factors:[{id:'mfa-1',factor_type:'totp',status:'verified'}]};
function token(aal:string){return Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:userId,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),aal,amr:[{method:aal==='aal2'?'totp':'oauth',timestamp:Math.floor(Date.now()/1000)}]})).toString('base64url')+'.fake_signature'}
async function setup(page:Page,mode:'member'|'uninvited'|'aal1'|'signedout'='member'){
 let record:any=null;const calls:{name:string;body:any}[]=[];
 await page.route('https://test.supabase.co/**',async route=>{
 const request=route.request(),url=new URL(request.url()); const name=url.pathname.split('/').pop()!;
 if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});return;}
 let body:any={};try{body=request.postDataJSON()||{}}catch{}
 let data:any={};
 if(url.pathname.includes('/rest/v1/rpc/')){
 calls.push({name,body});
 if(name==='my_access')data=mode==='uninvited'?{state:'uninvited'}:{state:'member',member};
 else if(name==='portal_bootstrap')data={member,years:[{id:yearId,label:year+'–'+(year+1),starts_on:year+'-01-01',ends_on:year+'-12-31',active:true}],behaviors:[{id:behaviorId,name:'Test handbook behavior',policy_reference:'Fictional test policy',active:true}],counts:{total:record?1:0,open:record?1:0,students:record?1:0,active_actions:0},followups:[]};
 else if(name==='list_cases')data={items:record?[record]:[],total:record?1:0};
 else if(name==='search_students')data=record?[{id:'student-1',school_id:'TEST-001',full_name:'Fictional Student',case_count:1}]:[];
 else if(name==='save_case'){record={...body.p_payload,id:caseId,case_no:'POD-TEST-000001',year_label:year+'–'+(year+1),behavior_name:'Test handbook behavior',status:'draft',created_at:now,updated_at:now,created_by:userId,created_by_name:'Test Principal',version:1,participant_names:body.p_payload.participants.map((p:any)=>p.full_name).join(', '),participants:body.p_payload.participants.map((p:any,i:number)=>({...p,id:'participant-'+i,student_id:'student-'+(i+1),finding:'pending',prior_confirmed:0})),actions:[],events:[]};data=caseId;}
 else if(name==='get_case')data=record;
 else if(name==='set_case_status'){record.status=body.p_status;record.version++;data=null}
 else if(name==='export_records')data={cases:[record],generated_at:now,generated_by:member.full_name,role:'principal'};
 else if(name==='get_student_record')data={student:{id:'student-1',school_id:'TEST-001',full_name:'Fictional Student'},cases:[{...record,student_role:'respondent',finding:'pending'}]};
 else if(name==='case_history')data=[];
 else if(name==='admin_list_staff')data={members:[member],invitations:[]};
 else if(name==='list_audit')data={items:[],total:0};
 else if(name==='redeem_invitation')data={ok:false,message:'This code is invalid, expired, or belongs to a different Google account.'};
 }else if(url.pathname.endsWith('/user'))data=user;
 else if(url.pathname.includes('/factors'))data={all:user.factors,totp:user.factors,phone:[]};
 await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
 });
 if(mode!=='signedout')await page.addInitScript(({user,access,expires})=>{sessionStorage.setItem('sb-test-auth-token',JSON.stringify({access_token:access,refresh_token:'fake-refresh-token',expires_in:3600,expires_at:expires,token_type:'bearer',user}))},{user,access:token(mode==='aal1'||mode==='uninvited'?'aal1':'aal2'),expires:Math.floor(Date.now()/1000)+3600});
 return {calls};
}
test('Google sign-in landing page has no student-data request',async({page})=>{
 const {calls}=await setup(page,'signedout');await page.goto('/');
 await expect(page.getByRole('heading',{name:'Welcome to the office'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Continue with Google'})).toBeVisible();
 expect(calls.filter(c=>c.name!=='my_access')).toHaveLength(0);
 await page.screenshot({path:'test-results/preview-login.png',fullPage:true});
});
test('uninvited account sees only its access-code form',async({page})=>{
 const {calls}=await setup(page,'uninvited');await page.goto('/');
 await expect(page.getByRole('heading',{name:'Your personal invitation'})).toBeVisible();
 await page.getByLabel('School access code').fill('WRONG');
 await page.getByRole('button',{name:'Verify school access'}).click();
 await expect(page.getByRole('alert')).toContainText('invalid');
 expect(calls.some(c=>c.name==='portal_bootstrap'||c.name==='list_cases')).toBe(false);
});
test('enrolled account without MFA cannot open records',async({page})=>{
 const {calls}=await setup(page,'aal1');await page.goto('/');
 await expect(page.getByRole('heading',{name:'Enter your six-digit code'})).toBeVisible();
 expect(calls.some(c=>c.name==='portal_bootstrap')).toBe(false);
});
test('record a case, inspect student history, and download valid Word',async({page})=>{
 await setup(page);await page.setViewportSize({width:1440,height:1000});await page.goto('/');
 await expect(page.getByRole('heading',{name:'Office overview'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'The records start here'})).toBeVisible();
 await page.screenshot({path:'test-results/preview-dashboard.png',fullPage:true});
 await page.getByRole('button',{name:'Record incident',exact:true}).first().click();
 await expect(page.getByRole('heading',{name:'Record an incident'})).toBeVisible();
 await page.getByLabel('Behavior / handbook category').selectOption(behaviorId);
 await page.getByLabel('Location',{exact:true}).fill('Fictional classroom');
 await page.getByLabel('Factual account of the incident').fill('A fictional incident for an automated interface test. No real student information.');
 await page.getByLabel('School student ID',{exact:true}).fill('TEST-001');
 await page.getByLabel('Full name',{exact:true}).fill('Fictional Student');
 await page.getByLabel('Section',{exact:true}).fill('Test Section');
 await page.getByLabel('Statement availability').selectOption('recorded');
 await page.getByLabel('Respondent student’s statement').fill('This is a fictional student statement used in testing.');
 await page.screenshot({path:'test-results/preview-recording.png',fullPage:true});
 await page.getByRole('button',{name:'Save incident draft'}).click();
 await expect(page.getByRole('heading',{name:'POD-TEST-000001',exact:true})).toBeVisible();
 await expect(page.getByText('Pending review',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Submit for review',exact:true}).click();
 await page.getByLabel('Reason / decision note').fill('Submitted to the office for formal review.');
 await page.getByRole('button',{name:'Confirm and record'}).click();
 await expect(page.getByText('Reported',{exact:true})).toBeVisible();
 const downloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'Export Word',exact:true}).click();
 const download=await downloadPromise;
 expect(download.suggestedFilename()).toMatch(/\.docx$/);
 await fs.mkdir('test-results',{recursive:true});await download.saveAs('test-results/test-record.docx');
 const bytes=await fs.readFile('test-results/test-record.docx');expect(bytes.subarray(0,2).toString()).toBe('PK');expect(bytes.length).toBeGreaterThan(4000);
 await page.getByRole('button',{name:'Fictional Student',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Fictional Student',exact:true})).toBeVisible();
 await expect(page.getByText('Respondent',{exact:true})).toBeVisible();
});
test('phone navigation and incident form fit the viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);await page.goto('/');
 await expect(page.getByRole('heading',{name:'Office overview'})).toBeVisible();
 await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('button',{name:'Record incident',exact:true}).first().click();
 await expect(page.getByRole('heading',{name:'Record an incident'})).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
 expect(overflow).toBe(false);
 await page.screenshot({path:'test-results/preview-mobile.png',fullPage:true});
});
