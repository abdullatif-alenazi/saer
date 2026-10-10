export type TrackingNature="goal"|"commitment";
export type GoalMetricKind="quantity"|"level"|"milestone";
export type Schedule={mode:"daily"|"fixed"|"flexible";value:string;days?:string[];sessionsPerWeek?:number};
export type GoalDefinition={kind:GoalMetricKind;currentValue?:number;targetValue?:number;unit?:string;currentLevel?:string;targetLevel?:string;milestoneLabel?:string;currentMilestone?:number;targetMilestone?:number};
export type SupportingPlan={enabled:boolean;actionName:string;expectedMinutes:number;schedule:Schedule;period:string};
export type UnitPeriod={id:string;label:string;period:string;target:number;unitCount:number;unitValue:number};
export type UnitTracking={method:"counter"|"units";target:number;pressValue:number;periods:UnitPeriod[];timing?:{count:number;seconds:number}};
export type ExecutionRecord={activityId?:string;activity:string;minutes:number;quantity?:number;quantityUnit?:string;completedAt:string;status?:"completed"|"missed";dueKey?:string;goalProgressValue?:number};
const key="sair.executionLog.v1";
const calendarKey="sair.calendar.v1";
const journeyFilterKey="sair.journeyFilter.v1";
const notifyChange=()=>{if(typeof window!=="undefined")window.dispatchEvent(new Event("sair-local-change"))};
export function readExecutionLog():ExecutionRecord[]{try{return JSON.parse(localStorage.getItem(key)||"[]")}catch{return[]}}
export function saveExecution(record:ExecutionRecord){const records=readExecutionLog();localStorage.setItem(key,JSON.stringify([record,...records].slice(0,500)));notifyChange();return records.length+1}

export type PlannedActivity={
 id:string;name:string;template:string;period:string;goal:string;expectedMinutes:number;
 nature?:TrackingNature;schedule:Schedule;
 quantity?:number;unit?:string;measurements:string[];startTime?:string;endTime?:string;
 activityKind?:string;trackingMode?:"time"|"distance";
 exercises?:WorkoutExercise[];goalDefinition?:GoalDefinition;supportingPlan?:SupportingPlan;
 parentGoalId?:string;linkedCommitmentId?:string;reminder?:Reminder;unitTracking?:UnitTracking;
};
export type Reminder={mode:"none"|"time"|"station"|"before";value?:string|number};
export type WorkoutExercise={id:string;name:string;category:"دفع"|"سحب"|"أرجل"|"جذع";measurement:"repetitions"|"duration";sets:number;reps?:number;durationSeconds?:number;restSeconds:number};
const planKey="sair.plan.v1";
const normalize=(item:PlannedActivity):PlannedActivity=>({...item,nature:item.nature??"commitment",schedule:{...item.schedule,days:item.schedule.days??[]}});
export function readPlan():PlannedActivity[]{try{return (JSON.parse(localStorage.getItem(planKey)||"[]") as PlannedActivity[]).map(normalize)}catch{return[]}}
export function savePlan(activity:PlannedActivity){const plan=readPlan();const next=[...plan,normalize(activity)];localStorage.setItem(planKey,JSON.stringify(next));notifyChange();return next}
export function updatePlan(activity:PlannedActivity){const next=readPlan().map(item=>item.id===activity.id?normalize(activity):item);localStorage.setItem(planKey,JSON.stringify(next));notifyChange();return next}
export function deletePlan(id:string){const next=readPlan().filter(item=>item.id!==id);localStorage.setItem(planKey,JSON.stringify(next));notifyChange();return next}

export type UnitProgress={activityId:string;date:string;counterByPeriod:Record<string,number>;completedUnitsByPeriod:Record<string,number[]>;targetByPeriod?:Record<string,number>;updatedAt:string;completedAt?:string};
const unitProgressKey="sair.unitProgress.v1";
export function readUnitProgress():UnitProgress[]{try{return JSON.parse(localStorage.getItem(unitProgressKey)||"[]")}catch{return[]}}
export function saveUnitProgress(progress:UnitProgress){const all=readUnitProgress(),next=[progress,...all.filter(item=>!(item.activityId===progress.activityId&&item.date===progress.date))].slice(0,400);localStorage.setItem(unitProgressKey,JSON.stringify(next));notifyChange();return next}

export type Appointment={id:string;title:string;date:string;time:string;alertMinutes?:number};
const appointmentKey="sair.appointments.v1";
export function readAppointments():Appointment[]{try{return JSON.parse(localStorage.getItem(appointmentKey)||"[]")}catch{return[]}}
export function saveAppointment(item:Appointment){const next=[...readAppointments(),item];localStorage.setItem(appointmentKey,JSON.stringify(next));notifyChange();return next}
export function updateAppointment(item:Appointment){const next=readAppointments().map(value=>value.id===item.id?item:value);localStorage.setItem(appointmentKey,JSON.stringify(next));notifyChange();return next}
export function deleteAppointment(id:string){const next=readAppointments().filter(item=>item.id!==id);localStorage.setItem(appointmentKey,JSON.stringify(next));notifyChange();return next}

export type TaskItem={id:string;title:string;date?:string;time?:string;urgent?:boolean;completedAt?:string;archivedAt?:string;reminder?:Reminder};
const taskKey="sair.tasks.v1";
export function readTasks():TaskItem[]{try{return JSON.parse(localStorage.getItem(taskKey)||"[]")}catch{return[]}}
export function saveTask(item:TaskItem){const next=[...readTasks(),item];localStorage.setItem(taskKey,JSON.stringify(next));notifyChange();return next}
export function updateTask(item:TaskItem){const next=readTasks().map(value=>value.id===item.id?item:value);localStorage.setItem(taskKey,JSON.stringify(next));notifyChange();return next}
export function deleteTask(id:string){const next=readTasks().filter(item=>item.id!==id);localStorage.setItem(taskKey,JSON.stringify(next));notifyChange();return next}

export type LocalSnapshot={version:1;plan:PlannedActivity[];tasks:TaskItem[];appointments:Appointment[];executionLog:ExecutionRecord[];unitProgress:UnitProgress[];preferences:{calendarMode:string|null;journeyFilter:string|null}};
export function readLocalSnapshot():LocalSnapshot{return{version:1,plan:readPlan(),tasks:readTasks(),appointments:readAppointments(),executionLog:readExecutionLog(),unitProgress:readUnitProgress(),preferences:{calendarMode:localStorage.getItem(calendarKey),journeyFilter:localStorage.getItem(journeyFilterKey)}}}
export function replaceLocalSnapshot(snapshot:LocalSnapshot){localStorage.setItem(planKey,JSON.stringify(snapshot.plan??[]));localStorage.setItem(taskKey,JSON.stringify(snapshot.tasks??[]));localStorage.setItem(appointmentKey,JSON.stringify(snapshot.appointments??[]));localStorage.setItem(key,JSON.stringify(snapshot.executionLog??[]));localStorage.setItem(unitProgressKey,JSON.stringify(snapshot.unitProgress??[]));if(snapshot.preferences?.calendarMode)localStorage.setItem(calendarKey,snapshot.preferences.calendarMode);if(snapshot.preferences?.journeyFilter)localStorage.setItem(journeyFilterKey,snapshot.preferences.journeyFilter);if(typeof window!=="undefined")window.dispatchEvent(new Event("sair-cloud-state"))}
