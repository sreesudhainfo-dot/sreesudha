import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { CalendarCheck2, CalendarDays, Clock3, Fingerprint, LogOut, MapPinned, RefreshCw, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logout } from '../auth/services/auth';
import type { StaffProfile } from '../auth/components/RoleGate';
import { indiaDate, niceTime, niceDate, locate, officeInfo, distanceM, recordAction } from '../attendance/attendance';
import type { AttendanceRecord,Office } from '../attendance/attendance';
type Visit={id:string;visited_at:string;project_name:string;notes:string;customer_count:number};
export default function AgentPortalPage(){
 const me=useOutletContext<StaffProfile>();
 const [tab,setTab]=useState<'attendance'|'visits'>('attendance'),[visits,setVisits]=useState<Visit[]>([]),[records,setRecords]=useState<AttendanceRecord[]>([]),[office,setOffice]=useState<Office|null>(null);
 const [distance,setDistance]=useState<number|null>(null),[accuracy,setAccuracy]=useState<number|null>(null),[now,setNow]=useState(Date.now());
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{
  try{
   const [a,v,o]=await Promise.all([
    supabase.from('staff_attendance').select('id,user_id,work_date,check_in_at,check_out_at,check_in_accuracy_m,check_out_accuracy_m').eq('user_id',me.user_id).order('work_date',{ascending:false}).limit(31),
    supabase.rpc('my_agent_site_visits'),officeInfo()]);
   if(a.error)throw a.error;if(v.error)throw v.error;setOffice(o);setRecords((a.data??[]) as AttendanceRecord[]);setVisits((v.data??[]) as Visit[]);setError('');
  }catch(e){setError(e instanceof Error?e.message:'Could not load your records');}finally{setLoading(false);}
 },[me.user_id,me.agent_id]);
 useEffect(()=>{void refresh()},[refresh]);
 useEffect(()=>{const handle=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(handle)},[]);
 const today=records.find(r=>r.work_date===indiaDate());const remaining=today&&!today.check_out_at?Math.max(0,Math.ceil((Date.parse(today.check_in_at)+300000-now)/1000)):0;
 const fmtLeft=remaining?`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:'';
 async function checkLocation(){setBusy(true);setError('');setNotice('');try{const pos=await locate();const o=office??await officeInfo();if(o.latitude==null||o.longitude==null)throw new Error('Office location has not been configured by Admin.');setDistance(distanceM(pos.coords.latitude,pos.coords.longitude,o.latitude,o.longitude));setAccuracy(pos.coords.accuracy);}catch(e){setError(e instanceof Error?e.message:'Location unavailable');}finally{setBusy(false);}}
 async function attendance(action:'check_in'|'check_out'){setBusy(true);setError('');setNotice('');try{
  const pos=await locate();const o=office??await officeInfo();if(o.latitude!=null&&o.longitude!=null){setDistance(distanceM(pos.coords.latitude,pos.coords.longitude,o.latitude,o.longitude));setAccuracy(pos.coords.accuracy);}
  await recordAction(action,pos);setNotice(action==='check_in'?'Check In saved. Check Out unlocks after five minutes.':'Check Out saved.');await refresh();
 }catch(e){setError(e instanceof Error?e.message:'Attendance not saved');}finally{setBusy(false);}}
 return <div className="staff-workspace"><header className="staff-header"><Link className="staff-logo clickable-mark" to="/agent-portal"><img className="company-logo header-company-logo" src="/sree-sudha-mark.png" alt="Sree Sudha"/><small>AGENT WORKSPACE</small></Link><button className="staff-signout" onClick={()=>void logout().then(()=>location.assign('/agent-login'))}><LogOut size={17}/> Sign out</button></header>
  <main className="staff-main agent-portal-main"><div className="staff-greeting"><div><p className="att-overline">MY AGENT PORTAL</p><h1>Welcome, {me.full_name}</h1><p>Attendance and site visits — only your records are visible here.</p></div><div className="staff-id"><span>{me.employee_code}</span><small>EMPLOYEE ID</small></div></div>
  <div className="agent-portal-tabs"><button className={tab==='attendance'?'active':''} onClick={()=>setTab('attendance')}><CalendarCheck2 size={18}/> My Attendance</button><button className={tab==='visits'?'active':''} onClick={()=>setTab('visits')}><MapPinned size={18}/> My Site Visits</button><Link to={`/agent-register?ref=${encodeURIComponent(me.employee_code||'')}`}><UserRoundPlus size={18}/> Register Sub-Agent</Link></div>
  {error&&<div className="att-message error" role="alert">{error}</div>}{notice&&<div className="att-message success" role="status">{notice}</div>}
  {tab==='attendance'?<><div className="staff-primary-grid"><section className="att-card att-primary"><div className="att-top"><span className="att-eyebrow"><Fingerprint size={17}/> TODAY'S ATTENDANCE</span><span className="att-date">{niceDate(indiaDate())}</span></div><div className="att-times"><div><small>CHECK IN</small><strong>{niceTime(today?.check_in_at)}</strong></div><div className="att-time-divider"/><div><small>CHECK OUT</small><strong>{niceTime(today?.check_out_at)}</strong></div></div>
  {!today?<button className="attendance-button agent-portal-wide" disabled={busy} onClick={()=>void attendance('check_in')}><CalendarCheck2 size={17}/> Check In</button>:today.check_out_at?<div className="att-status"><ShieldCheck size={18}/> Attendance completed for today</div>:<button className="attendance-button agent-portal-wide" disabled={busy||remaining>0} onClick={()=>void attendance('check_out')}><Clock3 size={18}/> {remaining>0?`Check Out available in ${fmtLeft}`:'Check Out'}</button>}
  <p className="att-note">A server-side location check requires a position within 100 metres of the office. Check Out unlocks five minutes after Check In.</p></section>
  <section className="att-card att-location"><div className="att-card-heading"><span className="att-small-icon"><MapPinned size={20}/></span><div><h2>Location verification</h2><p>Office geofence: 100 metres</p></div></div><div className="att-location-status"><div><small>YOUR LAST READING</small><strong>{distance==null?'Not checked':`${Math.round(distance)} metres from office`}</strong></div><span className={`geo-dot ${distance!=null&&distance<=100?'good':''}`}/></div><div className="att-location-stats"><div><small>ALLOWED RADIUS</small><strong>100m</strong></div><div><small>LOCATION RULE</small><strong>100 m</strong></div></div><button className="att-outline-button" disabled={busy} onClick={()=>void checkLocation()}><RefreshCw size={16}/> Verify location</button></section></div>
  <section className="att-card att-history"><div className="att-history-head"><h2>My attendance history</h2><button className="att-refresh" onClick={()=>void refresh()}><RefreshCw size={16}/> Refresh</button></div><div className="att-table-wrap"><table className="att-table"><thead><tr><th>DATE</th><th>CHECK IN</th><th>CHECK OUT</th><th>WORK DURATION</th></tr></thead><tbody>{records.map(r=><tr key={r.id}><td>{niceDate(r.work_date)}</td><td>{niceTime(r.check_in_at)}</td><td>{niceTime(r.check_out_at)}</td><td>{r.check_out_at?`${((Date.parse(r.check_out_at)-Date.parse(r.check_in_at))/3600000).toFixed(2)} h`:'In progress'}</td></tr>)}</tbody></table>{!records.length&&<div className="att-empty">No attendance records yet.</div>}</div></section></>:
  <section className="att-card att-history"><div className="att-history-head"><div><h2>My site visit history</h2><p>Dates and projects recorded under your account</p></div><button className="att-refresh" onClick={()=>void refresh()}><RefreshCw size={16}/> Refresh</button></div><div className="agent-portal-visitlist">{visits.map(v=><div className="agent-portal-visit" key={v.id}><MapPinned size={22}/><div><strong>{v.project_name}</strong><span><CalendarDays size={14}/> {new Date(v.visited_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kolkata'})} · {niceTime(v.visited_at)}</span>{<p>{Number(v.customer_count)||0} customer(s) taken to site</p>}{v.notes&&<p>{v.notes}</p>}</div></div>)}{!visits.length&&<div className="att-empty">{loading?'Loading visits…':'No site visits recorded yet.'}</div>}</div></section>}
  <footer className="staff-footer">Sree Sudha Promoters & Developers · Agent workspace</footer></main></div>;
}
