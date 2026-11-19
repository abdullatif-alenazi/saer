"use client";
import type {User} from "@supabase/supabase-js";
import {normalizeUnitProgress,readLocalSnapshot,replaceLocalSnapshot,type ExecutionRecord,type LocalSnapshot,type UnitProgress} from "./local-store";
import {supabase} from "./supabase";
import {recordSupabaseDevRealtime,setSupabaseMetricReason} from "./supabase-dev-metrics";

export type SyncStatus="offline"|"ready"|"syncing"|"error";
type Listener=(user:User|null,status:SyncStatus)=>void;
type Pending={base:LocalSnapshot;local:LocalSnapshot;revision:string};
type CloudRow={payload:unknown;revision:number|string;updated_at:string};
const REVISION_CHECK_INTERVAL=30_000;
let timer:number|undefined;
let retryTimer:number|undefined;
let retryDelay=2000;
let currentUser:User|null=null;
let listener:Listener|undefined;
let accountReady=false;
let syncPromise:Promise<void>|undefined;
let syncingUserId:string|undefined;
let syncAgain=false;
let syncAgainCheckOnly=false;
let realtimeChannel:ReturnType<NonNullable<typeof supabase>["channel"]>|undefined;
let realtimeUserId:string|undefined;
let realtimeTimer:number|undefined;
let pendingRealtimeRevision:string|undefined;
let lastRevisionCheckAt=0;
const report=(status:SyncStatus)=>listener?.(currentUser,status);
const storage=(userId:string,kind:"base"|"pending"|"revision")=>`sair.sync.${kind}.v2.${userId}`;
const emptySnapshot=():LocalSnapshot=>({version:1,plan:[],tasks:[],appointments:[],executionLog:[],unitProgress:[],preferences:{calendarMode:null,journeyFilter:null,weekStartsOn:null,calendarCategories:[]}});
const normalizeSnapshot=(value:unknown):LocalSnapshot=>{const data=(value&&typeof value==="object"?value:{}) as Partial<LocalSnapshot>;return{...emptySnapshot(),...data,plan:data.plan??[],tasks:data.tasks??[],appointments:data.appointments??[],executionLog:data.executionLog??[],unitProgress:normalizeUnitProgress(data.unitProgress),preferences:{...emptySnapshot().preferences,...data.preferences}}};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const readSaved=<T,>(key:string):T|undefined=>{try{const value=localStorage.getItem(key);return value?JSON.parse(value) as T:undefined}catch{return undefined}};
const writeBase=(id:string,value:LocalSnapshot)=>localStorage.setItem(storage(id,"base"),JSON.stringify(value));
const readBase=(id:string)=>readSaved<LocalSnapshot>(storage(id,"base"));
const readRevision=(id:string)=>localStorage.getItem(storage(id,"revision"))||undefined;
const writeRevision=(id:string,value:string|undefined)=>{if(value)localStorage.setItem(storage(id,"revision"),value);else localStorage.removeItem(storage(id,"revision"))};
const readPending=(id:string)=>readSaved<Pending>(storage(id,"pending"));
const updatedAt=(item:unknown)=>{const value=item as {updatedAt?:string;completedAt?:string};return Date.parse(value.updatedAt??value.completedAt??"")||0};
function mergeRecords<T extends {id:string}>(base:T[],local:T[],remote:T[]):T[]{const before=new Map(base.map(item=>[item.id,item])),left=new Map(local.map(item=>[item.id,item])),right=new Map(remote.map(item=>[item.id,item])),ids=new Set([...before.keys(),...left.keys(),...right.keys()]),result:T[]=[];for(const id of ids){const old=before.get(id),l=left.get(id),r=right.get(id),lc=!same(l,old),rc=!same(r,old);let chosen:T|undefined;if(lc&&!rc)chosen=l;else if(rc&&!lc)chosen=r;else if(lc&&rc)chosen=updatedAt(l)>updatedAt(r)?l:r;else chosen=r??l;if(chosen)result.push(chosen)}return result}
function mergeProgress(local:UnitProgress[],remote:UnitProgress[]):UnitProgress[]{const result=[...remote];for(const item of local){const index=result.findIndex(value=>value.activityId===item.activityId&&value.date===item.date);if(index<0){result.push(item);continue}const current=result[index],latest=updatedAt(item)>updatedAt(current)?item:current,events=[...(current.counterEvents??[]),...(item.counterEvents??[])].filter((event,i,all)=>all.findIndex(candidate=>candidate.id===event.id)===i),periodIds=new Set([...Object.keys(current.counterByPeriod??{}),...Object.keys(item.counterByPeriod??{})]),counterByPeriod=Object.fromEntries([...periodIds].map(id=>[id,Math.max(current.counterByPeriod?.[id]??0,item.counterByPeriod?.[id]??0)])),sessions=new Map((current.timedSessions??[]).map(session=>[session.id,session]));for(const incoming of item.timedSessions??[]){const saved=sessions.get(incoming.id);if(!saved){sessions.set(incoming.id,incoming);continue}const rounds=new Map(saved.rounds.map(round=>[round.id,round]));for(const round of incoming.rounds){const previous=rounds.get(round.id);rounds.set(round.id,previous?.status==="undone"&&round.status==="completed"?previous:round)}sessions.set(incoming.id,{...(updatedAt(incoming)>updatedAt(saved)?incoming:saved),rounds:[...rounds.values()]})}result[index]={...latest,counterByPeriod,counterEvents:events,timedSessions:[...sessions.values()]}}return result}
function mergeSnapshots(base:LocalSnapshot,local:LocalSnapshot,remote:LocalSnapshot):LocalSnapshot{const logsById=new Map<string,ExecutionRecord>();for(const item of [...remote.executionLog,...local.executionLog]){const key=item.id??`${item.activityId??item.activity}:${item.completedAt}:${item.quantity??""}`;const previous=logsById.get(key);if(!previous||updatedAt(item)>updatedAt(previous))logsById.set(key,item)}const logs=[...logsById.values()];const progress=mergeProgress(local.unitProgress,remote.unitProgress);const keys=["calendarMode","journeyFilter","weekStartsOn","calendarCategories"] as const;const preferences=Object.fromEntries(keys.map(key=>{const l=local.preferences?.[key]??(key==="calendarCategories"?[]:null),r=remote.preferences?.[key]??(key==="calendarCategories"?[]:null),b=base.preferences?.[key]??(key==="calendarCategories"?[]:null);return[key,!same(l,b)&&same(r,b)?l:r]})) as LocalSnapshot["preferences"];return{version:1,plan:mergeRecords(base.plan??[],local.plan??[],remote.plan??[]),tasks:mergeRecords(base.tasks??[],local.tasks??[],remote.tasks??[]),appointments:mergeRecords(base.appointments??[],local.appointments??[],remote.appointments??[]),executionLog:logs.slice(0,500),unitProgress:progress.slice(0,400),preferences}}
function keepPending(userId:string,base:LocalSnapshot,local=readLocalSnapshot()){localStorage.setItem(storage(userId,"pending"),JSON.stringify({base,local,revision:Date.now().toString()} satisfies Pending))}
function finishLocally(userId:string,snapshot:LocalSnapshot,revision:string|undefined){writeBase(userId,snapshot);writeRevision(userId,revision);const current=readLocalSnapshot();if(!same(current,snapshot)){keepPending(userId,snapshot,current);syncAgain=true}else localStorage.removeItem(storage(userId,"pending"));accountReady=true;report("ready")}
function retryLater(userId:string,checkOnly=false){if(!navigator.onLine)return;window.clearTimeout(retryTimer);retryTimer=window.setTimeout(()=>{if(currentUser?.id===userId)void syncAccount(false,readLocalSnapshot(),"إعادة محاولة بعد فشل",checkOnly)},retryDelay);retryDelay=Math.min(30000,retryDelay*2)}

