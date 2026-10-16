import http from 'node:http';
import{readFile,stat}from 'node:fs/promises';
import{readFileSync,writeFileSync,mkdirSync}from 'node:fs';
import path from 'node:path';
import{fileURLToPath}from 'node:url';
import{makeClient,validCoord,vehicleKey}from './lib/gbis.mjs';
import{anchorStops}from './dist/motion.mjs';
import{MAX_ACTIVE_ROUTES,pollInterval,selectRouteIds,createCache}from './lib/route-selection.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),publicRoot=path.join(root,'dist'),local=path.join(root,'.local');mkdirSync(local,{recursive:true});
const catalog=JSON.parse(await readFile(new URL('./data/routes.json',import.meta.url),'utf8'));
let coverage={};try{coverage=JSON.parse(await readFile(new URL('./data/catalog-coverage.json',import.meta.url),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const routeNames=new Map(catalog.map(r=>[r.id,r.name]));
const bundangStopIds=new Set(JSON.parse(await readFile(new URL('./data/bundang-stops.json',import.meta.url),'utf8')).map(s=>s.id));
const budget=Number(process.env.GBIS_DAILY_BUDGET??1000);
if(!Number.isSafeInteger(budget)||budget<1)throw new Error('GBIS_DAILY_BUDGET은 승인 한도 이하의 양의 정수여야 합니다.');
const configuredIds=(process.env.GBIS_ROUTE_IDS||'').split(',').filter(id=>routeNames.has(id));
const defaults=[...new Set(configuredIds.length?configuredIds:catalog.slice(0,1).map(r=>r.id))].slice(0,MAX_ACTIVE_ROUTES),cached=createCache();
const palette=['#1769e0','#009978','#ad59d5'];
let quota={};try{quota=JSON.parse(readFileSync(path.join(local,'quota.json'),'utf8'));}catch{}
const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
function spend(){const day=today();if(quota.day!==day)quota={day,count:0};if(quota.count>=budget){const e=new Error('설정한 오늘의 호출 예산을 사용했습니다.');e.code='BUDGET';e.status=429;throw e;}quota.count++;writeFileSync(path.join(local,'quota.json'),JSON.stringify(quota));}
const client=process.env.GBIS_SERVICE_KEY?makeClient(process.env.GBIS_SERVICE_KEY,{onRequest:spend}):null;
async function route(id){return cached('route:'+id,86400000,async()=>{
 const [s,l]=await Promise.all([client('stops',{routeId:id}),client('shape',{routeId:id})]);
 const points=l.rows.sort((a,b)=>Number(a.lineSeq)-Number(b.lineSeq)).filter(v=>validCoord(v.x,v.y)).map(v=>[+v.x,+v.y]);
 if(points.length<2)throw new Error(routeNames.get(id)+'번의 사용 가능한 공식 노선 형상이 없습니다.');
 const stops=anchorStops(points,s.rows.filter(v=>validCoord(v.x,v.y)).sort((a,b)=>+a.stationSeq-+b.stationSeq).map(v=>({id:String(v.stationId),seq:+v.stationSeq,name:v.stationName,inBundang:bundangStopIds.has(String(v.stationId)),coordinates:[+v.x,+v.y]})));
 const name=routeNames.get(id)||id;return {id,name,label:'공식 노선 '+name,source:'gbis',points,stops};
});}
async function locations(id,ttl){return cached('live:'+id,ttl,async()=>{
 const result=await client('locations',{routeId:id});
 return {routeId:id,observedAt:result.completedAt,queryTime:result.queryTime,fields:result.fields,rows:result.rows.filter(v=>vehicleKey(v)).map(v=>({id:id+':'+vehicleKey(v),routeId:id,label:String(v.plateNo||v.vehId),stationId:String(v.stationId),stationSeq:+v.stationSeq,stateCd:+v.stateCd}))};
});}
function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');if(req.method!=='GET')return json(res,{error:'GET only'},405);
 if(url.pathname==='/api/status')return json(res,{keyConfigured:!!client,ready:!!client&&catalog.length>0,routeIds:defaults,pollMs:pollInterval(defaults.length,budget),budget,callsToday:quota.day===today()?quota.count||0:0,maxActiveRoutes:MAX_ACTIVE_ROUTES,availableRouteCount:catalog.length});
 if(url.pathname==='/api/catalog')return json(res,{routes:catalog,maxActiveRoutes:MAX_ACTIVE_ROUTES,coverage});
 if(url.pathname.startsWith('/api/')){
  if(!client||!catalog.length)return json(res,{error:'인증키와 확인한 노선 목록을 설정하세요.',code:'SETUP_REQUIRED'},503);
  if(!['/api/routes','/api/live'].includes(url.pathname))return json(res,{error:'알 수 없는 API'},404);
  const ids=selectRouteIds(url.searchParams.get('ids'),defaults,catalog),pollMs=pollInterval(ids.length,budget);
  if(url.pathname==='/api/routes')return json(res,await Promise.all(ids.map(async(id,i)=>({...await route(id),color:palette[i]}))));
  return json(res,{values:await Promise.all(ids.map(id=>locations(id,pollMs))),pollMs,receivedAt:Date.now()});
 }
 const rel=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),file=path.resolve(publicRoot,'.'+rel);
 if(!file.startsWith(publicRoot+path.sep))return json(res,{error:'Not found'},404);
 try{if(!(await stat(file)).isFile())throw new Error();const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});res.end(body);}catch{return json(res,{error:'Not found'},404);}
}catch(e){json(res,{error:e.message,code:e.code||'ERROR'},e.status||502);}}).listen(Number(process.env.PORT)||4317,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+(Number(process.env.PORT)||4317)));
