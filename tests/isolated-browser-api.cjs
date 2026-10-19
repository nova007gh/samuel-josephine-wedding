/* VPS-only disposable API for browser end-to-end tests. No live env/database. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const http=require('node:http');
const {spawn}=require('node:child_process');
const server=process.argv[2]||'/opt/wedding-api/server.js';
const Database=require(path.join(path.dirname(server),'node_modules/better-sqlite3'));
const dir=fs.mkdtempSync('/root/wedding-browser-e2e-');
const media=http.createServer((req,res)=>{
  const name=path.basename(new URL(req.url,'http://localhost').pathname);
  const file=path.join(dir,'uploads',name);
  if(!/^[a-f0-9-]+\.(jpg|jpeg|png|webp|mp3|m4a|mp4|weba|webm|ogg|wav|aac)$/.test(name)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  const types={'.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.m4a':'audio/mp4','.mp4':'video/mp4','.weba':'audio/webm','.webm':'video/webm','.ogg':'audio/ogg','.wav':'audio/wav','.aac':'audio/aac'};
  res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
media.listen(3195,'127.0.0.1');
const child=spawn(process.execPath,[server],{env:{PATH:process.env.PATH,PORT:'3196',HOST:'127.0.0.1',DATA_DIR:dir,ADMIN_PASSWORD:'isolated-browser-only',FFMPEG_BIN:'disabled-test-ffmpeg',GUEST_OTP_REQUIRED:process.argv[3]==='--otp-off'?'false':'true'}});
let ready=false,closing=false;
child.stderr.on('data',data=>process.stderr.write(data));
child.stdout.on('data',data=>{
  if(ready||!String(data).includes('listening'))return;
  ready=true;
  const db=new Database(path.join(dir,'wedding.db'));
  for(const [id,phone,status,attending]of [['e2e-approved','+233240000001','approved',1],['e2e-exploring','+233240000002','approved',0],['e2e-pending','+233240000003','pending',1]]){
    db.prepare('INSERT INTO guests (id,name,phone,status,attending,checkedInAt) VALUES (?,?,?,?,?,?)').run(id,id,phone,status,attending,Date.now());
    db.prepare('INSERT INTO otps (phone,code,expiresAt,attempts,sentAt) VALUES (?,?,?,?,?)').run(phone.slice(-9),crypto.createHash('sha256').update('123456').digest('hex'),Date.now()+10*60000,0,Date.now());
  }
  db.close();console.log('ISOLATED_BROWSER_READY');
});
async function close(){
  if(closing)return;closing=true;clearTimeout(maximum);
  media.closeAllConnections();media.close();
  if(child.exitCode===null&&child.signalCode===null){
    const exited=new Promise(r=>child.once('exit',r));child.kill();
    const force=setTimeout(()=>child.kill('SIGKILL'),5000);await exited;clearTimeout(force);
  }
  fs.rmSync(dir,{recursive:true,force:true});console.log('ISOLATED_BROWSER_CLEANED');process.exit();
}
const maximum=setTimeout(close,10*60000);
process.stdin.resume();process.stdin.on('end',close);
for(const signal of ['SIGTERM','SIGINT','SIGHUP'])process.on(signal,close);
child.on('exit',()=>{if(!closing){console.error('Isolated API exited unexpectedly');close();}});
