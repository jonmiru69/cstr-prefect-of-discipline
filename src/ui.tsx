import { useEffect, useRef, useState, type DependencyList, type ReactNode } from 'react';
import { AlertCircle, Inbox, LoaderCircle, X } from 'lucide-react';
import { errorMessage } from './lib';
import { STATUS_NAMES,FINDING_NAMES } from './types';

export function useLoad<T>(loader:()=>Promise<T>, deps:DependencyList) {
 const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{let live=true; setLoading(true);setError('');setData(null);
 loader().then(v=>{if(live)setData(v)}).catch(e=>{if(live)setError(errorMessage(e))}).finally(()=>{if(live)setLoading(false)});
 return()=>{live=false};
 // The caller supplies dependencies intentionally, including the loaded entity ID.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[...deps,revision]);
 return {data,error,loading,reload:()=>setRevision(v=>v+1)};
}
export function Alert({children,success=false}:{children:ReactNode;success?:boolean}) {
 return <div role={success?'status':'alert'} className={'notice '+(success?'success':'error')}><AlertCircle size={18}/><div>{children}</div></div>;
}
export function Loading(){return <div className="loading" role="status"><LoaderCircle className="spin" size={22}/>Loading…</div>}
export function Empty({title,children,action}:{title:string;children?:ReactNode;action?:ReactNode}){
 return <div className="empty"><Inbox size={32} strokeWidth={1.4}/><h3>{title}</h3><p>{children}</p>{action}</div>;
}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){
 return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;
}
export function Badge({value}:{value:string}){return <span className={'badge badge-'+value}>{STATUS_NAMES[value]||FINDING_NAMES[value]||({respondent:'Respondent',affected:'Affected student',witness:'Witness'} as Record<string,string>)[value]||value.replaceAll('_',' ')}</span>}
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const d=ref.current;d?.showModal();return()=>d?.close()},[]);
 return <dialog ref={ref} className="modal" aria-label={title} onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
 <div className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={22}/></button></div>{children}</dialog>;
}
export function PageHeading({eyebrow,title,description,actions}:{eyebrow?:string;title:string;description?:string;actions?:ReactNode}){
 return <div className="page-heading"><div>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description&&<p className="subtle">{description}</p>}</div>{actions&&<div className="heading-actions">{actions}</div>}</div>;
}
export function ReasonDialog({title,description,onClose,onSubmit,children}:{title:string;description:string;onClose:()=>void;onSubmit:(reason:string)=>Promise<void>;children?:ReactNode}){
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <Modal title={title} onClose={()=>{if(!busy)onClose()}}><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await onSubmit(reason);onClose()}catch(e){setError(errorMessage(e))}finally{setBusy(false)}}}><p>{description}</p>{children}
 <Field label="Reason / decision note"><textarea required minLength={10} maxLength={10000} rows={4} value={reason} onChange={e=>setReason(e.target.value)}/></Field>
 {error&&<Alert>{error}</Alert>}<div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button" disabled={busy}>{busy?'Saving…':'Confirm and record'}</button></div></form></Modal>
}
