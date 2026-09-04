export type PrayerTimes={fajr:number;dhuhr:number;asr:number;maghrib:number;isha:number};
export type TimeWindow={index:number;startMinute:number;endMinute:number;remainingMinutes:number;nextName:string;times:PrayerTimes};
const latitude=24.7136,longitude=46.6753,timezone=3;
const rad=(value:number)=>value*Math.PI/180;
const deg=(value:number)=>value*180/Math.PI;
const normHours=(value:number)=>((value%24)+24)%24;
const normDegrees=(value:number)=>((value%360)+360)%360;
const arabicDigits=(value:number)=>String(value).replace(/\d/g,d=>"٠١٢٣٤٥٦٧٨٩"[Number(d)]);

function julianDay(date:Date){const month=date.getMonth()+1,day=date.getDate();let year=date.getFullYear(),adjustedMonth=month;if(month<=2){year-=1;adjustedMonth+=12}const a=Math.floor(year/100),b=2-a+Math.floor(a/4);return Math.floor(365.25*(year+4716))+Math.floor(30.6001*(adjustedMonth+1))+day+b-1524.5}
function sunPosition(julian:number){const d=julian-2451545,g=normDegrees(357.529+.98560028*d),q=normDegrees(280.459+.98564736*d),l=normDegrees(q+1.915*Math.sin(rad(g))+.02*Math.sin(rad(2*g))),e=23.439-.00000036*d;const rightAscension=normHours(deg(Math.atan2(Math.cos(rad(e))*Math.sin(rad(l)),Math.cos(rad(l))))/15),declination=deg(Math.asin(Math.sin(rad(e))*Math.sin(rad(l))));return{declination,equation:q/15-rightAscension}}
function timeForAngle(noon:number,angle:number,date:Date,direction:number){const{declination}=sunPosition(julianDay(date)),numerator=-Math.sin(rad(angle))-Math.sin(rad(declination))*Math.sin(rad(latitude)),denominator=Math.cos(rad(declination))*Math.cos(rad(latitude)),hourAngle=deg(Math.acos(Math.max(-1,Math.min(1,numerator/denominator))))/15;return noon+direction*hourAngle}
function asrTime(noon:number,date:Date){const{declination}=sunPosition(julianDay(date)),angle=-deg(Math.atan(1/(1+Math.tan(Math.abs(rad(latitude-declination))))));return timeForAngle(noon,angle,date,1)}
const toMinutes=(hours:number)=>Math.round(normHours(hours)*60);

export function getRiyadhPrayerTimes(date:Date):PrayerTimes{const{equation}=sunPosition(julianDay(date)),noon=normHours(12+timezone-longitude/15-equation),maghrib=timeForAngle(noon,.833,date,1);return{fajr:toMinutes(timeForAngle(noon,18.5,date,-1)),dhuhr:toMinutes(noon+2/60),asr:toMinutes(asrTime(noon,date)),maghrib:toMinutes(maghrib),isha:toMinutes(maghrib+1.5)}}
export function minuteOfDay(date:Date){return date.getHours()*60+date.getMinutes()}
export function resolveTimeWindow(date:Date):TimeWindow{const times=getRiyadhPrayerTimes(date),starts=[times.fajr,times.dhuhr,times.asr,times.maghrib,times.isha],names=["الظهر","العصر","المغرب","الليل","الفجر"];const minute=minuteOfDay(date);let index=4;if(minute>=starts[0]&&minute<starts[1])index=0;else if(minute>=starts[1]&&minute<starts[2])index=1;else if(minute>=starts[2]&&minute<starts[3])index=2;else if(minute>=starts[3]&&minute<starts[4])index=3;const startMinute=starts[index],endMinute=index===4?(minute<starts[0]?starts[0]:starts[0]+1440):starts[index+1],normalized=index===4&&minute<starts[0]?minute+1440:minute;return{index,startMinute,endMinute,remainingMinutes:Math.max(0,endMinute-normalized),nextName:names[index],times}}
export function durationLabel(minutes:number){const safe=Math.max(0,Math.ceil(minutes)),hours=Math.floor(safe/60),rest=safe%60;if(hours&&rest)return`${arabicDigits(hours)}س ${arabicDigits(rest)}د`;if(hours)return`${arabicDigits(hours)}س`;return`${arabicDigits(rest)}د`}
export function minuteClockLabel(minutes:number){const normalized=((minutes%1440)+1440)%1440,hour24=Math.floor(normalized/60),minute=normalized%60,hour12=hour24%12||12,period=hour24<12?"ص":"م";return`${arabicDigits(hour12)}:${arabicDigits(minute).padStart(2,"٠")} ${period}`}
export function clockLabel(date:Date){return minuteClockLabel(minuteOfDay(date))}
export function fitsWindow(expectedMinutes:number,remainingMinutes:number){return expectedMinutes<=remainingMinutes}
