import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarClock, Check, LoaderCircle, MapPinned, Users, X } from 'lucide-react';
import type { Agent } from '../types/agent';
import type { AgentCustomer } from '../services/customers';
import { addSiteVisit,manageSiteVisit } from '../services/siteVisits';
import type { AgentSiteVisit } from '../services/siteVisits';
import { agentCode } from '../types/agent';

type Props = {
  agents: Agent[];
  customers: AgentCustomer[];
  initialAgentId?: string;
  editingVisit?: AgentSiteVisit;
  onClose: () => void;
  onAdded: () => Promise<void>;
};

function localNow(value?:string) {
  const date = value?new Date(value):new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function SiteVisitForm({ agents, customers, initialAgentId, editingVisit, onClose, onAdded }: Props) {
  const [agentId, setAgentId] = useState(editingVisit?.agent_id??initialAgentId ?? '');
  const [visitedAt, setVisitedAt] = useState(()=>localNow(editingVisit?.visited_at));
  const [projectName, setProjectName] = useState(editingVisit?.project_name??'Sree Sudha MIRAI');
  const [notes, setNotes] = useState(editingVisit?.notes??'');
  const [selectedIds, setSelectedIds] = useState<string[]>(editingVisit?.agent_site_visit_customers.map(c=>c.customer_id)??[]);
  const [customerQuery,setCustomerQuery]=useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const available = useMemo(() => customers.filter(c => c.agent_id === agentId), [customers, agentId]);
  const filteredCustomers=available.filter(c=>`${c.full_name} ${c.phone}`.toLowerCase().includes(customerQuery.trim().toLowerCase()));
  const agent = agents.find(a => a.id === agentId);
  const maxDateTime = localNow();
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!agent || agent.status !== 'Active') return setError('Select an active agent.');
    if (!selectedIds.length) return setError('Select at least one customer from this agent.');
    if (!visitedAt || !Number.isFinite(new Date(visitedAt).getTime())) return setError('Select a valid date and time.');
    if (new Date(visitedAt).getTime() > Date.now() + 10 * 60 * 1000) return setError('A completed visit cannot be in the future.');
    setSaving(true);
    try {
      if(editingVisit){await manageSiteVisit(editingVisit.id,'edit',{date:new Date(visitedAt).toISOString(),project:projectName.trim(),notes:notes.trim(),customerIds:selectedIds});}
      else{await addSiteVisit({ agentId, visitedAt: new Date(visitedAt).toISOString(), projectName: projectName.trim(), notes: notes.trim(), customerIds: selectedIds });}
    } catch (err) {
      console.error('Site visit save failed:', err);
      const e = err as { message?: string; code?: string; details?: string };
      setError([e?.message || 'Failed to save site visit.', e?.code ? `Code: ${e.code}` : '', e?.details || ''].filter(Boolean).join(' — '));
      setSaving(false);
      return;
    }
    // Saving succeeded. A list-refresh error must not encourage duplicate submissions.
    try { await onAdded(); } catch (refreshError) { console.error('Visit saved; list refresh failed:', refreshError); }
    onClose();
    setSaving(false);
  }
  return <div className="modal-layer visit-form-layer" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
    <section className="visit-form-modal" role="dialog" aria-modal="true" aria-labelledby="visit-form-title">
      <div className="visit-form-head"><div><span className="eyebrow">SITE VISIT REGISTRY</span><h2 id="visit-form-title">{editingVisit?'Edit site visit':'Record site visit'}</h2><p>Track when an agent took customers to the project.</p></div><button className="icon-button" aria-label="Close visit form" disabled={saving} onClick={onClose}><X size={20}/></button></div>
      <form onSubmit={submit} className="visit-form-body">
        <div className="visit-form-row"><label>Agent <span>*</span><select value={agentId} onChange={e => { setAgentId(e.target.value); setSelectedIds([]); }} required disabled={Boolean(initialAgentId)}><option value="">Select agent</option>{agents.filter(a => a.status === 'Active' || a.id === initialAgentId).map(a => <option key={a.id} value={a.id}>{a.full_name} · {agentCode(a)}</option>)}</select></label><label>Visit date & time <span>*</span><div className="visit-icon-input"><CalendarClock size={17}/><input type="datetime-local" required max={maxDateTime} value={visitedAt} onChange={e => setVisitedAt(e.target.value)}/></div></label></div>
        <label>Project / Site <span>*</span><div className="visit-icon-input"><MapPinned size={17}/><input required maxLength={160} minLength={2} value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Project visited"/></div></label>
        <div className="visit-customer-head"><div><strong>Customers taken to site</strong><small>Only customers registered under this agent can be selected</small></div><span className="visit-count"><Users size={16}/>{selectedIds.length} selected</span></div>
        {Boolean(agentId)&&available.length>0&&<input className="visit-customer-search" type="search" placeholder="Search customers by name or phone" value={customerQuery} onChange={e=>setCustomerQuery(e.target.value)}/>}
        {!agentId ? <p className="visit-inline-help">Choose an agent to see their customers.</p> : available.length ? <div className="visit-select-list">{filteredCustomers.map(c => <label key={c.id} className={selectedIds.includes(c.id) ? 'visit-client checked' : 'visit-client'}><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={e => setSelectedIds(previous => e.target.checked ? [...previous, c.id] : previous.filter(id => id !== c.id))}/><span className="visit-client-initial">{c.full_name.slice(0, 1).toUpperCase()}</span><span><strong>{c.full_name}</strong><small>{c.phone}</small></span><Check size={16} className="visit-client-check"/></label>)}</div> : <p className="visit-inline-help">No customers under this agent. Open their profile and add customers first.</p>}
        <label>Notes (optional)<textarea rows={3} maxLength={1000} placeholder="Discussion, follow-up, or customer requirements" value={notes} onChange={e => setNotes(e.target.value)}/></label>
        {error && <div className="message error" role="alert">{error}</div>}
        <div className="visit-form-actions"><button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button><button className="btn btn-primary" type="submit" disabled={saving || !selectedIds.length || !agentId}>{saving ? <LoaderCircle className="spin" size={17}/> : <Check size={17}/>} {editingVisit?'Save changes':'Save visit'} · {selectedIds.length} client{selectedIds.length === 1 ? '' : 's'}</button></div>
      </form>
    </section>
  </div>;
}
