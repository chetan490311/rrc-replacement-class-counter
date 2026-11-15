
import { Preferences } from '@capacitor/preferences';
import * as XLSX from 'xlsx';
import './style.css';

const KEY='rrc-v1-data';
const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday'];
const defaultData={teachers:[],routine:{},records:[],school:'KMC',department:'',lastImport:null};
let data=defaultData, selectedDate=new Date().toISOString().slice(0,10), selectedDay=weekdays[(new Date().getDay()+6)%7]||'Monday', tab='counter', editingTeacher=null;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){try{const x=await Preferences.get({key:KEY});if(x.value)data={...defaultData,...JSON.parse(x.value)}}catch(e){console.warn(e)}}
async function save(){await Preferences.set({key:KEY,value:JSON.stringify(data)});render()}
function norm(s){return String(s||'').replace(/\s+/g,' ').trim().toUpperCase()}
function parseCell(value){
  const raw=String(value??'').replace(/\r/g,'').trim();
  if(!raw)return {subject:'',teachers:'',raw:''};
  const lines=raw.split('\n').map(x=>x.trim()).filter(Boolean);
  const first=lines[0]||'';
  const second=lines.slice(1).join(' ').replace(/\s+/g,' ').trim();
  const isLab=/LAB/i.test(first);
  return {subject:first,teachers:second||'',raw,isLab};
}
function sectionName(v){return String(v||'').replace(/\s*\([^)]*\)/g,'').trim()}
function routineRows(day){return data.routine[day]||[]}
function teacherSections(t){
  const initials=norm(t.initials);
  const out=[];
  for(const day of weekdays) for(const row of routineRows(day)){
    for(let p=0;p<row.cells.length;p++){
      const c=parseCell(row.cells[p]);
      const tokens=norm(c.teachers).split(/[+,\s]+/).filter(Boolean);
      if(tokens.includes(initials)) out.push({day,section:row.section,period:p+1,subject:c.subject,lab:!!c.isLab});
    }
  }
  return out;
}
function teacherLabs(t){
  return teacherSections(t).filter(x=>x.lab);
}
function activeTeachers(){return data.teachers}
function addRecord(t, section, type, periods){
  data.records.push({id:crypto.randomUUID(),dateBS:document.querySelector('#dateBS')?.value||'',dateAD:selectedDate,weekday:selectedDay,teacherId:t.id,teacher:t.name,initials:t.initials,subject:t.subject,section,type,periods:Number(periods),createdAt:new Date().toISOString()});
  save();
}
function shell(){return `<header><div class="brand"><div class="logo">R</div><div><b>RRC</b><small>REPLACEMENT CLASS COUNTER</small></div></div><div class="topmeta">OFFLINE RECORDS</div></header>
<nav>${[['counter','Counter'],['teachers','Teachers'],['routine','Master routine'],['reports','Reports'],['backup','Backup']].map(([id,n])=>`<button class="${tab===id?'active':''}" data-tab="${id}">${n}</button>`).join('')}</nav><main id="view"></main><footer>RRC 1.0 · Local device storage · Verify imported routine before use</footer>`}
function render(){document.querySelector('#app').innerHTML=shell();const v=document.querySelector('#view');v.innerHTML=tab==='counter'?counterView():tab==='teachers'?teachersView():tab==='routine'?routineView():tab==='reports'?reportsView():backupView();wire()}
function counterView(){
 const dayRows=routineRows(selectedDay);
 const dateVal=selectedDate;
 return `<section class="hero"><div><span class="eyebrow">DAILY ENTRY</span><h1>Replacement counter</h1><p>Choose a date, then record a replacement for a teacher.</p></div><div class="total"><b>${data.records.filter(r=>r.dateAD===dateVal).reduce((a,r)=>a+r.periods,0)}</b><small>periods today</small></div></section>
 <div class="panel controls"><label>Date (AD for weekday lookup)<input id="dateAD" type="date" value="${esc(selectedDate)}"></label><label>Weekday routine<select id="weekday">${weekdays.map(d=>`<option ${d===selectedDay?'selected':''}>${d}</option>`).join('')}</select></label><label>Nepali date (BS)<input id="dateBS" placeholder="e.g. 2083-07-28" value="${esc(bsForDate(dateVal))}"></label></div>
 <div class="note">The current build stores the BS date you enter and uses the selected weekday sheet. Automatic BS–AD conversion will be added in the calendar integration stage.</div>
 ${activeTeachers().length?`<div class="teacher-grid">${activeTeachers().map(t=>`<button class="teacher-card" data-teacher="${t.id}"><b>${esc(t.initials)}</b><span>${esc(t.name)}</span><small>${esc(t.subject)}</small><em>Record replacement →</em></button>`).join('')}</div>`:'<div class="empty">Add teachers and import the master routine to begin.</div>'}
 <section class="panel"><h2>Entries for selected date</h2>${recordsForDate(dateVal).map(recordLine).join('')||'<p class="muted">No replacement entries for this date.</p>'}</section>`;
}
function bsForDate(){return ''}
function recordsForDate(d){return data.records.filter(r=>r.dateAD===d)}
function recordLine(r){return `<div class="record"><div><b>${esc(r.initials)} · ${esc(r.teacher)}</b><small>${esc(r.section)} · ${esc(r.type)} · ${r.periods} period(s) · BS ${esc(r.dateBS)}</small></div><button class="danger small" data-delete-record="${r.id}">Undo</button></div>`}
function teachersView(){return `<section class="hero"><div><span class="eyebrow">DIRECTORY</span><h1>Teachers</h1><p>Register the teachers who can receive replacement assignments.</p></div></section>
 <form id="teacherForm" class="panel formgrid"><h2>${editingTeacher?'Edit teacher':'Add teacher'}</h2><input type="hidden" id="teacherId" value="${editingTeacher?.id||''}"><label>Initials<input id="initials" required maxlength="12" value="${esc(editingTeacher?.initials||'')}" placeholder="CP"></label><label>Full name<input id="teacherName" required value="${esc(editingTeacher?.name||'')}" placeholder="Chetan Poudel"></label><label>Subject<input id="subject" required value="${esc(editingTeacher?.subject||'')}" placeholder="Physics"></label><button class="primary" type="submit">Save teacher</button></form>
 <section class="panel"><h2>Registered teachers (${data.teachers.length})</h2>${data.teachers.map(t=>`<div class="record"><div><b>${esc(t.initials)} · ${esc(t.name)}</b><small>${esc(t.subject)} · ${teacherSections(t).length} routine assignment(s)</small></div><div class="actions"><button class="small" data-edit-teacher="${t.id}">Edit</button><button class="danger small" data-remove-teacher="${t.id}">Delete</button></div></div>`).join('')||'<p class="muted">No teachers added yet.</p>'}</section>`}
