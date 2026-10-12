const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
(async()=>{
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const logout=app.slice(app.indexOf("$('#guestSignOut')?.addEventListener"),app.indexOf('/* ---- Update UI based on guest session ---- */'));
  let handler,admin=true,failed=false,guestCleared=false,route='',calls=0,confirmation=true,release;
  const button={disabled:false},status={textContent:''},location={href:''};
  let held=null;
  const context={window:{__uploadsInFlight:0},location,confirm:()=>confirmation,isAdmin:()=>admin,
    $:selector=>selector==='#guestSignOut'?{addEventListener:(name,fn)=>handler=fn}:status,
    api:async(p,opts)=>{calls++;context.last={p,opts};if(held)await held;if(failed)throw new Error('Offline');},
    setAdminToken:()=>{admin=false;},switchView:value=>{route=value;},clearGuest:()=>{guestCleared=true;}};
  vm.runInNewContext(logout,context);
  context.window.__uploadsInFlight=1;await handler({currentTarget:button});assert.equal(calls,0,'Upload must finish before sign-out');context.window.__uploadsInFlight=0;
  failed=true;await handler({currentTarget:button});assert.equal(admin,true);assert.equal(guestCleared,false);assert.equal(button.disabled,false);
  failed=false;await handler({currentTarget:button});assert.equal(context.last.p,'/admin/logout');assert.equal(context.last.opts.admin,true);assert.equal(admin,false);assert.equal(guestCleared,false);assert.equal(route,'more');
  failed=true;await handler({currentTarget:button});assert.equal(guestCleared,false);assert.equal(location.href,'');
  failed=false;held=new Promise(r=>release=r);const pending=handler({currentTarget:button});const before=calls;
  await handler({currentTarget:button});assert.equal(calls,before,'Duplicate logout suppressed');release();await pending;
  assert.equal(context.last.p,'/guests/logout');assert.equal(guestCleared,true);assert.equal(location.href,'/');assert.equal(button.disabled,false);
  held=null;confirmation=false;const cancelled=calls;await handler({currentTarget:button});assert.equal(calls,cancelled);
  console.log('PASS admin/guest logout, secure failure retention, duplicate guard and confirmation cancellation (isolated VM)');

  const source=fs.readFileSync(path.join(root,'api-data.js'),'utf8');
  const push=source.slice(source.indexOf('function urlB64ToUint8Array('),source.indexOf('/* ---------- Admin auth ---------- */'));
  let subscription={toJSON:()=>({endpoint:'mock-endpoint'})},subscribes=0,requests=0,permissionRequests=0,offline=false;
  const notification={permission:'granted',requestPermission:async()=>{permissionRequests++;return 'default';}};
  const reg={pushManager:{getSubscription:async()=>subscription,subscribe:async()=>{subscribes++;return {toJSON:()=>({endpoint:'new-mock'})};}}};
  const navigator={serviceWorker:{ready:Promise.resolve(reg),getRegistration:async()=>reg}};
  const sandbox={window:{Notification:notification,PushManager:function(){}},Notification:notification,navigator,atob,Uint8Array,
    console:{warn(){}},clearTimeout,setTimeout:(fn,ms)=>setTimeout(fn,ms===8000?5:ms),
    api:async(p)=>{requests++;if(offline)throw new Error('Offline');return p==='/push/vapid'?{key:'AQID'}:{};}};
  vm.createContext(sandbox);vm.runInContext(push,sandbox);
  assert.equal(await sandbox.notificationsEnabled(),true);
  assert.equal(await sandbox.enableNotifications(),'on');assert.equal(subscribes,0,'Reuse existing subscription');
  subscription=null;assert.equal(await sandbox.enableNotifications(),'on');assert.equal(subscribes,1);
  notification.permission='denied';const noRequests=requests;assert.equal(await sandbox.enableNotifications(),'denied');assert.equal(requests,noRequests);assert.equal(permissionRequests,0);
  notification.permission='default';assert.equal(await sandbox.enableNotifications(),'dismissed');assert.equal(permissionRequests,1);
  notification.permission='granted';offline=true;assert.equal(await sandbox.enableNotifications(),'error');offline=false;
  navigator.serviceWorker.ready=new Promise(()=>{});assert.equal(await sandbox.enableNotifications(),'error','Worker timeout is bounded');
  navigator.serviceWorker.getRegistration=async()=>undefined;assert.equal(await sandbox.notificationsEnabled(),false,'No readiness hang for labels');
  delete sandbox.window.PushManager;assert.equal(await sandbox.enableNotifications(),'unsupported');
  console.log('PASS push permission states, subscription reuse, offline errors, bounded worker readiness and unsupported browsers (isolated VM)');
})().catch(err=>{console.error(err);process.exitCode=1;});
