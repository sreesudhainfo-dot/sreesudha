import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity, ArrowDownLeft, ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, ClipboardList,
  CircleAlert, Copy, Download, GitBranch, Building2, ClipboardCheck, LayoutDashboard, ListFilter, LoaderCircle, LogOut, MapPin, Menu,
  Network, Phone, Plus, RefreshCw, Search, ShieldCheck, SlidersHorizontal, MapPinned, Clock3, UserRound,
  UserRoundCheck, UserRoundPlus, Users, Eye, Pencil, Trash2, RotateCcw, Fingerprint, X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { logout } from '../auth/services/auth';
import AgentAvatar from './components/AgentAvatar';
import AgentForm from './components/AgentForm';
import AgentCustomers from './components/AgentCustomers';
import CustomerDirectory from './components/CustomerDirectory';
import { fetchCustomers } from './services/customers';
import type { AgentCustomer } from './services/customers';
import AgentTree from './components/AgentTree';
import SiteVisitForm from './components/SiteVisitForm';
import RegistrationRequests from '../agent-registration/RegistrationRequests';
import { fetchSiteVisits,manageSiteVisit } from './services/siteVisits';
import type { AgentSiteVisit } from './services/siteVisits';
import { fetchAgents, fetchPhotoLinks, setAgentStatus } from './services/agents';
import type { Agent } from './types/agent';
import { agentCode } from './types/agent';
import { indiaDate } from '../attendance/attendance';

type View='overview'|'agents'|'customers'|'network'|'visits'|'requests';
type Filter='all'|'main'|'referred'|'active'|'inactive';
const navItems:{id:View;label:string;icon:LucideIcon;caption:string}[]=[
  {id:'overview',label:'Overview',icon:LayoutDashboard,caption:'Agent summary'},
  {id:'agents',label:'All agents',icon:Users,caption:'Directory & records'},
  {id:'customers',label:'Customers',icon:UserRound,caption:'Manage customers'},
  {id:'network',label:'Referral network',icon:Network,caption:'Agent hierarchy'},
  {id:'visits',label:'Site visits',icon:MapPinned,caption:'Client visits'},
  {id:'requests',label:'Registration requests',icon:ClipboardList,caption:'Approvals'},
];
function cleanExcel(value:string){return /^[=+@\-\t\r]/.test(value)?`'${value}`:value;}
function fmtDate(s:string){return new Date(s).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}
function getDescendantCount(agentId:string,children:Map<string,Agent[]>) {
  const visited=new Set<string>([agentId]); const pending=[agentId]; let count=0;
  while(pending.length){const cur=pending.pop()!;for(const child of children.get(cur)??[]){if(!visited.has(child.id)){visited.add(child.id);count++;pending.push(child.id);}}}return count;
}
function Status({value}:{value:Agent['status']}){return <span className={`status-pill ${value==='Active'?'is-active':'is-inactive'}`}><i/>{value}</span>;}
function Stat({label,value,caption,icon:Icon,kind}:{label:string;value:number;caption:string;icon:LucideIcon;kind:string}){return <div className="stat-card"><div className="stat-top"><div className={`stat-icon ${kind}`}><Icon size={20}/></div><ArrowRight size={17} className="stat-arrow"/></div><div className="stat-value">{value.toLocaleString('en-IN')}</div><div className="stat-label">{label}</div><div className="stat-caption">{caption}</div></div>;}
function Empty({title,body,icon:Icon,action}:{title:string;body:string;icon:LucideIcon;action?:ReactNode}){return <div className="empty-state"><span className="empty-icon"><Icon size={27}/></span><h3>{title}</h3><p>{body}</p>{action}</div>;}

