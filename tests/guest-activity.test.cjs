const assert=require('node:assert/strict'),S=require('../guest-activity-schema');
for(const page of Object.keys(S.pages))assert.deepEqual(S.validate({page}),{page});
for(const value of [null,[],{},'chat',{page:'admin'},{page:'https://evil.test'},{page:'chat?message=private'},{page:'__proto__'},{page:'chat',guestId:'forged'},{page:'chat',text:'draft'},{page:'chat',lastSeen:123}])assert.throws(()=>S.validate(value));
const now=Date.UTC(2026,10,1);assert.equal(S.recent(now,now,'approved'),true);assert.equal(S.recent(now-90000,now,'approved'),true);for(const value of [now-90001,now+1,null,NaN,'0'])assert.equal(S.recent(value,now,'approved'),false);for(const status of ['pending','rejected','APPROVED',null])assert.equal(S.recent(now,now,status),false);
assert.equal(S.retentionMs,7*86400000);assert.equal(S.minBeatMs,5000);console.log('PASS allowlisted page-only signals, no arbitrary URLs/identities/drafts/client timestamps, recent/future-clock/approval boundaries and seven-day retention');
