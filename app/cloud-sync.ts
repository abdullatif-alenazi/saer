"use client";
import type {User} from "@supabase/supabase-js";
import {normalizeUnitProgress,readLocalSnapshot,replaceLocalSnapshot,type ExecutionRecord,type LocalSnapshot,type UnitProgress} from "./local-store";
import {supabase} from "./supabase";

export type SyncStatus="offline"|"ready"|"syncing"|"error";
type Listener=(user:User|null,status:SyncStatus)=>void;
let timer:number|undefined;
let retryTimer:number|undefined;
let retryDelay=2000;
let currentUser:User|null=null;
let listener:Listener|undefined;
let accountReady=false;
let syncPromise:Promise<void>|undefined;
let syncingUserId:string|undefined;
let syncAgain=false;
let realtimeChannel:ReturnType<NonNullable<typeof supabase>["channel"]>|undefined;
const report=(status:SyncStatus)=>listener?.(currentUser,status);
type Pending={base:LocalSnapshot;local:LocalSnapshot;revision:string};
const storage=(userId:string,kind:"base"|"pending")=>`sair.sync.${kind}.v2.${userId}`;
const emptySnapshot=():LocalSnapshot=>({version:1,plan:[],tasks:[],appointments:[],executionLog:[],unitProgress:[],preferences:{calendarMode:null,journeyFilter:null,weekStartsOn:null,calendarCategories:[]}});
const normalizeSnapshot=(value:unknown):LocalSnapshot=>{const data=(value&&typeof value==="object"?value:{}) as Partial<LocalSnapshot>;return{...emptySnapshot(),...data,plan:data.plan??[],tasks:data.tasks??[],appointments:data.appointments??[],executionLog:data.executionLog??[],unitProgress:normalizeUnitProgress(data.unitProgress),preferences:{...emptySnapshot().preferences,...data.preferences}}};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const readSaved=<T,>(key:string):T|undefined=>{try{const value=localStorage.getItem(key);return value?JSON.parse(value) as T:undefined}catch{return undefined}};
const writeBase=(id:string,value:LocalSnapshot)=>localStorage.setItem(storage(id,"base"),JSON.stringify(value));
const readBase=(id:string)=>readSaved<LocalSnapshot>(storage(id,"base"));
const readPending=(id:string)=>readSaved<Pending>(storage(id,"pending"));
const updatedAt=(item:unknown)=>{const value=item as {updatedAt?:string;completedAt?:string};return Date.parse(value.updatedAt??value.completedAt??"")||0};
function mergeRecords<T extends {id:string}>(base:T[],local:T[],remote:T[]):T[]{const before=new Map(base.map(item=>[item.id,item])),left=new Map(local.map(item=>[item.id,item])),right=new Map(remote.map(item=>[item.id,item])),ids=new Set([...before.keys(),...left.keys(),...right.keys()]),result:T[]=[];for(const id of ids){const old=before.get(id),l=left.get(id),r=right.get(id),lc=!same(l,old),rc=!same(r,old);let chosen:T|undefined;if(lc&&!rc)chosen=l;else if(rc&&!lc)chosen=r;else if(lc&&rc)chosen=updatedAt(l)>updatedAt(r)?l:r;else chosen=r??l;if(chosen)result.push(chosen)}return result}
function mergeProgress(local:UnitProgress[],remote:UnitProgress[]):UnitProgress[]{const result=[...remote];for(const item of local){const index=result.findIndex(value=>value.activityId===item.activityId&&value.date===item.date);if(index<0){result.push(item);continue}const current=result[index],latest=updatedAt(item)>updatedAt(current)?item:current,events=[...(current.counterEvents??[]),...(item.counterEvents??[])].filter((event,i,all)=>all.findIndex(candidate=>candidate.id===event.id)===i),periodIds=new Set([...Object.keys(current.counterByPeriod??{}),...Object.keys(item.counterByPeriod??{})]),counterByPeriod=Object.fromEntries([...periodIds].map(id=>[id,Math.max(current.counterByPeriod?.[id]??0,item.counterByPeriod?.[id]??0)])),sessions=new Map((current.timedSessions??[]).map(session=>[session.id,session]));for(const incoming of item.timedSessions??[]){const saved=sessions.get(incoming.id);if(!saved){sessions.set(incoming.id,incoming);continue}const rounds=new Map(saved.rounds.map(round=>[round.id,round]));for(const round of incoming.rounds){const previous=rounds.get(round.id);rounds.set(round.id,previous?.status==="undone"&&round.status==="completed"?previous:round)}sessions.set(incoming.id,{...(updatedAt(incoming)>updatedAt(saved)?incoming:saved),rounds:[...rounds.values()]})}result[index]={...latest,counterByPeriod,counterEvents:events,timedSessions:[...sessions.values()]}}return result}
function mergeSnapshots(base:LocalSnapshot,local:LocalSnapshot,remote:LocalSnapshot):LocalSnapshot{const logsById=new Map<string,ExecutionRecord>();for(const item of [...remote.executionLog,...local.executionLog]){const key=item.id??`${item.activityId??item.activity}:${item.completedAt}:${item.quantity??""}`;const previous=logsById.get(key);if(!previous||updatedAt(item)>updatedAt(previous))logsById.set(key,item)}const logs=[...logsById.values()];const progress=mergeProgress(local.unitProgress,remote.unitProgress);const keys=["calendarMode","journeyFilter","weekStartsOn","calendarCategories"] as const;const preferences=Object.fromEntries(keys.map(key=>{const l=local.preferences?.[key]??(key==="calendarCategories"?[]:null),r=remote.preferences?.[key]??(key==="calendarCategories"?[]:null),b=base.preferences?.[key]??(key==="calendarCategories"?[]:null);return[key,!same(l,b)&&same(r,b)?l:r]})) as LocalSnapshot["preferences"];return{version:1,plan:mergeRecords(base.plan??[],local.plan??[],remote.plan??[]),tasks:mergeRecords(base.tasks??[],local.tasks??[],remote.tasks??[]),appointments:mergeRecords(base.appointments??[],local.appointments??[],remote.appointments??[]),executionLog:logs.slice(0,500),unitProgress:progress.slice(0,400),preferences}}
function keepPending(userId:string,base:LocalSnapshot,local=readLocalSnapshot()){localStorage.setItem(storage(userId,"pending"),JSON.stringify({base,local,revision:Date.now().toString()} satisfies Pending))}
function retryLater(userId:string){if(!navigator.onLine)return;window.clearTimeout(retryTimer);retryTimer=window.setTimeout(()=>{if(currentUser?.id===userId)void syncAccount()},retryDelay);retryDelay=Math.min(30000,retryDelay*2)}

