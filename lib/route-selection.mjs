export const MAX_ACTIVE_ROUTES=3;
export function pollInterval(count,budget){return Math.max(15000,Math.ceil(86400000*Math.max(1,count)/(budget*.9)));}
export function selectRouteIds(raw,defaults,catalog,max=MAX_ACTIVE_ROUTES){
 const ids=[...new Set((raw===null?defaults:String(raw).split(',')).map(String))];
 const allowed=new Set(catalog.map(r=>r.id));
 if(ids.length<1||ids.length>max||ids.some(id=>!/^\d{5,12}$/.test(id)||!allowed.has(id))){const e=new Error(`목록에서 1~${max}개 노선을 선택하세요.`);e.code='INVALID_ROUTES';e.status=400;throw e;}
 return ids;
}
export function createCache(){
 const values=new Map(),pending=new Map();
 return async function cached(key,ttl,fn){
  const previous=values.get(key);if(previous&&Date.now()-previous.time<ttl)return previous.value;
  if(pending.has(key))return pending.get(key);
  const job=fn().then(value=>{values.set(key,{time:Date.now(),value});return value;}).finally(()=>pending.delete(key));pending.set(key,job);return job;
 };
}
