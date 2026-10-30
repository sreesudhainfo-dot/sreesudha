import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, Eye, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { addCustomer, archiveCustomer, updateCustomer } from '../services/customers';
import type { AgentCustomer } from '../services/customers';
import type { Agent } from '../types/agent';
import { agentCode } from '../types/agent';

interface Props {
  customers:AgentCustomer[];
  agents:Agent[];
  available:boolean;
  refresh:()=>Promise<void>;
  onViewAgent:(agent:Agent)=>void;
}
export default function CustomerDirectory({customers,agents,available,refresh,onViewAgent}:Props){
 const [query,setQuery]=useState('');
 const [editor,setEditor]=useState<AgentCustomer|null|undefined>(undefined);
 const [agentId,setAgentId]=useState('');
 const [name,setName]=useState('');const [phone,setPhone]=useState('');const [notes,setNotes]=useState('');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const byId=useMemo(()=>new Map(agents.map(a=>[a.id,a])),[agents]);
 const filtered=customers.filter(c=>`${c.full_name} ${c.phone} ${byId.get(c.agent_id)?.full_name??''}`.toLowerCase().includes(query.trim().toLowerCase()));
 function open(c?:AgentCustomer){setEditor(c??null);setAgentId(c?.agent_id??'');setName(c?.full_name??'');setPhone(c?.phone??'');setNotes(c?.notes??'');setError('');}
 async function save(e:FormEvent){e.preventDefault();setError('');if(!agentId)return setError('Choose a registered agent.');if(name.trim().length<2)return setError('Enter a valid customer name.');if(!/^\d{10}$/.test(phone))return setError('Enter a 10-digit mobile number.');
 setBusy(true);try{if(editor){await updateCustomer(editor.id,{full_name:name.trim(),phone,notes:notes.trim()});}else{await addCustomer({agent_id:agentId,full_name:name.trim(),phone,notes:notes.trim()});}await refresh();setEditor(undefined);setNotice(editor?'Customer details updated.':'Customer created successfully.');}
 catch(err){setError(err instanceof Error?err.message:'Customer save failed.');}finally{setBusy(false);}}
 async function remove(c:AgentCustomer){if(!window.confirm(`Delete ${c.full_name} from the active customer list? Their historical site visits will be retained.`))return;setBusy(true);setError('');
 try{await archiveCustomer(c.id);await refresh();setNotice('Customer archived. History has been preserved.');}catch(err){setError(err instanceof Error?err.message:'Unable to delete customer.');}finally{setBusy(false);}}
 return <section className="customer-directory panel" aria-label="Customer management">
  <div className="directory-header"><div><h2>Customers <span className="count-pill">{customers.length}</span></h2><p>Search customers and manage their records.</p></div><button className="btn btn-primary" disabled={!available} onClick={()=>open()}><Plus size={17}/> Add customer</button></div>
  {!available&&<div className="message error" role="alert">Customer data is not available. Check the agent_customers_migration.sql database setup.</div>}
  {notice&&<div className="ops-notice"><CheckCircle2 size={17}/>{notice}</div>}
  {error&&<div className="ops-alert" role="alert">{error}</div>}
  <label className="customer-directory-search"><Search size={18}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by customer, phone or agent name"/></label>
  <div className="customer-directory-grid">
  {filtered.map(c=>{const a=byId.get(c.agent_id);return <article key={c.id} className="customer-manager-card"><div className="customer-manager-main"><span className="customer-manager-avatar">{c.full_name.charAt(0).toUpperCase()}</span><div><h3>{c.full_name}</h3><p>{c.phone}</p><small>{a?.full_name??'Agent unavailable'}{a?` · ${agentCode(a)}`:''}</small></div></div><div className="customer-manager-actions"><button onClick={()=>a&&onViewAgent(a)} disabled={!a}><Eye size={16}/> Agent</button><button onClick={()=>open(c)}><Pencil size={16}/> Edit</button><button className="danger" disabled={busy} onClick={()=>void remove(c)}><Trash2 size={16}/> Delete</button></div></article>;})}
  </div>
  {!filtered.length&&<div className="empty-state"><Users size={26}/><h3>{customers.length?'No matching customers':'No customers yet'}</h3><p>{customers.length?'Try another search.':'Use Add customer to register the first customer.'}</p></div>}
  {editor!==undefined&&<div className="ops-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setEditor(undefined);}}><section className="ops-modal" role="dialog" aria-modal="true" aria-label={editor?'Edit customer':'Add customer'}><div className="ops-modal-head"><div><span className="ops-kicker">SREE SUDHA · CUSTOMERS</span><h2>{editor?'Edit customer':'Register customer'}</h2></div><button type="button" onClick={()=>setEditor(undefined)} disabled={busy} aria-label="Close"><X size={20}/></button></div><form className="ops-form" onSubmit={e=>void save(e)}><label>Assigned agent<select required disabled={Boolean(editor)} value={agentId} onChange={e=>setAgentId(e.target.value)}><option value="">Select agent</option>{agents.filter(a=>a.status==='Active'||a.id===agentId).map(a=><option key={a.id} value={a.id}>{a.full_name} · {agentCode(a)}</option>)}</select></label><label>Customer name<input autoFocus required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/></label><label>Mobile number<input required inputMode="numeric" maxLength={10} value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,''))} placeholder="10-digit number"/></label><label>Notes (optional)<textarea rows={3} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Requirement, preference or follow-up notes"/></label>{error&&<div className="ops-alert" role="alert">{error}</div>}<div className="ops-modal-footer"><button type="button" className="ops-outline" disabled={busy} onClick={()=>setEditor(undefined)}>Cancel</button><button className="ops-primary" type="submit" disabled={busy}>{busy?'Saving…':editor?'Save changes':'Register customer'}</button></div></form></section></div>}
 </section>;
}
