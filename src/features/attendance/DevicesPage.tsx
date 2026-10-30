import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ClipboardCopy, Fingerprint, ShieldCheck, UserPlus, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { StaffProfile } from '../auth/components/RoleGate';
import type { Agent } from '../agent-network/types/agent';
import { agentCode } from '../agent-network/types/agent';
import { portalRequest } from '../auth/pages/EmployeePortalLogin';
type Person={user_id:string;full_name:string;role:string;active:boolean;staff_employee_no:number|null;staff_no:number};
export default function DevicesPage(){
 const me=useOutletContext<StaffProfile>();const [staff,setStaff]=useState<Person[]>([]),[agents,setAgents]=useState<Agent[]>([]);
 const [name,setName]=useState(''),[id,setId]=useState(''),[link,setLink]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const reload=useCallback(async()=>{
  const [s,a]=await Promise.all([supabase.from('staff_profiles').select('user_id,full_name,role,active,staff_employee_no,staff_no').eq('role','staff').order('full_name'),supabase.from('agent_network').select('*').order('full_name')]);
  if(s.error)throw s.error;if(a.error)throw a.error;
  setStaff((s.data??[]) as Person[]);setAgents((a.data??[]) as Agent[]);
 },[]);
 useEffect(()=>{void reload().catch(e=>setError(e instanceof Error?e.message:'Could not load employees'))},[reload]);
 async function register(e:FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');setLink('');try{
   const r=await portalRequest({action:'admin-register-staff',name:name.trim()});
   setName('');setId(r.employee_code);setMessage(`Employee registered: ${r.employee_code}. Next, generate their device activation link.`);await reload();
 }catch(e){setError(e instanceof Error?e.message:'Could not register employee');}finally{setBusy(false)}}
 async function issue(e:FormEvent){e.preventDefault();setBusy(true);setError('');setLink('');setMessage('');try{
   const r=await portalRequest({action:'admin-device-link',employee_code:id});setLink(r.activation_link);setMessage(`One-time activation link generated for ${r.employee_code}. Share it privately with the correct person; expires in 60 minutes.`);
 }catch(e){setError(e instanceof Error?e.message:'Could not generate link');}finally{setBusy(false)}}
 const options=[...staff.filter(s=>s.active&&s.staff_employee_no!=null).map(s=>({code:`EMP${String(s.staff_employee_no).padStart(4,'0')}`,name:s.full_name,kind:'Staff'})),...agents.filter(a=>a.status==='Active'&&(a.hierarchy_employee_code||a.employee_no!=null)).map(a=>({code:agentCode(a),name:a.full_name,kind:'Agent'}))];
 return <div className="ops-page"><header className="ops-top"><Link to="/agents" className="ops-brand"><img src="/sree-sudha-mark.png" alt="Sree Sudha home"/><span><strong>SREE SUDHA</strong><small>EMPLOYEE ACCESS</small></span></Link><Link to="/agents" className="ops-link"><ArrowLeft size={16}/> Dashboard</Link></header>
 <main className="ops-container"><div className="ops-heading"><div><span className="ops-kicker">MANAGEMENT ACCESS</span><h1>Employees & devices</h1><p>Register staff, approve trusted devices and share secure one-time activation links.</p></div><div className="manager-role"><ShieldCheck size={14}/> {me.role.toUpperCase()}</div></div>
 {error&&<div className="ops-alert" role="alert">{error}</div>}{message&&<div className="ops-notice" role="status"><CheckCircle2 size={18}/>{message}</div>}
 <div className="portal-admin-grid"><section className="ops-panel portal-admin-panel"><div className="ops-panel-head"><div><h2>1 · Register staff</h2><p>Random non-repeating four-digit EMP IDs.</p></div><UserPlus size={23}/></div><form className="ops-form" onSubmit={e=>void register(e)}><label>Employee name<input required value={name} maxLength={120} onChange={e=>setName(e.target.value)} placeholder="Enter full name"/></label><button className="ops-primary" disabled={busy||name.trim().length<2} type="submit"><UserPlus size={16}/> Register & assign ID</button></form></section>
 <section className="ops-panel portal-admin-panel"><div className="ops-panel-head"><div><h2>2 · Approve a device</h2><p>Agents and staff sign in without routine email verification.</p></div><Fingerprint size={23}/></div><form className="ops-form" onSubmit={e=>void issue(e)}><label>Employee / Agent<select required value={id} onChange={e=>{setId(e.target.value);setLink('')}}><option value="">Select employee</option>{options.map(o=><option key={o.code} value={o.code}>{o.name} · {o.code} · {o.kind}</option>)}</select></label><button className="ops-primary" disabled={busy||!id} type="submit"><Fingerprint size={16}/> Generate activation link</button>{link&&<div className="portal-activation-output"><label>Share only with the selected employee<input readOnly value={link} onFocus={e=>e.target.select()}/></label><button type="button" className="ops-outline" onClick={()=>void navigator.clipboard.writeText(link)}><ClipboardCopy size={16}/> Copy link</button></div>}</form></section></div>
 <section className="ops-panel portal-admin-panel portal-explainer"><h2>How sign-in works</h2><p>Admin creates an account and shares a one-time activation link. The employee opens the link on the chosen device and registers a passkey using fingerprint, face unlock or device PIN. Each future login requires only the Employee ID and the device's passkey confirmation. The browser never receives any Supabase service-role key.</p><p><strong>Attendance:</strong> ID sign-in alone does not mark attendance. Every Check In and Check Out still requires the server-side GPS rule and the five-minute minimum interval.</p><p><strong>Lost or replaced phone:</strong> Do not reuse the old link. Disable/revoke its credential using the secure recovery procedure before re-enrolling.</p></section>
 </main></div>;
}
