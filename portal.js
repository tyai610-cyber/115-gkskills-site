/* 115 工科賽｜單一資訊入口，純前端、離線可使用 */
(()=>{'use strict';
const D=window.GK_GUIDE_DATA;if(!D)return;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const page=document.body.dataset.page; const qs=new URLSearchParams(location.search);
const byId=Object.fromEntries(D.skills.map(s=>[s.id,s]));const venues=Object.fromEntries(D.venues.map(v=>[v.id,v]));
function queryUpdate(k,value){try{const u=new URL(location.href);u.searchParams.set(k,value);history.replaceState(null,'',u.pathname+u.search+u.hash);}catch(e){}}
const matchSkill=(s,q)=>!q||[s.id,s.name,s.venue,s.registrationPlace,s.theory].some(x=>String(x||'').toLowerCase().includes(q.toLowerCase()));
function initHome(){
 const search=$('#quickSkillSearch'),res=$('#quickSkillResults');
 const renderResults=()=>{const q=search.value.trim();const found=q?D.skills.filter(s=>matchSkill(s,q)).slice(0,9):[];res.innerHTML=q?(found.length?found.map(s=>`<a href="skills.html?skill=${s.id}"><span>${s.id} ${esc(s.name)}</span><small>${esc(s.venue)}</small></a>`).join(''):'<p class="quick-no-results" role="status">查無符合職種，請更換名稱或編號。</p>'):'';};
 search.addEventListener('input',renderResults);search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const q=search.value.trim(),one=D.skills.find(s=>matchSkill(s,q));if(one)location.href=`skills.html?skill=${one.id}`;else location.href=`skills.html?q=${encodeURIComponent(q)}`}});
 const promo=$('.portal-event-box'),hero=$('.portal-hero-layout'),entrances=$('#entrances');
 if(promo&&hero&&entrances){const mq=window.matchMedia('(max-width:620px)');const arrange=()=>{if(mq.matches){entrances.insertAdjacentElement('afterend',promo);promo.classList.add('portal-event-after-entrances');}else{hero.appendChild(promo);promo.classList.remove('portal-event-after-entrances');}};arrange();if(mq.addEventListener)mq.addEventListener('change',arrange);else mq.addListener(arrange);}
}
function initSkills(){
 const input=$('#skillQuery'),v=$('#skillVenue'),list=$('#skillList'),detail=$('#skillDetail');
 D.venues.forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=x.name+'（'+x.count+'職種）';v.append(o)});
 let id=byId[qs.get('skill')]?qs.get('skill'):'01';
 if(qs.get('q'))input.value=qs.get('q');
 const draw=()=>{
  const matches=D.skills.filter(s=>(v.value==='all'||s.venueId===v.value)&&matchSkill(s,input.value.trim()));
  if(!matches.some(s=>s.id===id)&&matches.length)id=matches[0].id;
  $('#skillSummary').textContent='符合條件 '+matches.length+'／29 個職種；點選可查看報到及試場。';
  list.innerHTML=matches.map(s=>`<button type="button" data-skill="${s.id}" aria-pressed="${id===s.id}"><span class="skill-num">${s.id}</span><span><b>${esc(s.name)}</b><small>${esc(s.venue)}</small></span></button>`).join('')||'<p>查無符合條件的職種，請調整名稱或場域。</p>';
  const s=matches.find(x=>x.id===id);if(!s){detail.innerHTML='<h2>沒有符合條件的職種</h2>';return}
  detail.innerHTML=`<div class="skill-ident"><div><span class="skill-code">SKILL ${s.id} / 29</span><h2>${esc(s.name)}</h2></div><span class="skill-venue">${esc(s.venue)}</span></div><div class="skill-info-grid"><section class="skill-reg"><small>11/24 報到時間</small><strong>${esc(s.registrationTime)}</strong></section><section><small>報到位置</small><strong>${esc(s.registrationPlace)}</strong></section><section><small>學科／筆試位置</small><strong>${esc(s.theory)}</strong></section><section><small>術科／試場位置</small><strong>${esc(s.practical)}</strong></section><section><small>領隊會議及賽後檢討</small><strong>${esc(s.meeting)}</strong></section><section><small>所在競賽場域</small><strong>${esc(s.venue)}</strong></section></div><div class="skill-detail-actions"><a href="venues.html?venue=${s.venueId}">查看場域導覽圖 ↗</a><a href="agenda.html?day=24" class="secondary">查看大會報到日程 ↗</a><a href="sixth/index.html?program=${s.id}#explorer">進階互動定位／199 筆整理後行程 ↗</a><a href="individual.html?skill=${s.id}" class="secondary">查看本職種三日逐項行程 ↗</a>${/行政大樓/.test(s.theory)?`<a href="floor.html?skill=${s.id}" class="secondary">行政大樓教室格位 ↗</a>`:""}</div><p class="skill-footnote">來源：${esc(s.source)}；報到資料取自 Excel「報到」工作表。術科各梯次時間仍須依職種詳細日程。</p>`;
  queryUpdate('skill',id);
 };
 list.addEventListener('click',e=>{const b=e.target.closest('[data-skill]');if(!b)return;id=b.dataset.skill;draw()});input.addEventListener('input',draw);v.addEventListener('change',draw);draw();
}
function initVenues(){
 let id=venues[qs.get('venue')]?qs.get('venue'):'nkh',type=0,zoom=1;
 const tabs=$('#venueTabs'),mapTypes=$('#mapTypes'),image=$('#venueMapImage'),viewport=$('#venueMapViewport');
 function draw(){
  const v=venues[id];if(!v)return;
  if(type>=v.maps.length)type=0;
  tabs.innerHTML=D.venues.map(x=>`<button type="button" data-venue="${x.id}" aria-pressed="${x.id===id}">${esc(x.name)} · ${x.count}</button>`).join('');
  mapTypes.innerHTML=v.maps.map((m,i)=>`<button type="button" data-map="${i}" aria-pressed="${i===type}">${esc(m.name)}</button>`).join('');
  $('#venueTitle').textContent=v.name;$('#venueHint').textContent=`${v.count} 個職種 · ${v.maps.length} 張來源圖 · 會議分流參考：${v.meetingHint}`;
  image.src=v.maps[type].src;image.alt=`${v.name}：${v.maps[type].name}（11/12 來源圖網頁縮圖）`;
  const programs=D.skills.filter(s=>s.venueId===id);$('#venueCount').textContent=programs.length;
  $('#venuePrograms').innerHTML=programs.map(s=>`<button type="button" data-skill="${s.id}">${s.id}　${esc(s.name)}　↗</button>`).join('');const deep=$('#venueDeepLink');if(deep){deep.href='sixth/index.html?venue='+encodeURIComponent(id)+'#explorer';deep.textContent='原版互動定位（'+v.name+'） ↗';}
  setZoom(1);queryUpdate('venue',id);
 }
 function setZoom(value){zoom=Math.min(3.5,Math.max(1,Math.round(value*10)/10));image.style.width=zoom*100+'%';$('#venueZoomText').textContent=Math.round(zoom*100)+'%';if(zoom===1){viewport.scrollLeft=0;viewport.scrollTop=0}}
 tabs.addEventListener('click',e=>{const b=e.target.closest('[data-venue]');if(!b)return;id=b.dataset.venue;type=0;draw()});
 mapTypes.addEventListener('click',e=>{const b=e.target.closest('[data-map]');if(!b)return;type=+b.dataset.map;draw()});
 $('#venuePrograms').addEventListener('click',e=>{const b=e.target.closest('[data-skill]');if(b)location.href=`skills.html?skill=${b.dataset.skill}`});
 $('#mapPlus').addEventListener('click',()=>setZoom(zoom+.25));$('#mapMinus').addEventListener('click',()=>setZoom(zoom-.25));$('#mapReset').addEventListener('click',()=>setZoom(1));draw();
}
if(page==='home')initHome();else if(page==='skills')initSkills();else if(page==='venues')initVenues();
})();
