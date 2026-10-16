import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const output=new URL('../dist/',import.meta.url);
const hashes={'leaflet.js':'20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=','leaflet.css':'p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='};
const files=['leaflet.js','leaflet.css','images/layers.png','images/layers-2x.png','images/marker-icon.png','images/marker-icon-2x.png','images/marker-shadow.png'];
mkdirSync(new URL('images/',output),{recursive:true});
for(const name of files){
 const response=await fetch('https://unpkg.com/leaflet@1.9.4/dist/'+name,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('Leaflet download failed: HTTP '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(hashes[name]&&createHash('sha256').update(bytes).digest('base64')!==hashes[name])throw new Error('Leaflet checksum mismatch');
 writeFileSync(new URL(name,output),bytes);console.log('Saved '+name);
}
const license=await fetch('https://raw.githubusercontent.com/Leaflet/Leaflet/v1.9.4/LICENSE',{signal:AbortSignal.timeout(20000)});
if(!license.ok)throw new Error('Leaflet license download failed');
writeFileSync(new URL('leaflet-LICENSE.txt',output),await license.text());
