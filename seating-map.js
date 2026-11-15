/* Shared seating map: one renderer for the admin dashboard and the guest pass. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SeatingMap=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const label=t=>String(t.name||'Table');
  function adminState(t){return t.capacity>0&&t.used>=t.capacity?'is-full':t.checkedSeats>0?'is-active':t.used>0?'is-partial':'is-empty';}
  function guestState(t,mine){return t.id===mine?'is-mine':t.capacity>0&&t.used>=t.capacity?'is-full':t.used>0?'is-partial':'is-empty';}
  const describe=(t,state)=>label(t)+': '+(state==='is-mine'?'your table':state==='is-full'?'full':state==='is-active'?'guests checked in':state==='is-partial'?'partly reserved':'available')+', '+t.used+' of '+t.capacity+' seats reserved';
  const legends={
    admin:[['is-active','Checked in / Active'],['is-partial','Partially Filled'],['is-full','Full'],['is-empty','Empty / Reserved']],
    guest:[['is-mine','My Table'],['is-empty','Available'],['is-partial','Reserved'],['is-full','Full']]
  };
  function render(host,opt){
    if(!host||typeof host.replaceChildren!=='function')return null;
    const tables=Array.isArray(opt&&opt.tables)?opt.tables:[],context=opt&&opt.context==='guest'?'guest':'admin';
    const wrap=document.createElement('section');wrap.className='seat-map seat-map--'+context;
    if(!tables.length){const p=document.createElement('p');p.className='seat-map-empty';p.textContent='No saved tables to map yet.';wrap.append(p);host.replaceChildren(wrap);return wrap;}
    const stage=document.createElement('div');stage.className='seat-map-stage';stage.textContent=(opt&&opt.stage)||'Sam & Jossy';
    const grid=document.createElement('div');grid.className='seat-map-grid';
    for(const t of tables){
      const state=context==='guest'?guestState(t,opt&&opt.mine):adminState(t);
      const tile=document.createElement(opt&&opt.interactive?'button':'span');
      tile.className='seat-tile '+state;
      tile.textContent=label(t);
      tile.setAttribute('aria-label',describe(t,state));
      if(opt&&opt.interactive){tile.type='button';tile.dataset.tableId=t.id;tile.addEventListener('click',()=>opt.onPick&&opt.onPick(t.id));}
      grid.append(tile);
    }
    const entrance=document.createElement('div');entrance.className='seat-map-entrance';entrance.textContent=(opt&&opt.entrance)||'Main Entrance · Guest Check-In';
    const legend=document.createElement('div');legend.className='seat-map-legend';
    for(const [cls,text] of legends[context]){const chip=document.createElement('span');chip.className='seat-legend-chip '+cls;chip.textContent=text;legend.append(chip);}
    wrap.append(stage,grid,entrance,legend);
    host.replaceChildren(wrap);
    return wrap;
  }
  /* Zoom scales tile sizes through a CSS variable, so layout never clips. */
  function zoomGrid(host,delta){
    const grid=host&&host.querySelector?host.querySelector('.seat-map-grid'):null;
    if(!grid)return null;
    const read=()=>{const raw=grid.style&&grid.style.getPropertyValue?grid.style.getPropertyValue('--seat-zoom'):'';const value=parseFloat(raw);return Number.isFinite(value)?value:1;};
    const next=Math.min(1.6,Math.max(.7,Math.round((read()+delta)*100)/100));
    grid.style.setProperty('--seat-zoom',next.toFixed(2));
    return next;
  }
  return {render,zoomGrid};
});
