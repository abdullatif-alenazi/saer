export type ExecutionRecord={activity:string;minutes:number;quantity?:number;completedAt:string};
const key="sair.executionLog.v1";
export function readExecutionLog():ExecutionRecord[]{try{return JSON.parse(localStorage.getItem(key)||"[]")}catch{return[]}}
export function saveExecution(record:ExecutionRecord){const records=readExecutionLog();localStorage.setItem(key,JSON.stringify([record,...records].slice(0,100)));return records.length+1}