const revisionString=(value:unknown)=>value==null?undefined:String(value);
const isNewerRevision=(candidate:string,current:string|undefined)=>{try{return BigInt(candidate)>BigInt(current??"0")}catch{return false}};
async function readCloudRow(userId:string,reason:string):Promise<{row:CloudRow|null;error:unknown}>{
 setSupabaseMetricReason(`${reason} — تنزيل لقطة البيانات`);
 const result=await supabase!.from("saer_state").select("payload,revision,updated_at").eq("user_id",userId).maybeSingle();
 return{row:result.data as CloudRow|null,error:result.error};
}
async function readCloudRevision(userId:string,reason:string):Promise<{revision:string|undefined;error:unknown}>{
 setSupabaseMetricReason(`${reason} — فحص الإصدار فقط`);
 const result=await supabase!.from("saer_state").select("revision").eq("user_id",userId).maybeSingle();
 return{revision:revisionString((result.data as {revision:number|string}|null)?.revision),error:result.error};
}
async function writeCloudCas(userId:string,expected:string|undefined,payload:LocalSnapshot,reason:string):Promise<{revision:string|undefined;conflict:boolean;error:unknown}>{
 setSupabaseMetricReason(`${reason} — حفظ مشروط ذري`);
 const result=await supabase!.rpc("sync_saer_state",{p_expected_revision:expected??null,p_payload:payload});
 if(result.error)return{revision:undefined,conflict:false,error:result.error};
 const rows=Array.isArray(result.data)?result.data as Array<{revision?:number|string}>:[];
 const revision=revisionString(rows[0]?.revision);
 return{revision,conflict:!revision,error:null};
}

