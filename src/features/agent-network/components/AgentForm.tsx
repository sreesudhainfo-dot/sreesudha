import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Camera, Check, ChevronDown, ImagePlus, LoaderCircle, Search, UserRoundPlus, X } from 'lucide-react';
import type { Agent, AgentInput } from '../types/agent';
import { agentCode } from '../types/agent';
import { addAgent, updateAgent } from '../services/agents';
import AgentAvatar from './AgentAvatar';
import { supabase } from '../../../lib/supabase';

type Props = {
  agents: Agent[];
  photos: Record<string,string>;
  editing?: Agent | null;
  presetParentId?: string | null;
  onClose: () => void;
  onSaved: (saved: Agent, isEditing: boolean) => Promise<void>;
};

export default function AgentForm({agents, photos, editing, presetParentId, onClose, onSaved}:Props){
  const [name,setName] = useState(editing?.full_name ?? '');
  const [phone,setPhone] = useState(editing?.phone ?? '');
  const [address,setAddress] = useState(editing?.address ?? '');
  const [parent,setParent] = useState(editing?.referrer_id ?? presetParentId ?? '');
  const [staffReferrer,setStaffReferrer] = useState('');
  const [photo,setPhoto] = useState<File|null>(null);
  const [preview,setPreview] = useState('');
  const [parentQuery,setParentQuery] = useState('');
  const [chooseParent,setChooseParent] = useState(false);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const inputRef=useRef<HTMLInputElement>(null);
  const byId=useMemo(()=>new Map(agents.map(a=>[a.id,a])),[agents]);
  useEffect(()=>()=>{if(preview) URL.revokeObjectURL(preview);},[preview]);
  function wouldCycle(id:string){
    if(!editing) return false;
    const seen=new Set<string>();let cursor:string|null=id;
    while(cursor && !seen.has(cursor)){if(cursor===editing.id)return true;seen.add(cursor);cursor=byId.get(cursor)?.referrer_id??null;}
    return false;
  }
  const parentOptions=agents.filter(a=>a.id!==editing?.id&&!wouldCycle(a.id)&&a.status==='Active'&&`${a.full_name} ${agentCode(a)} ${a.phone}`.toLowerCase().includes(parentQuery.toLowerCase())).slice(0,40);
  function selectPhoto(file:File|null){setError('');setPhoto(file);setPreview(file ? URL.createObjectURL(file) : '');}
  async function submit(e:FormEvent){
    e.preventDefault();setError('');
    const cleanedPhone=phone.replace(/\D/g,'');
    if(name.trim().length<2)return setError('Please enter the full name.');
    if(!/^\d{10}$/.test(cleanedPhone))return setError('A 10-digit mobile number is required.');
    if(address.trim().length<5)return setError('Please provide a complete address.');
    if(!editing&&!photo)return setError('Please upload an agent photo.');
    if(photo && !['image/jpeg','image/png','image/webp'].includes(photo.type))return setError('Only JPG, PNG, or WebP photos are supported.');
    if(photo && photo.size>5*1024*1024)return setError('Photo must be 5 MB or smaller.');
    if(parent && (parent===editing?.id || wouldCycle(parent)))return setError('This referral would create a circular hierarchy.');
    setSaving(true);
    try{
      let staffReferrerId=editing?.referrer_staff_user_id ?? null;
      let staffReferrerCode=editing?.referrer_staff_code ?? null;
      if(!editing && !parent && staffReferrer.trim()){
        const code=staffReferrer.trim().toUpperCase();
        if(!/^EMP\d{4}$/.test(code))throw new Error('Enter the referring employee ID (EMP + four digits).');
        const {data,error:staffError}=await supabase.from('staff_profiles')
          .select('user_id').eq('staff_employee_no',Number(code.slice(3)))
          .eq('role','staff').eq('active',true).maybeSingle();
        if(staffError)throw staffError;
        if(data){staffReferrerId=data.user_id;}else{
          const {data:quickStaff,error:quickError}=await supabase.from('id_portal_staff')
            .select('employee_code').eq('employee_code',code).eq('active',true).maybeSingle();
          if(quickError)throw quickError;
          if(!quickStaff)throw new Error('Referring employee not found or inactive.');
          staffReferrerCode=quickStaff.employee_code;
        }
      }
      const payload:AgentInput={full_name:name.trim(),phone:cleanedPhone,
        address:address.trim(),referrer_id:parent||null,
        referrer_staff_user_id:parent?null:staffReferrerId,referrer_staff_code:parent?null:staffReferrerCode};
      const saved=editing?await updateAgent(editing,payload,photo):await addAgent(payload,photo!);
      try {await onSaved(saved,Boolean(editing));} catch(refreshError){console.error('Agent saved; directory refresh failed:',refreshError);}
      onClose();
    }catch(err){const msg=err instanceof Error?err.message:(err&&typeof err==='object'&&'message' in err?String((err as {message:unknown}).message):'Unable to save agent. Review Supabase Storage and database permissions.');setError(/duplicate key|agent_network_phone_key/i.test(msg)?'An agent is already registered with this mobile number.':msg);}finally{setSaving(false);}
  }
  return <div className="modal-layer" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)onClose();}}><aside role="dialog" aria-modal="true" aria-label={editing?'Edit agent':'Register agent'} className="form-drawer">
    <div className="drawer-top"><div><div className="eyebrow">AGENT REGISTRATION</div><h2>{editing?'Edit agent details':'Register new agent'}</h2><p>{editing?'Update the agent’s contact details. Their referrer and ID stay the same.':'The ID is assigned automatically from the selected referrer ID.'}</p></div><button className="icon-button" aria-label="Close registration" disabled={saving} onClick={onClose}><X size={19}/></button></div>
    <form onSubmit={submit} className="agent-form"><div className="form-body">
      <div className="section-label"><span>01</span> Personal information</div>
      <div className="photo-input"><div className="photo-preview">{preview?<img src={preview} alt="Selected agent"/>:editing?<AgentAvatar name={editing.full_name} src={photos[editing.photo_path]} size="lg"/>:<Camera size={25}/>}</div><div><strong>Agent photo <span>{editing?'(optional)':'*'}</span></strong><p>JPG, PNG or WebP · Up to 5 MB</p><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>selectPhoto(e.target.files?.[0]??null)} className="sr-only"/><button type="button" className="btn btn-soft" onClick={()=>inputRef.current?.click()}><ImagePlus size={16}/> {photo?'Change photo':editing?'Replace photo':'Upload photo'}</button></div></div>
      <div className="form-field"><label htmlFor="agent-name">Full name <span>*</span></label><input id="agent-name" autoFocus required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. K. Ramesh Kumar"/></div>
      <div className="form-field"><label htmlFor="agent-phone">Mobile number <span>*</span></label><div className="input-prefix"><span>+91</span><input id="agent-phone" required inputMode="numeric" maxLength={10} value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,''))} placeholder="10-digit number"/></div></div>
      <div className="form-field"><label htmlFor="agent-address">Full address <span>*</span></label><textarea id="agent-address" required rows={3} maxLength={1000} value={address} onChange={e=>setAddress(e.target.value)} placeholder="House number, street, village / city, district"/></div>
      <div className="section-label second"><span>02</span> Referral relationship</div>
      <div className="referral-box"><p>Who introduced this agent?</p><button className="parent-selector" type="button" aria-expanded={chooseParent} disabled={Boolean(editing)} onClick={()=>setChooseParent(v=>!v)}><div className="parent-selected">{parent&&byId.has(parent)?<><AgentAvatar size="sm" name={byId.get(parent)!.full_name} src={photos[byId.get(parent)!.photo_path]}/><span><strong>{byId.get(parent)!.full_name}</strong><small>{agentCode(byId.get(parent)!)}</small></span></>:<><span className="main-agent-icon"><UserRoundPlus size={17}/></span><span><strong>Direct agent</strong><small>Not referred by another agent</small></span></>}</div><ChevronDown size={18}/></button>
      {!editing && !parent && <div className="form-field" style={{marginTop:14}}><label htmlFor="referring-staff">Or referring office employee ID (optional)</label><input id="referring-staff" value={staffReferrer} onChange={e=>setStaffReferrer(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7))} placeholder="EMP1520" maxLength={7}/></div>}
      {chooseParent && <div className="parent-menu"><label className="parent-search"><Search size={15}/><input autoFocus placeholder="Search name, Employee ID, or mobile" value={parentQuery} onChange={e=>setParentQuery(e.target.value)}/></label><div className="parent-options"><button type="button" className="parent-option" onClick={()=>{setParent('');setChooseParent(false);}}><span className="main-agent-icon"><UserRoundPlus size={16}/></span><span><strong>Direct agent</strong><small>New independent EMP root ID</small></span>{!parent&&<Check size={16}/>}</button>{parentOptions.map(a=><button type="button" className="parent-option" key={a.id} onClick={()=>{setParent(a.id);setChooseParent(false);setParentQuery('');}}><AgentAvatar name={a.full_name} src={photos[a.photo_path]} size="sm"/><span><strong>{a.full_name}</strong><small>{agentCode(a)} · {a.phone}</small></span>{parent===a.id&&<Check size={16}/>}</button>)}{parentOptions.length===0&&<p className="no-matches">No matching active agents.</p>}</div></div>}
      <p className="field-tip">A referred agent gets the parent ID plus an unused two-digit suffix. IDs cannot be reassigned.</p></div>
      <div className="id-note"><span className="id-note-icon"><Check size={16}/></span><div><strong>{editing?`Agent ID: ${agentCode(editing)}`:'Automatic Agent ID'}</strong><p>{editing?'The existing ID is permanent.':'Direct agents receive an EMP + four-digit root. Each referral receives a unique two-digit suffix under their parent (up to 99 per parent).'}</p></div></div>
      {error&&<div className="message error" role="alert">{error}</div>}
    </div><div className="drawer-actions"><button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button><button className="btn btn-primary" disabled={saving} type="submit">{saving?<LoaderCircle size={17} className="spin"/>:<Check size={17}/>} {saving?'Saving…':editing?'Save changes':'Register agent'}</button></div></form>
  </aside></div>;
}
