/* 115 工科賽大會資訊專區 v1.0 - 無第三方依賴，可離線使用 */
(() => {
'use strict';
const page=document.body.dataset.page;
const DATA=window.GK_EVENT_DATA;
if(!DATA){document.body.insertAdjacentHTML('afterbegin','<p role="alert">活動資料載入失敗。</p>');return;}
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=new URL(location.href);
function setQuery(k,v){try{const u=new URL(location.href);u.searchParams.set(k,v);history.replaceState({},'',u.pathname+u.search+u.hash)}catch(e){}}
const labels={checkin:'報到／點名',meeting:'會議',contest:'競賽',rest:'休息',press:'記者會',ceremony:'典禮',other:'其他'};
const titleDays={'24':['11 月 24 日','星期二','TUESDAY · NOV 24'], '25':['11 月 25 日','星期三','WEDNESDAY · NOV 25'], '26':['11 月 26 日','星期四','THURSDAY · NOV 26'], '27':['11 月 27 日','星期五','FRIDAY · NOV 27']};
function initHeader(){
 const nav=$(`[data-nav="${page}"]`);if(nav)nav.classList.add('active');
 const menu=$('#menuButton'),mn=$('#mobileNav');if(menu){menu.addEventListener('click',()=>{const open=mn.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))})}
}
function startAgenda(){
 const A=DATA.agenda;
 const params=new URLSearchParams(location.search);
 let day=A.days.includes(params.get('day'))?params.get('day'):'24';
 let venue=params.get('venue')||'all';
 const venueBox=$('#agendaVenue');
 venueBox.innerHTML='<option value="all">全部場域（查看分流）</option>'+Object.entries(A.venues).map(([key,v])=>`<option value="${key}">${esc(v.name)} (${v.count} 職種)</option>`).join('');
 if(!A.venues[venue] || day==='27')venue='all';venueBox.value=venue;
 const fmt=(t)=>/^\d\d:\d\d/.exec(t)?.[0]||t;
 const dayRender=()=>{
  $('#dayTabs').innerHTML=A.days.map(d=>`<button type="button" role="tab" data-day="${d}" aria-selected="${d===day}" class="${d===day?'active':''}"><small>星期${{'24':'二','25':'三','26':'四','27':'五'}[d]}</small><strong>11/${d}</strong></button>`).join('');
  $('#agendaDateEn').textContent=titleDays[day][2];$('#agendaDateTitle').innerHTML=`${titleDays[day][0]} <small>${titleDays[day][1]}</small>`;
  // 11/27 的22個程序以典禮詳細表 p.122–123 為主要來源。原大會概覽留在頁面差異說明。
  const dayEvents=day==='27'?[...DATA.ceremony.events.map(x=>({id:'detail-'+x.id,date:'27',time:x.time,title:x.title,kind:x.kind==='registration'?'checkin':'ceremony',who:['all'],place:DATA.ceremony.venue,detail:'典禮詳細程序；依 p.122–123',source:x.source,flag:null,venues:[]})),...A.events.filter(e=>e.id==='27-20')]:A.events.filter(ev=>ev.date===day);
  if($('#agendaCeremonyPriority'))$('#agendaCeremonyPriority').hidden=day!=='27';
  if($('#agendaLegacy'))$('#agendaLegacy').hidden=day!=='27';
  venueBox.disabled=day==='27';
  venueBox.title=day==='27'?'11/27 典禮地點為桃園市立綜合體育館，不適用七場域篩選。':'';
  const venueSide=$('#agendaVenueSidebar');if(venueSide)venueSide.hidden=day==='27';
  const specialRegistration=$('#agendaSpecialRegistration');if(specialRegistration)specialRegistration.hidden=day!=='24';
  const venueLabel=$('#agendaVenueLabel');if(venueLabel)venueLabel.textContent=day==='27'?'11/27 典禮於桃園市立綜合體育館（不適用七場域篩選）':'會議場域';
  if(day==='27'){venue='all';venueBox.value='all';setQuery('venue','all');}
  const shown=dayEvents.filter(ev=>{
   if(venue!=='all'&&ev.venues.length&&!ev.venues.includes(venue))return false;
   return true;
  }).sort((a,b)=>fmt(a.time).localeCompare(fmt(b.time)));
  $('#agendaSummary').textContent=day==='27'?`典禮詳細表 22 項程序＋賦歸 1 項；目前顯示 ${shown.length} 項。以 07:40–08:10 報到、08:50 正式開始為主要時程。`: `本日大會概覽 ${dayEvents.length} 項；目前顯示 ${shown.length} 項。個別職種仍以專屬日程為準。`;
  $('#agendaList').innerHTML=shown.length?shown.map(ev=>{
   const hasVenue=venue!=='all'&&!ev.venues.length&&ev.who.includes('judge');
   const place=hasVenue?A.venues[venue].name+'（依該場域安排）':ev.place;
   return `<article class="agenda-item"><time class="agenda-time">${esc(ev.time)}</time><div class="agenda-card"><div class="agenda-main"><span class="kind-chip kind-${esc(ev.kind)}">${esc(labels[ev.kind]||'活動')}</span><h3>${esc(ev.title)}</h3><div class="agenda-place">⌖ ${esc(place)}</div>${ev.detail?`<p style="margin-top:11px">${esc(ev.detail)}</p>`:''}${ev.flag?`<p class="agenda-flags">⚠ ${esc(ev.flag)}</p>`:''}<p class="source-tiny" style="font-size:10px;color:#8ba1a8;margin-top:9px">來源：大會手冊 ${esc(ev.source)}</p></div></div></article>`
  }).join(''):'<div class="no-records">此日期與場域條件下，原始大會日程未列出活動；請改選其他場域，或參閱個別職種日程與原始 PDF。</div>';
  $('#venueCards').innerHTML=Object.entries(A.venues).map(([key,v])=>`<div><button type="button" class="venue-button ${venue===key?'active':''}" data-venue="${key}" aria-expanded="${venue===key}"><span class="venue-count">${v.count}</span><span class="venue-copy"><b>${esc(v.name)}</b><small>${esc(v.hint)}</small></span><span class="venue-expand">${venue===key?'−':'＋'}</span></button>${venue===key?`<div class="venue-details">${esc(v.skills.join('、'))}</div>`:''}</div>`).join('');
  setQuery('day',day);
 };
 $('#dayTabs').addEventListener('click',ev=>{const b=ev.target.closest('button[data-day]');if(!b)return;day=b.dataset.day;if(day==='27'){venue='all';venueBox.value='all';setQuery('venue','all')}dayRender()});
 venueBox.addEventListener('change',()=>{if(day==='27'){venue='all';venueBox.value='all';}else venue=venueBox.value;setQuery('venue',venue);dayRender()});
 $('#venueCards').addEventListener('click',ev=>{if(day==='27')return;const b=ev.target.closest('button[data-venue]');if(!b)return;venue=venue===b.dataset.venue?'all':b.dataset.venue;venueBox.value=venue;setQuery('venue',venue);dayRender()});
 $('#resetAgenda').addEventListener('click',()=>{day='24';venue='all';venueBox.value='all';setQuery('venue','all');dayRender()});
 dayRender();
}
function startCeremony(){
 const data=DATA.ceremony.events;
 let filter='all';
 const filters=[['all','全部 22 項'],['awarding','頒獎與表揚'],['performance','演出節目'],['registration','報到'],['ceremony','典禮程序'],['final','會旗交接']];
 function render(){
  $('#ceremonyFilters').innerHTML=filters.map(([key,label])=>`<button type="button" data-filter="${key}" class="${filter===key?'active':''}" aria-pressed="${filter===key}">${label}</button>`).join('');
  const shown=filter==='all'?data:data.filter(x=>x.kind===filter || (filter==='ceremony' && x.kind==='milestone'));
  $('#ceremonyList').innerHTML=shown.map((x)=>{
   const kindMap={registration:'報到',ceremony:'典禮',performance:'表演',awarding:'頒獎',milestone:'重要節點',final:'交接'};
   return `<article class="ceremony-row ${x.kind==='awarding'?'award':''} ${x.kind==='milestone'?'milestone':''}" role="button" tabindex="0" aria-pressed="false" aria-label="選取程序：${esc(x.time)} ${esc(x.title)}" data-ceremony="${x.id}"><time class="time">${esc(x.time)}</time><h3>${esc(x.title)}</h3><span class="kind">${esc(kindMap[x.kind])}</span></article>`;
  }).join('');
 }
 $('#ceremonyFilters').addEventListener('click',e=>{const b=e.target.closest('button[data-filter]');if(!b)return;filter=b.dataset.filter;render()});
 function selectCeremonyRow(row){if(!row)return;const activate=!row.classList.contains('selected');$$('.ceremony-row').forEach(x=>{const selected=activate&&x===row;x.classList.toggle('selected',selected);x.setAttribute('aria-pressed',String(selected));});}
 $('#ceremonyList').addEventListener('click',e=>selectCeremonyRow(e.target.closest('.ceremony-row')));
 $('#ceremonyList').addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const row=e.target.closest('.ceremony-row');if(!row)return;e.preventDefault();selectCeremonyRow(row);});
 render();
}
function startTransport(){
 const items=DATA.transport.items;
 let active=items.find(x=>x.id===new URLSearchParams(location.search).get('route'))||items[0];
 let zoom=1,playing=!window.matchMedia('(prefers-reduced-motion: reduce)').matches,step=0;
 let timer=null;
 const nav=$('#transportNav'),viewport=$('#transportMapViewport'),image=$('#transportImage');
 function render(){
  nav.innerHTML=items.map((x,i)=>`<button type="button" role="tab" data-route="${x.id}" aria-selected="${active.id===x.id}"><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(x.short)}</strong></button>`).join('');
  $('#mapNum').textContent=`FIGURE ${String(active.fig).padStart(2,'0')} / 07`;
  $('#transportTitle').textContent=active.name;
  image.src=active.image;image.alt=`大會手冊第 ${active.page} 頁圖${active.fig}：${active.name}，原始箭頭及圖例完整保留`;
  $('#transportSource').textContent=`來源：大會手冊 p.${active.page} · 圖${['一','二','三','四','五','六','七'][active.fig-1]}`;
  $('#transportAudience').textContent=active.audience;
  $('#transportName').textContent=active.name;
  $('#transportSummary').textContent=active.summary;
  $('#transportNotes').innerHTML=active.notes.map(n=>`<li>${esc(n)}</li>`).join('');
  $('#transportSteps').innerHTML=active.steps.map((x,i)=>`<li data-step="${i}" class="${step===i?'current':''}">${esc(x)}</li>`).join('');
  $('#transportPdfLink').href=`assets/source/traffic.pdf#page=${active.fig}`;
  setQuery('route',active.id);
  updateZoom(1);
  updateStepButton();
 }
 function updateStepButton(){
  $('#stepPlay').textContent=playing?'⏸ 暫停輪播':'▶ 播放步驟';
  [...$('#transportSteps').children].forEach((li,i)=>li.classList.toggle('current',i===step));
 }
 function stopTimer(){if(timer){clearInterval(timer);timer=null}}
 function schedule(){stopTimer();if(!playing)return;timer=setInterval(()=>{step=(step+1)%active.steps.length;updateStepButton()},2000)}
 function updateZoom(v){zoom=Math.max(.7,Math.min(2.8,Math.round(v*10)/10));image.style.width=`${zoom*100}%`;$('#zoomPct').textContent=`${Math.round(zoom*100)}%`;if(zoom===1){viewport.scrollLeft=0;viewport.scrollTop=0;}}
 nav.addEventListener('click',e=>{const b=e.target.closest('button[data-route]');if(!b)return;active=items.find(x=>x.id===b.dataset.route)||items[0];step=0;render();schedule()});
 $('#stepPlay').addEventListener('click',()=>{playing=!playing;updateStepButton();schedule()});
 $('#transportSteps').addEventListener('click',e=>{const li=e.target.closest('li[data-step]');if(!li)return;step=+li.dataset.step;updateStepButton()});
 $('#mapZoomIn').addEventListener('click',()=>updateZoom(zoom+.3));
 $('#mapZoomOut').addEventListener('click',()=>updateZoom(zoom-.3));
 $('#mapZoomReset').addEventListener('click',()=>updateZoom(1));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopTimer();else schedule()});
 // In the standalone module the prior campus animation may not yet exist; hide unresolved links.
 window.addEventListener('pagehide',stopTimer,{once:true});
 render();schedule();
}
initHeader();
if(page==='agenda')startAgenda();
if(page==='ceremony')startCeremony();
if(page==='transport')startTransport();
})();
