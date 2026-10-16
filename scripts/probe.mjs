import{mkdir,appendFile,writeFile}from 'node:fs/promises';
import{createHash,randomBytes}from 'node:crypto';
import{setTimeout as sleep}from 'node:timers/promises';
import{makeClient,vehicleKey}from '../lib/gbis.mjs';
import{Observer}from '../lib/observation.mjs';
const options=Object.fromEntries(process.argv.slice(2).map(v=>v.replace(/^--/,'').split('=')));
try{
 const routeId=options.route||process.env.GBIS_ROUTE_IDS?.split(',')[0];const interval=Number(options.interval??5000),duration=Number(options.duration??120),max=Number(options['max-requests']??60);
 if(!/^\d{5,12}$/.test(routeId||''))throw new Error('검증한 routeId를 --route=노선ID로 지정하세요.');
 if(!Number.isFinite(interval)||interval<1000||!Number.isFinite(duration)||duration<1||duration>3600||!Number.isInteger(max)||max<1||max>1000)throw new Error('간격은 1000ms 이상, 관측 시간은 1~3600초, 최대 요청은 1~1000회입니다.');
 const client=makeClient(process.env.GBIS_SERVICE_KEY),observer=new Observer(),salt=randomBytes(16).toString('hex');
 const dir=new URL('../measurements/'+new Date().toISOString().replace(/[:.]/g,'-')+'/',import.meta.url);await mkdir(dir,{recursive:true});
 const start=performance.now();console.log(`노선 ${routeId}, ${interval}ms 간격, 최대 ${max}회. GPS가 아닌 공개 위치상태를 관측합니다.`);
 for(let n=0;n<max&&performance.now()-start<duration*1000;n++){
  const begin=performance.now();let stop=false;try{const result=await client('locations',{routeId});observer.observe(result);const rows=result.rows.map(v=>({id:createHash('sha256').update(salt+(vehicleKey(v)||'unknown')).digest('hex').slice(0,12),stationId:v.stationId,stationSeq:v.stationSeq,stateCd:v.stateCd}));await appendFile(new URL('samples.jsonl',dir),JSON.stringify({...result,rows})+'\n');}
  catch(e){observer.failure();await appendFile(new URL('samples.jsonl',dir),JSON.stringify({completedAt:Date.now(),error:e.code||'UNKNOWN'})+'\n');if(['20','22','23','29','30','31','32','401','403','429'].includes(e.code)){stop=true;process.exitCode=1;console.error(`인증·호출 제한 오류 (${e.code})로 관측을 중단합니다.`);}}
  await writeFile(new URL('report.json',dir),JSON.stringify({...observer.report(),routeId,pollIntervalMs:interval,empirical:true},null,2));
  if(stop)break;
  const remain=Math.min(interval-(performance.now()-begin),duration*1000-(performance.now()-start));if(n<max-1&&remain>0)await sleep(remain);
 }
 console.log(JSON.stringify(observer.report(),null,2));console.log('기록 위치: '+dir.pathname);
}catch(e){console.error(e.message);process.exitCode=1;}