function routineView(){
 return `<section class="hero"><div><span class="eyebrow">MASTER TIMETABLE</span><h1>Import & edit routine</h1><p>Import the five weekday sheets, review extracted cells, then save your corrected version.</p></div></section>
 <section class="panel"><h2>1. Upload Excel workbook</h2><p class="muted">Supports .xlsx and .xls. Expected layout: section labels in column A; period cells in columns B–J. Cells may contain subject on the first line and teacher initials on the next line.</p><input type="file" id="excelFile" accept=".xlsx,.xls"><button class="primary" id="importBtn">Import workbook</button><div id="importStatus" class="muted"></div></section>
 <section class="panel"><h2>2. Edit imported cells</h2><div class="toolbar"><label>Day<select id="routineDay">${weekdays.map(d=>`<option>${d}</option>`).join('')}</select></label><button class="primary" id="saveRoutine">Save routine edits</button></div><div id="routineEditor">${routineEditor('Monday')}</div></section>
 <section class="panel"><h2>3. Import review</h2><p class="muted">The importer keeps the raw cell text for manual correction. Check all teacher initials and lab entries before using the counter.</p><p>${data.lastImport?`Last imported: ${esc(data.lastImport)} · ${weekdays.reduce((n,d)=>n+routineRows(d).length,0)} section rows`:'No workbook imported yet.'}</p></section>`;
}
function routineEditor(day){
 const rows=routineRows(day);if(!rows.length)return '<p class="muted">No data for this weekday yet.</p>';
 return `<div class="tablewrap"><table class="routine"><thead><tr><th>Section</th>${Array.from({length:9},(_,i)=>`<th>P${i+1}</th>`).join('')}</tr></thead><tbody>${rows.map((r,ri)=>`<tr><td><input data-section="${ri}" value="${esc(r.section)}"></td>${r.cells.map((c,ci)=>`<td><textarea data-cell="${ri}:${ci}" rows="2">${esc(c||'')}</textarea></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function reportsView(){
 const total=data.records.reduce((a,r)=>a+r.periods,0);
 const grouped={};for(const r of data.records){const k=r.teacher;grouped[k]??={initials:r.initials,periods:0,dates:[],sections:[]};grouped[k].periods+=r.periods;grouped[k].dates.push(`${r.dateBS||r.dateAD} (${r.section})`);grouped[k].sections.push(r.section)}
 return `<section class="hero"><div><span class="eyebrow">REPORTS</span><h1>Replacement summary</h1><p>Teacher totals and detailed assignment dates.</p></div><div class="total"><b>${total}</b><small>periods recorded</small></div></section><section class="panel"><div class="toolbar"><label>From (AD)<input id="fromDate" type="date"></label><label>To (AD)<input id="toDate" type="date"></label><button class="primary" id="filterReport">Filter</button><button id="pngReport">Print / Save report</button></div><div id="reportTable">${reportTable(grouped)}</div></section>`;
}
function reportTable(g){return `<div class="tablewrap"><table><thead><tr><th>Initials</th><th>Teacher</th><th>Replacement classes</th><th>Dates / sections</th></tr></thead><tbody>${Object.entries(g).map(([n,x])=>`<tr><td>${esc(x.initials)}</td><td>${esc(n)}</td><td>${x.periods}</td><td>${esc(x.dates.join(', '))}</td></tr>`).join('')}</tbody></table></div>`}
function backupView(){return `<section class="hero"><div><span class="eyebrow">DATA SAFETY</span><h1>Backup & restore</h1><p>Keep a copy of teacher records, routine edits and replacement history.</p></div></section><section class="panel"><button class="primary" id="exportBackup">Download JSON backup</button><label class="filelabel">Restore from backup<input id="restoreBackup" type="file" accept=".json,application/json"></label><p class="muted">Store backup files somewhere safe. Clearing app data or uninstalling the app can erase local records if you have not exported a backup.</p></section>`}
function openEntry(tid){
 const t=data.teachers.find(x=>x.id===tid);if(!t)return;
 const matches=teacherSections(t).filter(x=>x.day===selectedDay);
 const classes=[...new Set(matches.filter(x=>!x.lab).map(x=>x.section))];
 const labEligible=/physics/i.test(t.subject)?'Physics Lab':/chem/i.test(t.subject)?'Chemistry Lab':/bio/i.test(t.subject)?'Biology Lab':/computer|ict/i.test(t.subject)?'Computer Lab':null;
 const labAssignments=matches.filter(x=>x.lab);
 const labs=labEligible?[labEligible]:[...new Set(labAssignments.map(x=>x.subject.replace(/LAB.*/i,'Lab').trim()))];
 const options=[...classes.map(x=>({name:x,type:'Section'})),...labs.map(x=>({name:x,type:'Lab'}))];
 const modal=document.createElement('dialog');modal.className='modal';
 modal.innerHTML=`<form method="dialog" class="modalbox"><button class="close" value="cancel">×</button><h2>${esc(t.initials)} · ${esc(t.name)}</h2><p class="muted">${esc(t.subject)} · ${selectedDay}</p><label>Choose section / lab<select id="entryPlace">${options.map(o=>`<option value="${esc(o.name)}" data-type="${o.type}">${esc(o.name)}${o.type==='Lab'?' (Laboratory)':''}</option>`).join('')}</select></label><div id="labPeriods" class="hidden"><label>Laboratory periods<select id="periodCount"><option value="1">One period</option><option value="2">Both periods</option></select></label></div><button class="primary" id="saveEntry" value="default" ${options.length?'':'disabled'}>Save replacement</button><p class="muted">${options.length?'Only routine-matched sections and eligible subject labs are listed.':'No matching section found for this teacher on this weekday. Check teacher initials in the routine editor.'}</p></form>`;
 document.body.append(modal);
 const place=modal.querySelector('#entryPlace'), lab=modal.querySelector('#labPeriods');
 const toggle=()=>{const op=place.selectedOptions[0];lab.classList.toggle('hidden',op?.dataset.type!=='Lab')};place.addEventListener('change',toggle);toggle();
 modal.querySelector('#saveEntry').addEventListener('click',e=>{e.preventDefault();if(!options.length)return;const op=place.selectedOptions[0];addRecord(t,place.value,op.dataset.type,op.dataset.type==='Lab'?modal.querySelector('#periodCount').value:1);modal.close();modal.remove()});
 modal.addEventListener('close',()=>modal.remove());modal.showModal();
}
function wire(){
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;editingTeacher=null;render()});
 const date=document.querySelector('#dateAD');if(date)date.onchange=()=>{selectedDate=date.value;const d=new Date(date.value+'T12:00:00');selectedDay=weekdays[(d.getDay()+6)%7]||'Monday';render()};
 const wd=document.querySelector('#weekday');if(wd)wd.onchange=()=>{selectedDay=wd.value;render()};
 document.querySelectorAll('[data-teacher]').forEach(b=>b.onclick=()=>openEntry(b.dataset.teacher));
 document.querySelectorAll('[data-delete-record]').forEach(b=>b.onclick=()=>{if(confirm('Undo this replacement entry?')){data.records=data.records.filter(r=>r.id!==b.dataset.deleteRecord);save()}});
 const tf=document.querySelector('#teacherForm');if(tf)tf.onsubmit=e=>{e.preventDefault();const id=document.querySelector('#teacherId').value;const obj={id:id||crypto.randomUUID(),initials:document.querySelector('#initials').value.trim(),name:document.querySelector('#teacherName').value.trim(),subject:document.querySelector('#subject').value.trim()};if(id)data.teachers=data.teachers.map(t=>t.id===id?obj:t);else data.teachers.push(obj);editingTeacher=null;save()};
 document.querySelectorAll('[data-edit-teacher]').forEach(b=>b.onclick=()=>{editingTeacher=data.teachers.find(t=>t.id===b.dataset.editTeacher);render()});
 document.querySelectorAll('[data-remove-teacher]').forEach(b=>b.onclick=()=>{if(confirm('Delete this teacher? Existing replacement history will remain.')){data.teachers=data.teachers.filter(t=>t.id!==b.dataset.removeTeacher);save()}});
 const day=document.querySelector('#routineDay');if(day)day.onchange=()=>{document.querySelector('#routineEditor').innerHTML=routineEditor(day.value);wireRoutineSave()};
 wireRoutineSave();
 const file=document.querySelector('#excelFile'),btn=document.querySelector('#importBtn');if(btn)btn.onclick=async()=>{if(!file.files[0]){alert('Choose an Excel workbook first.');return}try{const buf=await file.files[0].arrayBuffer();const wb=XLSX.read(buf,{type:'array'});const next={};for(const d of weekdays){const ws=wb.Sheets[d];if(!ws){next[d]=[];continue}const range=XLSX.utils.decode_range(ws['!ref']||'A1');const rows=[];for(let r=range.s.r+4;r<=range.e.r;r++){const label=ws[XLSX.utils.encode_cell({r,c:0})]?.v;if(!label||!/^(XI|XII)\\s*M\\s*\\d+/i.test(String(label).trim()))continue;const cells=[];for(let c=1;c<=9;c++){const cell=ws[XLSX.utils.encode_cell({r,c})];cells.push(cell?.v==null?'':String(cell.v))}rows.push({section:sectionName(label),rawSection:String(label),cells})}next[d]=rows}data.routine=next;data.lastImport=new Date().toLocaleString();await save();document.querySelector('#importStatus').textContent=`Imported ${weekdays.reduce((n,d)=>n+next[d].length,0)} section rows from ${wb.SheetNames.length} worksheet(s). Review every sheet before approval.`;document.querySelector('#routineEditor').innerHTML=routineEditor('Monday');wireRoutineSave()}catch(err){alert('Could not read workbook: '+err.message)}};
 const saveR=document.querySelector('#saveRoutine');if(saveR)saveR.onclick=()=>{const d=document.querySelector('#routineDay').value;const rows=data.routine[d]||[];document.querySelectorAll('[data-section]').forEach(i=>rows[Number(i.dataset.section)].section=i.value);document.querySelectorAll('[data-cell]').forEach(i=>{const [r,c]=i.dataset.cell.split(':').map(Number);rows[r].cells[c]=i.value});data.routine[d]=rows;save();alert(d+' routine saved.')};
 const ex=document.querySelector('#exportBackup');if(ex)ex.onclick=()=>download('rrc-backup.json',JSON.stringify(data,null,2),'application/json');
 const restore=document.querySelector('#restoreBackup');if(restore)restore.onchange=async()=>{try{data={...defaultData,...JSON.parse(await restore.files[0].text())};await save();alert('Backup restored.')}catch(e){alert('Invalid backup file.')}};
 const filter=document.querySelector('#filterReport');if(filter)filter.onclick=()=>{const from=document.querySelector('#fromDate').value,to=document.querySelector('#toDate').value;const g={};for(const r of data.records){if(from&&r.dateAD<from||to&&r.dateAD>to)continue;g[r.teacher]??={initials:r.initials,periods:0,dates:[]};g[r.teacher].periods+=r.periods;g[r.teacher].dates.push(`${r.dateBS||r.dateAD} (${r.section})`)}document.querySelector('#reportTable').innerHTML=reportTable(g)};
 const png=document.querySelector('#pngReport');if(png)png.onclick=()=>window.print();
}
function wireRoutineSave(){const saveR=document.querySelector('#saveRoutine');if(saveR)saveR.onclick=()=>{const d=document.querySelector('#routineDay').value;const rows=data.routine[d]||[];document.querySelectorAll('[data-section]').forEach(i=>rows[Number(i.dataset.section)].section=i.value);document.querySelectorAll('[data-cell]').forEach(i=>{const [r,c]=i.dataset.cell.split(':').map(Number);rows[r].cells[c]=i.value});data.routine[d]=rows;save();alert(d+' routine saved.')}}
function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
load().then(() => {
  render();
}).catch(error => {
  console.error("RRC initialization failed:", error);
});
