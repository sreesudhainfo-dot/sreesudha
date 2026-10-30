import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, LoaderCircle, ShieldCheck, MapPin, Users } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { isHierarchyEmployeeCode } from '../../../lib/crmRules.mjs';

export type PortalKind='staff'|'agent';
type QuickProfile={employee_code:string;full_name:string;kind:'staff'|'agent'};
export const PORTAL_KEY='sree_sudha_quick_portal';
export async function lookupPortal(code:string):Promise<QuickProfile|null>{
 const {data,error}=await supabase.rpc('id_portal_profile',{p_code:code});
 if(error)throw new Error(`${error.message}. Ensure the id-only portal SQL migration has been installed.`);
 return data as QuickProfile|null;
}
export default function EmployeePortalLogin(){
 const navigate=useNavigate();const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function signIn(e:FormEvent){
  e.preventDefault();setError('');const id=code.trim().toUpperCase();
  if(!isHierarchyEmployeeCode(id) && !/^EMP\d{4,5}$/.test(id)){
   setError('Enter the Employee ID issued by the office, such as EMP1520 or EMP152001.');return;
  }
  setBusy(true);
  try{
   const person=await lookupPortal(id);
   if(!person){setError('Employee ID not found or account inactive. Contact the office for your assigned ID.');return;}
   sessionStorage.setItem(PORTAL_KEY,JSON.stringify(person));
   navigate(person.kind==='agent'?'/agent-portal':'/attendance',{replace:true});
  }catch(e){setError(e instanceof Error?e.message:'Unable to verify Employee ID.');}
  finally{setBusy(false);}
 }
 return <div className="staff-login-page"><main className="staff-login-container portal-signin-card quick-portal-login unified-portal-login">
  <Link className="clickable-mark staff-mark-link" to="/login" aria-label="Sree Sudha management sign in"><img className="company-logo staff-login-company-logo" src="/sree-sudha-mark.png" alt="Sree Sudha"/></Link>
  <div className="staff-login-icon"><Users size={27}/></div>
  <p className="att-overline">EMPLOYEE / AGENT ACCESS</p>
  <h1>One ID login</h1>
  <p className="staff-login-lead">Use one Employee ID page for both staff and agents. The CRM will automatically open the correct workspace after verifying the ID.</p>
  <form className="staff-login-form" onSubmit={signIn}><label>Employee ID
   <input required value={code} autoComplete="off" placeholder="EMP1520" maxLength={70}
    onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}/>
  </label>{error&&<div className="att-message error" role="alert">{error}</div>}
  <button className="attendance-button" type="submit" disabled={busy}>{busy?<LoaderCircle size={18} className="spin"/>:<ArrowRight size={18}/>} {busy?'Checking Employee ID…':'Continue to workspace'}</button></form>
  <div className="staff-login-facts"><span><MapPin size={15}/> 100m office radius</span><span><BadgeCheck size={15}/> Auto-detects staff or agent</span><span><ShieldCheck size={15}/> Management stays protected separately</span></div>
  <p className="portal-small-help">This quick portal checks whether the entered Employee ID belongs to a staff member or an agent, then opens the correct workspace automatically.</p>
  <div className="portal-login-links"><Link to="/login">Management sign in</Link></div>
 </main></div>;
}
