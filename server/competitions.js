'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/* Separate, additive tables. No sample competitions or votes are seeded. */
module.exports = function installCompetitions({app,db,requireAdmin,publicWrite,multer,storage,uploadsDir}){
  db.exec(`
    CREATE TABLE IF NOT EXISTS guest_sessions (tokenHash TEXT PRIMARY KEY, guestId TEXT NOT NULL, expiresAt INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS guest_sessions_guest ON guest_sessions(guestId);
    CREATE TABLE IF NOT EXISTS competition_browsers (id TEXT PRIMARY KEY, tokenHash TEXT UNIQUE NOT NULL, expiresAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS competitions (id TEXT PRIMARY KEY, config TEXT NOT NULL, createdAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS competition_votes (
      competitionId TEXT NOT NULL, guestId TEXT NOT NULL, choiceId TEXT NOT NULL, createdAt INTEGER NOT NULL,
      PRIMARY KEY(competitionId,guestId,choiceId));
    CREATE TABLE IF NOT EXISTS competition_comments (
      competitionId TEXT NOT NULL, guestId TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      createdAt INTEGER NOT NULL, PRIMARY KEY(competitionId,guestId));
  `);
  const uid = () => crypto.randomUUID();
  const hash = token => crypto.createHash('sha256').update(token).digest('hex');
  const ttl = 90 * 24 * 3600 * 1000;
  function issueSession(res,guestId){
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('DELETE FROM guest_sessions WHERE expiresAt < ?').run(Date.now());
    db.prepare('INSERT INTO guest_sessions VALUES (?,?,?)').run(hash(token),guestId,Date.now()+ttl);
    res.cookie('sj_guest_session',token,{httpOnly:true,secure:res.req.secure,sameSite:'strict',path:'/api',maxAge:ttl});
  }
  function cookieToken(req){ return /(?:^|;\s*)sj_guest_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1]; }
  function guest(req){
    const token = cookieToken(req);
    return token ? db.prepare(`SELECT g.* FROM guest_sessions s JOIN guests g ON g.id=s.guestId
      WHERE s.tokenHash=? AND s.expiresAt>?`).get(hash(token),Date.now()) : null;
  }
  function browserVoter(req,res){
    const token=/(?:^|;\s*)sj_voting_browser=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];
    const row=token&&db.prepare('SELECT id FROM competition_browsers WHERE tokenHash=? AND expiresAt>?').get(hash(token),Date.now());
    if(row)return row;
    if(!res)return null;
    if(req.headers['sec-fetch-site']==='cross-site')return null;
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.get('host'))return null;}catch{return null;}}
    const newToken=crypto.randomBytes(32).toString('hex'),id='browser:'+uid();
    db.prepare('DELETE FROM competition_browsers WHERE expiresAt<?').run(Date.now());
    db.prepare('INSERT INTO competition_browsers VALUES (?,?,?)').run(id,hash(newToken),Date.now()+ttl);
    res.cookie('sj_voting_browser',newToken,{httpOnly:true,secure:req.secure,sameSite:'strict',path:'/api',maxAge:ttl});
    return {id};
  }
  const verifiedRequired=c=>c.requireVerified!==false;
  const voter=(c,req,res)=>verifiedRequired(c)?guest(req):browserVoter(req,res);
  function sameOrigin(req,res,next){
    if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({error:'Open voting from the wedding app.'});
    if (req.headers.origin){
      try { if (new URL(req.headers.origin).host !== req.get('host')) return res.status(403).json({error:'Voting must use this wedding app.'}); }
      catch { return res.status(403).json({error:'Invalid request origin.'}); }
    }
    next();
  }
  app.post('/api/guests/logout',sameOrigin,(req,res)=>{
    const token = cookieToken(req);
    if(token) db.prepare('DELETE FROM guest_sessions WHERE tokenHash=?').run(hash(token));
    res.clearCookie('sj_guest_session',{path:'/api',httpOnly:true,secure:req.secure,sameSite:'strict'});
    res.json({ok:true});
  });
  app.get('/api/competitions/session',(req,res)=>{
    res.set('Cache-Control','no-store');
    const g = guest(req);
    res.json({verified:!!g,approved:g?.status==='approved',attending:!!g?.attending});
  });
  function load(id){
    const row=db.prepare('SELECT * FROM competitions WHERE id=?').get(id);
    return row ? {id:row.id,...JSON.parse(row.config),createdAt:row.createdAt} : null;
  }
  function save(c){
    const {id,createdAt,...config}=c;
    db.prepare('INSERT INTO competitions VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config')
      .run(id,JSON.stringify(config),createdAt);
  }
  function phase(c){
    if(c.status==='draft'||c.status==='closed') return c.status;
    if(c.endAt && Date.now()>=c.endAt) return 'closed';
    if(c.status==='paused') return 'paused';
    if(c.startAt && Date.now()<c.startAt) return 'upcoming';
    return 'active';
  }
  function eligible(c,g){
    if(!verifiedRequired(c))return '';
    if(!g) return 'Verify your guest sign-in before voting.';
    if(g.status!=='approved') return 'Voting opens after the couple approves your guest registration.';
    if(c.audience==='attending'&&!g.attending) return 'This competition is for attending guests only.';
    if(c.audience==='group'&&!c.guestIds.includes(g.id)) return 'This competition is for a selected guest group.';
    return '';
  }
  function results(c){
    const rows=db.prepare('SELECT choiceId,COUNT(*) AS votes FROM competition_votes WHERE competitionId=? GROUP BY choiceId').all(c.id);
    const totalVotes=rows.reduce((n,r)=>n+r.votes,0);
    const uniqueVoters=db.prepare('SELECT COUNT(DISTINCT guestId) AS n FROM competition_votes WHERE competitionId=?').get(c.id).n;
    return {totalVotes,uniqueVoters,rankings:c.choices.map(choice=>{
      const votes=rows.find(r=>r.choiceId===choice.id)?.votes||0;
      return {...choice,votes,percentage:totalVotes ? Math.round(votes/totalVotes*100) : 0};
    }).sort((a,b)=>b.votes-a.votes || c.choices.findIndex(x=>x.id===a.id)-c.choices.findIndex(x=>x.id===b.id))};
  }
  function present(c,g,admin=false){
    const myChoices=g ? db.prepare('SELECT choiceId FROM competition_votes WHERE competitionId=? AND guestId=?').all(c.id,g.id).map(r=>r.choiceId) : [];
    const reason=eligible(c,g);
    const p=phase(c);
    const comments=c.commentsEnabled ? db.prepare(`SELECT c.text,c.createdAt,g.name FROM competition_comments c
      LEFT JOIN guests g ON g.id=c.guestId WHERE c.competitionId=? AND c.status='approved' ORDER BY c.createdAt DESC LIMIT 100`).all(c.id) : [];
    const visible={id:c.id,title:c.title,description:c.description,coverUrl:c.coverUrl,status:p,startAt:c.startAt,endAt:c.endAt,
      requireVerified:verifiedRequired(c),
      voteMode:c.voteMode,allowChange:c.allowChange,showResults:c.showResults,showPhotos:c.showPhotos,commentsEnabled:c.commentsEnabled,
      choices:c.choices.map(x=>({id:x.id,name:x.name,photoUrl:c.showPhotos||admin ? x.photoUrl : ''})),myChoices,
      canVote:!reason&&p==='active'&&(!myChoices.length||c.allowChange),
      votingReason:reason || (p!=='active' ? 'Voting is not open.' : myChoices.length&&!c.allowChange ? 'Your vote is already counted. Changes are disabled.' : ''),
      results:c.showResults||admin ? results(c) : null,comments:comments.map(x=>({...x,name:x.name||(verifiedRequired(c)?'Guest':'Guest (unverified)')}))};
    if(visible.results&&!c.showPhotos&&!admin) visible.results.rankings.forEach(x=>{x.photoUrl='';});
    if(admin) return {...visible,config:c};
    return visible;
  }
  function text(v,max,label){
    if(typeof v!=='string'||v.length>max) throw new Error(`${label} must be text of at most ${max} characters.`);
    return v.trim();
  }
  function photo(v){
    if(!v) return '';
    if(typeof v!=='string'||!/^\/uploads\/[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(v)) throw new Error('Use a photo uploaded through the competition editor.');
    if(!fs.existsSync(path.join(uploadsDir,path.basename(v)))) throw new Error('Uploaded photo not found. Please upload it again.');
    return v;
  }
  function validate(body,old){
    const c={id:old?.id||uid(),createdAt:old?.createdAt||Date.now(),title:text(body.title,120,'Title'),
      description:text(body.description||'',1000,'Description'),coverUrl:photo(body.coverUrl),
      status:body.status||'draft',audience:body.audience||'all',voteMode:body.voteMode||'single',guestIds:[],choices:[],
      requireVerified:body.requireVerified!==false,
      showResults:body.showResults===true,showPhotos:body.showPhotos!==false,allowChange:body.allowChange===true,commentsEnabled:body.commentsEnabled===true};
    if(!c.title) throw new Error('Enter a competition title.');
    if(!['draft','active','paused','closed'].includes(c.status)) throw new Error('Invalid competition status.');
    if(!['all','attending','group'].includes(c.audience)||!['single','multiple'].includes(c.voteMode)) throw new Error('Invalid voting settings.');
    if(body.requireVerified!==undefined&&typeof body.requireVerified!=='boolean')throw new Error('Verification setting must be on or off.');
    if(!c.requireVerified&&c.audience!=='all')throw new Error('Attending-only and selected-group voting require verified sign-in. Select All guests to disable verification.');
    if(!Array.isArray(body.guestIds)||body.guestIds.length>1000||body.guestIds.some(id=>typeof id!=='string')) throw new Error('Invalid guest group.');
    c.guestIds=[...new Set(body.guestIds)];
    if(c.audience==='group'&&!c.guestIds.length) throw new Error('Select at least one guest for this group.');
    if(c.guestIds.some(id=>!old?.guestIds.includes(id)&&!db.prepare("SELECT id FROM guests WHERE id=? AND status='approved'").get(id))) throw new Error('Groups must contain approved guests only.');
    for(const key of ['startAt','endAt']){
      c[key]=body[key]===null||body[key]===undefined||body[key]==='' ? null : Number(body[key]);
      if(c[key]!==null&&(!Number.isSafeInteger(c[key])||c[key]<0||c[key]>8640000000000000)) throw new Error('Invalid voting dates.');
    }
    if(c.endAt&&c.startAt&&c.endAt<=c.startAt) throw new Error('End date must be after the start date.');
    if(c.status==='active'&&c.endAt&&c.endAt<=Date.now()) throw new Error('Choose a future end date before publishing or reopening.');
    if(!Array.isArray(body.choices)||body.choices.length<2||body.choices.length>30) throw new Error('Add between 2 and 30 contestants.');
    c.choices=body.choices.map(x=>{
      const name=text(x.name,120,'Contestant name');
      if(!name) throw new Error('Each contestant needs a name.');
      if(x.id&&!old?.choices.some(o=>o.id===x.id)) throw new Error('Unknown contestant.');
      return {id:x.id||uid(),name,photoUrl:photo(x.photoUrl)};
    });
    if(new Set(c.choices.map(x=>x.id)).size!==c.choices.length) throw new Error('Duplicate contestants are not allowed.');
    if(old&&db.prepare('SELECT 1 FROM competition_votes WHERE competitionId=? LIMIT 1').get(old.id)){
      if(verifiedRequired(old)!==c.requireVerified)throw new Error('Verification cannot change after votes are cast. Duplicate the competition to change this setting without resetting voter identities.');
      if(old.audience!==c.audience||old.voteMode!==c.voteMode||JSON.stringify([...old.guestIds].sort())!==JSON.stringify([...c.guestIds].sort()))
        throw new Error('Voting audience and vote limit cannot change after votes are cast. Duplicate the competition to start fresh.');
      const removed=old.choices.filter(x=>!c.choices.some(y=>y.id===x.id));
      if(removed.some(x=>db.prepare('SELECT 1 FROM competition_votes WHERE competitionId=? AND choiceId=? LIMIT 1').get(c.id,x.id)))
        throw new Error('A contestant with votes cannot be removed. Close or duplicate the competition instead.');
    }
    c.publishedAt=old?.publishedAt||null;
    if(c.status==='active'&&(!old||old.status==='draft'||!c.publishedAt))
      c.publishedAt=Math.max(Date.now(),(old?.publishedAt||0)+1);
    return c;
  }
  /* Lightweight discovery feed: never exposes drafts, ballots or private results. */
  app.get('/api/competitions/notices',(req,res)=>{
    res.set('Cache-Control','no-store');
    const notices=db.prepare('SELECT id FROM competitions ORDER BY createdAt DESC').all().map(r=>{const c=load(r.id);return {c,status:phase(c)};})
      .filter(({status})=>['active','upcoming'].includes(status)).map(({c,status})=>{const g=voter(c,req);return {id:c.id,title:c.title,status,
        publishedAt:c.publishedAt||c.createdAt,startAt:c.startAt,
        canVote:status==='active'&&!eligible(c,g)&&(!g||!db.prepare('SELECT 1 FROM competition_votes WHERE competitionId=? AND guestId=? LIMIT 1').get(c.id,g.id)||c.allowChange)};});
    res.json(notices);
  });
  app.get('/api/competitions',(req,res)=>{
    res.set('Cache-Control','no-store');
    res.json(db.prepare('SELECT id FROM competitions ORDER BY createdAt DESC').all().map(r=>load(r.id)).filter(c=>c.status!=='draft').map(c=>present(c,voter(c,req))));
  });
  app.get('/api/competitions/:id',(req,res)=>{
    res.set('Cache-Control','no-store');
    const c=load(req.params.id);
    if(!c||c.status==='draft') return res.status(404).json({error:'Competition not found.'});
    res.json(present(c,voter(c,req,['active','upcoming'].includes(phase(c))?res:undefined)));
  });
  const voteTransaction=db.transaction((c,g,choices,comment)=>{
    const existing=db.prepare('SELECT choiceId FROM competition_votes WHERE competitionId=? AND guestId=?').all(c.id,g.id).map(r=>r.choiceId);
    if(existing.length&&!c.allowChange){
      if(JSON.stringify(existing.sort())===JSON.stringify([...choices].sort())) return; // Safe retry, never a duplicate vote.
      throw new Error('Your vote is already counted. Changes are disabled.');
    }
    db.prepare('DELETE FROM competition_votes WHERE competitionId=? AND guestId=?').run(c.id,g.id);
    const insert=db.prepare('INSERT INTO competition_votes VALUES (?,?,?,?)');
    for(const choice of choices) insert.run(c.id,g.id,choice,Date.now());
    if(c.commentsEnabled&&comment) db.prepare(`INSERT INTO competition_comments VALUES (?,?,?,'pending',?)
      ON CONFLICT(competitionId,guestId) DO UPDATE SET text=excluded.text,status='pending',createdAt=excluded.createdAt`).run(c.id,g.id,comment,Date.now());
  });
  app.post('/api/competitions/:id/vote',sameOrigin,publicWrite,(req,res)=>{
    const c=load(req.params.id);
    if(!c||c.status==='draft') return res.status(404).json({error:'Competition not found.'});
    const g=voter(c,req);
    const reason=eligible(c,g);
    if(reason) return res.status(g ? 403 : 401).json({error:reason});
    if(!g)return res.status(401).json({error:'Allow voting cookies and reload this competition before submitting. No verified sign-in is required for this game.'});
    if(phase(c)!=='active') return res.status(409).json({error:'Voting is not open for this competition.'});
    try{
      const choices=req.body?.choices;
      if(!Array.isArray(choices)||!choices.length||choices.length>c.choices.length||new Set(choices).size!==choices.length
        ||choices.some(id=>!c.choices.some(x=>x.id===id))||(c.voteMode==='single'&&choices.length!==1)) throw new Error('Choose valid contestants within the voting limit.');
      const comment=text(req.body?.comment||'',300,'Comment');
      voteTransaction(c,g,choices,comment);
      res.json(present(c,g));
    }catch(err){res.status(400).json({error:err.message});}
  });
  app.get('/api/admin/competitions',requireAdmin,(req,res)=>{
    res.set('Cache-Control','no-store');
    res.json(db.prepare('SELECT id FROM competitions ORDER BY createdAt DESC').all().map(r=>present(load(r.id),null,true)));
  });
  app.get('/api/admin/competitions/:id',requireAdmin,(req,res)=>{
    res.set('Cache-Control','no-store');
    const c=load(req.params.id);
    if(!c) return res.status(404).json({error:'Competition not found.'});
    res.json(present(c,null,true));
  });
  app.post('/api/admin/competitions',requireAdmin,(req,res)=>{
    try{const c=validate(req.body);save(c);res.status(201).json(present(c,null,true));}
    catch(err){res.status(400).json({error:err.message});}
  });
  app.patch('/api/admin/competitions/:id',requireAdmin,(req,res)=>{
    const old=load(req.params.id);
    if(!old) return res.status(404).json({error:'Competition not found.'});
    try{const c=validate({...old,...req.body},old);save(c);res.json(present(c,null,true));}
    catch(err){res.status(400).json({error:err.message});}
  });
  app.post('/api/admin/competitions/:id/duplicate',requireAdmin,(req,res)=>{
    const old=load(req.params.id);
    if(!old) return res.status(404).json({error:'Competition not found.'});
    const c={...old,id:uid(),title:(old.title+' (copy)').slice(0,120),status:'draft',publishedAt:null,startAt:null,endAt:null,createdAt:Date.now(),choices:old.choices.map(x=>({...x,id:uid()}))};
    save(c);res.status(201).json(present(c,null,true));
  });
  app.delete('/api/admin/competitions/:id',requireAdmin,(req,res)=>{
    if(!load(req.params.id)) return res.status(404).json({error:'Competition not found.'});
    db.transaction(()=>{
      db.prepare('DELETE FROM competition_votes WHERE competitionId=?').run(req.params.id);
      db.prepare('DELETE FROM competition_comments WHERE competitionId=?').run(req.params.id);
      db.prepare('DELETE FROM competitions WHERE id=?').run(req.params.id);
    })();
    res.json({ok:true});
  });
  app.get('/api/admin/competitions/:id/voters',requireAdmin,(req,res)=>{
    res.set('Cache-Control','no-store');
    const c=load(req.params.id);
    if(!c) return res.status(404).json({error:'Competition not found.'});
    const rows=db.prepare(`SELECT v.guestId,g.name,v.choiceId,v.createdAt FROM competition_votes v
      LEFT JOIN guests g ON g.id=v.guestId WHERE v.competitionId=? ORDER BY v.createdAt DESC`).all(c.id);
    const comments=db.prepare('SELECT guestId,text,status FROM competition_comments WHERE competitionId=?').all(c.id);
    const voters=new Map();
    rows.forEach(r=>{
      if(!voters.has(r.guestId)) voters.set(r.guestId,{guestId:r.guestId,name:r.name||(r.guestId.startsWith('browser:')?'Browser guest (unverified)':'Removed guest'),choices:[],createdAt:r.createdAt,comment:comments.find(x=>x.guestId===r.guestId)||null});
      voters.get(r.guestId).choices.push(c.choices.find(x=>x.id===r.choiceId)?.name||'Removed contestant');
    });
    res.json([...voters.values()]);
  });
  app.patch('/api/admin/competitions/:id/comments/:guestId',requireAdmin,(req,res)=>{
    if(!['approved','rejected'].includes(req.body?.status)) return res.status(400).json({error:'Choose approve or reject.'});
    const result=db.prepare('UPDATE competition_comments SET status=? WHERE competitionId=? AND guestId=?').run(req.body.status,req.params.id,req.params.guestId);
    if(!result.changes) return res.status(404).json({error:'Comment not found.'});
    res.json({ok:true});
  });
  app.get('/api/admin/competitions/:id/export',requireAdmin,(req,res)=>{
    const c=load(req.params.id);
    if(!c) return res.status(404).json({error:'Competition not found.'});
    const r=results(c);
    const cell=v=>{const s=String(v);return '"'+(/^[\s]*[=+\-@]/.test(s)||/^[\t\r]/.test(s)?"'":'')+s.replace(/"/g,'""')+'"';};
    const lines=[['Competition',c.title],['Total votes',r.totalVotes],[verifiedRequired(c)?'Unique voters':'Voting browsers (unverified)',r.uniqueVoters],[],['Rank','Contestant','Votes','Percentage']];
    let previous=-1,rank=0;
    r.rankings.forEach((x,i)=>{if(x.votes!==previous){rank=i+1;previous=x.votes;}lines.push([rank,x.name,x.votes,x.percentage+'%']);});
    res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="competition-results.csv"','Cache-Control':'no-store'});
    res.send('\uFEFF'+lines.map(row=>row.map(cell).join(',')).join('\r\n'));
  });
  const photoUpload=multer({storage,limits:{fileSize:10*1024*1024,files:1},fileFilter:(req,file,cb)=>{
    const ok=['image/jpeg','image/png','image/webp'].includes(file.mimetype);
    cb(ok?null:new Error('Use a JPEG, PNG or WebP photo.'),ok);
  }});
  app.post('/api/admin/competition-photos',requireAdmin,photoUpload.single('file'),(req,res)=>{
    if(!req.file) return res.status(400).json({error:'Choose a photo.'});
    res.json({url:'/uploads/'+req.file.filename});
  });
  return {issueSession};
};
