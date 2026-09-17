import { Document,Packer,Paragraph,TextRun,HeadingLevel,AlignmentType,Header,Footer,PageNumber,Table,TableRow,TableCell,WidthType } from 'docx';
import { displayDate,downloadBlob,rpc } from './lib';
import { FINDING_NAMES,ROLE_NAMES,STATUS_NAMES,type CaseDetail,type Role } from './types';
type ExportData={cases:CaseDetail[];generated_at:string;generated_by:string;role:Role};
const text=(value:string,bold=false)=>new Paragraph({children:[new TextRun({text:value||'—',bold})],spacing:{after:100}});
const heading=(value:string)=>new Paragraph({text:value,heading:HeadingLevel.HEADING_2,spacing:{before:240,after:120}});
const lines=(value:string)=>value.split(/\r?\n/).map(v=>text(v||' '));
const row=(key:string,value:string)=>new TableRow({children:[new TableCell({children:[text(key,true)],width:{size:30,type:WidthType.PERCENTAGE}}),new TableCell({children:[text(value)]})]});
export function createRecordDocument(data:ExportData){
 return new Document({
 creator:'CSTR Prefect of Discipline',title:'Confidential discipline record',description:'Authorized school record export',
 styles:{default:{document:{run:{font:'Arial',size:21},paragraph:{spacing:{after:100}}}},paragraphStyles:[{id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:'Arial',size:30,bold:true,color:'B31B2C'}},{id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:'Arial',size:24,bold:true,color:'B31B2C'}}]},
 sections:data.cases.map(c=>({
 properties:{page:{size:{width:11906,height:16838},margin:{top:1134,right:1134,bottom:1134,left:1134}}},
 headers:{default:new Header({children:[new Paragraph({text:'COLEGIO DE STO. TOMAS – RECOLETOS, INC.',alignment:AlignmentType.CENTER}),new Paragraph({text:'PREFECT OF DISCIPLINE • CONFIDENTIAL',alignment:AlignmentType.CENTER})]})},
 footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun('Confidential • '+c.case_no+' • Page '),new TextRun({children:[PageNumber.CURRENT]})]})]})},
 children:[
 new Paragraph({text:'Student Discipline Case Record',heading:HeadingLevel.HEADING_1}),
 new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[
 row('Case number',c.case_no),row('School year',c.year_label),row('Case stage',STATUS_NAMES[c.status]||c.status),
 row('Incident date / time',displayDate(c.happened_at,true)+' (Asia/Manila)'),row('Location',c.location),
 row('Behavior category',c.behavior_name),row('Officially logged',displayDate(c.created_at,true)+' by '+c.created_by_name),
 row('Record version',String(c.version))]}),
 heading('Incident account'),...lines(c.summary),
 ...c.participants.flatMap(p=>[
 heading(p.full_name+' — '+p.role),text('School ID: '+p.school_id+' | Age at incident: '+p.age+' | Grade '+p.grade+' | Section: '+p.section+(p.strand?' | Strand: '+p.strand:'')),
 ...(p.role==='respondent'?[text('Finding: '+(FINDING_NAMES[p.finding||'pending']||p.finding)),text('Prior confirmed incidents of this behavior in this school year: '+(p.prior_confirmed||0)),...lines(p.finding_reason||'Finding not yet recorded.')]:[]),
 text('Statement status: '+p.statement_status.replaceAll('_',' ')+' | Taken: '+displayDate(p.statement_at,true)),
 ...lines(p.statement||'No statement recorded.')
 ]),
 heading('Disciplinary actions and interventions'),
 ...(c.actions.length?c.actions.flatMap(a=>[text(a.student_name+' — '+a.kind+' ('+a.status+')',true),text(displayDate(a.starts_on)+' to '+displayDate(a.ends_on)),...lines(a.description),
 text('Approved: '+displayDate(a.approved_at,true)+' | Authority: '+(a.approved_by_name||'Pending approval')),...lines(a.completion_note||'')]):[text('No actions recorded.')]),
 heading('Office meetings and case timeline'),
 ...(c.events.length?[...c.events].reverse().flatMap(e=>[text(e.title+' — '+displayDate(e.happened_at,true),true),text('Recorded by '+e.author+' on '+displayDate(e.created_at,true)),text('Participants: '+(e.attendees||'Not recorded')),...lines(e.body),...(e.follow_up_on?[text('Follow-up due: '+displayDate(e.follow_up_on))]:[])]):[text('No meetings or notes recorded.')]),
 heading('Export details'),text('Generated '+displayDate(data.generated_at,true)+' by '+data.generated_by+' ('+ROLE_NAMES[data.role]+').'),
 text('This export contains confidential student information. Share only with authorized recipients. The portal retains the authoritative record and revision history.'),
 text('Prepared by: ____________________     Reviewed by: ____________________')
 ]
 }))
 });
}
export async function exportWord(args:{caseId?:string;studentId?:string;yearId?:string}){
 const data=await rpc<ExportData>('export_records',{p_case_id:args.caseId||null,p_student_id:args.studentId||null,p_year_id:args.yearId||null});
 const doc=createRecordDocument(data);
 downloadBlob(await Packer.toBlob(doc),'CSTR-POD-'+(args.caseId?data.cases[0].case_no:'student-record')+'-'+data.generated_at.slice(0,10)+'.docx');
}
