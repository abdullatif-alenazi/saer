export type TrackingNature="goal"|"commitment";
export type GoalMetricKind="quantity"|"level"|"milestone";
export type Schedule={mode:"daily"|"fixed"|"flexible";value:string;days?:string[];sessionsPerWeek?:number};
export type GoalDefinition={kind:GoalMetricKind;currentValue?:number;targetValue?:number;unit?:string;currentLevel?:string;targetLevel?:string;milestoneLabel?:string;currentMilestone?:number;targetMilestone?:number};
export type SupportingPlan={enabled:boolean;actionName:string;expectedMinutes:number;schedule:Schedule;period:string};
export type UnitPeriod={id:string;label:string;period:string;target:number;unitCount:number;unitValue:number};
export type GaugeStyle="ring"|"semi"|"periods";
export type UnitTracking={method:"counter"|"units";target:number;pressValue:number;periods:UnitPeriod[];timing?:{count:number;seconds:number;enabled?:boolean;showTimer?:boolean;roundSize?:number;timerGaugeStyle?:"ring"|"semi"};gaugeStyle?:GaugeStyle};
export type TimedRound={id:string;sessionId:string;periodId:string;periodAmounts?:Record<string,number>;sequence:number;amount:number;unitIndex?:number;unitIndexes?:number[];unitIndexesByPeriod?:Record<string,number[]>;startedAt:string;completedAt:string;durationSeconds:number;status:"completed"|"undone";method:"counter"|"units"};
export type TimedSession={id:string;activityId:string;date:string;startedAt:string;roundStartedAt?:string;updatedAt:string;status:"running"|"paused"|"finished";elapsedMs:number;roundElapsedMs:number;pendingRoundAmount?:number;pendingRoundAmounts?:Record<string,number>;pendingRoundPeriodId?:string;pendingUnitIndexes?:number[];pendingUnitIndexesByPeriod?:Record<string,number[]>;rounds:TimedRound[];interrupted?:boolean;finishedAt?:string};
export type WorkoutSetResult={round:number;repetitions?:number;targetRepetitions?:number;durationSeconds:number;targetDurationSeconds?:number;expectedDurationSeconds?:number;preparationSeconds?:number;completedAt:string};
export type WorkoutExerciseResult={exerciseId:string;name:string;measurement:"repetitions"|"duration";completedSets:number;targetSets:number;repetitions:number;durationSeconds:number;sets?:WorkoutSetResult[]};
export type WorkoutRestResult={exerciseId:string;exerciseName:string;kind:"round"|"exercise";round?:number;expectedSeconds:number;actualSeconds:number;startedAt:string;endedAt:string};
export type WorkoutTimingSummary={performanceSeconds:number;restSeconds:number;waitingSeconds:number;preparationSeconds:number;pausedSeconds:number;elapsedSeconds:number;expectedSeconds:number|null;rests:WorkoutRestResult[]};
export type ProgressionStage={id:string;name:string;sets:number;targets:number[];completedAt?:string;evidenceSessionIds?:string[]};
export type ProgressionLevel={id:string;name:string;stages:ProgressionStage[]};
export type ExerciseProgressionPath={exerciseId:string;exerciseName:string;measurement:"repetitions"|"duration";levels:ProgressionLevel[];currentLevelId:string;currentStageId:string;qualifyingSessionIds:string[];processedSessionIds:string[];pendingPromotion?:{levelId:string;stageId:string;sessionIds:string[];createdAt:string};lastAdvancedAt?:string};
export type WorkoutProgressionPlan={version:1;name:string;mode:"ready"|"custom";fitnessLevel:"beginner"|"intermediate"|"advanced";goal:string;requiredConsecutiveSessions:number;requireAllSets:boolean;requireSameLevel:boolean;requireConfirmation:boolean;createdAt:string;updatedAt:string;paths:ExerciseProgressionPath[]};
export type PrayerStatus="very-early"|"early"|"late"|"very-late"|"home"|"makeup";
export type ExecutionRecord={id?:string;activityId?:string;activity:string;minutes:number;durationSeconds?:number;restDurationSeconds?:number;quantity?:number;targetQuantity?:number;quantityUnit?:string;activityKind?:"quantity"|"time"|"single";completedAt:string;status?:"completed"|"missed";dueKey?:string;goalProgressValue?:number;sessionId?:string;rounds?:TimedRound[];exerciseResults?:WorkoutExerciseResult[];workoutTiming?:WorkoutTimingSummary;prayerName?:"الفجر"|"الظهر"|"العصر"|"المغرب"|"العشاء";prayerStatus?:PrayerStatus};
const key="sair.executionLog.v1";
const calendarKey="sair.calendar.v1";
const journeyFilterKey="sair.journeyFilter.v1";
const weekStartsOnKey="sair.weekStartsOn.v1";
export type WeekStartsOn="saturday"|"sunday";
export function readWeekStartsOn():WeekStartsOn{return localStorage.getItem(weekStartsOnKey)==="sunday"?"sunday":"saturday"}
export function saveWeekStartsOn(value:WeekStartsOn){localStorage.setItem(weekStartsOnKey,value);notifyChange()}
const notifyChange=()=>{if(typeof window!=="undefined")window.dispatchEvent(new Event("sair-local-change"))};
const normalizeCalisthenicsLabel=(value:string)=>value.replaceAll("كاليستنكس","كاليسثنكس");
export function readExecutionLog():ExecutionRecord[]{try{return(JSON.parse(localStorage.getItem(key)||"[]") as ExecutionRecord[]).map(record=>({...record,activity:normalizeCalisthenicsLabel(record.activity)}))}catch{return[]}}
export function saveExecution(record:ExecutionRecord){const records=readExecutionLog(),next=record.id?[record,...records.filter(item=>item.id!==record.id)].slice(0,500):[record,...records].slice(0,500);localStorage.setItem(key,JSON.stringify(next));notifyChange();return next.length}

