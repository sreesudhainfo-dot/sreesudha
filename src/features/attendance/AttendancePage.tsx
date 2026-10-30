import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, ClipboardList, CalendarCheck2, CalendarDays, CheckCircle2, Clock3, Fingerprint, LocateFixed, LogOut, MapPin, RefreshCw, ShieldCheck, Timer, TriangleAlert } from 'lucide-react';
import type { StaffProfile } from '../auth/components/RoleGate';
import { logout } from '../auth/services/auth';
import { supabase } from '../../lib/supabase';
import { distanceM, employeeCode, indiaDate, locate, niceDate, niceTime, officeInfo, recordAction } from './attendance';
import type { AttendanceRecord, Office } from './attendance';

export default function AttendancePage(){
  const profile=useOutletContext<StaffProfile>();
  const [today,setToday]=useState<AttendanceRecord|null>(null);
  const [history,setHistory]=useState<AttendanceRecord[]>([]);
  const [office,setOffice]=useState<Office|null>(null);
  const [distance,setDistance]=useState<number|null>(null);
  const [accuracy,setAccuracy]=useState<number|null>(null);
  const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const t=window.setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
  async function reload(){
    try{
      const [settings,response]=await Promise.all([officeInfo(),supabase.from('staff_attendance').select('id,user_id,work_date,check_in_at,check_out_at,check_in_accuracy_m,check_out_accuracy_m').eq('user_id',profile.user_id).order('work_date',{ascending:false}).limit(21)]);
      if(response.error)throw response.error;
      setOffice(settings);const rows=response.data as AttendanceRecord[];setHistory(rows);
      setToday(rows.find(r=>r.work_date===indiaDate())??null);
    }catch(e){setError(e instanceof Error?e.message:'Could not load attendance records.');}
    finally{setLoading(false);}
  }
  useEffect(()=>{void reload();},[profile.user_id]);
  async function verifyOnly(){
    if(office?.latitude==null||office?.longitude==null){setError('Your administrator must configure the office coordinates first.');return;}
    setBusy(true);setError('');setNotice('');
    try{const pos=await locate();const d=distanceM(pos.coords.latitude,pos.coords.longitude,office.latitude,office.longitude);setDistance(d);setAccuracy(pos.coords.accuracy);setNotice(d<=100?'Position is within the office boundary.':'Position cannot yet be accepted for attendance.');}
    catch(e){setError(e instanceof Error?e.message:'Location unavailable.');}finally{setBusy(false);}
  }
  const unlockAt=today?Date.parse(today.check_in_at)+300000:0;
  const secondsLeft=today&&!today.check_out_at?Math.max(0,Math.ceil((unlockAt-now)/1000)):0;
  const checkoutReady=Boolean(today&&!today.check_out_at&&secondsLeft===0);
  async function submit(action:'check_in'|'check_out'){
    if(action==='check_out'&&!checkoutReady)return;
    setBusy(true);setError('');setNotice('');
    try{
      const pos=await locate();
      if(office?.latitude!=null&&office?.longitude!=null){setDistance(distanceM(pos.coords.latitude,pos.coords.longitude,office.latitude,office.longitude));setAccuracy(pos.coords.accuracy);}
      const record=await recordAction(action,pos);
      setToday(record);setNotice(action==='check_in'?'Check In recorded successfully. Check Out unlocks after 5 minutes.':'Check Out recorded successfully.');
      await reload();
    }catch(e){setError(e instanceof Error?e.message:'Could not submit attendance.');}
    finally{setBusy(false);}
  }
  const placed=office?.latitude!=null&&office.longitude!=null;
  const within=distance!==null&&distance<=100;
  return <div className="staff-workspace">
    <header className="staff-header"><Link className="staff-logo clickable-mark" to="/attendance" aria-label="Staff attendance home"><img className="company-logo header-company-logo" src="/sree-sudha-mark.png" alt="Sree Sudha"/><small>Staff workspace</small></Link><button className="staff-signout" onClick={()=>void logout().then(()=>window.location.assign('/staff-login'))}><LogOut size={17}/> <span>Sign out</span></button></header>
    <main className="staff-main"><Link className="staff-daily-link" to="/daily-work"><ClipboardList size={17}/> My daily work <ArrowRight size={16}/></Link><div className="staff-greeting"><div><p className="att-overline">EMPLOYEE ATTENDANCE</p><h1>Hello, {profile.full_name.split(' ')[0]} <span>👋</span></h1><p>Track your working day securely at the office.</p></div><div className="staff-id"><span>{employeeCode(profile.staff_no)}</span><small>Employee ID</small></div></div>
      <div className="staff-primary-grid"><section className="att-card att-primary"><div className="att-top"><span className="att-eyebrow"><CalendarCheck2 size={16}/> TODAY'S ATTENDANCE</span><span className="att-date">{niceDate(indiaDate())}</span></div><div className="att-times"><div><small>CHECK IN</small><strong>{niceTime(today?.check_in_at)}</strong></div><div className="att-time-divider"/><div><small>CHECK OUT</small><strong>{niceTime(today?.check_out_at)}</strong></div></div>
        {today?.check_out_at?<div className="att-status"><CheckCircle2 size={18}/> Attendance completed for today</div>:today?<div className="att-status"><Timer size={18}/> {secondsLeft>0?`Check Out available in ${Math.floor(secondsLeft/60)}:${String(secondsLeft%60).padStart(2,'0')}`:'Check Out is ready'}</div>:<div className="att-status"><Clock3 size={18}/> Ready for Check In</div>}
        {notice&&<div className="att-message success"><CheckCircle2 size={16}/>{notice}</div>}
        {error&&<div className="att-message error"><TriangleAlert size={16}/>{error}</div>}
        {!today?<button disabled={busy||loading||!placed} className="attendance-button" onClick={()=>void submit('check_in')}><Fingerprint size={20}/>{busy?'Verifying GPS…':'Check In now'}<ArrowRight size={19}/></button>:<button disabled={busy||!checkoutReady||Boolean(today.check_out_at)} className="attendance-button" onClick={()=>void submit('check_out')}><Fingerprint size={20}/>{today.check_out_at?'Checked out':secondsLeft>0?'Check Out locked · 5 min':busy?'Verifying GPS…':'Check Out now'}<ArrowRight size={19}/></button>}
        <p className="att-note"><ShieldCheck size={15}/> {today?'The 5-minute wait is enforced by the server.':'Attendance uses GPS verification and the server clock.'}</p>
      </section><section className="att-card att-location"><div className="att-card-heading"><span className="att-small-icon"><MapPin size={20}/></span><div><h2>Office location</h2><p>100-metre attendance boundary</p></div></div><div className="att-location-status"><div><small>VERIFICATION</small><strong>{!placed?'Office not configured':distance===null?'Location not checked':within?'Within 100 metres':'Outside office area'}</strong></div><span className={within?'geo-dot good':'geo-dot'}/></div><div className="att-location-stats"><div><small>Distance</small><strong>{distance===null?'—':`${Math.round(distance)} m`}</strong></div><div><small>Attendance radius</small><strong>100 m</strong></div></div><button className="att-outline-button" disabled={busy||!placed} onClick={()=>void verifyOnly()}><LocateFixed size={17}/>{busy?'Checking GPS…':'Check my location'}<RefreshCw size={15}/></button><p className="att-helper">Location permission is required. Check In and Check Out must be within 100 metres of the office.</p></section></div>
      <section className="att-card att-history"><div className="att-history-head"><div><p className="att-overline">YOUR RECORDS</p><h2>Recent attendance</h2></div><button className="att-refresh" onClick={()=>void reload()} aria-label="Refresh attendance"><RefreshCw size={18}/></button></div>{loading?<div className="att-empty">Loading records…</div>:history.length===0?<div className="att-empty"><CalendarDays size={26}/><p>No attendance records yet. Your first Check In will appear here.</p></div>:<div className="att-table-wrap"><table className="att-table"><thead><tr><th>DATE</th><th>CHECK IN</th><th>CHECK OUT</th><th>STATUS</th></tr></thead><tbody>{history.map(row=><tr key={row.id}><td>{niceDate(row.work_date)}</td><td>{niceTime(row.check_in_at)}</td><td>{niceTime(row.check_out_at)}</td><td><span className="att-table-status">{row.check_out_at?'Completed':'Checked in'}</span></td></tr>)}</tbody></table></div>}</section>
      <footer className="staff-footer">Sree Sudha Promoters & Developers · Staff portal</footer>
    </main></div>;
}
