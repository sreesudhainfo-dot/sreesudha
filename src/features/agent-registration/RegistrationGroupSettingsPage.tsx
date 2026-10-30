import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MessageCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const valid = (url: string) => !url || /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]+$/.test(url);

export default function RegistrationGroupSettingsPage() {
  const [url,setUrl] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [done,setDone] = useState('');
  useEffect(()=>{
    let active=true;
    void supabase.rpc('manage_registration_group_invite',{p_save:false}).then(({data,error})=>{
      if(!active)return;
      if(error)setError(error.message);
      else setUrl(typeof data === 'string' ? data : '');
    });
    return ()=>{active=false};
  },[]);
  async function submit(e:FormEvent) {
    e.preventDefault();setDone('');setError('');
    const next=url.trim();
    if(!valid(next)){setError('Use the official WhatsApp group invite, starting with https://chat.whatsapp.com/');return;}
    setBusy(true);
    try {
      const {data,error}=await supabase.rpc('manage_registration_group_invite',{p_url:next,p_save:true});
      if(error)throw error;
      setUrl(typeof data==='string'?data:'');
      setDone(next?'WhatsApp group invitation saved. New applicants can join after submitting registration.':'WhatsApp invitation cleared; no join link will be shown.');
    }catch(err){setError(err instanceof Error?err.message:'Could not save group invitation.');}
    finally{setBusy(false);}
  }
  return <div className="ops-page">
    <header className="ops-top"><Link to="/agents" className="ops-brand"><img src="/sree-sudha-mark.png" alt="Sree Sudha"/><span><strong>SREE SUDHA</strong><small>MANAGEMENT SETTINGS</small></span></Link><Link to="/agents" className="ops-link"><ArrowLeft size={16}/> Dashboard</Link></header>
    <main className="ops-container" style={{maxWidth:890}}>
      <div className="ops-heading"><div><span className="ops-kicker">MANAGEMENT ACCESS</span><h1>Registration WhatsApp group</h1><p>Manage the invitation shown after an agent registration is saved successfully.</p></div><ShieldCheck size={24}/></div>
      {error&&<div className="ops-alert" role="alert">{error}</div>}
      {done&&<div className="ops-notice" role="status"><CheckCircle2 size={18}/>{done}</div>}
      <section className="ops-panel"><div className="ops-panel-head"><div><h2><MessageCircle size={18} style={{display:'inline-block',verticalAlign:'middle'}}/> Group invitation link</h2><p>Leave blank for now. You can add or replace the official link here later.</p></div></div>
        <form className="ops-form" onSubmit={submit}>
          <label>Official WhatsApp group invitation<input type="url" value={url} onChange={e=>setUrl(e.target.value)} maxLength={350} placeholder="https://chat.whatsapp.com/…"/></label>
          <p className="ops-help">Only an agent who completed registration receives the invitation on the success page. Registration remains pending company review.</p>
          <div className="ops-modal-footer"><Link className="ops-outline" to="/agents">Back to CRM</Link><button className="ops-primary" type="submit" disabled={busy}>{busy?'Saving…':'Save invitation'}</button></div>
        </form>
      </section>
    </main>
  </div>;
}
