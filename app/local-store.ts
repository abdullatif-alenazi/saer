export type ExecutionRecord={activity:string;minutes:number;quantity?:number;completedAt:string};
const key="sair.executionLog.v1";
export function readExecutionLog():ExecutionRecord[]{try{return JSON.parse(localStorage.getItem(key)||"[]")}catch{return[]}}
export function saveExecution(record:ExecutionRecord){const records=readExecutionLog();localStorage.setItem(key,JSON.stringify([record,...records].slice(0,100)));return records.length+1}

export type PlannedActivity={
 id:string;name:string;template:string;period:string;goal:string;expectedMinutes:number;
 schedule:{mode:"daily"|"fixed"|"flexible";value:string};
 quantity?:number;unit?:string;measurements:string[];startTime?:string;endTime?:string;
 exercises?:WorkoutExercise[];
};
export type WorkoutExercise={id:string;name:string;category:"دفع"|"سحب"|"أرجل"|"جذع";measurement:"repetitions"|"duration";sets:number;reps?:number;durationSeconds?:number;restSeconds:number};
const planKey="sair.plan.v1";
export function readPlan():PlannedActivity[]{try{return JSON.parse(localStorage.getItem(planKey)||"[]")}catch{return[]}}
export function savePlan(activity:PlannedActivity){const plan=readPlan();const next=[...plan,activity];localStorage.setItem(planKey,JSON.stringify(next));return next}
