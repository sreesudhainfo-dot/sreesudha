import { Component, lazy, StrictMode, Suspense } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const App=lazy(()=>import('./App'));
const url=import.meta.env.VITE_SUPABASE_URL?.trim()??'';
const key=import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()??'';
const validURL=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)&&!url.toLowerCase().includes('your-');
const validKey=Boolean(key)&&!key.toLowerCase().includes('your_');
function Frame({children}:{children:ReactNode}){return <div className="startup-screen"><main className="startup-panel">{children}</main></div>;}
function MissingConfig(){return <Frame><div className="eyebrow">SREE SUDHA · STAFF MANAGEMENT</div><h1>Supabase connection required</h1><p>Create an <strong>.env</strong> file beside <strong>package.json</strong> and use the credentials from your existing Supabase project.</p><pre>{`VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co\nVITE_SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-KEY`}</pre><p>After saving, restart <strong>npm run dev</strong>.</p><p className="config-error">{!validURL?'Project URL is missing or invalid. ':''}{!validKey?'Public anon / publishable key is missing.':''}</p><small>Never place a Supabase service_role or secret key in the browser configuration.</small></Frame>;}
class Boundary extends Component<{children:ReactNode},{error:Error|null}>{state:{error:Error|null}={error:null};static getDerivedStateFromError(error:Error){return {error};}componentDidCatch(error:Error,info:ErrorInfo){console.error('Staff Management startup error:',error,info.componentStack);}render(){if(!this.state.error)return this.props.children;return <Frame><h1>Staff Management could not start</h1><p>Open Chrome DevTools → Console (F12) to inspect the error.</p>{import.meta.env.DEV&&<pre>{this.state.error.message}</pre>}<button className="btn btn-primary" onClick={()=>window.location.reload()}>Reload app</button></Frame>;}}

createRoot(document.getElementById('root')!).render(validURL&&validKey?<StrictMode><Boundary><Suspense fallback={<Frame>Loading Sree Sudha…</Frame>}><App/></Suspense></Boundary></StrictMode>:<MissingConfig/>);