export default function AgentRegistryPage(){
  const [params,setParams]=useSearchParams();
  const raw=params.get('view');
  const view:View=raw==='agents'||raw==='customers'||raw==='network'||raw==='visits'||raw==='requests'?raw:'overview';
  const [agents,setAgents]=useState<Agent[]>([]);
  const [customers,setCustomers]=useState<AgentCustomer[]>([]);
  const [customersError,setCustomersError]=useState(false);
  const [visits,setVisits]=useState<AgentSiteVisit[]>([]);
  const [visitsError,setVisitsError]=useState(false);
  const [visitFormAgentId,setVisitFormAgentId]=useState<string|null>(null);
  const [visitEditing,setVisitEditing]=useState<AgentSiteVisit|null>(null);
  const [photos,setPhotos]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<Filter>('all');
  const [showMobileNav,setShowMobileNav]=useState(false);
  const [form,setForm]=useState<{editing?:Agent;parentId?:string|null}|null>(null);
  const [selected,setSelected]=useState<Agent|null>(null);
  const [busy,setBusy]=useState(false);
  const [toast,setToast]=useState('');
  const [userEmail,setUserEmail]=useState('');
  const [networkQuery,setNetworkQuery]=useState('');
  const [businessSummary,setBusinessSummary]=useState<{plots:number|null;bookings:number|null;staff:number|null;dailyWork:number|null}>({plots:null,bookings:null,staff:null,dailyWork:null});
  const byId=useMemo(()=>new Map(agents.map(a=>[a.id,a])),[agents]);
  const customersByAgent=useMemo(()=>{const m=new Map<string,AgentCustomer[]>();for(const c of customers)m.set(c.agent_id,[...(m.get(c.agent_id)??[]),c]);return m;},[customers]);
  const countCustomers=(id:string)=>customersByAgent.get(id)?.length??0;
  const visitsByAgent=useMemo(()=>{const m=new Map<string,AgentSiteVisit[]>();for(const v of visits)m.set(v.agent_id,[...(m.get(v.agent_id)??[]),v]);return m;},[visits]);
  const countVisits=(id:string)=>visitsByAgent.get(id)?.length??0;
  const allClientsTaken=visits.reduce((count,v)=>count+v.agent_site_visit_customers.length,0);
  const visitCustomerNames=(v:AgentSiteVisit)=>v.agent_site_visit_customers.map(x=>customers.find(c=>c.id===x.customer_id)?.full_name??'Customer record unavailable').join(', ');
  const children=useMemo(()=>{const m=new Map<string,Agent[]>();for(const a of agents)if(a.referrer_id)m.set(a.referrer_id,[...(m.get(a.referrer_id)??[]),a]);return m;},[agents]);
  const roots=useMemo(()=>agents.filter(a=>!a.referrer_id||!byId.has(a.referrer_id)),[agents,byId]);
  const invited=agents.filter(a=>a.referrer_id||a.referrer_staff_user_id).length;
  const active=agents.filter(a=>a.status==='Active').length;
  const directory=useMemo(()=>agents.filter(a=>{
    if(filter==='main'&&(a.referrer_id||a.referrer_staff_user_id))return false;
    if(filter==='referred'&&!a.referrer_id&&!a.referrer_staff_user_id)return false;
    if(filter==='active'&&a.status!=='Active')return false;
    if(filter==='inactive'&&a.status!=='Inactive')return false;
    return `${a.full_name} ${agentCode(a)} ${a.phone} ${a.address} ${a.status} ${a.referrer_id?byId.get(a.referrer_id)?.full_name??'':''}`.toLowerCase().includes(query.trim().toLowerCase());
  }),[agents,filter,query,byId]);
  const recent=useMemo(()=>[...agents].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,5),[agents]);
  const selectedParent=selected?.referrer_id?byId.get(selected.referrer_id):null;
  const selectedDirect=selected?children.get(selected.id)??[]:[];
  const selectedTotal=selected?getDescendantCount(selected.id,children):0;
  const refresh=useCallback(async()=>{
    setError('');
    try{
      const list=await fetchAgents();setAgents(list);
      try{setCustomers(await fetchCustomers());setCustomersError(false);}
      catch(err){console.warn('Customers unavailable. Run agent_customers_migration.sql:',err);setCustomersError(true);}
      try{setVisits(await fetchSiteVisits());setVisitsError(false);}
      catch(err){console.warn('Site visits unavailable. Run agent_site_visits_migration.sql:',err);setVisitsError(true);}
      try{setPhotos(await fetchPhotoLinks(list));}catch(err){console.warn('Photo URLs unavailable:',err);}
      setSelected(current=>current?list.find(a=>a.id===current.id)??null:null);
      // Homepage metrics are optional: an uninstalled module should never break Agent Registry.
      const today=indiaDate();
      const [plots,bookings,staff,dailyWork]=await Promise.all([
        supabase.from('mirai_plots').select('id',{count:'exact',head:true}).eq('is_active',true),
        supabase.from('mirai_bookings').select('id',{count:'exact',head:true}).neq('status','Cancelled'),
        supabase.from('staff_attendance').select('id',{count:'exact',head:true}).eq('work_date',today),
        supabase.from('employee_daily_work').select('id',{count:'exact',head:true}).eq('work_date',today).is('deleted_at',null)
      ]);
      setBusinessSummary({plots:plots.error?null:plots.count??0,bookings:bookings.error?null:bookings.count??0,staff:staff.error?null:staff.count??0,dailyWork:dailyWork.error?null:dailyWork.count??0});
    }catch(err){setError(err instanceof Error?err.message:'Unable to load agents.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();void supabase.auth.getUser().then(({data})=>setUserEmail(data.user?.email??''));},[refresh]);
  useEffect(()=>{if(!toast)return;const t=window.setTimeout(()=>setToast(''),6500);return()=>window.clearTimeout(t);},[toast]);
  useEffect(()=>{document.body.style.overflow=selected||form||visitFormAgentId!==null?'hidden':'';return()=>{document.body.style.overflow='';};},[selected,form,visitFormAgentId]);
  useEffect(()=>{if(!selected)return;function escape(e:KeyboardEvent){if(e.key==='Escape')setSelected(null);}document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[selected]);
  function changeView(v:View){setParams(v==='overview'?{}:{view:v});setShowMobileNav(false);setSelected(null);}
  function openNew(parentId?:string){setSelected(null);setForm({parentId});}
  async function onSaved(saved:Agent,editing:boolean){await refresh();setToast(editing?`${saved.full_name} updated successfully.`:`${saved.full_name} registered · ${agentCode(saved)} assigned`);}
  async function refreshCustomers(){setCustomers(await fetchCustomers());setCustomersError(false);setToast('Customer saved successfully.');}
  async function refreshVisits(){const list=await fetchSiteVisits();setVisits(list);setVisitsError(false);setToast('Site visit saved successfully.');}
  function recordVisit(agentId=''){setVisitEditing(null);setSelected(null);setVisitFormAgentId(agentId);}
  function editVisit(v:AgentSiteVisit){setVisitEditing(v);setSelected(null);setVisitFormAgentId(v.agent_id);}
  async function cancelVisit(v:AgentSiteVisit){const reason=window.prompt('Enter reason for cancelling this site visit (at least 5 characters):');if(!reason||reason.trim().length<5)return;setBusy(true);try{await manageSiteVisit(v.id,'cancel',undefined,reason);await refreshVisits();setToast('Site visit archived.');}catch(e){setError(e instanceof Error?e.message:'Could not cancel visit');}finally{setBusy(false);}}
  function exportExcel(){
    const list=view==='agents'?directory:agents;
    const sheet=XLSX.utils.json_to_sheet(list.map(a=>({
      'Agent ID':agentCode(a),'Full name':cleanExcel(a.full_name),'Mobile':a.phone,'Address':cleanExcel(a.address),
      'Introduced by':a.referrer_id?byId.has(a.referrer_id)?cleanExcel(`${byId.get(a.referrer_id)!.full_name} (${agentCode(byId.get(a.referrer_id)!)})`):'Unknown':a.referrer_staff_user_id?`Office employee (${agentCode(a).slice(0,-2)})`:'Direct registration',
      'Direct referrals':children.get(a.id)?.length??0,'Total downline':getDescendantCount(a.id,children),'Customers':countCustomers(a.id),'Site visits':countVisits(a.id),'Status':a.status,'Registered':fmtDate(a.created_at)
    })));
    sheet['!cols']=[{wch:13},{wch:13},{wch:28},{wch:17},{wch:45},{wch:33},{wch:19},{wch:16},{wch:15},{wch:12},{wch:14},{wch:17}];
    const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Agents');XLSX.writeFile(book,`Sree_Sudha_Agents_${new Date().toISOString().slice(0,10)}.xlsx`);
  }
  function exportVisits(){
    const sheet=XLSX.utils.json_to_sheet(visits.map(v=>({
      'Visit date':fmtDate(v.visited_at),
      'Visit time (IST)':new Date(v.visited_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'}),
      'Agent ID':byId.has(v.agent_id)?agentCode(byId.get(v.agent_id)!):'Unknown',
      'Agent':cleanExcel(byId.get(v.agent_id)?.full_name??'Unknown'),
      'Project / Site':cleanExcel(v.project_name),
      'Number of clients':v.agent_site_visit_customers.length,
      'Customer names':cleanExcel(visitCustomerNames(v)),
      'Notes':cleanExcel(v.notes)
    })));
    sheet['!cols']=[{wch:18},{wch:18},{wch:15},{wch:30},{wch:28},{wch:19},{wch:55},{wch:45}];
    const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Site visits');
    XLSX.writeFile(book,`Sree_Sudha_Site_Visits_${new Date().toISOString().slice(0,10)}.xlsx`);
  }
  async function toggleStatus(a:Agent){const next=a.status==='Active'?'Inactive':'Active';if(!window.confirm(`Mark ${a.full_name} as ${next.toLowerCase()}? Referral history will be kept.`))return;setBusy(true);setError('');try{await setAgentStatus(a.id,next);await refresh();setToast(`${a.full_name} marked ${next.toLowerCase()}.`);}catch(err){setError(err instanceof Error?err.message:'Unable to update.');}finally{setBusy(false);}}
  function AgentTable({list}:{list:Agent[]}){return <div className="table-scroll agent-table-scroll"><table className="agents-table agents-directory-table"><thead><tr><th>AGENT</th><th className="action-head">ACTIONS</th><th>EMPLOYEE ID</th><th>MOBILE</th><th>INTRODUCED BY</th><th>REFERRALS</th><th>CUSTOMERS</th><th>VISITS</th><th>STATUS</th></tr></thead><tbody>{list.map(a=><tr key={a.id}><td><button className="agent-name-cell" onClick={()=>setSelected(a)}><AgentAvatar name={a.full_name} src={photos[a.photo_path]} size="sm"/><span><strong>{a.full_name}</strong><small>Joined {fmtDate(a.created_at)}</small></span></button></td><td className="action-cell"><div className="visible-row-actions"><button className="table-action view" title={`View ${a.full_name}`} onClick={()=>setSelected(a)}><Eye size={15}/> View</button><button className="table-action edit" title={`Edit ${a.full_name}`} onClick={()=>{setSelected(null);setForm({editing:a});}}><Pencil size={15}/> Edit</button><button className={`table-action ${a.status==='Active'?'delete':'restore'}`} title={`${a.status==='Active'?'Deactivate':'Reactivate'} ${a.full_name}`} disabled={busy} onClick={()=>void toggleStatus(a)}>{a.status==='Active'?<Trash2 size={15}/>:<RotateCcw size={15}/>} {a.status==='Active'?'Delete':'Restore'}</button></div></td><td><span className="agent-id">{agentCode(a)}</span></td><td><span className="table-phone">{a.phone}</span></td><td>{a.referrer_id?<button className="referrer-link" onClick={()=>{const parent=byId.get(a.referrer_id!);if(parent)setSelected(parent);}}>{byId.get(a.referrer_id)?.full_name??'Unknown'}<small>{byId.get(a.referrer_id)?agentCode(byId.get(a.referrer_id)!):''}</small></button>:<span className="direct-tag">{a.referrer_staff_user_id?`Office staff ${agentCode(a).slice(0,-2)}`:'Direct agent'}</span>}</td><td><span className="team-count"><Users size={14}/>{children.get(a.id)?.length??0}</span></td><td><button className="customer-count-button" onClick={()=>setSelected(a)} aria-label={`View customers for ${a.full_name}`}><Users size={14}/>{countCustomers(a.id)}</button></td><td><button className="customer-count-button" onClick={()=>setSelected(a)} aria-label={`View visits for ${a.full_name}`}><MapPinned size={14}/>{countVisits(a.id)}</button></td><td><Status value={a.status}/></td></tr>)}</tbody></table></div>;}
  function MobileList({list}:{list:Agent[]}){return <div className="mobile-list">{list.map(a=><article className="mobile-agent-card" key={a.id}><button className="mobile-agent" onClick={()=>setSelected(a)}><AgentAvatar name={a.full_name} src={photos[a.photo_path]} size="md"/><span className="mobile-agent-main"><strong>{a.full_name}</strong><span>{agentCode(a)}</span><small>{a.phone} · {a.referrer_id?`Under ${byId.get(a.referrer_id)?.full_name??'Unknown'}`:a.referrer_staff_user_id?`Office staff ${agentCode(a).slice(0,-2)}`:'Direct agent'} · {countCustomers(a.id)} customers · {countVisits(a.id)} visits</small></span><ChevronRight size={18}/></button><div className="mobile-actions"><button onClick={()=>setSelected(a)}><Eye size={16}/> View</button><button onClick={()=>setForm({editing:a})}><Pencil size={16}/> Edit</button><button disabled={busy} className={a.status==='Active'?'danger':''} onClick={()=>void toggleStatus(a)}>{a.status==='Active'?<Trash2 size={16}/>:<RotateCcw size={16}/>} {a.status==='Active'?'Delete':'Restore'}</button></div></article>)}</div>;}
  function Records({list}:{list:Agent[]}){return list.length?<><AgentTable list={list}/><MobileList list={list}/></>:<Empty icon={Search} title={agents.length?'No matching agents':'No agents registered yet'} body={agents.length?'Try a different search or filter.':'Register your first agent to build the directory.'} action={!agents.length?<button className="btn btn-primary" onClick={()=>openNew()}><Plus size={16}/> Add first agent</button>:undefined}/>;}
  const headerLabel=view==='overview'?'Dashboard':view==='agents'?'Agent directory':view==='customers'?'Customers':view==='visits'?'Site visits':view==='requests'?'Registration requests':'Referral network';
  return <div className="app-shell">
    <aside className={`sidebar ${showMobileNav?'sidebar-open':''}`}><div className="sidebar-logo"><button type="button" className="sidebar-brand-block brand-home" title="Go to dashboard" aria-label="Sree Sudha home — dashboard" onClick={()=>changeView('overview')}><img className="company-logo sidebar-company-logo" src="/sree-sudha-mark.png" alt=""/><span className="brand-words"><strong>SREE SUDHA</strong><small>MANAGEMENT CRM</small></span></button><button className="sidebar-close" aria-label="Close menu" onClick={()=>setShowMobileNav(false)}><X size={18}/></button></div>
      <div className="sidebar-menu-scroll">
        <div className="side-group-caption">HOME</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.filter(item=>item.id==='overview').map(item=><button key={item.id} type="button" aria-current={view===item.id?'page':undefined} className={`side-link ${view===item.id?'selected':''}`} onClick={()=>changeView(item.id)}><item.icon size={19}/><span>Dashboard</span>{view===item.id&&<span className="side-dot"/>}</button>)}
        </nav>
        <div className="side-group-caption sidebar-tools">AGENTS & CUSTOMERS</div>
        <nav className="side-nav" aria-label="Agent management">
          {navItems.filter(item=>['agents','customers','network','requests'].includes(item.id)).map(item=><button key={item.id} type="button" aria-current={view===item.id?'page':undefined} className={`side-link ${view===item.id?'selected':''}`} onClick={()=>changeView(item.id)}><item.icon size={19}/><span>{item.id==='requests'?'Agent approvals':item.label}</span>{view===item.id&&<span className="side-dot"/>}</button>)}
        </nav>
        <div className="side-group-caption sidebar-tools">OPERATIONS</div>
        <nav className="side-nav" aria-label="Business operations">
          <button className={`side-link ${view==='visits'?'selected':''}`} aria-current={view==='visits'?'page':undefined} onClick={()=>changeView('visits')}><MapPinned size={19}/><span>Site visits</span>{view==='visits'&&<span className="side-dot"/>}</button>
          <Link className="side-link" to="/mirai-sales"><Building2 size={19}/><span>MIRAI sales</span></Link>
          <Link className="side-link" to="/daily-work"><ClipboardCheck size={19}/><span>Daily work</span></Link>
          <Link className="side-link" to="/management"><CalendarDays size={19}/><span>Employees & attendance</span></Link>
          <Link className="side-link" to="/employees"><ShieldCheck size={19}/><span>Staff & agent devices</span></Link><Link className="side-link" to="/registration-settings"><ShieldCheck size={19}/><span>WhatsApp group settings</span></Link>
        </nav>
        <div className="side-group-caption sidebar-tools">REGISTRATION</div>
        <a className="side-new" href="/agent-register" target="_blank" rel="noopener noreferrer"><UserRoundPlus size={18}/><span>Agent registration form</span><ArrowRight size={16}/></a>
      </div>
      <div className="sidebar-bottom"><div className="sidebar-security"><ShieldCheck size={18}/><span><strong>Private records</strong><small>Access-controlled workspace</small></span></div><div className="sidebar-company">Sree Sudha Promoters & Developers</div></div>
    </aside>
    {showMobileNav&&<div className="sidebar-backdrop" onClick={()=>setShowMobileNav(false)}/>}
    <div className="app-content">
      <header className="topbar"><div className="topbar-left"><button className="menu-button" onClick={()=>setShowMobileNav(true)} aria-label="Open menu"><Menu size={21}/></button><span className="topbar-path">Sree Sudha CRM</span><ChevronRight size={14}/><strong>{headerLabel}</strong></div><div className="topbar-right"><span className="secure-label"><i/> Secure session</span><div className="user-chip"><span>{(userEmail||'A').slice(0,1).toUpperCase()}</span><div><strong>Management</strong><small>{userEmail||'Secure account'}</small></div></div><button className="icon-button logout-button" title="Sign out" aria-label="Sign out" onClick={()=>void logout().then(()=>window.location.assign('/login')).catch(err=>setError(err.message))}><LogOut size={18}/></button></div></header>
      <main className="main-area">
        {error&&<div className="message error global-error" role="alert"><CircleAlert size={19}/><div><strong>Unable to load or update agent records</strong><p>{error}</p><small>Check your Supabase connection, the Agent Network migration, and access permissions.</small></div><button className="icon-button" aria-label="Dismiss error" onClick={()=>setError('')}><X size={17}/></button></div>}
        <div className="page-heading"><div><p className="eyebrow">SREE SUDHA · MANAGEMENT</p><h1>{view==='overview'?'Business dashboard':view==='agents'?'Agent directory':view==='customers'?'Customers':view==='visits'?'Site visits':view==='requests'?'Agent registrations':'Referral network'}</h1><p className="heading-desc">{view==='overview'?'Agents, customers, MIRAI sales and employee activity at a glance.':view==='agents'?'Every agent, their details, and who introduced them.':view==='customers'?'Add, edit and archive customers from one simple screen.':view==='visits'?'Record the clients each agent brought, with project, date and time.':view==='requests'?'Review registrations and assign permanent hierarchy Employee IDs.':'See exactly who works under whom, at every level.'}</p></div><div className="heading-actions"><button className="btn btn-outline secondary-action" title="Refresh agent data" onClick={()=>{setLoading(true);void refresh();}}><RefreshCw size={17}/> Refresh</button><button className="btn btn-primary" onClick={()=>openNew()}><Plus size={18}/> Register agent</button></div></div>
        {view==='overview'&&<section className="home-actions" aria-label="Quick actions">
          <div className="home-actions-head"><div><h2>Quick actions</h2><p>Common tasks</p></div><span className="home-actions-hint">Choose an action to get started</span></div>
          <div className="home-actions-grid">
            <button type="button" onClick={()=>openNew()}><span className="home-action-icon violet"><UserRoundPlus size={19}/></span><span><strong>Register agent</strong><small>New agent or referral</small></span><ArrowRight className="home-action-arrow" size={17}/></button>
            <button type="button" onClick={()=>changeView('customers')}><span className="home-action-icon mint"><Users size={19}/></span><span><strong>Customers</strong><small>Add or update records</small></span><ArrowRight className="home-action-arrow" size={17}/></button>
            <button type="button" onClick={()=>recordVisit()} disabled={customersError||visitsError}><span className="home-action-icon sand"><MapPinned size={19}/></span><span><strong>Record site visit</strong><small>Agent, clients and date</small></span><ArrowRight className="home-action-arrow" size={17}/></button>
            <Link to="/mirai-sales?tab=bookings"><span className="home-action-icon lilac"><Building2 size={19}/></span><span><strong>Plot booking</strong><small>MIRAI inventory & sales</small></span><ArrowRight className="home-action-arrow" size={17}/></Link>
          </div>
        </section>}
        {view==='requests'&&<RegistrationRequests agents={agents} onApproved={refresh}/>}
        {(customersError||visitsError)&&<details className="home-setup-alert"><summary><CircleAlert size={17}/><strong>Setup required</strong><span>{[customersError&&'Customers',visitsError&&'Site visits'].filter(Boolean).join(' and ')} {customersError&&visitsError?'are':'is'} not connected to the database.</span><ChevronRight size={16}/></summary><div>{customersError&&<p>Customers: run <code>supabase/agent_customers_migration.sql</code> in the correct Supabase project.</p>}{visitsError&&<p>Site visits: run <code>supabase/agent_site_visits_migration.sql</code> after the customer migration.</p>}<p>Back up your database before applying any migration.</p></div></details>}
        {loading?<div className="center-loader"><LoaderCircle className="spin" size={24}/> Loading secure agent records…</div>:<>
          {view==='overview'&&<>
            <section className="home-kpis" aria-label="Business summary">
              <div className="home-kpi"><div className="home-kpi-top"><span>Registered agents</span><Users size={19}/></div><strong>{agents.length}</strong><small>{active} active</small></div>
              <div className="home-kpi"><div className="home-kpi-top"><span>Customers</span><UserRound size={19}/></div><strong>{customersError?'—':customers.length}</strong><small>In agent records</small></div>
              <div className="home-kpi"><div className="home-kpi-top"><span>Site visits</span><MapPinned size={19}/></div><strong>{visitsError?'—':visits.length}</strong><small>{visitsError?'Requires setup':`${allClientsTaken} customer attendances`}</small></div>
              <div className="home-kpi"><div className="home-kpi-top"><span>MIRAI bookings</span><Building2 size={19}/></div><strong>{businessSummary.bookings??'—'}</strong><small>{businessSummary.plots===null?'Sales setup required':`${businessSummary.plots} active inventory plots`}</small></div>
            </section>
            <div className="home-content-grid">
              <section className="panel home-recent"><div className="panel-head"><div><h2>Recently registered agents</h2><p>Latest agent records</p></div><button className="text-link" onClick={()=>changeView('agents')}>All agents <ArrowRight size={16}/></button></div>
                {recent.length?<div className="home-recent-list">{recent.map(a=><div className="home-recent-row" key={a.id}><AgentAvatar name={a.full_name} src={photos[a.photo_path]} size="sm"/><div className="home-recent-person"><strong>{a.full_name}</strong><small>{agentCode(a)} · {fmtDate(a.created_at)}</small></div><Status value={a.status}/><button className="home-compact-action" onClick={()=>setSelected(a)}><Eye size={15}/> View</button></div>)}</div>:<Empty icon={Users} title="No agents yet" body="Register your first agent to get started." action={<button className="btn btn-primary" onClick={()=>openNew()}><Plus size={16}/> Register agent</button>}/>}
              </section>
              <div className="home-right-panels">
                <section className="panel home-summary"><div className="panel-head"><div><h2>Today’s team activity</h2><p>Attendance and work records</p></div><CalendarDays size={19}/></div>
                  <div className="home-today-row"><span><UserRoundCheck size={18}/> Attendance records</span><strong>{businessSummary.staff??'—'}</strong></div>
                  <div className="home-today-row"><span><ClipboardCheck size={18}/> Daily work entries</span><strong>{businessSummary.dailyWork??'—'}</strong></div>
                  <Link className="home-panel-link" to="/management">Open attendance <ArrowRight size={16}/></Link>
                </section>
                <section className="panel home-summary"><div className="panel-head"><div><h2>Referral network</h2><p>Agent relationships</p></div><GitBranch size={19}/></div>
                  <div className="home-today-row"><span>Direct agents</span><strong>{agents.length-invited}</strong></div>
                  <div className="home-today-row"><span>Referred agents</span><strong>{invited}</strong></div>
                  <button className="home-panel-link" onClick={()=>changeView('network')}>View hierarchy <ArrowRight size={16}/></button>
                </section>
              </div>
            </div>
          </>}
          {view==='agents'&&<section className="panel directory-panel"><div className="directory-header"><div><h2>All registered agents <span className="count-pill">{directory.length}</span></h2><p>Use the View, Edit, or Delete buttons beside each agent. Delete deactivates; records are preserved.</p></div><button className="btn btn-outline" onClick={exportExcel} disabled={!agents.length}><Download size={17}/> Export Excel</button></div><div className="directory-controls"><label className="search-box"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, Employee ID or mobile"/><span className="search-key">SEARCH</span></label><div className="filter-wrap"><ListFilter size={17}/><select value={filter} onChange={e=>setFilter(e.target.value as Filter)} aria-label="Filter agents"><option value="all">All agents</option><option value="main">Direct agents</option><option value="referred">Referred agents</option><option value="active">Active only</option><option value="inactive">Inactive only</option></select><SlidersHorizontal size={15}/></div></div><Records list={directory}/><div className="directory-footer"><span>Showing {directory.length} of {agents.length} agents</span><span><CheckCircle2 size={15}/> Agent identifiers are never reused</span></div></section>}
          {view==='customers'&&<CustomerDirectory customers={customers} agents={agents} available={!customersError} refresh={refreshCustomers} onViewAgent={setSelected}/>}
          {view==='visits'&&<section className="panel visit-directory-panel">
            <div className="directory-header"><div><h2>Site visit register <span className="count-pill">{visits.length}</span></h2><p>Customers taken to site, by agent and visit date.</p></div><div className="heading-actions"><button className="btn btn-outline" disabled={!visits.length} onClick={exportVisits}><Download size={17}/> Export Excel</button><button className="btn btn-primary" disabled={visitsError||customersError} onClick={()=>recordVisit()}><Plus size={17}/> Record site visit</button></div></div>
            <div className="visit-register-metrics"><span><MapPinned size={17}/> {visits.length} visits recorded</span><span><Users size={17}/> {allClientsTaken} client visit entries</span></div>
            {!visits.length?<Empty icon={MapPinned} title="No site visits recorded" body="Choose an agent and their customers to record the first site visit." action={<button className="btn btn-primary" disabled={visitsError||customersError} onClick={()=>recordVisit()}><Plus size={16}/> Record first visit</button>}/>:<div className="table-scroll"><table className="agents-table visits-table"><thead><tr><th>VISIT DATE & TIME</th><th>ACTIONS</th><th>AGENT</th><th>PROJECT / SITE</th><th>CLIENTS TAKEN</th><th>CUSTOMER NAMES</th></tr></thead><tbody>{visits.map(v=><tr key={v.id}><td><strong>{fmtDate(v.visited_at)}</strong><small className="visit-time"><Clock3 size={13}/>{new Date(v.visited_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})}</small></td><td className="action-cell"><div className="visible-row-actions"><button className="table-action edit" onClick={()=>editVisit(v)}><Pencil size={15}/> Edit</button><button className="table-action delete" disabled={busy} onClick={()=>void cancelVisit(v)}><Trash2 size={15}/> Delete</button></div></td><td><button className="referrer-link" onClick={()=>{const a=byId.get(v.agent_id);if(a)setSelected(a);}}>{byId.get(v.agent_id)?.full_name??'Agent unavailable'}<small>{byId.has(v.agent_id)?agentCode(byId.get(v.agent_id)!):''}</small></button></td><td>{v.project_name}</td><td><span className="visit-number">{v.agent_site_visit_customers.length}</span></td><td className="visit-names" title={visitCustomerNames(v)}>{visitCustomerNames(v)}</td></tr>)}</tbody></table></div>}
          </section>}
          {view==='network'&&<><div className="network-toolbar panel"><div className="network-toolbar-info"><span className="network-toolbar-icon"><GitBranch size={21}/></span><div><h2>Agent referral hierarchy</h2><p>{roots.length} top-level agents · {invited} referrals · {agents.length} total records</p></div></div><label className="search-box network-search"><Search size={17}/><input value={networkQuery} onChange={e=>setNetworkQuery(e.target.value)} placeholder="Search name or Employee ID"/></label></div><AgentTree agents={agents} photos={photos} query={networkQuery} onSelect={setSelected}/><div className="network-help"><ArrowDownLeft size={16}/> Click any agent to view their details and referral relationships.</div></>}
        </>}
      </main>
    </div>
    {form&&<AgentForm key={`${form.editing?.id??'new'}_${form.parentId??'root'}`} agents={agents} photos={photos} editing={form.editing} presetParentId={form.parentId} onClose={()=>setForm(null)} onSaved={onSaved}/>}
    {selected&&<div className="modal-layer profile-layer" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
      <section className="profile-drawer profile-popup" role="dialog" aria-modal="true" aria-label={`Agent profile: ${selected.full_name}`}>
        <div className="profile-topbar"><span>AGENT PROFILE · {agentCode(selected)}</span><div className="profile-head-actions"><button className="table-action edit" onClick={()=>{setForm({editing:selected});setSelected(null);}}><Pencil size={16}/> Edit</button><button className={`table-action ${selected.status==='Active'?'delete':'restore'}`} disabled={busy} onClick={()=>void toggleStatus(selected)}>{selected.status==='Active'?<Trash2 size={16}/>:<RotateCcw size={16}/>} {selected.status==='Active'?'Delete':'Restore'}</button><button className="icon-button" aria-label="Close profile" onClick={()=>setSelected(null)}><X size={20}/></button></div></div>
        <div className="profile-body profile-popup-body"><div className="profile-left">
          <div className="profile-identity"><AgentAvatar name={selected.full_name} src={photos[selected.photo_path]} size="lg"/><div><h2>{selected.full_name}</h2><span className="profile-id">{agentCode(selected)} <button type="button" title="Copy ID" aria-label="Copy agent ID" onClick={()=>{void navigator.clipboard.writeText(agentCode(selected)).then(()=>setToast('Agent ID copied.')).catch(()=>setToast('Clipboard unavailable.'));}}><Copy size={13}/></button></span></div></div>
          <Status value={selected.status}/>
          <div className="profile-stats"><div><strong>{selectedDirect.length}</strong><span>Direct referrals</span></div><div><strong>{selectedTotal}</strong><span>Total downline</span></div><div><strong>{countCustomers(selected.id)}</strong><span>Customers</span></div><div><strong>{countVisits(selected.id)}</strong><span>Site visits</span></div></div>
          <div className="profile-section"><h3>Contact details</h3><div className="detail-line"><Phone size={18}/><div><small>Mobile number</small><a href={`tel:+91${selected.phone}`}>+91 {selected.phone}</a></div></div><div className="detail-line"><MapPin size={18}/><div><small>Address</small><p>{selected.address}</p></div></div><div className="detail-line"><CalendarDays size={18}/><div><small>Registration date</small><p>{fmtDate(selected.created_at)}</p></div></div></div>
          <div className="profile-bottom-actions"><button className="btn btn-outline" onClick={()=>{setForm({editing:selected});setSelected(null);}}>Edit agent</button><button className="btn btn-primary" onClick={()=>openNew(selected.id)}><Plus size={17}/> Add referral</button><Link className="btn btn-outline" to="/employees"><Fingerprint size={16}/> Approve device</Link></div><button className="status-switch" disabled={busy} onClick={()=>void toggleStatus(selected)}><Activity size={17}/> {selected.status==='Active'?'Mark agent inactive':'Reactivate agent'} <ArrowLeft size={15}/></button>
        </div><div className="profile-right">
          <AgentCustomers key={selected.id} agentId={selected.id} agentName={selected.full_name} customers={customersByAgent.get(selected.id)??[]} onAdded={refreshCustomers} available={!customersError}/>
          <div className="profile-section"><div className="visit-profile-title"><h3>Site visits <span className="customer-count">{countVisits(selected.id)}</span></h3><button className="btn btn-soft" disabled={visitsError||customersError||selected.status!=='Active'} onClick={()=>recordVisit(selected.id)}><Plus size={15}/> Add visit</button></div>
            {(visitsByAgent.get(selected.id)??[]).length===0?<div className="customer-empty"><MapPinned size={18}/> No site visits recorded yet.</div>:<div className="profile-visit-list">{(visitsByAgent.get(selected.id)??[]).slice(0,8).map(v=><div key={v.id} className="profile-visit-item"><span className="profile-visit-icon"><MapPinned size={17}/></span><div><strong>{v.project_name}</strong><small>{fmtDate(v.visited_at)} · {new Date(v.visited_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})}</small><p>{visitCustomerNames(v)}</p></div><span className="visit-number">{v.agent_site_visit_customers.length}</span></div>)}</div>}
            {countVisits(selected.id)>8&&<button className="text-link visit-all" onClick={()=>changeView('visits')}>View complete site visit register <ArrowRight size={15}/></button>}
          </div>
          <div className="profile-section"><h3>Referral details</h3><div className="introduced-by"><span>{selectedParent?'INTRODUCED BY':'REGISTRATION TYPE'}</span>{selectedParent?<button className="introduced-person" onClick={()=>setSelected(selectedParent)}><AgentAvatar name={selectedParent.full_name} src={photos[selectedParent.photo_path]} size="sm"/><strong>{selectedParent.full_name}</strong><small>{agentCode(selectedParent)}</small><ChevronRight size={16}/></button>:<div className="introduced-person"><span className="main-agent-icon"><UserRound size={18}/></span><strong>{selected.referrer_staff_user_id?`Referred by office employee ${agentCode(selected).slice(0,-2)}`:'Direct agent'}</strong></div>}</div>
            <div className="referrals-heading"><h4>Direct referrals</h4><span>{selectedDirect.length}</span></div>{selectedDirect.length===0?<p className="no-referrals">No agents have been registered under this agent yet.</p>:<div className="referral-list">{selectedDirect.map(a=><button key={a.id} onClick={()=>setSelected(a)}><AgentAvatar name={a.full_name} src={photos[a.photo_path]} size="sm"/><span><strong>{a.full_name}</strong><small>{agentCode(a)}</small></span><ChevronRight size={16}/></button>)}</div>}
          </div>
        </div></div>
      </section></div>}
    {visitFormAgentId!==null&&<SiteVisitForm key={visitEditing?.id??visitFormAgentId??'new'} editingVisit={visitEditing??undefined} agents={agents} customers={customers} initialAgentId={visitFormAgentId||undefined} onClose={()=>{setVisitFormAgentId(null);setVisitEditing(null);}} onAdded={refreshVisits}/>}
    {toast&&<div className="toast" role="status"><Check size={18}/><span>{toast}</span><button onClick={()=>setToast('')} aria-label="Dismiss notification"><X size={16}/></button></div>}
  </div>;
}
