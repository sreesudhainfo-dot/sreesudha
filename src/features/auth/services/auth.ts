import { supabase } from '../../../lib/supabase';

/** Use server-validated Supabase Auth, not a browser-local hardcoded password. */
export async function login(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
