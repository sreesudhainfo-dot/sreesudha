import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { logout } from '../services/auth';

export type StaffRole = 'staff' | 'agent' | 'admin' | 'md';
export interface StaffProfile { user_id:string;staff_no:number;full_name:string;role:StaffRole;active:boolean; agent_id?:string|null; staff_employee_no?:number|null; employee_code?:string }

export default function RoleGate({managerOnly=false,home=false,staffOnly=false,agentOnly=false}:{managerOnly?:boolean;home?:boolean;staffOnly?:boolean;agentOnly?:boolean}) {
  const [profile,setProfile] = useState<StaffProfile|null>(null);
  const [status,setStatus] = useState<'loading'|'signedout'|'unassigned'|'ready'|'error'>('loading');
  const [message,setMessage]=useState('');
  const loc=useLocation();
  useEffect(()=>{
    let active=true;
    async function load() {
      setStatus('loading');
      const {data:{user},error:userError}=await supabase.auth.getUser();
      if(!active)return;
      if(userError||!user){setStatus('signedout');return;}
      const {data,error}=await supabase.from('staff_profiles')
        .select('user_id,staff_no,staff_employee_no,agent_id,full_name,role,active').eq('user_id',user.id).maybeSingle();
      if(!active)return;
      if(error){setMessage(error.message);setStatus('error');return;}
      if(!data||!data.active){setStatus('unassigned');return;}
      const p=data as StaffProfile;
      if(p.role==='agent'&&p.agent_id){
        const {data:codeData}=await supabase.rpc('my_employee_code');
        p.employee_code=typeof codeData==='string'?codeData:'Agent';
      }else if(p.role==='staff') p.employee_code=`EMP${String(p.staff_employee_no??p.staff_no).padStart(4,'0')}`;
      setProfile(p);setStatus('ready');
    }
    void load();
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
      if(event==='SIGNED_OUT'&&active){setStatus('signedout');setProfile(null);}
    });
    return ()=>{active=false;subscription.unsubscribe();};
  },[loc.key]);
  if(status==='loading')return <div className="access-screen">Checking your account permissions…</div>;
  if(status==='signedout')return <Navigate to={agentOnly?'/agent-login':managerOnly||home?'/login':'/staff-login'} replace/>;
  if(status==='unassigned'||status==='error')return <div className="access-screen"><section className="access-card"><h1>{status==='error'?'Unable to verify permissions':'Account not assigned yet'}</h1><p>{status==='error'?message:'Your account exists in Supabase Auth, but your administrator must add an active staff profile before you can use the app.'}</p><button className="attendance-button" onClick={()=>void logout().then(()=>window.location.assign('/login'))}>Sign out</button></section></div>;
  if(!profile)return null;
  const management=profile.role==='admin'||profile.role==='md';
  if(home)return <Navigate to={management?'/agents':profile.role==='agent'?'/agent-portal':'/attendance'} replace/>;
  if(managerOnly&&!management)return <Navigate to={profile.role==='agent'?'/agent-portal':'/attendance'} replace/>;
  if(agentOnly&&profile.role!=='agent')return <Navigate to={management?'/agents':'/attendance'} replace/>;
  if(staffOnly&&profile.role==='agent')return <Navigate to="/agent-portal" replace/>;
  return <Outlet context={profile}/>;
}
