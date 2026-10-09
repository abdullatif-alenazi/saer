"use client";
import type {User} from "@supabase/supabase-js";
import {readLocalSnapshot,replaceLocalSnapshot,type LocalSnapshot} from "./local-store";
import {supabase} from "./supabase";

export type SyncStatus="offline"|"ready"|"syncing"|"error";
type Listener=(user:User|null,status:SyncStatus)=>void;
let timer:number|undefined;
let currentUser:User|null=null;
let listener:Listener|undefined;
let loadingAccount:Promise<void>|undefined;
const report=(status:SyncStatus)=>listener?.(currentUser,status);
const hasContent=(snapshot:LocalSnapshot)=>Boolean(snapshot.plan.length||snapshot.tasks.length||snapshot.appointments.length||snapshot.executionLog.length||snapshot.unitProgress.length);
const byId=<T extends {id:string}>(remote:T[],local:T[])=>[...remote.filter(item=>!local.some(candidate=>candidate.id===item.id)),...local];
const mergeSnapshots=(remote:LocalSnapshot,local:LocalSnapshot):LocalSnapshot=>{
 const logs=[...remote.executionLog,...local.executionLog].filter((item,index,all)=>all.findIndex(candidate=>JSON.stringify(candidate)===JSON.stringify(item))===index);
 const progress=[...remote.unitProgress,...local.unitProgress].reduce<LocalSnapshot["unitProgress"]>((all,item)=>{
  const index=all.findIndex(candidate=>candidate.activityId===item.activityId&&candidate.date===item.date);
  if(index<0){all.push(item);return all}
  if(new Date(item.updatedAt).getTime()>=new Date(all[index].updatedAt).getTime())all[index]=item;
  return all;
 },[]);
 return {version:1,plan:byId(remote.plan,local.plan),tasks:byId(remote.tasks,local.tasks),appointments:byId(remote.appointments,local.appointments),executionLog:logs.slice(0,500),unitProgress:progress.slice(0,400),preferences:{calendarMode:local.preferences?.calendarMode??remote.preferences?.calendarMode??null,journeyFilter:local.preferences?.journeyFilter??remote.preferences?.journeyFilter??null}};
};

async function saveAccountState(snapshot=readLocalSnapshot()){
 if(!supabase||!currentUser)return;
 const userId=currentUser.id;
 report("syncing");
 const {error}=await supabase.from("saer_state").upsert({user_id:userId,payload:snapshot,updated_at:new Date().toISOString()},{onConflict:"user_id"});
 if(currentUser?.id!==userId)return;
 report(error?"error":"ready");
}
async function openAccount(){
 if(!supabase||!currentUser)return;
 const userId=currentUser.id;
 report("syncing");
 const {data,error}=await supabase.from("saer_state").select("payload").eq("user_id",userId).maybeSingle();
 if(currentUser?.id!==userId)return;
 if(error){report("error");return}
 const local=readLocalSnapshot(),remote=data?.payload as LocalSnapshot|undefined;
 if(remote&&hasContent(remote)){
  if(hasContent(local)){
   const merged=mergeSnapshots(remote,local);
   replaceLocalSnapshot(merged);
   await saveAccountState(merged);
   return;
  }
  replaceLocalSnapshot(remote);report("ready");return;
 }
 // أول جهاز يفتح الحساب ينشئ النسخة المرتبطة به تلقائيًا.
 // بيانات الحساب الموجودة تبقى هي المرجع، ولا تستبدلها بيانات جهاز فارغ.
 await saveAccountState(local);
}
export function scheduleCloudSave(){
 if(!currentUser)return;
 window.clearTimeout(timer);
 timer=window.setTimeout(()=>void saveAccountState(),500);
}
export function startCloudSync(onChange:Listener,onPasswordRecovery?:()=>void){
 listener=onChange;
 if(!supabase){onChange(null,"offline");return()=>{listener=undefined}}
 currentUser=null;
 loadingAccount=undefined;
 const activate=(user:User|null)=>{
  const changed=user?.id!==currentUser?.id;
  currentUser=user;
  if(!user){loadingAccount=undefined;report("offline");return}
  if(changed||!loadingAccount)loadingAccount=openAccount();
 };
 const onLocal=()=>scheduleCloudSave();
 window.addEventListener("sair-local-change",onLocal);
 const authTimeout=window.setTimeout(()=>{if(!currentUser)report("offline")},1200);
 void supabase.auth.getUser().then(({data})=>activate(data.user)).catch(()=>activate(null));
 const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{if(event==="PASSWORD_RECOVERY")onPasswordRecovery?.();activate(session?.user??null)});
 return()=>{window.clearTimeout(authTimeout);window.removeEventListener("sair-local-change",onLocal);subscription.unsubscribe();listener=undefined}
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
