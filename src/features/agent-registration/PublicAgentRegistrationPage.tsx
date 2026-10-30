import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Camera, CheckCircle2, ClipboardCheck, LoaderCircle, MapPin, ShieldCheck, UserRoundPlus, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export default function PublicAgentRegistrationPage() {
  const [params] = useSearchParams();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [referrer, setReferrer] = useState((params.get('ref') ?? '').trim().toUpperCase().slice(0, 80));
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [groupUrl, setGroupUrl] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function onPhoto(file:File | null) {
    setError('');
    if (file && (!ACCEPTED.includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setError('Use a JPG, PNG or WebP image smaller than 5 MB.'); return;
    }
    setPhoto(file); setPreview(file ? URL.createObjectURL(file) : '');
  }

  async function onSubmit(event:FormEvent) {
    event.preventDefault(); setError('');
    const mobile=phone.replace(/\D/g, '');
    if(fullName.trim().length<2 || fullName.trim().length>120) return setError('Enter your full name.');
    if(!/^\d{10}$/.test(mobile)) return setError('Enter your 10-digit mobile number.');
    if(address.trim().length<5) return setError('Enter your complete address.');
    if(!photo) return setError('Please add your photo before continuing.');
    if(referrer.trim() && !/^(EMP\d{4}(?:\d{2})*|EMP\d{5}|AG\d+)$/i.test(referrer.trim())) return setError('Enter a valid Employee ID, e.g. EMP1520 or EMP152001.');
    setBusy(true);
    let path='';
    try {
      const ext=photo.type==='image/png'?'png':photo.type==='image/webp'?'webp':'jpg';
      path=`intake/${crypto.randomUUID()}.${ext}`;
      const {error:photoError}=await supabase.storage.from('agent-photos').upload(path,photo,{upsert:false,contentType:photo.type});
      if(photoError) throw photoError;
      const {data:registrationId,error:submitError}=await supabase.rpc('submit_agent_registration',{
        p_full_name:fullName.trim(),p_phone:mobile,p_address:address.trim(),p_photo_path:path,
        p_referral_code:referrer.trim().toUpperCase()||null
      });
      if(submitError) throw submitError;
      // Group invite is only requested after confirmed database submission.
      setSubmitted(true);
      if (typeof registrationId === 'string') {
        try {
          const {data:invite,error:inviteError}=await supabase.rpc('read_registration_group_invite',{p_registration_id:registrationId});
          if(!inviteError && typeof invite==='string' && /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]+$/.test(invite)) setGroupUrl(invite);
        } catch (inviteError) { console.error('Invitation retrieval unavailable:',inviteError); }
      }
    }catch(err){
      setError(err instanceof Error?err.message:'Registration could not be submitted. Please try again.');
      // Unclaimed intake uploads cannot be publicly deleted; Admin periodically clears orphans.
    }finally{setBusy(false);}
  }

  return <div className="public-agent-page">
    <div className="public-agent-glow" aria-hidden="true"/>
    <header className="public-agent-header"><Link to="/agent-register" aria-label="Sree Sudha registration home"><img src="/sree-sudha-mark.png" alt="Sree Sudha"/></Link><span>SREE SUDHA <small>PROMOTERS & DEVELOPERS</small></span></header>
    <main className="public-agent-card">
      {submitted ? <div className="public-agent-success">
        <span className="public-agent-success-icon"><CheckCircle2 size={40}/></span>
        <p className="public-agent-eyebrow">REGISTRATION SUBMITTED</p>
        <h1>Your details have been received</h1>
        <p>Our team will verify your registration. After management approval, your unique Employee ID will be assigned. Contact the office to receive your approved Employee ID.</p>
        <div className="public-agent-success-info"><ShieldCheck size={18}/> Your application is pending approval. Attendance becomes available after your registration is approved.</div>
        {groupUrl ? <a href={groupUrl} target="_blank" rel="noopener noreferrer" className="public-agent-submit" style={{display:'flex',alignItems:'center',justifyContent:'center',textDecoration:'none'}}>Join the Sree Sudha WhatsApp group <ArrowRight size={18}/></a> : <p className="public-agent-tip">The company's WhatsApp group invitation will be available once management adds its link.</p>}
        <button className="public-agent-secondary" type="button" onClick={()=>window.location.reload()}>Register another agent</button>
      </div> : <>
        <div className="public-agent-heading"><span className="public-agent-eyebrow"><UserRoundPlus size={16}/> JOIN THE SREE SUDHA NETWORK</span><h1>Agent Registration</h1><p>Just a few details. You can register using your phone in about two minutes.</p></div>
        <form className="public-agent-form" onSubmit={onSubmit}>
          <div className="public-agent-photo"><div className="public-agent-avatar">{preview?<img src={preview} alt="Your selected photo"/>:<Camera size={31}/>}</div><div><strong>Your photo <b>*</b></strong><p>A clear face photo, up to 5 MB</p><button type="button" className="public-agent-secondary" onClick={()=>inputRef.current?.click()}>{photo?'Change photo':'Choose / Take photo'}</button></div><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="user" hidden onChange={e=>onPhoto(e.currentTarget.files?.[0]??null)}/>{photo&&<button type="button" className="public-agent-clear" title="Remove photo" aria-label="Remove photo" onClick={()=>onPhoto(null)}><X size={17}/></button>}</div>
          <label>Full name <b>*</b><input required autoComplete="name" maxLength={120} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your full name"/></label>
          <label>Mobile number <b>*</b><div className="public-agent-phone"><span>+91</span><input required type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,''))} placeholder="10-digit number"/></div></label>
          <label>Full address <b>*</b><textarea required maxLength={1000} rows={3} value={address} onChange={e=>setAddress(e.target.value)} placeholder="House / Street, Village / City, District"/></label>
          <label>Referred by (optional)<input autoCapitalize="characters" autoComplete="off" maxLength={80} value={referrer} onChange={e=>setReferrer(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} placeholder="Referring agent ID, e.g. EMP1520 or EMP152001"/></label>
          <p className="public-agent-tip"><MapPin size={16}/> If another agent invited you, enter their Employee ID. Otherwise, leave it blank.</p>
          {error&&<div className="public-agent-error" role="alert">{error}</div>}
          <button className="public-agent-submit" disabled={busy} type="submit">{busy?<LoaderCircle size={19} className="spin"/>:<ClipboardCheck size={19}/>} {busy?'Submitting registration…':'Submit Registration'} <ArrowRight size={18}/></button>
          <p className="public-agent-legal"><ShieldCheck size={14}/> Your information is sent to Sree Sudha for registration review. Only authorized management can view it.</p>
        </form>
      </>}
    </main>
    <footer className="public-agent-footer">Sree Sudha Promoters & Developers · <Link to="/login">Management login</Link></footer>
  </div>;
}