export type WorkoutSchedule={days:string[];timeMode:"time"|"station";time?:string;station?:string};
export type WorkoutSessionSettings={startMode:"manual"|"automatic";roundStartMode?:"manual"|"automatic";exerciseStartMode?:"manual"|"automatic";preparationSeconds:number;sound:boolean;vibration:boolean;motion:"normal"|"reduced"};
export type PlannedActivity={
 id:string;name:string;template:string;period:string;goal:string;expectedMinutes:number;createdAt?:string;updatedAt?:string;archivedAt?:string;sortOrder?:number;
 nature?:TrackingNature;schedule:Schedule;
 quantity?:number;unit?:string;measurements:string[];startTime?:string;endTime?:string;
 activityKind?:string;trackingMode?:"time"|"distance";workoutStartMode?:"manual"|"automatic";
 workoutSchedule?:WorkoutSchedule;workoutSessionSettings?:WorkoutSessionSettings;workoutEnabled?:boolean;workoutColor?:string;workoutIcon?:string;
 exercises?:WorkoutExercise[];progressionPlan?:WorkoutProgressionPlan;goalDefinition?:GoalDefinition;supportingPlan?:SupportingPlan;
 parentGoalId?:string;linkedCommitmentId?:string;reminder?:Reminder;unitTracking?:UnitTracking;prayerEnabled?:boolean;
};
export type Reminder={mode:"none"|"time"|"station"|"before";value?:string|number};
export type WorkoutExercise={id:string;name:string;category:"دفع"|"سحب"|"أرجل"|"جذع";measurement:"repetitions"|"duration";sets:number;reps?:number;repetitionTargets?:number[];durationSeconds?:number;durationTargets?:number[];expectedDurationSeconds?:number;restSeconds:number;restAfterSeconds?:number};
const planKey="sair.plan.v1";
export const PRAYER_ACTIVITY_ID="sair-prayer-tracker";
const prayerWeekDays=["السبت","الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة"];
const normalize=(item:PlannedActivity):PlannedActivity=>({...item,name:normalizeCalisthenicsLabel(item.name),nature:item.nature??"commitment",schedule:{...item.schedule,days:item.schedule.days??[]}});
export function readPlan():PlannedActivity[]{
 try{
  const raw=JSON.parse(localStorage.getItem(planKey)||"[]") as PlannedActivity[],plan=raw.map(normalize),prayers=plan.filter(item=>item.template==="صلاة");
  if(!prayers.length)return plan;
  const source=prayers.find(item=>item.id===PRAYER_ACTIVITY_ID)??prayers[0],aliases=new Set(prayers.map(item=>item.id));
  const prayer=normalize({...source,id:PRAYER_ACTIVITY_ID,name:"الصلاة",nature:"commitment",period:"الصباح",goal:"",expectedMinutes:0,schedule:{mode:"daily",value:"الصلوات الخمس",days:prayerWeekDays},quantity:5,unit:"صلوات",measurements:["حالة الصلاة"],unitTracking:undefined,goalDefinition:undefined,supportingPlan:undefined,prayerEnabled:source.prayerEnabled!==false});
  const next=[...plan.filter(item=>item.template!=="صلاة"),prayer];
  const changed=prayers.length!==1||JSON.stringify(prayers[0])!==JSON.stringify(prayer);
  if(changed){
   localStorage.setItem(planKey,JSON.stringify(next));
   try{
    const records=JSON.parse(localStorage.getItem("sair.executionLog.v1")||"[]") as ExecutionRecord[];
    const migrated=records.map(record=>record.activityId&&aliases.has(record.activityId)?{...record,activityId:PRAYER_ACTIVITY_ID,activity:"الصلاة"}:record);
    const seen=new Set<string>(),deduped=migrated.filter(record=>{if(record.prayerName&&record.dueKey&&record.activityId===PRAYER_ACTIVITY_ID){const key=`${record.dueKey}:${record.prayerName}`;if(seen.has(key))return false;seen.add(key)}return true});
    if(JSON.stringify(deduped)!==JSON.stringify(records))localStorage.setItem("sair.executionLog.v1",JSON.stringify(deduped));
   }catch{}
   notifyChange();
  }
  return next;
 }catch{return[]}
}
export function savePlan(activity:PlannedActivity){const plan=readPlan(),now=new Date().toISOString(),nextOrder=plan.reduce((max,item,index)=>Math.max(max,item.sortOrder??index),-1)+1;if(activity.template==="صلاة"){const prayer=normalize({...activity,id:PRAYER_ACTIVITY_ID,name:"الصلاة",nature:"commitment",period:"الصباح",goal:"",expectedMinutes:0,schedule:{mode:"daily",value:"الصلوات الخمس",days:prayerWeekDays},quantity:5,unit:"صلوات",measurements:["حالة الصلاة"],unitTracking:undefined,goalDefinition:undefined,supportingPlan:undefined,prayerEnabled:true,createdAt:plan.find(item=>item.template==="صلاة")?.createdAt??activity.createdAt??now,updatedAt:now}),next=[...plan.filter(item=>item.template!=="صلاة"),prayer];localStorage.setItem(planKey,JSON.stringify(next));notifyChange();return next}const next=[...plan,normalize({...activity,sortOrder:activity.sortOrder??nextOrder,createdAt:activity.createdAt??now,updatedAt:now})];localStorage.setItem(planKey,JSON.stringify(next));notifyChange();return next}
export function updatePlan(activity:PlannedActivity){const next=readPlan().map(item=>item.id===activity.id?normalize({...activity,sortOrder:activity.sortOrder??item.sortOrder,createdAt:activity.createdAt??item.createdAt,updatedAt:new Date().toISOString()}):item);localStorage.setItem(planKey,JSON.stringify(next));notifyChange();return next}
export function savePlanOrder(ids:string[]){const order=new Map(ids.map((id,index)=>[id,index]));const next=readPlan().map((item,index)=>({...item,sortOrder:order.get(item.id)??item.sortOrder??ids.length+index}));localStorage.setItem(planKey,JSON.stringify(next));notifyChange();return next}
export function deletePlan(id:string){const next=readPlan().filter(item=>item.id!==id);localStorage.setItem(planKey,JSON.stringify(next));notifyChange();return next}
export function deleteActivityAndHistory(id:string){const plan=readPlan(),activity=plan.find(item=>item.id===id),relatedIds=new Set([id,...(activity?.linkedCommitmentId?[activity.linkedCommitmentId]:[]),...(activity?.parentGoalId?[activity.parentGoalId]:[])]);localStorage.setItem(planKey,JSON.stringify(plan.filter(item=>!relatedIds.has(item.id))));localStorage.setItem(key,JSON.stringify(readExecutionLog().filter(record=>!record.activityId||!relatedIds.has(record.activityId))));localStorage.setItem(unitProgressKey,JSON.stringify(readUnitProgress().filter(progress=>!relatedIds.has(progress.activityId))));notifyChange();return Array.from(relatedIds)}

