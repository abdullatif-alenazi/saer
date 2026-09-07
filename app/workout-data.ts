import type { WorkoutExercise } from "./local-store";

export const calisthenicsCatalog:WorkoutExercise[]=[
 {id:"push-up",name:"ضغط",category:"دفع",measurement:"repetitions",sets:3,reps:10,restSeconds:60},
 {id:"incline-push-up",name:"ضغط مائل",category:"دفع",measurement:"repetitions",sets:3,reps:12,restSeconds:45},
 {id:"dips",name:"متوازي",category:"دفع",measurement:"repetitions",sets:3,reps:8,restSeconds:75},
 {id:"pike-push-up",name:"ضغط بايك",category:"دفع",measurement:"repetitions",sets:3,reps:8,restSeconds:60},
 {id:"pull-up",name:"عقلة",category:"سحب",measurement:"repetitions",sets:3,reps:6,restSeconds:90},
 {id:"chin-up",name:"عقلة معكوسة",category:"سحب",measurement:"repetitions",sets:3,reps:6,restSeconds:90},
 {id:"australian-row",name:"سحب أسترالي",category:"سحب",measurement:"repetitions",sets:3,reps:10,restSeconds:60},
 {id:"squat",name:"سكوات",category:"أرجل",measurement:"repetitions",sets:3,reps:12,restSeconds:60},
 {id:"lunge",name:"لانجز",category:"أرجل",measurement:"repetitions",sets:3,reps:10,restSeconds:60},
 {id:"glute-bridge",name:"جسر الحوض",category:"أرجل",measurement:"repetitions",sets:3,reps:15,restSeconds:45},
 {id:"calf-raise",name:"رفع السمانة",category:"أرجل",measurement:"repetitions",sets:3,reps:15,restSeconds:45},
 {id:"plank",name:"بلانك",category:"جذع",measurement:"duration",sets:3,durationSeconds:45,restSeconds:60},
 {id:"leg-raise",name:"رفع الأرجل",category:"جذع",measurement:"repetitions",sets:3,reps:10,restSeconds:60},
 {id:"hollow-hold",name:"هولو هولد",category:"جذع",measurement:"duration",sets:3,durationSeconds:30,restSeconds:45},
];
