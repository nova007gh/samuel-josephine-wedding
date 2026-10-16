/* Disposable API test; no production environment, credentials or data. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=process.argv[2],server=path.join(root,'server.js'),Database=require(path.join(root,'node_modules/better-sqlite3'));
const dir=fs.mkdtempSync('/root/wedding-broadcast-test-'),base='http://127.0.0.1:3198/api';let child,token;
async function start(){child=spawn(process.execPath,[server],{env:{PATH:process.env.PATH,PORT:'3198',HOST:'127.0.0.1',DATA_DIR:dir,ADMIN_PASSWORD:'broadcast-test-only',FFMPEG_BIN:'disabled-test-ffmpeg'}});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Startup timed out')),15000);child.stdout.on('data',chunk=>{if(String(chunk).includes('listening')){clearTimeout(timer);resolve();}});child.once('exit',code=>{clearTimeout(timer);reject(new Error('API exited '+code));});});}
async function stop(){if(child&&child.exitCode===null){const exit=new Promise(r=>child.once('exit',r));child.kill();await exit;}}
async function req(url,{method='GET',body,admin=false,status=200}={}){const r=await fetch(base+url,{method,headers:{...(admin?{Authorization:'Bearer '+token}:{}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,url+' '+JSON.stringify(data));return data;}
(async()=>{try{
  await start();const db=new Database(path.join(dir,'wedding.db'));const originalSettings=db.prepare('SELECT * FROM settings ORDER BY key').all();
  const initial=await req('/live-broadcast');assert.equal(initial.data.status,'unconfigured');assert.deepEqual(db.prepare('SELECT * FROM settings ORDER BY key').all(),originalSettings);
  await req('/admin/live-broadcast',{method:'PATCH',body:{data:initial.data,expectedRevision:initial.revision},status:401});
  token=(await req('/admin/login',{method:'POST',body:{password:'broadcast-test-only'}})).token;
  const form=new FormData();form.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')],{type:'image/png'}),'poster.png');
  await req('/admin/live-broadcast/photo',{method:'POST',body:form,status:401});
  const photo=(await req('/admin/live-broadcast/photo',{method:'POST',body:form,admin:true})).url;assert.ok(fs.existsSync(path.join(dir,photo)));
  const bad=new FormData();bad.append('file',new Blob(['<svg/>'],{type:'image/svg+xml'}),'bad.svg');await req('/admin/live-broadcast/photo',{method:'POST',body:bad,admin:true,status:400});
  const beforeFiles=fs.readdirSync(path.join(dir,'uploads')).filter(f=>!f.includes('.thumb.')&&!f.includes('.display.')).sort();
  const big=new FormData();big.append('file',new Blob([Buffer.alloc(10*1024*1024+1)],{type:'image/jpeg'}),'big.jpg');await req('/admin/live-broadcast/photo',{method:'POST',body:big,admin:true,status:413});
  assert.deepEqual(fs.readdirSync(path.join(dir,'uploads')).filter(f=>!f.includes('.thumb.')&&!f.includes('.display.')).sort(),beforeFiles,'Oversized upload cleaned');
  await req('/admin/live-broadcast',{method:'PATCH',admin:true,body:{data:{...initial.data,posterUrl:'/uploads/missing.png'},expectedRevision:initial.revision},status:400});
  const data={...initial.data,status:'scheduled',streamUrl:'https://youtu.be/dQw4w9WgXcQ',startsAt:Date.parse('2027-01-09T10:00:00Z'),posterUrl:photo};
  const saved=await req('/admin/live-broadcast',{method:'PATCH',admin:true,body:{data,expectedRevision:initial.revision}});assert.notEqual(saved.revision,initial.revision);
  await req('/admin/live-broadcast',{method:'PATCH',admin:true,body:{data:{...data,title:'Stale'},expectedRevision:initial.revision},status:409});
  assert.deepEqual((await req('/live-broadcast')).data,data);
  for(const row of originalSettings)assert.deepEqual(db.prepare('SELECT * FROM settings WHERE key=?').get(row.key),row);
  assert.equal(db.pragma('integrity_check',{simple:true}),'ok');db.close();await stop();await start();
  const restarted=await req('/live-broadcast');assert.deepEqual(restarted.data,data);assert.equal(restarted.revision,saved.revision);
  console.log('PASS disposable broadcast API: read-only defaults, auth guards, MIME/10MiB rejection and cleanup, missing photos, revision conflict, unrelated settings, SQLite integrity and restart persistence');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(err=>{console.error(err);process.exitCode=1;});
