export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function distance(a,b){const r=Math.PI/180,dy=(b[1]-a[1])*111195,dx=(b[0]-a[0])*111195*Math.cos((a[1]+b[1])*r/2);return Math.hypot(dx,dy);}
export function makePath(points){let total=0;const cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(total+=distance(points[i-1],points[i]));return {points,cumulative,total};}
export function pointAt(path,meters){const d=clamp(meters,0,path.total);let i=1;while(i<path.cumulative.length-1&&path.cumulative[i]<d)i++;const a=path.points[i-1],b=path.points[i]||a,t=(d-path.cumulative[i-1])/(path.cumulative[i]-path.cumulative[i-1]||1);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
export function project(path,p,min=0){let best={distance:Infinity,meters:min};for(let i=1;i<path.points.length;i++){if(path.cumulative[i]<min)continue;const a=path.points[i-1],b=path.points[i],k=Math.cos(p[1]*Math.PI/180),dx=(b[0]-a[0])*k,dy=b[1]-a[1];let t=clamp(((p[0]-a[0])*k*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1),0,1);const seg=path.cumulative[i]-path.cumulative[i-1];t=Math.max(t,(min-path.cumulative[i-1])/(seg||1));if(t>1)continue;const q=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])],error=distance(q,p);if(error<best.distance)best={distance:error,meters:path.cumulative[i-1]+seg*t};}return best;}
export function anchorStops(points,stops){const path=makePath(points);let min=0;return stops.map(s=>{const p=project(path,s.coordinates,min);min=p.meters;return {...s,meters:p.meters,matchError:p.distance};});}
// Interpolate only between received anchors. Never extrapolate beyond a fresh observation.
export class MotionTrack{
 constructor(sample){this.from=sample.meters;this.to=sample.meters;this.started=sample.time;this.duration=0;this.last=sample;this.anchor=sample;this.lastChanged=sample.time;this.speed=null;this.reason='첫 관측';}
 at(now){const t=clamp((now-this.started)/(this.duration||1),0,1);return this.from+(this.to-this.from)*t;}
 ingest(sample){if(sample.time<=this.last.time)return;const delta=sample.meters-this.anchor.meters,dt=(sample.time-this.lastChanged)/1000;
  if(Math.abs(delta)<1){this.last={...sample};if(sample.time-this.lastChanged>90000){this.speed=null;this.reason='상태 변화 없음';}return;}
  const speed=delta/dt*3.6,valid=delta>0&&dt>0&&dt<600&&speed<=90;
  this.from=valid?this.at(sample.time):sample.meters;this.to=sample.meters;this.started=sample.time;this.duration=valid?Math.min(15000,Math.max(1000,(sample.time-this.last.time))):0;
  this.speed=valid?speed:null;this.reason=valid?'구간 평균 추정':'회차·위치 재설정';this.lastChanged=sample.time;this.last=sample;this.anchor=sample;
 }
}
