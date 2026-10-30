import { supabase } from '../../../lib/supabase';
import type { Agent, AgentInput, AgentStatus } from '../types/agent';

const BUCKET='agent-photos';
export async function fetchAgents():Promise<Agent[]>{
  // Supabase/PostgREST may cap rows in a single response. Fetch all pages.
  const all:Agent[]=[];const size=750;
  for(let from=0;from<50000;from+=size){
    const {data,error}=await supabase.from('agent_network').select('*').order('agent_no',{ascending:true}).range(from,from+size-1);
    if(error)throw error;
    const page=(data??[]) as Agent[];all.push(...page);
    if(page.length<size)return all;
  }
  throw new Error('Agent directory exceeded the supported 50,000 records. Contact your administrator.');
}
export async function fetchPhotoLinks(agents:Agent[]):Promise<Record<string,string>>{
  const paths=[...new Set(agents.map(a=>a.photo_path).filter(Boolean))];
  const links:Record<string,string>={};
  // Signed URLs are temporary; refresh the page to renew them if needed.
  for(let i=0;i<paths.length;i+=50){
    const chunk=paths.slice(i,i+50);
    const resolved=await Promise.all(chunk.map(async path=>{
      const {data}=await supabase.storage.from(BUCKET).createSignedUrl(path,3600);
      return [path,data?.signedUrl??''] as const;
    }));
    Object.assign(links,Object.fromEntries(resolved));
  }
  return links;
}
export async function uploadPhoto(file:File):Promise<string>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Use a JPG, PNG, or WebP photo.');
  if(file.size>5*1024*1024)throw new Error('Photo must be smaller than 5 MB.');
  const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
  const path=`${crypto.randomUUID()}.${ext}`;
  const {error}=await supabase.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false});
  if(error)throw error;return path;
}
export async function addAgent(input:AgentInput,file:File):Promise<Agent>{
  const path=await uploadPhoto(file);
  const {data,error}=await supabase.from('agent_network').insert({...input,photo_path:path}).select('*').single();
  if(error){await supabase.storage.from(BUCKET).remove([path]);throw error;}
  return data as Agent;
}
export async function updateAgent(agent:Agent,input:AgentInput,photo?:File|null):Promise<Agent>{
  const path=photo?await uploadPhoto(photo):agent.photo_path;
  const {data,error}=await supabase.from('agent_network').update({...input,photo_path:path}).eq('id',agent.id).select('*').single();
  if(error){if(photo)await supabase.storage.from(BUCKET).remove([path]);throw error;}
  if(photo&&agent.photo_path!==path)await supabase.storage.from(BUCKET).remove([agent.photo_path]);
  return data as Agent;
}
export async function setAgentStatus(id:string,status:AgentStatus){const {error}=await supabase.from('agent_network').update({status}).eq('id',id);if(error)throw error;}
