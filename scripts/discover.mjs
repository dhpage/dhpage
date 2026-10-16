import{makeClient}from '../lib/gbis.mjs';
try{const keyword=process.argv[2];if(!keyword)throw new Error('노선 검색어를 지정하세요. 예: 720-2');const client=makeClient(process.env.GBIS_SERVICE_KEY);const result=await client('routes',{keyword});console.log(JSON.stringify(result.rows,null,2));}catch(e){console.error(e.message);process.exitCode=1;}