async function performSync(userId:string,initial:boolean,beforeLoad:LocalSnapshot,reason:string,checkOnly:boolean){
 let pending=readPending(userId),base=pending?.base??readBase(userId)??emptySnapshot(),expected=readRevision(userId),live=readLocalSnapshot(),next:LocalSnapshot;
 if(checkOnly&&!pending&&expected){
  const head=await readCloudRevision(userId,reason);
  lastRevisionCheckAt=Date.now();
  if(currentUser?.id!==userId)return;
  if(head.error)throw head.error;
  if(head.revision===expected){accountReady=true;report("ready");return}
  const {row,error}=await readCloudRow(userId,reason);
  if(currentUser?.id!==userId)return;
  if(error)throw error;
  const remote=row?.payload?normalizeSnapshot(row.payload):undefined;
  expected=revisionString(row?.revision);
  if(remote){next=mergeSnapshots(base,readLocalSnapshot(),remote);if(same(remote,next)){if(!same(readLocalSnapshot(),next))replaceLocalSnapshot(next);finishLocally(userId,next,expected);return}}
  else next=readLocalSnapshot();
 }else if(initial||!expected){
  const {row,error}=await readCloudRow(userId,reason);
  if(currentUser?.id!==userId)return;
  if(error)throw error;
  const remote=row?.payload?normalizeSnapshot(row.payload):undefined;
  expected=revisionString(row?.revision);
  live=readLocalSnapshot();
  if(!remote&&!pending&&same(live,beforeLoad)&&same(live,emptySnapshot())){finishLocally(userId,live,expected);return}
  next=remote?(pending||initial&&!same(live,beforeLoad)||!readBase(userId)?mergeSnapshots(base,live,remote):remote):live;
  if(remote&&same(remote,next)){if(!same(live,next))replaceLocalSnapshot(next);finishLocally(userId,next,expected);return}
 }else{
  if(!pending){accountReady=true;report("ready");return}
  next=readLocalSnapshot();
 }

 for(let attempt=0;attempt<3;attempt++){
  if(currentUser?.id!==userId)return;
  const saved=await writeCloudCas(userId,expected,next,reason);
  if(currentUser?.id!==userId)return;
  if(saved.error)throw saved.error;
  if(!saved.conflict&&saved.revision){
   retryDelay=2000;window.clearTimeout(retryTimer);
   finishLocally(userId,next,saved.revision);
   const broadcast={revision:saved.revision};
   recordSupabaseDevRealtime("SEND",{type:"broadcast",event:"changed",payload:broadcast},"إشعار مزامنة صادر");
   void realtimeChannel?.send({type:"broadcast",event:"changed",payload:broadcast});
   return;
  }
  const {row,error}=await readCloudRow(userId,`${reason} — حل تعارض`);
  if(currentUser?.id!==userId)return;
  if(error)throw error;
  const remote=row?.payload?normalizeSnapshot(row.payload):undefined;
  expected=revisionString(row?.revision);
  live=readLocalSnapshot();
  pending=readPending(userId);
  base=pending?.base??readBase(userId)??base;
  next=remote?mergeSnapshots(base,live,remote):live;
  if(remote&&same(remote,next)){if(!same(live,next))replaceLocalSnapshot(next);finishLocally(userId,next,expected);return}
 }
 keepPending(userId,readBase(userId)??base,readLocalSnapshot());
 accountReady=true;report("syncing");
 retryLater(userId);
}

