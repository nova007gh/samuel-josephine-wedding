/* Linux disposable API + isolated nginx only. No live credentials or records.
   node tests/large-upload-api.cjs /root/wedding-upload-v191-candidate */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {spawn,execFileSync}=require('node:child_process');
const root=process.argv[2];
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wedding-large-upload-'));
let api,nginx,token;
const base='http://127.0.0.1:3196/api';
async function stop(child){if(child&&child.exitCode===null){const closed=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await closed;}}
async function upload(bytes){
  const boundary='wedding-large-file-test';
  const head=Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\nDisposable upload test\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.mp4"\r\nContent-Type: video/mp4\r\n\r\n`);
  const tail=Buffer.from(`\r\n--${boundary}--\r\n`);
  return new Promise((resolve,reject)=>{
    const req=http.request(base+'/admin/gallery',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'multipart/form-data; boundary='+boundary,'Content-Length':head.length+bytes+tail.length}},res=>{
      let body='';res.on('data',c=>body+=c);res.on('end',()=>{try{resolve({status:res.statusCode,data:JSON.parse(body)});}catch{reject(new Error(body));}});
    });
    req.on('error',reject);req.setTimeout(120000,()=>req.destroy(new Error('test timeout')));
    req.write(head);let remaining=bytes;const chunk=Buffer.alloc(64*1024);
    function write(){
      while(remaining>0){const n=Math.min(remaining,chunk.length);remaining-=n;if(!req.write(chunk.subarray(0,n))){req.once('drain',write);return;}}
      req.end(tail);
    }
    write();
  });
}
(async()=>{
  try{
    api=spawn(process.execPath,[path.join(root,'server.js')],{env:{...process.env,PORT:'3195',HOST:'127.0.0.1',DATA_DIR:dir,ADMIN_PASSWORD:'disposable-upload-only',FFMPEG_BIN:'disabled-test-ffmpeg'},stdio:['ignore','pipe','pipe']});
    api.stderr.on('data',()=>{});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('API start timed out')),10000);api.stdout.on('data',chunk=>{if(String(chunk).includes('listening')){clearTimeout(timer);resolve();}});api.once('exit',code=>reject(new Error('API exit '+code)));});
    // Reuse the candidate's exact upload proxy directives, on loopback only.
    const config=fs.readFileSync(path.join(root,'nginx-snybena.conf'),'utf8');
    const directives=config.match(/location \/api\/ \{([\s\S]*?)\n    \}/)[1].replace('127.0.0.1:3100','127.0.0.1:3195');
    const conf=path.join(dir,'nginx.conf');
    fs.writeFileSync(conf,`pid ${dir}/nginx.pid; error_log ${dir}/error.log; events {} http { access_log off; client_body_temp_path ${dir}/body; server { listen 127.0.0.1:3196; location /api/ { ${directives} } } }`);
    execFileSync('nginx',['-t','-c',conf]);
    nginx=spawn('nginx',['-c',conf,'-g','daemon off;'],{stdio:'ignore'});
    for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,50));}
    token=(await (await fetch(base+'/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'disposable-upload-only'})})).json()).token;
    assert.ok(token);
    // Stream bytes through nginx -> Multer -> disk, without large JS buffers.
    let maxRss=0,healthChecks=0,maxHealthMs=0;
    let busy=true;
    const probe=(async()=>{while(busy){const start=Date.now();assert.equal((await fetch(base+'/health')).status,200);maxHealthMs=Math.max(maxHealthMs,Date.now()-start);healthChecks++;const rss=fs.readFileSync(`/proc/${api.pid}/status`,'utf8').match(/VmRSS:\s+(\d+)/);maxRss=Math.max(maxRss,Number(rss?.[1]||0));await new Promise(r=>setTimeout(r,100));}})();
    try{
      for(const bytes of [257*1024*1024,1024*1024*1024]){
        const result=await upload(bytes);assert.equal(result.status,200);assert.equal(result.data.size,bytes);
        assert.equal(fs.statSync(path.join(dir,'uploads',path.basename(result.data.mediaUrl))).size,bytes);
        fs.unlinkSync(path.join(dir,'uploads',path.basename(result.data.mediaUrl)));
      }
      const rejected=await upload(1024*1024*1024+1);assert.equal(rejected.status,413);assert.match(rejected.data.error,/1024MB/);
      assert.equal(fs.readdirSync(path.join(dir,'uploads')).length,0,'Multer removes rejected partial file');
    }finally{busy=false;await probe;}
    assert.ok(healthChecks>0);assert.ok(maxRss<250*1024,'API stays below 250 MiB while streaming large files');
    assert.ok(maxHealthMs<3000,'Health endpoint stays responsive during upload');
    console.log(`PASS isolated nginx/API: 257 MiB and exactly 1 GiB accepted; over 1 GiB rejected/cleaned; ${healthChecks} health checks, max ${maxHealthMs}ms, peak API RSS ${(maxRss/1024).toFixed(1)} MiB`);
  }finally{await stop(nginx);await stop(api);fs.rmSync(dir,{recursive:true,force:true});}
})().catch(err=>{console.error(err);process.exitCode=1;});
