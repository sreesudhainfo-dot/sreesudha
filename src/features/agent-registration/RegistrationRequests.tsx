import { useCallback, useEffect, useState } from 'react';
import { Check, ClipboardList, LoaderCircle, RefreshCw, UserRound, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Agent } from '../agent-network/types/agent';
import { agentCode } from '../agent-network/types/agent';

interface Request {
  id:string;full_name:string;phone:string;address:string;photo_path:string;
  referral_code:string|null;referrer_id:string|null;status:'Pending'|'Approved'|'Rejected';created_at:string;
}
export default function RegistrationRequests({agents,onApproved}:{agents:Agent[];onApproved:()=>Promise<void>}){
  const [requests,setRequests]=useState<Request[]>([]);
  const [photos,setPhotos]=useState<Record<string,string>>({});
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [message,setMessage]=useState('');
  const load=useCallback(async()=>{
    setError('');
    const {data,error:fetchError}=await supabase.from('agent_registration_requests')
      .select('id,full_name,phone,address,photo_path,referral_code,referrer_id,status,created_at')
      .eq('status','Pending').order('created_at',{ascending:true}).limit(200);
    if(fetchError){setError(`${fetchError.message}. Run supabase/agent_public_registration_and_random_ids.sql first.`);setLoading(false);return;}
    const list=(data??[]) as Request[];setRequests(list);
    const urls=await Promise.all(list.map(async item=>{
      const {data:signed}=await supabase.storage.from('agent-photos').createSignedUrl(item.photo_path,900);
      return [item.id,signed?.signedUrl??''] as const;
    }));setPhotos(Object.fromEntries(urls));setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);
  async function review(item:Request,approve:boolean){
    if(!window.confirm(`${approve?'Approve':'Reject'} ${item.full_name}'s registration? ${approve?'A permanent hierarchy-based EMP ID will be assigned.':'The request will be closed.'}`))return;
    setBusy(item.id);setError('');setMessage('');
    try{
      const {data,error:reviewError}=await supabase.rpc('review_agent_registration',{
        p_request_id:item.id,p_approve:approve,p_notes:null
      });
      if(reviewError)throw reviewError;
      setMessage(approve?`${item.full_name} approved — ${String(data.employee_id)} assigned. Share this ID after confirming their identity.`:`${item.full_name}'s request was rejected.`);
      await load();if(approve)await onApproved();
    }catch(e){setError(e instanceof Error?e.message:'Could not review registration.');}
    finally{setBusy(null);}
  }
  return <section className="requests-page">
    <div className="requests-intro"><div><span className="eyebrow">APPROVALS</span><h2>New agent applications</h2><p>Verify identity and referral details before assigning an Employee ID.</p></div><button className="btn btn-outline" onClick={()=>void load()}><RefreshCw size={16}/> Refresh</button></div>
    {error&&<div className="message error" role="alert">{error}</div>}
    {message&&<div className="message success" role="status">{message}</div>}
    {loading?<div className="requests-empty">Loading applications…</div>:requests.length===0?<div className="requests-empty"><ClipboardList size={28}/><h3>No pending registrations</h3><p>New self-registrations will appear here for your approval.</p></div>:<div className="requests-grid">{requests.map(item=>{
      const ref=agents.find(a=>a.id===item.referrer_id);
      return <article className="request-card" key={item.id}>
        <div className="request-person">{photos[item.id]?<img src={photos[item.id]} alt={item.full_name}/>:<div className="request-avatar"><UserRound size={22}/></div>}<div><h3>{item.full_name}</h3><small>Submitted {new Date(item.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</small></div></div>
        <dl><div><dt>Mobile</dt><dd>{item.phone}</dd></div><div><dt>Address</dt><dd>{item.address}</dd></div><div><dt>Referring agent</dt><dd>{ref?`${ref.full_name} (${agentCode(ref)})`:item.referral_code??'Direct registration'}</dd></div></dl>
        <div className="request-actions"><button type="button" className="btn btn-outline" disabled={busy===item.id} onClick={()=>void review(item,false)}><X size={16}/> Reject</button><button type="button" className="btn btn-primary" disabled={busy===item.id} onClick={()=>void review(item,true)}>{busy===item.id?<LoaderCircle size={16} className="spin"/>:<Check size={16}/>} Approve & assign ID</button></div>
      </article>;
    })}</div>}
  </section>;
}
