export type AgentStatus = 'Active' | 'Inactive';
export interface Agent {
  id: string;
  agent_no: number;
  employee_no?: number | null; // legacy agent number; do not delete
  hierarchy_employee_code?: string | null; // public permanent referral-based EMP ID
  referrer_staff_user_id?: string | null;
  referrer_staff_code?: string | null;
  team_code?: string | null;
  full_name: string;
  phone: string;
  address: string;
  photo_path: string;
  referrer_id: string | null;
  status: AgentStatus;
  created_at: string;
  updated_at: string;
}
export type AgentInput = Pick<Agent, 'full_name' | 'phone' | 'address' | 'referrer_id' | 'referrer_staff_user_id' | 'referrer_staff_code'>;
export function agentCode(value: Agent) { return value.hierarchy_employee_code || (value.employee_no != null ? `EMP${String(value.employee_no).padStart(5, '0')}` : `AG${String(value.agent_no).padStart(5, '0')}`); }
export function teamCode(value: Agent) { return value.team_code || 'Not assigned'; }
export function agentInitials(value: string) { return value.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase(); }