export type CounterEvent={id:string;periodId:string;delta:number;createdAt:string};
export type UnitProgress={activityId:string;date:string;counterByPeriod:Record<string,number>;counterEvents?:CounterEvent[];completedUnitsByPeriod:Record<string,number[]>;targetByPeriod?:Record<string,number>;timedSessions?:TimedSession[];activeSessionId?:string;updatedAt:string;completedAt?:string};
export function normalizeUnitProgress(value:unknown):UnitProgress[]{
 if(!Array.isArray(value))return[];
 return value.filter((item):item is Record<string,unknown>=>Boolean(item&&typeof item==="object"&&!Array.isArray(item))).map(item=>{
  const counters=item.counterByPeriod&&typeof item.counterByPeriod==="object"&&!Array.isArray(item.counterByPeriod)?item.counterByPeriod as Record<string,number>:{};
  const completed=item.completedUnitsByPeriod&&typeof item.completedUnitsByPeriod==="object"&&!Array.isArray(item.completedUnitsByPeriod)?item.completedUnitsByPeriod as Record<string,unknown>:{};
  const completedUnitsByPeriod=Object.fromEntries(Object.entries(completed).map(([id,units])=>[id,Array.isArray(units)?units.filter((unit):unit is number=>Number.isInteger(unit)&&unit>=0):[]]));
  const timedSessions=Array.isArray(item.timedSessions)?item.timedSessions.filter((session):session is Record<string,unknown>=>Boolean(session&&typeof session==="object"&&!Array.isArray(session))).map(session=>({...session,rounds:Array.isArray(session.rounds)?session.rounds:[]})) as unknown as TimedSession[]:[];
  return{...item,counterByPeriod:counters,counterEvents:Array.isArray(item.counterEvents)?item.counterEvents:[],completedUnitsByPeriod,targetByPeriod:item.targetByPeriod&&typeof item.targetByPeriod==="object"&&!Array.isArray(item.targetByPeriod)?item.targetByPeriod as Record<string,number>:undefined,timedSessions} as UnitProgress;
 }).filter(item=>typeof item.activityId==="string"&&typeof item.date==="string");
}
export function counterValue(progress:UnitProgress|undefined,periodId:string){if(!progress)return 0;const base=progress.counterByPeriod?.[periodId]??0;const changes=(progress.counterEvents??[]).filter(event=>event.periodId===periodId).reduce((sum,event)=>sum+event.delta,0);return Math.max(0,base+changes)}
export function setCounterValue(progress:UnitProgress,periodId:string,value:number,minimumBase=0):UnitProgress{const base=Math.max(progress.counterByPeriod[periodId]??0,minimumBase),current=Math.max(0,base+(progress.counterEvents??[]).filter(event=>event.periodId===periodId).reduce((sum,event)=>sum+event.delta,0)),delta=Math.max(0,value)-current;if(!delta)return{...progress,counterByPeriod:{...progress.counterByPeriod,[periodId]:base}};const id=globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`;return{...progress,counterByPeriod:{...progress.counterByPeriod,[periodId]:base},counterEvents:[...(progress.counterEvents??[]),{id,periodId,delta,createdAt:new Date().toISOString()}]}}
const unitProgressKey="sair.unitProgress.v1";
export function readUnitProgress():UnitProgress[]{try{return normalizeUnitProgress(JSON.parse(localStorage.getItem(unitProgressKey)||"[]"))}catch{return[]}}
export function saveUnitProgress(progress:UnitProgress,notify=true){const all=readUnitProgress(),next=[progress,...all.filter(item=>!(item.activityId===progress.activityId&&item.date===progress.date))].slice(0,400);localStorage.setItem(unitProgressKey,JSON.stringify(next));if(notify)notifyChange();return next}

export type CalendarRecordKind="appointment"|"occasion"|"event"|"memory";
export type CalendarCategory={id:string;name:string;createdAt?:string};
export type CalendarOriginalDate={calendar:"gregory"|"islamic";year:number;month:number;day:number};
export type Appointment={id:string;title:string;date:string;time:string;alertMinutes?:number;updatedAt?:string;archivedAt?:string;kind?:CalendarRecordKind;customCategoryId?:string;endDate?:string;calendar?:"gregory"|"islamic";originalDate?:CalendarOriginalDate;yearly?:boolean;repeat?:"none"|"daily"|"weekly"|"monthly"|"yearly";alerts?:number[];location?:string;notes?:string;person?:string;taskId?:string;timeEnabled?:boolean;endTime?:string};
const appointmentKey="sair.appointments.v1";
export function readAppointments():Appointment[]{try{return JSON.parse(localStorage.getItem(appointmentKey)||"[]")}catch{return[]}}
export function saveAppointment(item:Appointment){const next=[...readAppointments(),{...item,updatedAt:new Date().toISOString()}];localStorage.setItem(appointmentKey,JSON.stringify(next));notifyChange();return next}
export function updateAppointment(item:Appointment){const next=readAppointments().map(value=>value.id===item.id?{...item,updatedAt:new Date().toISOString()}:value);localStorage.setItem(appointmentKey,JSON.stringify(next));notifyChange();return next}
export function deleteAppointment(id:string){const next=readAppointments().filter(item=>item.id!==id);localStorage.setItem(appointmentKey,JSON.stringify(next));notifyChange();return next}

export type TaskItem={id:string;title:string;date?:string;time?:string;urgent?:boolean;categoryId?:string;completedAt?:string;archivedAt?:string;reminder?:Reminder;updatedAt?:string};
const taskKey="sair.tasks.v1";
export function readTasks():TaskItem[]{try{return JSON.parse(localStorage.getItem(taskKey)||"[]")}catch{return[]}}
export function saveTask(item:TaskItem){const next=[...readTasks(),{...item,updatedAt:new Date().toISOString()}];localStorage.setItem(taskKey,JSON.stringify(next));notifyChange();return next}
export function updateTask(item:TaskItem){const next=readTasks().map(value=>value.id===item.id?{...item,updatedAt:new Date().toISOString()}:value);localStorage.setItem(taskKey,JSON.stringify(next));notifyChange();return next}
export function deleteTask(id:string){const next=readTasks().filter(item=>item.id!==id);localStorage.setItem(taskKey,JSON.stringify(next));notifyChange();return next}

const calendarCategoriesKey="sair.calendarCategories.v1";
export function readCalendarCategories():CalendarCategory[]{try{const value=JSON.parse(localStorage.getItem(calendarCategoriesKey)||"[]");return Array.isArray(value)?value.filter(item=>item&&typeof item.id==="string"&&typeof item.name==="string"):[]}catch{return[]}}
export function saveCalendarCategory(category:CalendarCategory){const categories=readCalendarCategories(),next=categories.some(item=>item.id===category.id)?categories.map(item=>item.id===category.id?category:item):[...categories,category];localStorage.setItem(calendarCategoriesKey,JSON.stringify(next));notifyChange();return next}
export type LocalSnapshot={version:1;plan:PlannedActivity[];tasks:TaskItem[];appointments:Appointment[];executionLog:ExecutionRecord[];unitProgress:UnitProgress[];preferences:{calendarMode:string|null;journeyFilter:string|null;weekStartsOn?:WeekStartsOn|null;calendarCategories?:CalendarCategory[]}};
export function readLocalSnapshot():LocalSnapshot{return{version:1,plan:readPlan(),tasks:readTasks(),appointments:readAppointments(),executionLog:readExecutionLog(),unitProgress:readUnitProgress(),preferences:{calendarMode:localStorage.getItem(calendarKey),journeyFilter:localStorage.getItem(journeyFilterKey),weekStartsOn:localStorage.getItem(weekStartsOnKey)==="sunday"?"sunday":localStorage.getItem(weekStartsOnKey)==="saturday"?"saturday":null,calendarCategories:readCalendarCategories()}}}
export function replaceLocalSnapshot(snapshot:LocalSnapshot){localStorage.setItem(planKey,JSON.stringify(snapshot.plan??[]));localStorage.setItem(taskKey,JSON.stringify(snapshot.tasks??[]));localStorage.setItem(appointmentKey,JSON.stringify(snapshot.appointments??[]));localStorage.setItem(key,JSON.stringify(snapshot.executionLog??[]));localStorage.setItem(unitProgressKey,JSON.stringify(normalizeUnitProgress(snapshot.unitProgress)));localStorage.setItem(calendarCategoriesKey,JSON.stringify(snapshot.preferences?.calendarCategories??[]));for(const [key,value] of [[calendarKey,snapshot.preferences?.calendarMode],[journeyFilterKey,snapshot.preferences?.journeyFilter],[weekStartsOnKey,snapshot.preferences?.weekStartsOn]] as const){if(value)localStorage.setItem(key,value);else localStorage.removeItem(key)}if(typeof window!=="undefined")window.dispatchEvent(new Event("sair-cloud-state"))}
