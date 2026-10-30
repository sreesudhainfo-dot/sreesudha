import { supabase } from '../../lib/supabase';

export interface AttendanceRecord {
  id:string;user_id:string;work_date:string;check_in_at:string;check_out_at:string|null;
  check_in_accuracy_m:number;check_out_accuracy_m:number|null;
}
export interface Office { office_id:number;office_name:string;latitude:number|null;longitude:number|null;radius_m:number }
export function indiaDate(now:Date=new Date()){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const vals=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${vals.year}-${vals.month}-${vals.day}`;
}
export function niceTime(date:string|null|undefined){return date?new Date(date).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:true}):'—';}
export function niceDate(date:string){return new Date(`${date}T12:00:00+05:30`).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kolkata'});}
export function employeeCode(staffNo:number){return `EMP${String(staffNo).padStart(4,'0')}`;}
export function distanceM(aLat:number,aLon:number,bLat:number,bLon:number){
  const radians=(n:number)=>n*Math.PI/180;
  const da=radians(bLat-aLat),db=radians(bLon-aLon);
  const h=Math.sin(da/2)**2+Math.cos(radians(aLat))*Math.cos(radians(bLat))*Math.sin(db/2)**2;
  return 2*6371000*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function locate():Promise<GeolocationPosition>{
  if(!navigator.geolocation)return Promise.reject(new Error('Location is not supported on this device. Use HTTPS or localhost and enable location access.'));
  return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,(e)=>{
    reject(new Error(e.code===1?'Location permission was denied. Allow location access in your browser.':e.code===3?'Location request timed out. Move where GPS signal is stronger and retry.':'Unable to determine location. Enable device GPS and try again.'));
  },{enableHighAccuracy:true,timeout:20000,maximumAge:0}));
}
export async function officeInfo():Promise<Office>{
  const {data,error}=await supabase.from('office_settings').select('office_id,office_name,latitude,longitude,radius_m').eq('office_id',1).single();
  if(error)throw error;return data as Office;
}
export async function recordAction(action:'check_in'|'check_out',position:GeolocationPosition):Promise<AttendanceRecord>{
  const {data,error}=await supabase.rpc('attendance_action',{
    p_action:action,p_lat:position.coords.latitude,p_lon:position.coords.longitude,p_accuracy_m:position.coords.accuracy
  });
  if(error)throw error;return data as AttendanceRecord;
}