async function syncAccount(initial=false,beforeLoad=readLocalSnapshot()):Promise<void>{
 if(!supabase||!currentUser)return;
 if(syncPromise&&syncingUserId===currentUser.id){syncAgain=true;return syncPromise}
 const userId=currentUser.id;
 const run=async()=>{
  report("syncing");
  const {data,error}=await supabase!.from("saer_state").select("payload,updated_at").eq("user_id",userId).maybeSingle();
  if(currentUser?.id!==userId)return;
  const live=readLocalSnapshot(),pending=readPending(userId),knownBase=readBase(userId),base=pending?.base??knownBase??emptySnapshot();
  if(error){
   accountReady=true;
   if(!readBase(userId))writeBase(userId,emptySnapshot());
   localStorage.setItem(storage(userId,"pending"),JSON.stringify({base:pending?.base??readBase(userId)??emptySnapshot(),local:live,revision:Date.now().toString()} satisfies Pending));
   report(navigator.onLine?"error":"offline");retryLater(userId);return;
  }
  const remote=data?.payload?normalizeSnapshot(data.payload):undefined;
  let next:LocalSnapshot;
  if(remote){next=pending||initial&&!same(live,beforeLoad)||!knownBase?mergeSnapshots(base,live,remote):remote}
  else next=live;
  if(!same(live,next))replaceLocalSnapshot(next);
  if(remote&&same(remote,next)){
   writeBase(userId,next);const current=readLocalSnapshot();if(!same(current,next)){keepPending(userId,next,current);syncAgain=true}else localStorage.removeItem(storage(userId,"pending"));accountReady=true;report("ready");return;
  }
  const updatedAt=new Date(Math.max(Date.now(),Date.parse(data?.updated_at??"")+1)).toISOString();
  const result=remote?await supabase!.from("saer_state").update({payload:next,updated_at:updatedAt}).eq("user_id",userId).eq("updated_at",data!.updated_at).select("updated_at").maybeSingle():await supabase!.from("saer_state").insert({user_id:userId,payload:next,updated_at:updatedAt}).select("updated_at").maybeSingle();
  if(currentUser?.id!==userId)return;
  if(result.error||remote&&!result.data){
   keepPending(userId,pending?.base??remote??readBase(userId)??emptySnapshot());
   if(remote&&!result.error)syncAgain=true;
   else if(result.error?.code==="23505")syncAgain=true;
   else retryLater(userId);
   accountReady=true;report(result.error?(navigator.onLine?"error":"offline"):"syncing");return;
  }
  retryDelay=2000;window.clearTimeout(retryTimer);
  writeBase(userId,next);
  const current=readLocalSnapshot();
  if(!same(current,next)){
   localStorage.setItem(storage(userId,"pending"),JSON.stringify({base:next,local:current,revision:Date.now().toString()} satisfies Pending));syncAgain=true;
  }else localStorage.removeItem(storage(userId,"pending"));
  accountReady=true;
  void realtimeChannel?.send({type:"broadcast",event:"changed",payload:{updatedAt:new Date().toISOString()}});
  report("ready");
 };
 const operation=run().catch(()=>{if(currentUser?.id===userId){accountReady=true;if(!readPending(userId))keepPending(userId,readBase(userId)??emptySnapshot());report(navigator.onLine?"error":"offline");retryLater(userId)}}).finally(()=>{if(syncingUserId===userId){syncPromise=undefined;syncingUserId=undefined;if(syncAgain&&currentUser?.id===userId){syncAgain=false;void syncAccount()}}});
 syncPromise=operation;syncingUserId=userId;return operation;
}
export function scheduleCloudSave(){
 if(!currentUser||!accountReady)return;
 const userId=currentUser.id,snapshot=readLocalSnapshot(),previous=readPending(userId);
 localStorage.setItem(storage(userId,"pending"),JSON.stringify({base:previous?.base??readBase(userId)??emptySnapshot(),local:snapshot,revision:Date.now().toString()} satisfies Pending));
 if(!navigator.onLine){report("offline");return}
 window.clearTimeout(timer);
 timer=window.setTimeout(()=>void syncAccount(),450);
}
export function startCloudSync(onChange:Listener,onPasswordRecovery?:()=>void){
 listener=onChange;
 if(!supabase){onChange(null,"offline");return()=>{listener=undefined}}
 currentUser=null;
 accountReady=false;
 const stopRealtime=()=>{if(realtimeChannel){void supabase!.removeChannel(realtimeChannel);realtimeChannel=undefined}};
 const activate=(user:User|null)=>{
  const changed=user?.id!==currentUser?.id;
  if(changed){accountReady=false;stopRealtime()}
  currentUser=user;
  if(!user){accountReady=false;report("offline");return}
  if(changed||!accountReady){const before=readLocalSnapshot();realtimeChannel=supabase!.channel(`sair-sync-${user.id}`).on("broadcast",{event:"changed"},()=>{if(currentUser?.id===user.id)void syncAccount()}).subscribe();void syncAccount(true,before)}
 };
 const onLocal=()=>scheduleCloudSave();
 const onOnline=()=>{retryDelay=2000;if(currentUser)void syncAccount()};
 const onOffline=()=>report("offline");
 const onVisible=()=>{if(document.visibilityState==="visible"&&currentUser)void syncAccount()};
 window.addEventListener("sair-local-change",onLocal);
 window.addEventListener("online",onOnline);window.addEventListener("offline",onOffline);document.addEventListener("visibilitychange",onVisible);
 const authTimeout=window.setTimeout(()=>{if(!currentUser)report("offline")},1200);
 void supabase.auth.getUser().then(({data})=>activate(data.user)).catch(()=>activate(null));
 const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{if(event==="PASSWORD_RECOVERY")onPasswordRecovery?.();activate(session?.user??null)});
 return()=>{window.clearTimeout(authTimeout);window.clearTimeout(timer);window.clearTimeout(retryTimer);window.removeEventListener("sair-local-change",onLocal);window.removeEventListener("online",onOnline);window.removeEventListener("offline",onOffline);document.removeEventListener("visibilitychange",onVisible);subscription.unsubscribe();stopRealtime();listener=undefined;currentUser=null;accountReady=false}
}
export async function signInWithPassword(email:string,password:string){
 if(!supabase)return{error:"إعدادات Supabase غير مكتملة."};
 const {error}=await supabase.auth.signInWithPassword({email,password});
 return{error:error?.message};
}
export async function signUpWithPassword(email:string,password:string){
 if(!supabase)return{error:"إعدادات Supabase غير مكتملة."};
 const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});
 if(error)return{error:error.message};
 return{message:data.session?"تم إنشاء حسابك وتسجيل دخولك.":"تحقق من بريدك لتأكيد الحساب، ثم سجّل دخولك."};
}
export async function requestPasswordReset(email:string){
 if(!supabase)return{error:"إعدادات Supabase غير مكتملة."};
 const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}?recovery=1`});
 return{error:error?.message};
}
export async function updatePassword(password:string){
 if(!supabase)return{error:"إعدادات Supabase غير مكتملة."};
 const {error}=await supabase.auth.updateUser({password});
 return{error:error?.message};
}
export async function signOut(){if(supabase)await supabase.auth.signOut()}
