"use client";
import type {User} from "@supabase/supabase-js";
import {readLocalSnapshot,replaceLocalSnapshot,type LocalSnapshot} from "./local-store";
import {supabase} from "./supabase";

export type SyncStatus="offline"|"ready"|"syncing"|"error";
type Listener=(user:User|null,status:SyncStatus)=>void;
let timer:number|undefined;
let currentUser:User|null=null;
let listener:Listener|undefined;
const report=(status:SyncStatus)=>listener?.(currentUser,status);
const hasContent=(snapshot:LocalSnapshot)=>Boolean(snapshot.plan.length||snapshot.tasks.length||snapshot.appointments.length||snapshot.executionLog.length||snapshot.unitProgress.length);

async function push(){
 if(!supabase||!currentUser)return;
 report("syncing");
 const {error}=await supabase.from("saer_state").upsert({user_id:currentUser.id,payload:readLocalSnapshot(),updated_at:new Date().toISOString()});
 report(error?"error":"ready");
}
async function pullOrCreate(){
 if(!supabase||!currentUser)return;
 report("syncing");
 const {data,error}=await supabase.from("saer_state").select("payload").eq("user_id",currentUser.id).maybeSingle();
 if(error){report("error");return}
 const local=readLocalSnapshot(),remote=data?.payload as LocalSnapshot|undefined;
 if(remote&&hasContent(remote)){replaceLocalSnapshot(remote);report("ready");return}
 if(hasContent(local))await push();else report("ready");
}
export function scheduleCloudSave(){
 if(!currentUser)return;
 window.clearTimeout(timer);
 timer=window.setTimeout(()=>void push(),700);
}
export function startCloudSync(onChange:Listener){
 listener=onChange;
 if(!supabase){onChange(null,"offline");return()=>{listener=undefined}}
 const onLocal=()=>scheduleCloudSave();
 window.addEventListener("sair-local-change",onLocal);
 void supabase.auth.getUser().then(({data})=>{currentUser=data.user;report(data.user?"syncing":"offline");if(data.user)void pullOrCreate()});
 const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user??null;report(currentUser?"syncing":"offline");if(currentUser)window.setTimeout(()=>void pullOrCreate(),0)});
 return()=>{window.removeEventListener("sair-local-change",onLocal);subscription.unsubscribe();listener=undefined}
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
export async function signOut(){if(supabase)await supabase.auth.signOut()}
export async function syncNow(){await push()}
