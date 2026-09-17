import { useEffect,useState,type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight,LockKeyhole,ShieldCheck,KeyRound } from 'lucide-react';
import { configured,errorMessage,rpc,supabase } from './lib';
import { ROLE_NAMES,type Member,type Role } from './types';
import { Alert,Field,Loading } from './ui';

export function Brand({compact=false}:{compact?:boolean}){
 return <div className={'brand '+(compact?'compact':'')}><img className="brand-mark" src="/logo.png" alt="Colegio de Sto. Tomas – Recoletos seal" width={50} height={50}/><div className="brand-text"><strong>CSTR</strong><span>PREFECT OF DISCIPLINE</span></div></div>
}
function AuthLayout({children}:{children:ReactNode}){
 return <main className="auth-page"><section className="auth-intro"><Brand/><div className="auth-message"><p className="eyebrow gold">COLEGIO DE STO. TOMAS – RECOLETOS, INC.</p><h1>Careful records.<br/>Accountable decisions.</h1><p>A confidential workspace for the Prefect of Discipline and authorized school personnel.</p><div className="auth-rule"/><span><ShieldCheck size={18}/>JUNIOR & SENIOR HIGH SCHOOL</span></div><p className="auth-foot">Student information is accessible only to authorized staff.</p></section><section className="auth-form-panel">{children}<p className="privacy-contact">{import.meta.env.VITE_PRIVACY_CONTACT||'Contact the CSTR school office for privacy requests.'} <a href="/privacy.html">Privacy notice</a></p></section></main>
}
export function AuthGate({children}:{children:(member:Member)=>ReactNode}){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(configured),[error,setError]=useState('');
 const [access,setAccess]=useState<{state:string;member?:Member}|null>(null),[aal,setAal]=useState(''),[refresh,setRefresh]=useState(0);
 const [welcome,setWelcome]=useState('');
 useEffect(()=>{
  if(!supabase)return;
  supabase.auth.getSession().then(({data,error})=>{if(error)setError(error.message);setSession(data.session);setLoading(false)});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next); if(!next){setAccess(null);setAal('')}});
  return()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{
  if(!session||!supabase)return;
  let live=true;setLoading(true);setError('');
  Promise.all([rpc<{state:string;member?:Member}>('my_access'),supabase.auth.mfa.getAuthenticatorAssuranceLevel()])
  .then(([a,m])=>{if(!live)return;if(m.error)throw m.error;setAccess(a);setAal(m.data.currentLevel||'aal1')})
  .catch(e=>{if(live)setError(errorMessage(e))}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[session?.access_token,refresh]);
 const signOut=async()=>{await supabase?.auth.signOut({scope:'local'});setWelcome('');setSession(null)};
 if(!configured)return <AuthLayout><div className="auth-card"><LockKeyhole className="auth-icon"/><p className="eyebrow">ONE-TIME SETUP</p><h2>Connect the school portal</h2><p>The website files are ready. The project owner must add the Supabase URL and publishable key in Cloudflare Pages, then redeploy.</p><div className="setup-keys"><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_PUBLISHABLE_KEY</code></div><p className="subtle">Follow the included START-HERE guide. Student records remain empty until the office records a case.</p></div></AuthLayout>;
 if(session&&access?.state==='member'&&aal==='aal2'&&!loading&&!error)return <>{children(access.member!)}</>;
 return <AuthLayout><div className="auth-card">
 {loading?<Loading/>:!session?<><LockKeyhole className="auth-icon"/><p className="eyebrow">AUTHORIZED PERSONNEL ONLY</p><h2>Welcome to the office</h2><p>Sign in with the Google account approved by the school.</p><button className="button google" onClick={async()=>{
 setError('');const {error}=await supabase!.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+window.location.pathname,queryParams:{prompt:'select_account'}}});if(error)setError(error.message);
 }}><span className="google-g">G</span>Continue with Google<ArrowRight size={18}/></button><div className="auth-step-list"><span>01 <strong>Google account</strong></span><span>02 <strong>School access</strong></span><span>03 <strong>Authenticator</strong></span></div><p className="subtle small">First visit? Have your personal school access code ready.</p></>:
 access?.state==='disabled'?<><h2>Access is disabled</h2><p>Contact the principal or system administrator to review your access.</p></>:
 access?.state==='uninvited'?<InviteForm onSuccess={(name,role)=>{setWelcome('Welcome, '+name+'. Your access as '+ROLE_NAMES[role]+' is confirmed.');setRefresh(v=>v+1)}}/>:
 access?.state==='member'?<>{welcome&&<Alert success>{welcome}</Alert>}<MfaForm onSuccess={()=>setRefresh(v=>v+1)}/></>:null}
 {error&&<Alert>{error}<button className="text-button" onClick={()=>setRefresh(v=>v+1)}>Try again</button></Alert>}
 {session&&<button className="text-button signout-link" onClick={signOut}>Sign out / use a different Google account</button>}
 </div></AuthLayout>
}
function InviteForm({onSuccess}:{onSuccess:(name:string,role:Role)=>void}){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await rpc<{ok:boolean;message?:string;name:string;role:Role}>('redeem_invitation',{p_code:code});if(!r.ok)throw new Error(r.message);setCode('');onSuccess(r.name,r.role)}catch(e){setError(errorMessage(e))}finally{setBusy(false)}}}><KeyRound className="auth-icon"/><p className="eyebrow">SCHOOL ACCESS</p><h2>Your personal invitation</h2><p>Paste the access code issued to your Google account. It can be used once.</p><Field label="School access code"><input required type="password" autoComplete="off" maxLength={100} value={code} onChange={e=>setCode(e.target.value)} placeholder="Paste your personal code"/></Field>{error&&<Alert>{error}</Alert>}<button className="button full" disabled={busy}>{busy?'Checking…':'Verify school access'}<ArrowRight size={18}/></button></form>
}
export function MfaForm({onSuccess,backup=false}:{onSuccess:()=>void;backup?:boolean}){
 const [choices,setChoices]=useState<{id:string;friendly_name?:string}[]>([]); const [factor,setFactor]=useState(''),[qr,setQr]=useState(''),[secret,setSecret]=useState(''),[code,setCode]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[enroll,setEnroll]=useState(false);
 useEffect(()=>{let live=true;supabase!.auth.mfa.listFactors().then(({data,error})=>{if(!live)return;if(error){setError(error.message);setLoading(false);return}setChoices(data.totp.filter(x=>x.status==='verified'));const f=data.totp.find(x=>x.status==='verified');if(f&&!backup)setFactor(f.id);else setEnroll(true);setLoading(false)});return()=>{live=false}},[backup]);
 async function setup(){
 setBusy(true);setError('');
 try{
  const {data:existing}=await supabase!.auth.mfa.listFactors();
  for(const f of existing?.all||[])if(f.factor_type==='totp'&&f.status==='unverified')await supabase!.auth.mfa.unenroll({factorId:f.id});
  const {data,error}=await supabase!.auth.mfa.enroll({factorType:'totp',friendlyName:'CSTR '+(backup?'backup ':'')+new Date().toISOString().slice(0,16)});
  if(error)throw error;
  setFactor(data.id);setQr(data.totp.qr_code.startsWith('data:')?data.totp.qr_code:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(data.totp.qr_code));setSecret(data.totp.secret);
 }catch(e){setError(errorMessage(e))}finally{setBusy(false)}
 }
 if(loading)return <Loading/>;
 return <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{
 const {error}=await supabase!.auth.mfa.challengeAndVerify({factorId:factor,code:code.replaceAll(' ','')});if(error)throw error;setSecret('');setQr('');setCode('');onSuccess();
 }catch(e){setError(errorMessage(e))}finally{setBusy(false)}}}><ShieldCheck className="auth-icon"/><p className="eyebrow">{backup?'BACKUP AUTHENTICATOR':'IDENTITY VERIFICATION'}</p><h2>{enroll?'Set up your authenticator':'Enter your six-digit code'}</h2>
 <p>{enroll?'Use a free authenticator app on your phone. Scan the QR code, then enter the six-digit code it displays.':'Open your authenticator app and enter the current code for CSTR.'}</p>
 {enroll&&!factor&&<button className="button full" type="button" disabled={busy} onClick={setup}>{busy?'Preparing…':'Show setup QR code'}</button>}
 {qr&&<div className="qr-block"><img src={qr} width={200} height={200} alt="Scan this QR code with your authenticator app"/><details><summary>Enter a setup key manually</summary><code className="secret">{secret}</code></details></div>}
 {factor&&<>{!enroll&&choices.length>1&&<Field label="Authenticator device"><select value={factor} onChange={e=>setFactor(e.target.value)}>{choices.map((f,i)=><option key={f.id} value={f.id}>{f.friendly_name||'Authenticator '+(i+1)}</option>)}</select></Field>}<Field label="Authenticator code"><input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} placeholder="000000" className="otp"/></Field><button className="button full" disabled={busy}>{busy?'Verifying…':'Verify and continue'}<ArrowRight size={18}/></button></>}
 {error&&<Alert>{error}</Alert>}
 </form>
}
