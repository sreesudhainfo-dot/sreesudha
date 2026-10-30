import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CalendarCheck2, ClipboardList, Clock3, LogOut, MapPin, RefreshCw, UserRoundPlus, FolderKanban, Route, BarChart3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { indiaDate, locate, niceDate, niceTime } from './attendance';
import { lookupPortal,PORTAL_KEY } from '../auth/pages/EmployeePortalLogin';

type Person={employee_code:string;full_name:string;kind:'agent'|'staff'};
type Shift={id:string;work_date:string;check_in_at:string;check_out_at:string|null};
type Visit={id:string;visited_at:string;project_name:string;customer_count:number};
type Work={id:string;work_date:string;category:string;description:string;status:string;created_at?:string};
const categories=['Customer Follow-up','Lead Calling','Digital Marketing','Office Work','Accounts','Site Coordination','Other'];
const failText=(e:unknown)=>e instanceof Error?e.message:typeof e==='object'&&e!==null&&'message'in e?String((e as {message:unknown}).message):'Request failed. Check Supabase configuration.';
const monthValue=(d=indiaDate())=>d.slice(0,7);

function groupByDate(items:Work[]){
  const map = new Map<string, Work[]>();
  items.forEach(item=>{
    const arr = map.get(item.work_date) ?? [];
    arr.push(item);
    map.set(item.work_date, arr);
  });
  return [...map.entries()].sort((a,b)=>b[0].localeCompare(a[0]));
}

function monthAttendanceSummary(rows:Shift[], selectedMonth:string){
  const currentDate = indiaDate();
  const today = new Date(`${currentDate}T00:00:00`);
  const [year, month] = selectedMonth.split('-').map(Number);
  const endOfMonth = new Date(year, month, 0);
  const lastDay = selectedMonth === currentDate.slice(0,7) ? today.getDate() : endOfMonth.getDate();
  const presentDays = new Set(rows.filter(r=>r.work_date.startsWith(selectedMonth)).map(r=>r.work_date)).size;
  return { present: presentDays, absent: Math.max(0, lastDay - presentDays) };
}

