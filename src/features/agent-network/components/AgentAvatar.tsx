import { agentInitials } from '../types/agent';
type Props={name:string;src?:string;size?:'sm'|'md'|'lg'};
export default function AgentAvatar({name,src,size='md'}:Props){return <span className={`avatar avatar-${size}`} title={name}>{src?<img src={src} alt={`${name} agent photo`}/>:agentInitials(name)}</span>;}
