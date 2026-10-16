import{makePath,pointAt,anchorStops}from './motion.mjs';
// Hand-authored geographic sketches for simulation, NOT official bus routes or stops.
const definitions=[
 {id:'demo-a',name:'A',label:'서현 → 야탑',color:'#1769e0',points:[[127.1235,37.3852],[127.1227,37.3884],[127.1222,37.3925],[127.1252,37.3951],[127.1278,37.3993],[127.1272,37.4045],[127.1265,37.4095],[127.1272,37.4146]],names:['서현역 일대','이매촌 일대','이매역 일대','성남아트센터 일대','야탑역 일대']},
 {id:'demo-b',name:'B',label:'정자 → 서현',color:'#009978',points:[[127.108,37.3655],[127.1089,37.3701],[127.1111,37.3742],[127.112,37.3777],[127.116,37.3796],[127.12,37.3815],[127.1235,37.3852]],names:['정자역 일대','정자동 일대','수내역 일대','분당구청 일대','서현역 일대']},
 {id:'demo-c',name:'C',label:'판교 → 이매',color:'#ad59d5',points:[[127.1114,37.3951],[127.1128,37.3987],[127.116,37.3985],[127.12,37.3984],[127.1241,37.3985],[127.1278,37.3993]],names:['판교역 일대','백현동 일대','삼평동 일대','이매역 일대']}
];
export const demoRoutes=definitions.map(d=>{const path=makePath(d.points);const stops=d.names.map((name,i)=>({id:d.id+'-'+i,seq:i+1,name,coordinates:pointAt(path,path.total*i/(d.names.length-1))}));return {...d,source:'simulation',stops:anchorStops(d.points,stops),path};});
export function demoFeed(elapsed,now){return demoRoutes.flatMap((r,j)=>[0,1].map(i=>{const cycle=r.path.total+220,meters=Math.max(0,((elapsed*(6.3+j*.7)+i*r.path.total*.45+j*130)%cycle)-110);return {id:r.id+'-v'+i,routeId:r.id,label:'시연 '+(j*2+i+1).toString().padStart(2,'0'),meters:Math.min(meters,r.path.total),time:now,stateCd:meters===0?1:2};}));}
