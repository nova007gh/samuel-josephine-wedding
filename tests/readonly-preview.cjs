/* Candidate frontend + GET-only public live API/media proxy; cannot submit data. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{Readable,pipeline}=require('node:stream'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
  if(req.method!=='GET'){res.writeHead(405);res.end('Read-only preview');return;}
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname.startsWith('/api/')||pathname.startsWith('/uploads/')){
    try{const r=await fetch('https://snybena.com'+req.url,{signal:AbortSignal.timeout(45000)});res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')||'application/octet-stream','Cache-Control':'no-store'});if(r.body)pipeline(Readable.fromWeb(r.body),res,()=>{});else res.end();}catch{if(!res.headersSent)res.writeHead(502);res.end('Preview upstream unavailable');}return;
  }
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
(async()=>{try{await new Promise(r=>server.listen(0,'127.0.0.1',r));const child=spawn(process.execPath,[path.join(__dirname,'gifts-design.cjs'),process.argv[2],process.argv[3]||'--live-broadcast'],{stdio:'inherit',env:{...process.env,WEDDING_TEST_URL:'http://127.0.0.1:'+server.address().port+'/'}});process.exitCode=await new Promise(r=>child.once('exit',r))||0;}finally{server.closeAllConnections();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
