import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Fingerprint, LoaderCircle, ShieldCheck } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import { portalRequest } from './EmployeePortalLogin';
export default function DeviceActivationPage(){
 const [params]=useSearchParams();const id=(params.get('id')||'').toUpperCase(),ticket=params.get('ticket')||'';
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 async function enroll(){setBusy(true);setError('');try{
  if(!window.PublicKeyCredential)throw new Error('This device cannot create a passkey. Use modern Chrome, Safari or Edge over HTTPS.');
  const {options,challenge_id}=await portalRequest({action:'enroll-options',employee_code:id,ticket});
  const credential=await startRegistration({optionsJSON:options});
  await portalRequest({action:'enroll-verify',employee_code:id,ticket,challenge_id,credential});
  setDone(true);
 }catch(e){setError(e instanceof Error?e.message:'Unable to activate device');}finally{setBusy(false);}}
 return <div className="staff-login-page"><div className="staff-login-container portal-signin-card">
 <img className="company-logo staff-login-company-logo" src="/sree-sudha-mark.png" alt="Sree Sudha"/>
 <div className="staff-login-icon"><Fingerprint size={29}/></div>
 <p className="att-overline">EMPLOYEE DEVICE ACTIVATION</p><h1>{done?'Device approved':'Activate trusted device'}</h1>
 {done?<><p className="staff-login-lead">Your passkey is registered. You can now sign in using your Employee ID and the device's biometric/PIN confirmation.</p><div className="att-message success"><CheckCircle2 size={18}/> Approved for {id}</div><Link className="attendance-button portal-big-link" to={id.length===8?'/agent-login':'/staff-login'}>Go to sign in</Link></>:
 <><p className="staff-login-lead">Employee ID: <strong>{id||'Missing ID'}</strong>. Tap Activate on the phone or computer your Admin authorized. You may be asked to use your fingerprint, face or device PIN once to create a passkey.</p>
 {error&&<div className="att-message error" role="alert">{error}</div>}
 <button className="attendance-button portal-big-link" disabled={!id||!ticket||busy} onClick={()=>void enroll()}>{busy?<LoaderCircle size={18} className="spin"/>:<ShieldCheck size={18}/>} {busy?'Verifying device…':'Activate this device'}</button></>}
 <p className="portal-small-help">Each activation link expires after 60 minutes and can only be used once. Do not share it.</p>
 </div></div>;
}
