/* Disposable VPS API/database; no live environment or message sending. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const root=process.argv[2],DB=require(path.join(root,'node_modules/better-sqlite3')),dir=fs.mkdtempSync('/root/wedding-quick-test-');let child,token;
const base='http://127.0.0.1:3198/api';
async function start(required){child=spawn(process.execPath,[path.join(root,'server.js')],{env:{PATH:process.env.PATH,PORT:'3198',HOST:'127.0.0.1',DATA_DIR:dir,ADMIN_PASSWORD:'quick-test-only',GUEST_OTP_REQUIRED:required,FFMPEG_BIN:'disabled-test-ffmpeg'}});await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Startup timed out')),15000);child.stdout.on('data',chunk=>{if(String(chunk).includes('listening')){clearTimeout(t);resolve();}});child.once('exit',code=>{clearTimeout(t);reject(new Error('Server exited '+code));});});}
async function stop(){if(child&&child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}}
async function req(url,{method='GET',body,admin=false,status=200,headers={}}={}){const r=await fetch(base+url,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(admin?{Authorization:'Bearer '+token}:{}),...headers},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,url+' '+JSON.stringify(data));return {data,cookie:r.headers.get('set-cookie')};}
(async()=>{let db;try{
  await start('false');db=new DB(path.join(dir,'wedding.db'));
  db.prepare('INSERT INTO guests (id,name,phone,email,status,attending,checkedInAt) VALUES (?,?,?,?,?,?,?)').run('existing-private','Existing Private Guest','+233240000001','private@example.com','approved',1,Date.now());
  const old=db.prepare('SELECT * FROM guests WHERE id=?').get('existing-private');
  assert.equal((await req('/onboarding')).data.otpRequired,false);
  for(const p of ['/otp/send','/otp/verify','/guests/login','/guests/lookup'])await req(p,{method:'POST',body:{phone:old.phone,code:'123456'},status:409});
  assert.equal(db.prepare('SELECT COUNT(*) n FROM otps').get().n,0,'No codes created while disabled');
  const body={name:'Quick Guest',phone:old.phone,attending:true,entryKey:crypto.randomBytes(32).toString('hex')};
  const [a,b]=await Promise.all([req('/guest-entry',{method:'POST',body}),req('/guest-entry',{method:'POST',body})]);
  assert.equal(a.data.guest.id,b.data.guest.id);assert.notEqual(a.data.guest.id,old.id);assert.equal(a.cookie,null);assert.equal(a.data.guest.email,'');assert.equal(a.data.guest.checkinMethod,'quick');
  assert.deepEqual(db.prepare('SELECT * FROM guests WHERE id=?').get(old.id),old,'No phone-based overwrite or disclosure');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM guests').get().n,2);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM guest_sessions').get().n,0,'No verified session issued');
  assert.equal((await req('/competitions/session')).data.verified,false);
  assert.notEqual(db.prepare('SELECT tokenHash FROM guest_entry_keys').get().tokenHash,body.entryKey,'Only hashed idempotency secret stored');
  await req('/guest-entry',{method:'POST',body:{...body,entryKey:'bad'},status:400});
  await req('/guest-entry',{method:'POST',body:{...body,name:''},status:400});
  await req('/guest-entry',{method:'POST',body:{...body,phone:'123'},status:400});
  await req('/guest-entry',{method:'POST',body:{...body,email:'bad'},status:400});
  await req('/guest-entry',{method:'POST',body,headers:{Origin:'https://evil.example'},status:403});
  await req('/guests',{method:'POST',body:{name:'Cannot bypass verified registration',phone:old.phone},status:403});
  token=(await req('/admin/login',{method:'POST',body:{password:'quick-test-only'}})).data.token;
  const guests=(await req('/admin/guests',{admin:true})).data;assert.equal(guests.find(g=>g.id===a.data.guest.id).checkinMethod,'quick');
  await req('/admin/guests',{status:401});
  db.prepare('UPDATE guest_entry_keys SET expiresAt=0').run();await req('/guest-entry',{method:'POST',body,status:410});
  assert.equal(db.pragma('integrity_check',{simple:true}),'ok');
  await stop();await start('true');assert.equal((await req('/onboarding')).data.otpRequired,true);await req('/guest-entry',{method:'POST',body,status:409});
  assert.equal(db.prepare('SELECT COUNT(*) n FROM guests').get().n,2);assert.deepEqual(db.prepare('SELECT * FROM guests WHERE id=?').get(old.id),old);
  console.log('PASS quick entry API: OTP disabled without message/code creation, validation, hashed idempotency/concurrent retry, no phone takeover/disclosure, no verified voting session, admin auth/labels, expiry, re-enable switch and persistence');
}finally{db?.close();await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
