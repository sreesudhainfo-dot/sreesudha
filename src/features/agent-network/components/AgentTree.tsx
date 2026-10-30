import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Network } from 'lucide-react';
import type { Agent } from '../types/agent';
import { agentCode } from '../types/agent';
import AgentAvatar from './AgentAvatar';

type Props={agents:Agent[];photos:Record<string,string>;query:string;onSelect:(agent:Agent)=>void};
export default function AgentTree({agents,photos,query,onSelect}:Props){
  const [collapsed,setCollapsed]=useState<Set<string>>(()=>new Set());
  const byId=useMemo(()=>new Map(agents.map(a=>[a.id,a])),[agents]);
  const children=useMemo(()=>{const map=new Map<string,Agent[]>();agents.forEach(a=>{if(a.referrer_id)map.set(a.referrer_id,[...(map.get(a.referrer_id)??[]),a]);});return map;},[agents]);
  const term=query.toLowerCase().trim();
  const visible=useMemo(()=>{
    if(!term)return null;
    const ids=new Set<string>();
    agents.filter(a=>`${a.full_name} ${agentCode(a)} ${a.phone}`.toLowerCase().includes(term)).forEach(a=>{
      const seen=new Set<string>();let cursor:Agent|undefined=a;
      while(cursor&&!seen.has(cursor.id)){seen.add(cursor.id);ids.add(cursor.id);cursor=cursor.referrer_id?byId.get(cursor.referrer_id):undefined;}
    });
    return ids;
  },[term,agents,byId]);
  const roots=agents.filter(a=>!a.referrer_id||!byId.has(a.referrer_id));
  function Node({agent,ancestors}:{agent:Agent;ancestors:Set<string>}){
    if(ancestors.has(agent.id)||(visible&&!visible.has(agent.id)))return null;
    const direct=(children.get(agent.id)??[]).filter(a=>!visible||visible.has(a.id));
    const closed=!term&&collapsed.has(agent.id);
    const active=term&&`${agent.full_name} ${agentCode(agent)} ${agent.phone}`.toLowerCase().includes(term);
    const nextAncestors=new Set([...ancestors,agent.id]);
    return <div className="tree-node"><button type="button" className={`tree-card ${active?'tree-match':''}`} onClick={()=>onSelect(agent)}><div className="tree-card-top"><AgentAvatar name={agent.full_name} src={photos[agent.photo_path]} size="md"/><span className="tree-tag">{agent.referrer_staff_user_id?'STAFF REFERRED':agent.referrer_id?'REFERRED':'DIRECT'}</span></div><strong title={agent.full_name}>{agent.full_name}</strong><span className="tree-code">{agentCode(agent)}</span><div className="tree-card-footer"><span className={`tree-status ${agent.status==='Active'?'ok':''}`}><i/>{agent.status}</span><span>{(children.get(agent.id)??[]).length} direct</span></div></button>
      {direct.length>0&&<><button className="tree-collapse" aria-label={`${closed?'Expand':'Collapse'} ${agent.full_name} referrals`} onClick={()=>setCollapsed(prev=>{const n=new Set(prev);if(n.has(agent.id))n.delete(agent.id);else n.add(agent.id);return n;})}>{closed?<ChevronRight size={17}/>:<ChevronDown size={17}/>}</button>{!closed&&<div className="tree-children">{direct.map(child=><div key={child.id} className="tree-branch"><Node agent={child} ancestors={nextAncestors}/></div>)}</div>}</>}
    </div>;
  }
  if(!agents.length)return <div className="tree-surface"><div className="empty-state"><span className="empty-icon"><Network size={27}/></span><h3>No network yet</h3><p>Register agents and choose who introduced them to build this referral map.</p></div></div>;
  if(visible&&visible.size===0)return <div className="tree-surface"><div className="empty-state"><span className="empty-icon"><Network size={27}/></span><h3>No matching agents</h3><p>Search using an agent’s name, Employee ID, or mobile number.</p></div></div>;
  return <div className="tree-surface"><div className="tree-scroll" role="region" aria-label="Scrollable referral hierarchy" tabIndex={0}><div className="tree-forest">{roots.map(root=>root.referrer_staff_user_id ? <div className="tree-node" key={root.id}><div className="tree-card" style={{paddingBottom:14,background:'#f6f8fb'}}><strong>Referring Office Employee</strong><span className="tree-code">{agentCode(root).slice(0,-2)}</span></div><div className="tree-children"><div className="tree-branch"><Node agent={root} ancestors={new Set()}/></div></div></div> : <Node key={root.id} agent={root} ancestors={new Set()}/>)}</div></div><div className="tree-surface-footer"><Network size={15}/> {roots.length} independent network{roots.length===1?'':'s'} · Agent referral relationships are maintained permanently</div></div>;
}
