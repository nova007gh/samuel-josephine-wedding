/* Real HTTP + disposable SQLite/uploads; no production config or messages. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const root=process.argv[2],DB=require(path.join(root,'node_modules/better-sqlite3'));
const dir=fs.mkdtempSync('/root/wedding-community-test-'),base='http://127.0.0.1:3193/api';let child,db,admin;
const cookie1='sj_guest_session='+'a'.repeat(64),cookie2='sj_guest_session='+'b'.repeat(64);
async function start(){child=spawn(process.execPath,[path.join(root,'server.js')],{env:{PATH:process.env.PATH,PORT:'3193',HOST:'127.0.0.1',DATA_DIR:dir,ADMIN_PASSWORD:'community-isolated-only',FFMPEG_BIN:'disabled-test-ffmpeg'}});await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('API startup timeout')),15000);child.stdout.on('data',b=>{if(String(b).includes('listening')){clearTimeout(t);resolve();}});child.once('exit',c=>{clearTimeout(t);reject(new Error('API exited '+c));});});}
async function stop(){if(child&&child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill();await ended;}}
async function req(url,{method='GET',body,cookie,host=false,status=200,origin}={}){const form=body instanceof FormData,r=await fetch(base+url,{method,headers:{...(body&&!form?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(host?{Authorization:'Bearer '+admin}:{}),...(origin?{Origin:origin}:{})},body:body?(form?body:JSON.stringify(body)):undefined});const j=await r.json();assert.equal(r.status,status,url+' '+JSON.stringify(j));return j;}
const id=()=>crypto.randomUUID(),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
const form=(bytes=png,name='photo.png',type='image/png')=>{const f=new FormData();f.append('file',new Blob([bytes],{type}),name);return f;};
(async()=>{try{
  await start();db=new DB(path.join(dir,'wedding.db'));const baseline=db.prepare('SELECT * FROM settings ORDER BY key').all();
  for(const [g,key] of [['g-one','a'],['g-two','b']]){db.prepare("INSERT INTO guests(id,name,phone,checkedInAt) VALUES (?,?,?,?)").run(g,'Verified '+g,'+23324000000'+(key==='a'?'1':'2'),Date.now());db.prepare('INSERT INTO guest_sessions VALUES (?,?,?)').run(crypto.createHash('sha256').update(key.repeat(64)).digest('hex'),g,Date.now()+3600000);}
  assert.deepEqual((await req('/entertainment')).data,{acts:[]});assert.deepEqual(db.prepare('SELECT * FROM settings ORDER BY key').all(),baseline);
  await req('/chat',{status:401});await req('/chat/messages',{method:'POST',body:{id:id(),text:'Spoof',name:'Hosts',host:true},status:401});
  await req('/chat/uploads',{method:'POST',body:form(),status:401});await req('/admin/entertainment',{method:'PATCH',body:{},status:401});
  admin=(await req('/admin/login',{method:'POST',body:{password:'community-isolated-only'}})).token;
  await req('/chat/messages',{method:'POST',cookie:cookie1,origin:'https://not-the-wedding.example',body:{},status:403});
  const message={id:id(),text:'Hello <script>not markup</script>',name:'Fake host',kind:'announcement',host:true};
  let row=await req('/chat/messages',{method:'POST',cookie:cookie1,body:message});assert.equal(row.status,'pending');assert.equal(row.host,false);assert.equal(row.name,'Verified g-one');assert.equal(row.kind,'chat');
  const retry=await req('/chat/messages',{method:'POST',cookie:cookie1,body:message});assert.equal(row.id,retry.id);assert.equal(db.prepare('SELECT COUNT(*) n FROM wedding_chat').get().n,1);
  await req('/chat/messages',{method:'POST',cookie:cookie1,body:{...message,text:'Changed retry'},status:400});
  await req('/chat/messages',{method:'POST',cookie:cookie2,body:message,status:400});
  assert.equal((await req('/chat',{cookie:cookie2})).messages.length,0);assert.equal((await req('/chat',{cookie:cookie1})).messages.length,1);
  await req('/chat/messages/'+row.id+'/reaction',{method:'PUT',cookie:cookie2,body:{emoji:'❤️',active:true},status:404});
  await req('/admin/chat/'+row.id,{method:'PATCH',host:true,body:{status:'approved',pinned:true}});
  assert.equal((await req('/chat',{cookie:cookie2})).messages[0].pinned,true);
  for(let i=0;i<2;i++)await req('/chat/messages/'+row.id+'/reaction',{method:'PUT',cookie:cookie2,body:{emoji:'❤️',active:true}});
  let reacted=(await req('/chat',{cookie:cookie2})).messages[0];assert.equal(reacted.reactions[0].count,1);assert.equal(reacted.reactions[0].mine,true);
  await req('/chat/messages/'+row.id+'/reaction',{method:'PUT',cookie:cookie2,body:{emoji:'💣',active:true},status:400});
  await req('/chat/messages/'+row.id,{method:'DELETE',cookie:cookie2,status:403});
  await req('/chat/presence',{method:'POST',cookie:cookie1,body:{}});await req('/chat/presence',{method:'POST',cookie:cookie1,body:{}});assert.equal((await req('/chat',{cookie:cookie2})).activeGuests,1);
  const hostMessage=await req('/chat/messages',{method:'POST',host:true,body:{id:id(),text:'Host announcement',kind:'announcement'}});assert.equal(hostMessage.status,'approved');assert.equal(hostMessage.host,true);
  await req('/chat/uploads',{method:'POST',cookie:cookie1,body:form(Buffer.from('<svg onload="alert(1)"/>'),'fake.jpg'),status:400});
  const file=await req('/chat/uploads',{method:'POST',cookie:cookie1,body:form()});assert.equal(file.kind,'photos');assert.ok(fs.existsSync(path.join(dir,file.url)));
  await req('/chat/messages',{method:'POST',cookie:cookie2,body:{id:id(),text:'Stolen attachment',attachmentId:file.id},status:400});
  const media=await req('/chat/messages',{method:'POST',cookie:cookie1,body:{id:id(),text:'My photo',attachmentId:file.id}});assert.equal(media.attachment.url,file.url);
  const beforeFiles=fs.readdirSync(path.join(dir,'uploads')).length;
  await req('/chat/uploads',{method:'POST',cookie:cookie1,body:form(Buffer.alloc(25*1024*1024+1),'large.png'),status:413});assert.equal(fs.readdirSync(path.join(dir,'uploads')).length,beforeFiles);
  const initial=await req('/entertainment'),data={acts:[{id:'confirmed-act',name:'Confirmed test band',category:'band',description:'Test only',photoUrl:file.url,startsAt:Date.UTC(2027,0,9,17),duration:'2 hours',instagram:'https://instagram.com/example',youtube:'',facebook:''}]};
  const saved=await req('/admin/entertainment',{method:'PATCH',host:true,body:{data,expectedRevision:initial.revision}});assert.deepEqual(saved.data,data);
  await req('/admin/entertainment',{method:'PATCH',host:true,body:{data,expectedRevision:initial.revision},status:409});
  await req('/admin/entertainment',{method:'PATCH',host:true,body:{data:{acts:[{...data.acts[0],youtube:'javascript:alert(1)'}]},expectedRevision:saved.revision},status:400});
  await req('/admin/entertainment',{method:'PATCH',host:true,body:{data:{acts:[{...data.acts[0],photoUrl:'/uploads/missing.jpg'}]},expectedRevision:saved.revision},status:400});
  for(const r of baseline)assert.deepEqual(db.prepare('SELECT * FROM settings WHERE key=?').get(r.key),r);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gifts').get().n,0);assert.equal(db.pragma('integrity_check',{simple:true}),'ok');
  await stop();await start();assert.deepEqual((await req('/entertainment')).data,data);assert.equal((await req('/chat',{cookie:cookie1})).messages.length,3);
  await req('/admin/chat/'+row.id,{method:'PATCH',host:true,body:{status:'hidden'}});assert.equal((await req('/chat',{cookie:cookie2})).messages.some(m=>m.id===row.id),false);
  await req('/chat/messages/'+row.id,{method:'DELETE',cookie:cookie1});assert.equal(db.prepare('SELECT COUNT(*) n FROM wedding_chat_reactions WHERE messageId=?').get(row.id).n,0);
  console.log('PASS isolated community API: verified identities, host-only actions, same-origin, moderation/private pending messages, persistent idempotency, attachment ownership/bytes/limits, unique reactions, real presence, entertainment validation/conflicts, restart persistence and unrelated-data preservation. No live data changed.');
}finally{db?.close();await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
