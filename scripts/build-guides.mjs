import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function inline(s){
 return esc(s).replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_,label,url)=>'<a href="'+url.replace(/\.md(?=#|$)/,'.html')+'">'+label+'</a>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[\s(])(https:\/\/[^\s<)]+)/g,'$1<a href="$2">$2</a>');
}
function render(md){
 const lines=md.split(/\r?\n/);let html='',i=0,toc=[];
 while(i<lines.length){
  const line=lines[i];
  if(!line.trim()){i++;continue;}
  if(line.startsWith('~~~')){
   let code=[];i++;while(i<lines.length&&!lines[i].startsWith('~~~'))code.push(lines[i++]);i++;
   html+='<pre><code>'+esc(code.join('\n'))+'</code></pre>';continue;
  }
  const h=/^(#{1,3}) (.+)$/.exec(line);
  if(h){const level=h[1].length,id='section-'+i;html+='<h'+level+' id="'+id+'">'+inline(h[2])+'</h'+level+'>';if(level===2)toc.push('<a href="#'+id+'">'+inline(h[2])+'</a>');i++;continue;}
  if(line.startsWith('|')){
   let rows=[];while(i<lines.length&&lines[i].startsWith('|'))rows.push(lines[i++]);
   const cells=r=>r.split('|').slice(1,-1).map(c=>c.trim());
   html+='<div class="table-wrap"><table><thead><tr>'+cells(rows[0]).map(c=>'<th>'+inline(c)+'</th>').join('')+'</tr></thead><tbody>';
   for(const r of rows.slice(2))html+='<tr>'+cells(r).map(c=>'<td>'+inline(c)+'</td>').join('')+'</tr>';
   html+='</tbody></table></div>';continue;
  }
  if(/^\s*(?:\d+\.|-)\s/.test(line)){
   const ordered=/^\d+\./.test(line),tag=ordered?'ol':'ul',start=ordered?Number(line.match(/^\d+/)[0]):1;
   html+='<'+tag+(ordered?' start="'+start+'"':'')+'>';
   while(i<lines.length&&/^\s*(?:\d+\.|-)\s/.test(lines[i]))html+='<li>'+inline(lines[i++].replace(/^\s*(?:\d+\.|-)\s/,''))+'</li>';
   html+='</'+tag+'>';continue;
  }
  let p=[];while(i<lines.length&&lines[i].trim()&&!/^(?:#|~~~|\||\d+\.\s|-\s)/.test(lines[i]))p.push(lines[i++]);
  html+='<p>'+inline(p.join(' '))+'</p>';
 }
 return {html,toc};
}
const css='*{box-sizing:border-box}body{margin:0;color:#282a30;background:#f4f3f1;font:16px/1.7 system-ui,sans-serif}header{background:#4b0304;color:white;padding:28px 6%;border-bottom:5px solid #d7ab2f}header strong{font-size:22px}header span{display:block;color:#e0c14f;font-size:13px}main{max-width:1140px;margin:auto;display:grid;grid-template-columns:250px minmax(0,1fr);gap:36px;padding:36px 24px 80px}nav{position:sticky;top:20px;max-height:90vh;overflow:auto;font-size:13px;align-self:start}nav a{display:block;padding:5px 10px;border-left:2px solid #dedad4}article{background:white;padding:32px;border-radius:10px;min-width:0}h1{font-size:32px;line-height:1.25;color:#4b0304;margin-top:0}h2{font-size:24px;color:#4b0304;border-top:1px solid #e6e3df;padding-top:28px;margin-top:36px;line-height:1.3}h3{font-size:19px}a{color:#7f0000;overflow-wrap:anywhere}li{margin:9px 0}pre{background:#27282e;color:#fff;padding:18px;border-radius:6px;overflow:auto;font-size:13px;line-height:1.6}code{font-family:Consolas,monospace}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px}th{background:#f4eddc;text-align:left}th,td{padding:12px;border:1px solid #dedad4;vertical-align:top}footer{padding:24px;text-align:center;color:#6b6b75;font-size:13px}@media(max-width:850px){main{display:block;padding:18px 12px}nav{position:static;max-height:240px;margin-bottom:24px}article{padding:22px 18px}h1{font-size:27px}}@media print{nav,header,footer{display:none}main{display:block;padding:0}article{padding:0}h2{break-after:avoid}pre{white-space:pre-wrap;color:black;background:#eee}body{font-size:11pt;background:white}}';
const guides=['START-HERE.md','README.md',...(await readdir(path.join(root,'docs'))).filter(n=>n.endsWith('.md')).map(n=>'docs/'+n)];
for(const name of guides){
 const {html,toc}=render(await readFile(path.join(root,name),'utf8'));
 await writeFile(path.join(root,name.replace(/\.md$/,'.html')),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CSTR · '+esc(name.replace('.md',''))+'</title><style>'+css+'</style></head><body><header><strong>CSTR · Prefect of Discipline</strong><span>SETUP & OPERATIONS · GITHUB + CLOUDFLARE PAGES + SUPABASE</span></header><main><nav aria-label="Contents">'+toc.join('')+'</nav><article>'+html+'</article></main><footer>Version 1.0 · 17 September 2026 · Keep credentials and student records out of GitHub.</footer></body></html>');
}
console.log('Offline HTML guides created.');
