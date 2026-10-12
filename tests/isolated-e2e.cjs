/* Actual candidate frontend + actual disposable VPS API over a private tunnel.
   node tests/isolated-e2e.cjs /absolute/output/directory */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const tunnel=spawn('ssh',['-T','-o','ControlMaster=no','-o','ControlPath=none','-o','ConnectTimeout=15','-o','ExitOnForwardFailure=yes','-L','127.0.0.1:3197:127.0.0.1:3196','-L','127.0.0.1:3194:127.0.0.1:3195','snybena','node /opt/wedding-api/isolated-browser-api.cjs /opt/wedding-api/server.js']);
let child,server;
const ready=new Promise((resolve,reject)=>{
  let output='';
  const timer=setTimeout(()=>reject(new Error('Isolated browser API startup timed out')),30000);
  tunnel.stdout.on('data',chunk=>{output+=String(chunk);if(output.includes('ISOLATED_BROWSER_READY')){clearTimeout(timer);resolve();}});
  tunnel.stderr.on('data',chunk=>process.stderr.write(chunk));
  tunnel.once('exit',code=>{clearTimeout(timer);reject(new Error('Isolated tunnel exited '+code));});
});
(async()=>{
  try{
    await ready;
    server=http.createServer((req,res)=>{
      const pathname=new URL(req.url,'http://localhost').pathname;
      if(pathname.startsWith('/api/')){
        const upstream=http.request({hostname:'127.0.0.1',port:3197,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
        upstream.on('error',err=>{res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:err.message}));});req.pipe(upstream);return;
      }
      if(pathname.startsWith('/uploads/')){
        const upstream=http.request({hostname:'127.0.0.1',port:3194,path:req.url,method:'GET'},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
        upstream.on('error',()=>{res.writeHead(502);res.end();});upstream.end();return;
      }
      const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
      res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    child=spawn(process.execPath,[path.join(__dirname,'gifts-design.cjs'),process.argv[2],'--e2e'],{stdio:'inherit',env:{...process.env,WEDDING_TEST_URL:'http://127.0.0.1:'+server.address().port+'/'}});
    const code=await new Promise(r=>child.once('exit',r));process.exitCode=code||0;
  }finally{
    server?.closeAllConnections();server?.close();
    tunnel.stdin.end();
    if(tunnel.exitCode===null&&tunnel.signalCode===null){const exited=new Promise(r=>tunnel.once('exit',r));const force=setTimeout(()=>tunnel.kill(),8000);await exited;clearTimeout(force);}
  }
})().catch(err=>{console.error(err.message);process.exitCode=1;});