export default function IdOnlyPortalPage({kind}:{kind:'agent'|'staff'}){
 const [person,setPerson]=useState<Person|null>(()=>{try{return JSON.parse(sessionStorage.getItem(PORTAL_KEY)||'null') as Person|null}catch{return null}});
 const [verified,setVerified]=useState(false),[shift,setShift]=useState<Shift[]>([]),[visits,setVisits]=useState<Visit[]>([]),[work,setWork]=useState<Work[]>([]);
 const [tab,setTab]=useState<'attendance'|'visits'|'work'>('attendance');
 const [distance,setDistance]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[now,setNow]=useState(Date.now());
 const [category,setCategory]=useState(categories[0]),[description,setDescription]=useState(''),[status,setStatus]=useState('Completed');
 const [workDate,setWorkDate]=useState(indiaDate());
 const [selectedMonth,setSelectedMonth]=useState(monthValue());
 const code=person?.employee_code||'';
 const reload=useCallback(async(c:string,k:'agent'|'staff')=>{
  const requests = [
    supabase.rpc('id_portal_attendance_history',{p_code:c}),
    supabase.rpc('id_portal_work_list',{p_code:c}),
    k==='agent'?supabase.rpc('id_portal_agent_visits',{p_code:c}):Promise.resolve({data:[],error:null})
  ] as const;
  const [attendance,workLog,activity]=await Promise.all(requests);
  if(attendance.error)throw attendance.error;
  if(workLog.error)throw workLog.error;
  if(activity.error)throw activity.error;
  setShift((attendance.data??[]) as Shift[]);
  setWork((workLog.data??[]) as Work[]);
  setVisits((activity.data??[]) as Visit[]);
 },[]);
 useEffect(()=>{
  if(!person||person.kind!==kind)return;
  let cancelled=false;
  (async()=>{try{const current=await lookupPortal(person.employee_code);if(cancelled)return;
   if(!current||current.kind!==kind){sessionStorage.removeItem(PORTAL_KEY);setPerson(null);return;}
   setPerson(current);await reload(current.employee_code,current.kind);
  }catch(e){if(!cancelled)setError(failText(e));}finally{if(!cancelled)setVerified(true);}})();
  return()=>{cancelled=true};
 },[kind,reload]);
 useEffect(()=>{const handle=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(handle)},[]);
 const today=shift.find(a=>a.work_date===indiaDate());
 const secondsLeft=today&&!today.check_out_at?Math.max(0,Math.ceil((Date.parse(today.check_in_at)+300000-now)/1000)):0;
 const filteredShift = useMemo(()=>shift.filter(s=>s.work_date.startsWith(selectedMonth)),[shift,selectedMonth]);
 const filteredWork = useMemo(()=>work.filter(w=>w.work_date.startsWith(selectedMonth)),[work,selectedMonth]);
 const groupedWork = useMemo(()=>groupByDate(filteredWork),[filteredWork]);
 const summary = useMemo(()=>monthAttendanceSummary(shift,selectedMonth),[shift,selectedMonth]);
 async function verifyLocation(){if(!person)return;setBusy(true);setError('');setNotice('');try{
  const pos=await locate();const {data,error:e}=await supabase.rpc('id_portal_verify_location',{p_code:code,p_lat:pos.coords.latitude,p_lon:pos.coords.longitude});
  if(e)throw e;setDistance(Number(data.distance_m));
  if(Number(data.distance_m)>500 && today && !today.check_out_at){
    setNotice(`You are ${Math.round(Number(data.distance_m))} metres away. To auto-close attendance when leaving office, apply the included SQL migration and use a background-capable mobile flow. Browser-only check cannot backdate checkout automatically.`);
  } else {
    setNotice(data.within_office?'Location is within the office boundary.':`You are ${Math.round(data.distance_m)} m from the office. Check In requires 100 m or less.`);
  }
 }catch(e){setError(failText(e))}finally{setBusy(false)}}
 async function mark(action:'check_in'|'check_out'){
  setBusy(true);setError('');setNotice('');try{const pos=await locate();
   const {data,error:e}=await supabase.rpc('id_portal_attendance_action',{p_code:code,p_action:action,p_lat:pos.coords.latitude,p_lon:pos.coords.longitude});
   if(e)throw e;setDistance(null);await reload(code,kind);
   setNotice(data?.check_out_at?'Checked out successfully.':'Checked in successfully. Check Out becomes available after five minutes.');
  }catch(e){setError(failText(e))}finally{setBusy(false)}
 }
 async function saveWork(e:FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{
  const res = await supabase.rpc('id_portal_work_save_on_date',{p_code:code,p_category:category,p_description:description.trim(),p_status:status,p_work_date:workDate});
  if(res.error)throw res.error;setDescription('');setWorkDate(indiaDate());await reload(code,kind);setNotice('Work entry saved.');
 }catch(e){setError(failText(e))}finally{setBusy(false)}}
 function signOut(){sessionStorage.removeItem(PORTAL_KEY);setPerson(null);window.location.assign('/portal-login')}
 if(!person||person.kind!==kind)return <Navigate to="/portal-login" replace/>;
 if(!verified)return <div className="access-screen">Loading your workspace…</div>;
 return <div className="staff-workspace quick-portal-workspace"><header className="staff-header"><Link className="staff-logo clickable-mark" to={kind==='agent'?'/agent-portal':'/attendance'}><img className="company-logo header-company-logo" src="/sree-sudha-mark.png" alt="Sree Sudha"/><small>{kind==='agent'?'AGENT WORKSPACE':'EMPLOYEE WORKSPACE'}</small></Link><button className="staff-signout" onClick={signOut}><LogOut size={17}/> Sign out</button></header>
 <main className="staff-main"><div className="staff-greeting"><div><p className="att-overline">{kind==='agent'?'AGENT PORTAL':'EMPLOYEE PORTAL'}</p><h1>Welcome, {person.full_name}</h1><p>{kind==='agent'?'Attendance, site visits and daily work.':'Attendance and your daily work records.'}</p></div><div className="staff-id"><span>{code}</span><small>EMPLOYEE ID</small></div></div>
 <div className="agent-portal-tabs"><button className={tab==='attendance'?'active':''} onClick={()=>setTab('attendance')}><CalendarCheck2 size={18}/> Attendance</button>{kind==='agent'&&<button className={tab==='visits'?'active':''} onClick={()=>setTab('visits')}><Route size={18}/> Site visits</button>}<button className={tab==='work'?'active':''} onClick={()=>setTab('work')}><ClipboardList size={18}/> Daily work</button>{kind==='agent'&&<Link to={`/agent-register?ref=${encodeURIComponent(code)}`}><UserRoundPlus size={18}/> Register sub-agent</Link>}</div>
 {error&&<div className="att-message error" role="alert">{error}</div>}{notice&&<div className="att-message success" role="status">{notice}</div>}
 {tab==='attendance'?<><div className="staff-primary-grid"><section className="att-card att-primary"><div className="att-top"><span className="att-eyebrow"><CalendarCheck2 size={17}/> TODAY'S ATTENDANCE</span><span className="att-date">{niceDate(indiaDate())}</span></div>
 <div className="att-times"><div><small>CHECK IN</small><strong>{niceTime(today?.check_in_at)}</strong></div><div className="att-time-divider"/><div><small>CHECK OUT</small><strong>{niceTime(today?.check_out_at)}</strong></div></div>
 {!today?<button disabled={busy} className="attendance-button" onClick={()=>void mark('check_in')}><CalendarCheck2 size={18}/> Check In</button>:today.check_out_at?<div className="att-status">Attendance completed. Time out was captured successfully.</div>:<button disabled={busy||secondsLeft>0} className="attendance-button" onClick={()=>void mark('check_out')}><Clock3 size={17}/>{secondsLeft>0?`Check Out in ${Math.floor(secondsLeft/60)}:${String(secondsLeft%60).padStart(2,'0')}`:'Check Out'}</button>}
 <p className="att-note">Within 100 metres of the registered office. Five-minute minimum between Check In and Check Out.</p></section>
 <section className="att-card att-location"><div className="att-card-heading"><span className="att-small-icon"><MapPin size={20}/></span><div><h2>Office location</h2><p>Attendance boundary: 100 metres</p></div></div><div className="att-location-status"><div><small>LAST LOCATION CHECK</small><strong>{distance===null?'Not checked':`${Math.round(distance)} metres from office`}</strong></div><span className={`geo-dot ${distance!==null&&distance<=100?'good':''}`}/></div><button className="att-outline-button" disabled={busy} onClick={()=>void verifyLocation()}><RefreshCw size={17}/> Verify location</button></section></div>
 <section className="att-card att-history"><div className="att-history-head"><div><h2>Attendance history</h2><p className="ops-help">Month-wise summary and date-wise records</p></div><div className="att-history-controls"><label className="portal-month-label"><BarChart3 size={16}/> <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} /></label><button className="att-refresh" onClick={()=>void reload(code,kind)}><RefreshCw size={17}/> Refresh</button></div></div><div className="portal-summary-grid"><div className="portal-summary-card"><small>PRESENT DAYS</small><strong>{summary.present}</strong></div><div className="portal-summary-card"><small>ABSENT DAYS</small><strong>{summary.absent}</strong></div><div className="portal-summary-card"><small>MONTH</small><strong>{selectedMonth}</strong></div></div><div className="att-table-wrap"><table className="att-table responsive-table-cards"><thead><tr><th>DATE</th><th>CHECK IN</th><th>CHECK OUT</th><th>WORK DURATION</th><th>STATUS</th></tr></thead><tbody>{filteredShift.map(s=><tr key={s.id}><td data-label="Date">{niceDate(s.work_date)}</td><td data-label="Check in">{niceTime(s.check_in_at)}</td><td data-label="Check out">{niceTime(s.check_out_at)}</td><td data-label="Work duration">{s.check_out_at?`${((Date.parse(s.check_out_at)-Date.parse(s.check_in_at))/3600000).toFixed(2)} h`:'In progress'}</td><td data-label="Status"><span className="att-table-status">{s.check_out_at?'Checked out':'Checked in'}</span></td></tr>)}</tbody></table>{!filteredShift.length&&<div className="att-empty">No attendance recorded for this month yet.</div>}</div></section></>:
 tab==='visits'?<section className="att-card att-history"><div className="att-history-head"><h2>My site visits</h2><button className="att-refresh" onClick={()=>void reload(code,kind)}><RefreshCw size={16}/> Refresh</button></div><div className="agent-portal-visitlist">{visits.map(v=><div className="agent-portal-visit" key={v.id}><MapPin size={19}/><div><strong>{v.project_name}</strong><p>{new Date(v.visited_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kolkata'})} · {v.customer_count} customer(s)</p></div></div>)}{!visits.length&&<div className="att-empty">No site visits recorded yet.</div>}</div></section>:
 <section className="att-card att-history"><div className="att-history-head"><div><h2>My daily work</h2><p className="ops-help">Saved date-wise and grouped month-wise</p></div><div className="att-history-controls"><label className="portal-month-label"><FolderKanban size={16}/> <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} /></label></div></div><form className="ops-form quick-work-form" onSubmit={saveWork}><div className="ops-pair"><label>Date<input required type="date" max={indiaDate()} value={workDate} onChange={e=>setWorkDate(e.target.value)} /></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></label></div><div className="ops-pair"><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option>Completed</option><option>In Progress</option><option>Pending</option></select></label></div><label>Work completed<textarea required rows={3} minLength={3} maxLength={2000} placeholder="Describe the work completed" value={description} onChange={e=>setDescription(e.target.value)}/></label><button className="ops-primary" disabled={busy} type="submit">{busy?'Saving…':'Save work'}</button></form><div className="quick-work-items grouped-work-items">{groupedWork.map(([date,items])=><section key={date} className="work-group"><h3>{niceDate(date)}</h3>{items.map(w=><article key={w.id}><strong>{w.category}</strong><small>{w.status}</small><p>{w.description}</p></article>)}</section>)}{!groupedWork.length&&<div className="att-empty">No work entries for this month yet.</div>}</div></section>}
 <footer className="staff-footer">Sree Sudha Promoters & Developers</footer></main></div>;
}
