export type Tab = "goals" | "commitments" | "now" | "tasks" | "appointments";
export type Activity = {
  id: string; name: string; type: string; period: string; schedule: { mode: "fixed" | "flexible"; value: string };
  goal: string; quantity?: number; unit?: string; expectedMinutes?: number; measurements: string[]; frequency: string;
  completionStates?: string[]; items?: { name: string; sets: number; reps: number }[];
  executionLog: { date: string; minutes?: number; quantity?: number; state?: string }[];
};
export const activities: Activity[] = [
  { id:"reading",name:"القراءة",type:"قراءة",period:"الصباح",schedule:{mode:"fixed",value:"يوميًا"},goal:"قراءة بهدوء",quantity:5,unit:"صفحات",expectedMinutes:15,measurements:["الوقت","الصفحات"],frequency:"يومي",executionLog:[{date:"اليوم",minutes:14,quantity:5}] },
  { id:"strength",name:"تمارين مقاومة",type:"رياضة",period:"العصر",schedule:{mode:"flexible",value:"٤ جلسات أسبوعيًا"},goal:"قوة ولياقة",expectedMinutes:35,measurements:["الوقت","الجلسات","التكرارات"],frequency:"٤ جلسات أسبوعيًا",items:[{name:"سكوات",sets:3,reps:12},{name:"ضغط",sets:4,reps:10},{name:"لانجز",sets:3,reps:12}],executionLog:[{date:"أمس",minutes:32,quantity:112}] },
  { id:"sleep",name:"النوم",type:"نوم",period:"قبل النوم",schedule:{mode:"fixed",value:"يوميًا"},goal:"٧ ساعات",expectedMinutes:420,measurements:["فترة بين وقتين"],frequency:"يومي",executionLog:[] },
  { id:"prayer",name:"الصلاة مع الجماعة",type:"صلاة",period:"اليوم",schedule:{mode:"fixed",value:"الصلوات الخمس"},goal:"الجماعة",measurements:["حالة الإنجاز"],frequency:"5 مرات يوميًا",completionStates:["مع الأذان","مع الإقامة","فاتتني ركعات","فاتتني الجماعة"],executionLog:[] },
];
export const dayJourney = [
  {period:"الصباح",time:"—",totalMinutes:22,tasks:[{name:"القراءة",meta:"٥ صفحات · ١٥ د",done:true},{name:"أذكار الصباح",meta:"٧ د",done:true}]},
  {period:"الظهر",time:"١٢:٠٠",totalMinutes:25,tasks:[{name:"الصلاة",meta:"تسجيل سريع",done:false},{name:"المشي",meta:"٢٠ د",done:false}]},
  {period:"العصر",time:"١٥:٣٠",totalMinutes:35,tasks:[{name:"تمارين المقاومة",meta:"٢٠ د",done:false},{name:"حفظ قرآن",meta:"٢.٥ ص · ١٥ د",done:false}]},
  {period:"المغرب",time:"—",totalMinutes:30,tasks:[{name:"المهارة",meta:"جلسة واحدة · ٢٠ د",done:false},{name:"قراءة خفيفة",meta:"١٠ د",done:false}]},
  {period:"الليل",time:"—",totalMinutes:435,tasks:[{name:"استعداد للنوم",meta:"١٥ د",done:false},{name:"النوم",meta:"٧ ساعات",done:false}]},
];
export const templates = ["رياضة","قراءة","نوم","صيام","عادة","مهارة","شيء آخر"];
export const settings = [
  {title:"يومي",note:"بداية يومك ونهايته"},{title:"أوقات النوم والاستيقاظ",note:"٢٣:٣٠ — ٠٦:٣٠"},{title:"فترات اليوم",note:"خمس فترات مرنة"},{title:"القياس والمؤقت",note:"مؤقت هادئ، دون ضغط"},{title:"أسلوب التذكير",note:"مختصر، عند الحاجة"},{title:"شخصية سائر",note:"ذكي وساخر بخفة"},{title:"الإعدادات",note:"اللغة والمظهر"},{title:"الحساب",note:"غير مفعّل في النموذج"},
];
