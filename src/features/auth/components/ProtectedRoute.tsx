import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { Session } from '@supabase/supabase-js';

export default function ProtectedRoute() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setLoading(false); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => { if (active) { setSession(next); setLoading(false); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Checking secure login...</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