async function syncAccount(initial=false,beforeLoad=readLocalSnapshot(),reason=initial?"فتح الحساب أو تسجيل الدخول":"مزامنة لاحقة",checkOnly=false):Promise<void>{
 if(!supabase||!currentUser)return;
 if(syncPromise&&syncingUserId===currentUser.id){syncAgain=true;syncAgainCheckOnly=syncAgainCheckOnly||checkOnly;return syncPromise}
 const userId=currentUser.id;
 const run=async()=>{report("syncing");await performSync(userId,initial,beforeLoad,reason,checkOnly)};
 const operation=run().catch(()=>{if(currentUser?.id===userId){accountReady=true;if(!checkOnly&&!readPending(userId))keepPending(userId,readBase(userId)??emptySnapshot());report(navigator.onLine?"error":"offline");retryLater(userId,checkOnly)}}).finally(()=>{if(syncingUserId===userId){syncPromise=undefined;syncingUserId=undefined;if(syncAgain&&currentUser?.id===userId){const checkAgain=syncAgainCheckOnly;syncAgain=false;syncAgainCheckOnly=false;void syncAccount(false,readLocalSnapshot(),"تغييرات أثناء المزامنة",checkAgain)}}});
 syncPromise=operation;syncingUserId=userId;return operation;
}

export function scheduleCloudSave(){
 if(!currentUser||!accountReady)return;
 const userId=currentUser.id,snapshot=readLocalSnapshot(),previous=readPending(userId);
 localStorage.setItem(storage(userId,"pending"),JSON.stringify({base:previous?.base??readBase(userId)??emptySnapshot(),local:snapshot,revision:Date.now().toString()} satisfies Pending));
 if(!navigator.onLine){report("offline");return}
 window.clearTimeout(timer);
 timer=window.setTimeout(()=>void syncAccount(false,readLocalSnapshot(),"تغيير محلي بعد مهلة الحفظ"),450);
}

