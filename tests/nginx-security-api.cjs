/* Linux-only disposable nginx + echo server. Never forwards to the real API. */
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),{spawn,execFileSync}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wedding-edge-test-'));
let echo,nginx;
(async()=>{try{
  const source=fs.readFileSync(process.argv[2],'utf8');
  echo=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({forwarded:req.headers['x-forwarded-for'],real:req.headers['x-real-ip']}));});
  await new Promise(resolve=>echo.listen(0,'127.0.0.1',resolve));
  const directives=source.match(/location \/api\/ \{([\s\S]*?)\n    \}/)[1].replace('127.0.0.1:3100','127.0.0.1:'+echo.address().port);
  const headers=source.slice(0,source.indexOf('location /')).split('\n').filter(line=>line.includes('add_header ')).join('\n');
  const conf=path.join(dir,'nginx.conf');
  fs.writeFileSync(conf,`pid ${dir}/nginx.pid; error_log ${dir}/error.log; events {} http { access_log off; client_body_temp_path ${dir}/body; server { listen 127.0.0.1:3198; ${headers} location /api/ { ${directives} } } }`);
  execFileSync('nginx',['-t','-c',conf],{stdio:'pipe'});nginx=spawn('nginx',['-c',conf,'-g','daemon off;'],{stdio:'ignore'});
  let response;
  for(let i=0;i<100;i++){try{response=await fetch('http://127.0.0.1:3198/api/probe',{headers:{'X-Forwarded-For':'203.0.113.19, 198.51.100.20'}});break;}catch{await new Promise(resolve=>setTimeout(resolve,40));}}
  assert.ok(response);assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{forwarded:'127.0.0.1',real:'127.0.0.1'},'Forged client IP chain is discarded at the edge');
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.equal(response.headers.get('x-frame-options'),'SAMEORIGIN');
  assert.equal(response.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
  assert.equal(response.headers.get('cache-control'),'no-store');
  console.log('PASS isolated real nginx: client-supplied forwarding chain replaced and API security headers present; no live API traffic');
}finally{
  if(nginx&&nginx.exitCode===null){const exit=new Promise(resolve=>nginx.once('exit',resolve));nginx.kill();await exit;}
  echo?.closeAllConnections();await new Promise(resolve=>echo?echo.close(resolve):resolve());fs.rmSync(dir,{recursive:true,force:true});
}})().catch(error=>{console.error(error);process.exitCode=1;});
