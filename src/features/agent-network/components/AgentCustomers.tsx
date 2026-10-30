import { useState } from 'react';
import type { FormEvent } from 'react';
import { LoaderCircle, Phone, Plus, Users, Pencil, Trash2 } from 'lucide-react';
import type { AgentCustomer } from '../services/customers';
import { addCustomer, updateCustomer, archiveCustomer } from '../services/customers';

export default function AgentCustomers({agentId,agentName,customers,onAdded,available}:{
  agentId:string;agentName:string;customers:AgentCustomer[];onAdded:()=>Promise<void>;available:boolean
}){
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<AgentCustomer|null>(null);
  const [name,setName]=useState('');const [phone,setPhone]=useState('');const [notes,setNotes]=useState('');
  const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  async function submit(event:FormEvent){
    event.preventDefault();setError('');
    if(name.trim().length<2)return setError('Enter the customer name.');
    if(!/^\d{10}$/.test(phone))return setError('Enter a 10-digit phone number.');
    setSaving(true);
    try{if(editing){await updateCustomer(editing.id,{full_name:name.trim(),phone,notes:notes.trim()});}else{await addCustomer({agent_id:agentId,full_name:name.trim(),phone,notes:notes.trim()});}
      await onAdded();setName('');setPhone('');setNotes('');setEditing(null);setOpen(false);
    }catch(e){setError(e instanceof Error?e.message:'Could not save customer.');}
    finally{setSaving(false);}
  }
  return <div className="profile-section agent-customers-section">
    <div className="customer-section-title"><div><h3>Customers <span className="customer-count">{customers.length}</span></h3><p className="customer-subheading">Customers linked to {agentName}</p></div><button className="btn btn-soft" type="button" disabled={!available} onClick={()=>{setEditing(null);setName('');setPhone('');setNotes('');setOpen(v=>!v);}}><Plus size={15}/> Add customer</button></div>
    {!available?<div className="att-message error">Customers database not set up. Run the additional customers migration in Supabase.</div>:<>
    {error&&!open&&<div className="message error" role="alert">{error}</div>}
    {customers.length===0?<div className="customer-empty"><Users size={20}/><span>No customers added to this agent yet.</span></div>:<div className="customer-list">{customers.map(c=><div className="customer-entry" key={c.id}><span className="customer-avatar">{c.full_name.trim().charAt(0).toUpperCase()}</span><div><strong>{c.full_name}</strong><a href={`tel:+91${c.phone}`}><Phone size={12}/> {c.phone}</a>{c.notes&&<small>{c.notes}</small>}</div><div className="customer-entry-actions"><button type="button" aria-label={`Edit ${c.full_name}`} onClick={()=>{setEditing(c);setName(c.full_name);setPhone(c.phone);setNotes(c.notes);setOpen(true);}}><Pencil size={15}/> Edit</button><button type="button" disabled={saving} aria-label={`Delete ${c.full_name}`} onClick={()=>{if(!window.confirm('Archive this customer? Historical site visits remain available.'))return;setSaving(true);void archiveCustomer(c.id).then(onAdded).catch(e=>setError(e.message)).finally(()=>setSaving(false));}}><Trash2 size={15}/> Delete</button></div></div>)}</div>}
    {open&&<form className="customer-add-form" onSubmit={submit}>
      <strong>{editing?'Edit customer details':'New customer'}</strong><label>Customer name<input autoFocus required maxLength={120} placeholder="Customer full name" value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Mobile number<input required inputMode="numeric" maxLength={10} placeholder="10-digit mobile" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,''))}/></label>
      <label>Notes (optional)<textarea rows={2} maxLength={1000} placeholder="Requirement or follow-up information" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
      {error&&<p className="message error" role="alert">{error}</p>}
      <div className="customer-form-actions"><button type="button" className="btn btn-outline" onClick={()=>setOpen(false)} disabled={saving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?<LoaderCircle className="spin" size={16}/>:<Plus size={16}/>} {editing?'Save changes':'Save customer'}</button></div>
    </form>}</>}
  </div>;
}
