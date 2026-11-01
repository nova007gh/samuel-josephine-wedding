(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GuestActivitySchema=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const pages={home:'Home',story:'Our Story',events:'Events',program:'Reception Programme',engagementprogram:'Traditional Programme',gallery:'Gallery',bridaltrain:'Bridal Train',chat:'Wedding Chat',vendors:'Vendors',entertainment:'Entertainment',foodmenu:'Food & Drinks',livebroadcast:'Live Broadcast',gifts:'Gifts',more:'More',guestbook:'Guest Book',memories:'Share Memories',voicemsg:'Voice Memory',videomsg:'Video Memory',rsvp:'RSVP',competitions:'Competitions',competition:'Competition'};
  const recentMs=90000,retentionMs=7*86400000,minBeatMs=5000;
  function validate(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>k!=='page')||typeof value.page!=='string'||!Object.hasOwn(pages,value.page))throw Error('Choose a valid wedding page.');return {page:value.page};}
  function recent(lastSeen,now,status){return status==='approved'&&Number.isSafeInteger(lastSeen)&&lastSeen<=now&&lastSeen>=now-recentMs;}
  return {pages,recentMs,retentionMs,minBeatMs,validate,recent};
});
