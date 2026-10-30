import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, Pencil, Plus, RefreshCw, Trash2, Users, UserRound, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Person={employee_code:string;full_name:string;active:boolean;created_at:string};
export default function StaffDirectoryPage(){
 const [people,setPeople]=useState<Person[]>([]),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [selected,setSelected]=useState<Person|null>(null),[modalMode,setModalMode]=useState<'view'|'edit'|null>(null),[editName,setEditName]=useState('');
 const refresh=useCallback(async()=>{const {data,error:e}=await supabase.from('id_portal_staff').select('employee_code,full_name,active,created_at').order('created_at',{ascending:false});if(e)throw e;setPeople((data??[]) as Person[])},[]);
 useEffect(()=>{void refresh().catch(e=>setError(e instanceof Error?e.message:'Could not load employees. Run the ID-only portal migration.'))},[refresh]);
 async function register(e:FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{
  const {data,error:e}=await supabase.from('id_portal_staff').insert({full_name:name.trim()}).select('employee_code,full_name').single();
  if(e)throw e;setName('');setNotice(`${data.full_name} registered with ID ${data.employee_code}.`);await refresh();
 }catch(e){setError(e instanceof Error?e.message:'Unable to register employee.')}finally{setBusy(false)}}
 function openView(p:Person){setSelected(p);setEditName(p.full_name);setModalMode('view');}
 function openEdit(p:Person){setSelected(p);setEditName(p.full_name);setModalMode('edit');}
 async function saveEdit(e:FormEvent){e.preventDefault();if(!selected)return;setBusy(true);setError('');setNotice('');try{
  const {error:e}=await supabase.from('id_portal_staff').update({full_name:editName.trim()}).eq('employee_code',selected.employee_code);
  if(e)throw e;await refresh();setModalMode(null);setSelected(null);setNotice('Employee details updated.');
 }catch(e){setError(e instanceof Error?e.message:'Unable to update employee.')}finally{setBusy(false)}}
 async function toggle(p:Person){if(!confirm(`${p.active?'Deactivate':'Reactivate'} ${p.full_name}?`))return;setBusy(true);setError('');setNotice('');try{
  const {error:e}=await supabase.from('id_portal_staff').update({active:!p.active}).eq('employee_code',p.employee_code);
  if(e)throw e;await refresh();setNotice('Employee status updated.');
 }catch(e){setError(e instanceof Error?e.message:'Unable to update employee.')}finally{setBusy(false)}}
 return <div className="ops-page"><header className="ops-top"><Link className="ops-brand" to="/agents"><img src="/sree-sudha-mark.png" alt="Sree Sudha"/><span><strong>SREE SUDHA</strong><small>EMPLOYEE MANAGEMENT</small></span></Link><div className="ops-top-actions"><Link className="ops-link" to="/agents"><ArrowLeft size={17}/> Dashboard</Link><Link className="ops-link" to="/management">Attendance reports</Link></div></header>
 <main className="ops-container"><div className="ops-heading"><div><span className="ops-kicker">TEAM DIRECTORY</span><h1>Employees</h1><p>Register, view, edit and deactivate employee records.</p></div></div>
 {error&&<div className="ops-alert" role="alert">{error}</div>}{notice&&<div className="ops-notice"><CheckCircle2 size={16}/>{notice}</div>}
 <div className="quick-staff-grid"><section className="ops-panel"><div className="ops-panel-head"><div><h2><Plus size={17}/> Register employee</h2><p>Every employee receives a unique Employee ID automatically.</p></div></div><form className="ops-form quick-staff-form" onSubmit={register}><label>Full employee name<input required minLength={2} maxLength={120} value={name} placeholder="Employee full name" onChange={e=>setName(e.target.value)}/></label><button disabled={busy} type="submit" className="ops-primary"><UserRound size={16}/>{busy?'Saving…':'Register employee'}</button></form></section>
 <section className="ops-panel"><div className="ops-panel-head"><div><h2><Users size={18}/> Employee directory</h2><p>{people.filter(p=>p.active).length} active employees</p></div><button className="ops-outline" onClick={()=>void refresh()}><RefreshCw size={15}/> Refresh</button></div><div className="ops-table-wrap"><table className="ops-table responsive-table-cards"><thead><tr><th>EMPLOYEE</th><th>ID</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{people.map(p=><tr key={p.employee_code}><td data-label="Employee"><strong>{p.full_name}</strong></td><td data-label="ID">{p.employee_code}</td><td data-label="Status"><span className="ops-pill">{p.active?'Active':'Inactive'}</span></td><td data-label="Actions"><div className="ops-cell-actions wrap-actions"><button disabled={busy} onClick={()=>openView(p)}><Eye size={15}/> View</button><button disabled={busy} onClick={()=>openEdit(p)}><Pencil size={15}/> Edit</button><button className={p.active?'destructive-action':''} disabled={busy} onClick={()=>void toggle(p)}><Trash2 size={15}/> {p.active?'Delete':'Restore'}</button></div></td></tr>)}</tbody></table>{!people.length&&<p className="ops-empty">No employees registered yet.</p>}</div></section></div>
 <p className="ops-footnote"><ShieldCheck size={15}/> Management can use the same employee form pattern to view, edit or deactivate employee entries.</p></main>
 {selected&&modalMode&&<div className="ops-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy){setModalMode(null);setSelected(null);}}}><section className="ops-modal" role="dialog" aria-modal="true"><div className="ops-modal-head"><div><span className="ops-kicker">EMPLOYEE DETAILS</span><h2>{modalMode==='view'?'View employee':'Edit employee'}</h2></div><button onClick={()=>{setModalMode(null);setSelected(null);}} aria-label="Close"><X size={20}/></button></div>{modalMode==='view'?<div className="ops-form"><label>Employee name<input value={selected.full_name} disabled readOnly/></label><label>Employee ID<input value={selected.employee_code} disabled readOnly/></label><label>Status<input value={selected.active?'Active':'Inactive'} disabled readOnly/></label></div>:<form className="ops-form" onSubmit={saveEdit}><label>Employee name<input required minLength={2} maxLength={120} value={editName} onChange={e=>setEditName(e.target.value)}/></label><label>Employee ID<input value={selected.employee_code} disabled readOnly/></label><div className="ops-modal-footer"><button className="ops-outline" type="button" onClick={()=>{setModalMode(null);setSelected(null);}}>Cancel</button><button className="ops-primary" type="submit" disabled={busy}>{busy?'Saving…':'Save changes'}</button></div></form>}</section></div>}
 </div>;
}
