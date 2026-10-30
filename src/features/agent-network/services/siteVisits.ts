import { supabase } from '../../../lib/supabase';

export interface AgentSiteVisit {
  id: string;
  agent_id: string;
  visited_at: string;
  project_name: string;
  notes: string;
  created_at: string;
  agent_site_visit_customers: { customer_id: string }[];
}

export async function fetchSiteVisits(): Promise<AgentSiteVisit[]> {
  const all: AgentSiteVisit[] = [];
  const size = 500;
  for (let offset = 0; offset < 50000; offset += size) {
    const { data, error } = await supabase.from('agent_site_visits')
      .select('id,agent_id,visited_at,project_name,notes,created_at,agent_site_visit_customers(customer_id)')
      .is('cancelled_at',null).order('visited_at', { ascending: false })
      .range(offset, offset + size - 1);
    if (error) throw error;
    const page = (data ?? []) as AgentSiteVisit[];
    all.push(...page);
    if (page.length < size) return all;
  }
  throw new Error('Site visit records exceeded the supported 50,000 rows.');
}

export async function addSiteVisit(input: {
  agentId: string;
  visitedAt: string;
  projectName: string;
  notes: string;
  customerIds: string[];
}): Promise<void> {
  const { error } = await supabase.rpc('add_agent_site_visit', {
    p_agent_id: input.agentId,
    p_visited_at: input.visitedAt,
    p_project_name: input.projectName,
    p_notes: input.notes,
    p_customer_ids: input.customerIds,
  });
  if (error) throw error;
}

export async function manageSiteVisit(visitId:string,action:'edit'|'cancel',data?:{date:string;project:string;notes:string;customerIds:string[]},reason?:string){
 const {error}=await supabase.rpc('manage_agent_site_visit',{p_visit_id:visitId,p_action:action,
  p_visited_at:data?.date??null,p_project_name:data?.project??null,p_notes:data?.notes??null,
  p_customer_ids:data?.customerIds??null,p_reason:reason??null});if(error)throw error;
}