export function startCloudSync(onChange:Listener,onPasswordRecovery?:()=>void){
 listener=onChange;
 if(!supabase){onChange(null,"offline");return()=>{listener=undefined}}
 currentUser=null;accountReady=false;realtimeUserId=undefined;lastRevisionCheckAt=0;pendingRealtimeRevision=undefined;
 const stopRealtime=()=>{window.clearTimeout(realtimeTimer);realtimeTimer=undefined;pendingRealtimeRevision=undefined;if(realtimeChannel){void supabase!.removeChannel(realtimeChannel);realtimeChannel=undefined;realtimeUserId=undefined}};
 const ensureRealtime=(user:User)=>{
  if(realtimeChannel&&realtimeUserId===user.id)return;
  stopRealtime();realtimeUserId=user.id;
  realtimeChannel=supabase!.channel(`sair-sync-${user.id}`).on("broadcast",{event:"changed"},message=>{
   recordSupabaseDevRealtime("RECEIVE",message,"إشعار مزامنة وارد");
   const incoming=revisionString((message as {payload?:{revision?:number|string}}|null)?.payload?.revision);
   const known=readRevision(user.id);
   if(currentUser?.id===user.id&&(!incoming||isNewerRevision(incoming,known))){
    if(incoming&&(!pendingRealtimeRevision||isNewerRevision(incoming,pendingRealtimeRevision)))pendingRealtimeRevision=incoming;
    window.clearTimeout(realtimeTimer);
    realtimeTimer=window.setTimeout(()=>{pendingRealtimeRevision=undefined;if(currentUser?.id===user.id)void syncAccount(false,readLocalSnapshot(),"إشعار Realtime",true)},250);
   }
  }).subscribe();
 };
 const activate=(user:User|null)=>{
  const changed=user?.id!==currentUser?.id;
  if(changed){accountReady=false;stopRealtime();lastRevisionCheckAt=0}
  currentUser=user;
  if(!user){accountReady=false;report("offline");return}
  ensureRealtime(user);
  if(changed||!accountReady){const before=readLocalSnapshot();void syncAccount(true,before,"فتح الحساب أو تسجيل الدخول")}
 };
 const onLocal=()=>scheduleCloudSave();
 const onOnline=()=>{retryDelay=2000;if(currentUser){if(readPending(currentUser.id))void syncAccount(false,readLocalSnapshot(),"استعادة الاتصال");else if(Date.now()-lastRevisionCheckAt>=REVISION_CHECK_INTERVAL)void syncAccount(false,readLocalSnapshot(),"استعادة الاتصال",true)}};
 const onOffline=()=>report("offline");
 const onVisible=()=>{if(document.visibilityState!=="visible"||!currentUser)return;if(readPending(currentUser.id))void syncAccount(false,readLocalSnapshot(),"العودة إلى التطبيق");else if(Date.now()-lastRevisionCheckAt>=REVISION_CHECK_INTERVAL)void syncAccount(false,readLocalSnapshot(),"العودة إلى التطبيق",true)};
 window.addEventListener("sair-local-change",onLocal);
 window.addEventListener("online",onOnline);window.addEventListener("offline",onOffline);document.addEventListener("visibilitychange",onVisible);
 const authTimeout=window.setTimeout(()=>{if(!currentUser)report("offline")},1200);
 void supabase.auth.getUser().then(({data})=>activate(data.user)).catch(()=>activate(null));
 const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{if(event==="PASSWORD_RECOVERY")onPasswordRecovery?.();activate(session?.user??null)});
 return()=>{window.clearTimeout(authTimeout);window.clearTimeout(timer);window.clearTimeout(retryTimer);window.removeEventListener("sair-local-change",onLocal);window.removeEventListener("online",onOnline);window.removeEventListener("offline",onOffline);document.removeEventListener("visibilitychange",onVisible);subscription.unsubscribe();stopRealtime();listener=undefined;currentUser=null;accountReady=false;syncAgain=false;syncAgainCheckOnly=false;syncPromise=undefined;syncingUserId=undefined}
}

export async function signInWithPassword(email:string,password:string){if(!supabase)return{error:"إعدادات Supabase غير مكتملة."};const {error}=await supabase.auth.signInWithPassword({email,password});return{error:error?.message}}
export async function signUpWithPassword(email:string,password:string){if(!supabase)return{error:"إعدادات Supabase غير مكتملة."};const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});if(error)return{error:error.message};return{message:data.session?"تم إنشاء حسابك وتسجيل دخولك.":"تحقق من بريدك لتأكيد الحساب، ثم سجّل دخولك."}}
export async function requestPasswordReset(email:string){if(!supabase)return{error:"إعدادات Supabase غير مكتملة."};const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}?recovery=1`});return{error:error?.message}}
export async function updatePassword(password:string){if(!supabase)return{error:"إعدادات Supabase غير مكتملة."};const {error}=await supabase.auth.updateUser({password});return{error:error?.message}}
export async function signOut(){if(supabase)await supabase.auth.signOut()}
