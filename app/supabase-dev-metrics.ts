"use client";

/** Development-only Supabase transport measurements. Never records headers, tokens, or bodies. */
export type SupabaseDevMetric={
  at:string;
  reason:string;
  method:string;
  endpoint:string;
  durationMs:number;
  requestBodyBytes:number|null;
  responseBodyBytes:number|null;
  responseContentLength:number|null;
  status:number|null;
  ok:boolean;
  repeat:number;
};

declare global{
  interface Window{__SAER_SUPABASE_METRICS__?:SupabaseDevMetric[]}
}

const development=process.env.NODE_ENV==="development";
let reason="غير محدد";
const repeats=new Map<string,number>();

export function setSupabaseMetricReason(value:string){if(development)reason=value}

export function recordSupabaseDevRealtime(direction:"SEND"|"RECEIVE",payload:unknown,eventReason:string){
  if(!development)return;
  let payloadBytes:number|null=null;
  try{payloadBytes=new TextEncoder().encode(JSON.stringify(payload)).byteLength}catch{payloadBytes=null}
  const operationKey=`${eventReason}|WS_${direction}|/realtime/v1/*`;
  const repeat=(repeats.get(operationKey)??0)+1;
  repeats.set(operationKey,repeat);
  const metric:SupabaseDevMetric={at:new Date().toISOString(),reason:eventReason,method:`WS_${direction}`,endpoint:"/realtime/v1/*",durationMs:0,requestBodyBytes:direction==="SEND"?payloadBytes:null,responseBodyBytes:direction==="RECEIVE"?payloadBytes:null,responseContentLength:null,status:null,ok:true,repeat};
  const rows=window.__SAER_SUPABASE_METRICS__??(window.__SAER_SUPABASE_METRICS__=[]);
  rows.push(metric);
  console.info("[Saer Supabase dev metric]",metric);
}

export const measuredSupabaseFetch:typeof fetch=async(input,init)=>{
  if(!development)return fetch(input,init);
  const request=new Request(input,init);
  const method=request.method.toUpperCase();
  const path=new URL(request.url).pathname;
  const endpoint=path.includes("/rest/v1/")?path.slice(path.indexOf("/rest/v1/")):path.includes("/auth/v1/")?"/auth/v1/*":path.includes("/realtime/v1/")?"/realtime/v1/*":"/other";
  const operationKey=`${reason}|${method}|${endpoint}`;
  const repeat=(repeats.get(operationKey)??0)+1;
  repeats.set(operationKey,repeat);
  const started=performance.now();
  const requestBody=method==="GET"||method==="HEAD"?Promise.resolve(null):request.clone().arrayBuffer().then(body=>body.byteLength).catch(()=>null);
  try{
    const response=await fetch(request);
    void Promise.all([requestBody,response.clone().arrayBuffer().then(body=>body.byteLength).catch(()=>null)]).then(([requestBodyBytes,responseBodyBytes])=>{
      const contentLength=Number(response.headers.get("content-length"));
      const metric:SupabaseDevMetric={at:new Date().toISOString(),reason:endpoint==="/auth/v1/*"?"مصادقة":reason,method,endpoint,durationMs:Math.round(performance.now()-started),requestBodyBytes,responseBodyBytes,responseContentLength:Number.isFinite(contentLength)&&contentLength>0?contentLength:null,status:response.status,ok:response.ok,repeat};
      const rows=window.__SAER_SUPABASE_METRICS__??(window.__SAER_SUPABASE_METRICS__=[]);
      rows.push(metric);
      console.info("[Saer Supabase dev metric]",metric);
    });
    return response;
  }catch(error){
    void requestBody.then(requestBodyBytes=>{
      const metric:SupabaseDevMetric={at:new Date().toISOString(),reason,method,endpoint,durationMs:Math.round(performance.now()-started),requestBodyBytes,responseBodyBytes:null,responseContentLength:null,status:null,ok:false,repeat};
      const rows=window.__SAER_SUPABASE_METRICS__??(window.__SAER_SUPABASE_METRICS__=[]);
      rows.push(metric);
      console.info("[Saer Supabase dev metric]",metric);
    });
    throw error;
  }
};
