import test from 'node:test';
import assert from 'node:assert/strict';
import{MAX_ACTIVE_ROUTES,pollInterval,selectRouteIds,createCache}from '../lib/route-selection.mjs';
const catalog=['204000020','234000026','234000012','204000039'].map(id=>({id}));
test('route selection keeps defaults and separates duplicate route numbers by ID',()=>{
 assert.deepEqual(selectRouteIds(null,['234000026'],catalog),['234000026']);
 assert.deepEqual(selectRouteIds('204000020,234000012,204000020',[],catalog),['204000020','234000012']);
});
test('unlisted, empty, malformed and over-limit selections are rejected before collection',()=>{
 for(const raw of ['', '../.env','999999999','204000020,234000026,234000012,204000039'])assert.throws(()=>selectRouteIds(raw,[],catalog),e=>e.status===400&&e.code==='INVALID_ROUTES');
 assert.equal(MAX_ACTIVE_ROUTES,3);
 assert.equal(pollInterval(1,1000),96000);assert.equal(pollInterval(3,1000),288000);
});
test('cache shares each route across overlapping selections and concurrent requests',async()=>{
 const cached=createCache();let requests=0;
 const read=id=>cached('live:'+id,60000,async()=>{requests++;await new Promise(r=>setTimeout(r,5));return id;});
 const results=await Promise.all([Promise.all(['a','b'].map(read)),Promise.all(['b','c'].map(read))]);
 assert.deepEqual(results,[['a','b'],['b','c']]);assert.equal(requests,3);
 assert.equal(await read('b'),'b');assert.equal(requests,3);
});
test('failed upstream responses are not cached or left pending',async()=>{
 const cached=createCache();let requests=0;
 const read=()=>cached('live:a',60000,async()=>{if(++requests===1)throw new Error('temporary');return 'fresh';});
 await assert.rejects(read());assert.equal(await read(),'fresh');assert.equal(requests,2);
});
