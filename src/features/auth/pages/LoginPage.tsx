import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { login } from '../services/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await login(email, password);
      setAuthenticated(true);
      navigate('/', { replace: true });
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not sign in.'); }
    finally { setBusy(false); }
  }
  if (authenticated) return <Navigate to="/" replace />;
  return <div className="login-page">
    <div className="login-visual">
      <Link className="login-brand clickable-mark" to="/" aria-label="Sree Sudha home"><img className="company-logo login-company-logo" src="/sree-sudha-mark.png" alt="Sree Sudha"/></Link>
      <div className="login-statement"><p className="eyebrow light">PRIVATE MANAGEMENT PORTAL</p><h1>Sree Sudha<br/><em>Management CRM.</em></h1><p>Agent records, MIRAI sales and staff operations in a secure company system.</p><div className="login-trust"><ShieldCheck size={18}/> Role-based access · Private records</div></div>
      <div className="login-decoration" aria-hidden="true"><span/><span/><span/></div>
    </div>
    <div className="login-form-pane"><div className="login-form-card"><div className="login-badge"><LockKeyhole size={20}/></div><p className="eyebrow">SREE SUDHA · MANAGEMENT</p><h2>Management sign in</h2><p className="muted">Access for authorized management accounts.</p><form onSubmit={signIn} className="login-form">
      <label>Email address<input type="email" required autoComplete="username" placeholder="name@company.com" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>Password<div className="password-input"><input type={visible ? 'text' : 'password'} required autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" onClick={()=>setVisible(v=>!v)} aria-label={visible ? 'Hide password':'Show password'}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
      {error && <div role="alert" className="message error">{error}</div>}
      <button className="btn btn-primary login-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin"/>:<ArrowRight size={18}/>} {busy ? 'Signing in…' : 'Sign in securely'}</button>
    </form><div className="login-note"><ShieldCheck size={15}/> Accounts are created by your Supabase administrator.</div><Link className="staff-admin-link" to="/portal-login">Employee / Agent login</Link></div><div className="login-bottom">© {new Date().getFullYear()} Sree Sudha Promoters & Developers</div></div>
  </div>;
}
