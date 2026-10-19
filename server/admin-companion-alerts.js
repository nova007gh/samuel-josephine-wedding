'use strict';
// Private admin-only activity feed. Never part of /api/guide or its knowledge.
function connection(value){
  const s=String(value||'').normalize('NFKC');
  if(/\b(not|neither|unknown|unsure|don['’]?t)\b/i.test(s))return null;
  const sam=/\b(sam|samuel|groom)\b/i.test(s),jossy=/\b(jossy|josephine|bride)\b/i.test(s);
  return sam===jossy?null:sam?'sam':'jossy';
}
const normalName=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
module.exports=({app,db,requireAdmin})=>{
  app.get('/api/admin/companion-alerts',requireAdmin,(req,res)=>{
    res.set('Cache-Control','no-store');
    const now=Date.now(),cutoff=now-24*60*60000;
    // Contact details, message bodies, ballot choices and payment amounts are
    // deliberately not selected or returned by this feature.
    const guests=db.prepare('SELECT id,name,relation,checkedInAt,status FROM guests').all(),byId=new Map(guests.map(g=>[g.id,g])),names=new Map();
    for(const g of guests){const key=normalName(g.name);if(key)names.set(key,names.has(key)?null:g);}
    const events=[];
    function add(kind,row,g,match,view){
      const side=g&&connection(g.relation),at=Number(row.at);
      if(!side||!Number.isSafeInteger(at)||at<cutoff||at>now)return;
      const route={checkin:['admin','guests'],chat:['chat'],vote:['admincompetitions'],upload:['adminmedia'],guestbook:['admin','content'],rsvp:['admin','guests'],gift:['admin','gifts']}[kind];
      events.push({id:kind+':'+row.id+':'+at,side,name:String(g.name||'Guest').slice(0,120),kind,at,status:row.status||'',match,view:route[0],section:route[1]||null});
    }
    for(const g of guests)add('checkin',{id:g.id,at:g.checkedInAt,status:g.status},g,'guest-id','adminguests');
    for(const row of db.prepare("SELECT id,actorId,createdAt AS at,status FROM wedding_chat WHERE host=0 AND status!='hidden' AND createdAt>=? ORDER BY createdAt DESC LIMIT 150").all(cutoff))add('chat',row,byId.get(row.actorId),'guest-id','chat');
    for(const row of db.prepare('SELECT competitionId||\':\'||guestId AS id,guestId,MAX(createdAt) AS at FROM competition_votes WHERE createdAt>=? GROUP BY competitionId,guestId ORDER BY at DESC LIMIT 150').all(cutoff))add('vote',row,byId.get(row.guestId),'guest-id','admincompetitions');
    // Legacy submission tables have names rather than guest IDs. Only exact,
    // unique saved names qualify, and alerts explicitly disclose that match.
    for(const [table,name,at,kind,view] of [['memories','guestName','createdAt','upload','adminmemories'],['guestbook','name','createdAt','guestbook','adminguestbook'],['rsvps','name','submittedAt','rsvp','adminrsvps'],['gifts','name','createdAt','gift','admingifts']]){
      const status=['memories','guestbook'].includes(table)?'status':"'' AS status";
      for(const row of db.prepare(`SELECT id,${name} AS name,${at} AS at,${status} FROM ${table} WHERE ${at}>=? ORDER BY ${at} DESC LIMIT 150`).all(cutoff))add(kind,row,names.get(normalName(row.name)),'unique-name',view);
    }
    events.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
    res.json({events:events.slice(-150),asOf:now,windowHours:24,connectionPolicy:'explicit-saved-connection',nameMatchPolicy:'unique-exact-name-not-verified-ownership'});
  });
};
module.exports.connection=connection;
module.exports.normalName=normalName;
