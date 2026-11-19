import {createClient} from "@supabase/supabase-js";
import {measuredSupabaseFetch} from "./supabase-dev-metrics";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:process.env.NODE_ENV==="development"?measuredSupabaseFetch:fetch}}):null;
