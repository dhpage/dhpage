import{positionSignature,vehicleKey}from './gbis.mjs';
export const percentile=(values,p)=>{if(!values.length)return null;const a=[...values].sort((x,y)=>x-y);return a[Math.max(0,Math.ceil(p*a.length)-1)];};
export class Observer{
 constructor(){this.seen=new Map();this.intervals=[];this.bounds=[];this.duplicate=0;this.comparisons=0;this.changes=0;this.latencies=[];this.requests=0;this.errors=0;this.fields=new Set();}
 failure(){this.requests++;this.errors++;this.seen.clear();}
 observe(sample){this.requests++;this.latencies.push(sample.latencyMs);sample.fields.forEach(x=>this.fields.add(x));const next=new Map(),started=sample.startedMonoMs??sample.startedAt,completed=sample.completedMonoMs??sample.completedAt;
  for(const row of sample.rows){const key=vehicleKey(row);if(!key)continue;const sig=positionSignature(row),old=this.seen.get(key);let changed=old?.changed??null;
   if(old){this.comparisons++;if(old.sig===sig)this.duplicate++;else{this.changes++;const bracket=[old.start,completed];if(changed){this.intervals.push(completed-changed[1]);this.bounds.push({minMs:Math.max(0,bracket[0]-changed[1]),maxMs:bracket[1]-changed[0]});}changed=bracket;}}
   next.set(key,{sig,start:started,end:completed,changed});}
  this.seen=next;
 }
 report(){return {measurement:'관측된 차량별 위치상태 변경 간격 (GPS 갱신 주기 아님)',requests:this.requests,errors:this.errors,changes:this.changes,intervalSamples:this.intervals.length,observedFields:[...this.fields].sort(),duplicateRatio:this.comparisons?this.duplicate/this.comparisons:null,intervalMs:{p50:percentile(this.intervals,.5),p90:percentile(this.intervals,.9),p95:percentile(this.intervals,.95)},latencyMs:{p50:percentile(this.latencies,.5),p95:percentile(this.latencies,.95)},intervalBounds:this.bounds,limitations:['원천시각·GPS 좌표가 없어 원천 갱신 주기와 실제 위치 정확도는 측정 불가','폴링 사이 변경 누락 및 정차·중복 상태로 인한 관측 편향 가능','변경 구간 경계는 각 응답이 요청~완료 사이의 현재 상태라는 가정이며 원천 캐시 지연을 포함하지 않음']};}
}
