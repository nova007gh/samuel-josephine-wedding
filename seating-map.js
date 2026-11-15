/* Shared seating map: one renderer for the admin dashboard and the guest pass. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SeatingMap=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const SVG='http://www.w3.org/2000/svg';
  const label=t=>String(t.name||'Table');
  function adminState(t){return t.capacity>0&&t.used>=t.capacity?'is-full':t.checkedSeats>0?'is-active':t.used>0?'is-partial':'is-empty';}
  function guestState(t,mine){return t.id===mine?'is-mine':t.capacity>0&&t.used>=t.capacity?'is-full':t.used>0?'is-partial':'is-empty';}
  const describe=(t,state)=>label(t)+': '+(state==='is-mine'?'your table':state==='is-full'?'full':state==='is-active'?'guests checked in':state==='is-partial'?'partly reserved':'available')+', '+t.used+' of '+t.capacity+' seats reserved';
  const legends={
    admin:[['is-active','Checked in / Active'],['is-partial','Partially Filled'],['is-full','Full'],['is-empty','Empty / Reserved']],
    guest:[['is-mine','My Table'],['is-empty','Available'],['is-partial','Reserved'],['is-full','Full']]
  };
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
  function pin(){
    const svg=document.createElementNS(SVG,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','seat-tile-pin');svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS(SVG,'path');path.setAttribute('d','M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5');
    path.setAttribute('fill','currentColor');svg.append(path);return svg;
  }
  function render(host,opt){
    if(!host||typeof host.replaceChildren!=='function')return null;
    const tables=Array.isArray(opt&&opt.tables)?opt.tables:[],context=opt&&opt.context==='guest'?'guest':'admin';
    const wrap=el('section','seat-map seat-map--'+context);
    if(!tables.length){wrap.append(el('p','seat-map-empty','No saved tables to map yet.'));host.replaceChildren(wrap);return wrap;}
    const stage=el('div','seat-map-stage'+(opt&&opt.photo?' has-photo':''));
    const title=el('span','seat-map-stage-title',(opt&&opt.stage)||'Sam & Jossy');
    const grid=el('div','seat-map-grid');
    for(const t of tables){
      const state=context==='guest'?guestState(t,opt&&opt.mine):adminState(t);
      const tile=document.createElement(opt&&opt.interactive?'button':'span');
      tile.className='seat-tile '+state;
      tile.setAttribute('aria-label',describe(t,state));
      tile.append(el('span','seat-tile-name',label(t)),el('small','seat-tile-count',(t.used||0)+'/'+(t.capacity||0)));
      if(context==='guest'&&opt&&opt.mine&&t.id===opt.mine)tile.append(pin());
      if(opt&&opt.interactive){tile.type='button';tile.dataset.tableId=t.id;tile.addEventListener('click',()=>opt.onPick&&opt.onPick(t.id));}
      grid.append(tile);
    }
    const entrance=el('div','seat-map-entrance',(opt&&opt.entrance)||'Main Entrance · Guest Check-In');
    stage.append(title,grid,entrance);
    const legend=el('div','seat-map-legend');
    for(const [cls,text] of legends[context])legend.append(el('span','seat-legend-chip '+cls,text));
    wrap.append(stage,legend);
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
