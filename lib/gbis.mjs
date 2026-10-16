export const BASE='https://apis.data.go.kr/6410000/';
export const operations={locations:['buslocationservice/v2/getBusLocationListv2','busLocationList'],routes:['busrouteservice/v2/getBusRouteListv2','busRouteList'],routeInfo:['busrouteservice/v2/getBusRouteInfoItemv2','busRouteInfoItem'],stops:['busrouteservice/v2/getBusRouteStationListv2','busRouteStationList'],shape:['busrouteservice/v2/getBusRouteLineListv2','busRouteLineList'],baseInfo:['baseinfoservice/v2/getBaseInfoItemv2','baseInfoItem']};
export class GbisError extends Error{constructor(message,code='UPSTREAM'){super(message);this.code=code;}}
export function decodeResponse(raw,field){let parsed;try{parsed=JSON.parse(raw);}catch{const code=raw.match(/<(?:returnReasonCode|resultCode)>([^<]+)</)?.[1]||'NON_JSON';throw new GbisError('GBIS가 JSON 대신 인증 오류 또는 다른 응답을 반환했습니다.',code);}
 const envelope=parsed.response||parsed,header=envelope.msgHeader||envelope.header;
 if(!header||header.resultCode===undefined)throw new GbisError('GBIS 응답 구조를 확인할 수 없습니다.','SCHEMA');
 const code=String(header.resultCode);if(code!=='0'&&code!=='00'&&code!=='4')throw new GbisError('GBIS 요청이 거절되었습니다. 활용 승인과 호출 한도를 확인하세요.',code);
 const v=envelope.msgBody?.[field];if(code!=='4'&&v===undefined)throw new GbisError('예상한 GBIS 목록 필드가 없습니다.','SCHEMA');
 const rows=v==null?[]:Array.isArray(v)?v:[v];return {rows,queryTime:header.queryTime??null,resultCode:code,fields:[...new Set(rows.flatMap(x=>Object.keys(x)))].sort()};
}
export function makeClient(key,{fetchFn=fetch,onRequest=()=>{}}={}){if(!key)throw new GbisError('GBIS_SERVICE_KEY가 설정되지 않았습니다.','NO_KEY');let decoded=key.trim();try{decoded=decodeURIComponent(decoded);}catch{}
 return async function(kind,params){const op=operations[kind];if(!op)throw new GbisError('지원하지 않는 작업','OPERATION');const url=new URL(BASE+op[0]);url.search=new URLSearchParams({...params,serviceKey:decoded,format:'json'}).toString();onRequest();const startedAt=Date.now(),startedMonoMs=performance.now();let response;
 try{response=await fetchFn(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});}catch{throw new GbisError('GBIS 연결이 지연되거나 실패했습니다.','NETWORK');}
 if(!response.ok)throw new GbisError('GBIS HTTP 오류',String(response.status));const text=await response.text();const completedAt=Date.now(),completedMonoMs=performance.now();return {...decodeResponse(text,op[1]),startedAt,completedAt,startedMonoMs,completedMonoMs,latencyMs:completedMonoMs-startedMonoMs};};}
export function positionSignature(v){return [v.stationId??null,v.stationSeq??null,v.stateCd??null].join('|');}
export function vehicleKey(v){return v.vehId?String(v.vehId):v.plateNo?String(v.plateNo):null;}
export function validCoord(x,y){return Number.isFinite(Number(x))&&Number.isFinite(Number(y))&&Number(x)>124&&Number(x)<132&&Number(y)>33&&Number(y)<40;}
