import { supabase } from '../../../lib/supabase';

export interface AgentCustomer {
  id:string;
  agent_id:string;
  full_name:string;
  phone:string;
  notes:string;
  created_at:string;
  archived_at?:string|null;
}

export async function fetchCustomers():Promise<AgentCustomer[]>{
  const all:AgentCustomer[]=[];const size=750;
  for(let from=0;from<50000;from+=size){
    const {data,error}=await supabase.from('agent_customers')
      .select('id,agent_id,full_name,phone,notes,created_at,archived_at')
      .is('archived_at',null).order('created_at',{ascending:false}).range(from,from+size-1);
    if(error)throw error;
    const page=(data??[]) as AgentCustomer[];
    all.push(...page);
    if(page.length<size)return all;
  }
  throw new Error('Customer records exceeded 50,000. Contact the administrator.');
}

export async function addCustomer(input:{agent_id:string;full_name:string;phone:string;notes:string}):Promise<AgentCustomer>{
  const {data,error}=await supabase.from('agent_customers').insert(input)
    .select('id,agent_id,full_name,phone,notes,created_at,archived_at').single();
  if(error)throw error;
  return data as AgentCustomer;
}

export async function updateCustomer(id:string,changes:{full_name:string;phone:string;notes:string}){
 const {error}=await supabase.from('agent_customers').update(changes).eq('id',id);if(error)throw error;
}
export async function archiveCustomer(id:string){
 const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Sign in first');
 const {error}=await supabase.from('agent_customers').update({archived_at:new Date().toISOString(),archived_by:user.id}).eq('id',id);if(error)throw error;
}
