(()=>{'use strict';
const D=window.GK_GUIDE_DATA, T=window.GK_INDIVIDUAL_TIMELINE, $=q=>document.querySelector(q);
if(!D||!T)return;
const byId=Object.fromEntries(D.skills.map(p=>[p.id,p]));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const select=$('#indSkill'),day=$('#indDay');
D.skills.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.id+' · '+p.name+'｜'+p.venue;select.append(o)});
let id=new URLSearchParams(location.search).get('skill');if(!byId[id])id='01';select.value=id;
function render(){const p=byId[select.value],rows=T.programs[p.id]||[],filter=day.value;
 $('#indCode').textContent=p.id;$('#indTitle').textContent=p.name;$('#indVenue').textContent=p.venue;
 $('#indReg').textContent=p.registrationTime;$('#indRegPlace').textContent=p.registrationPlace;
 $('#indTheory').textContent=p.theory||'依公告';$('#indPractical').textContent=p.practical||'依公告';$('#indMeeting').textContent=p.meeting||'依公告';
 $('#indVenueLink').href='venues.html?venue='+encodeURIComponent(p.venueId);const deep=$('#indSixthLink');if(deep)deep.href='sixth/index.html?program='+p.id+'#studentTimeline';
 $('#indFloorLink').hidden=!/行政大樓/.test(p.theory||'');$('#indFloorLink').href='floor.html?skill='+p.id;
 const dates=filter==='all'?['11/24','11/25','11/26']:[filter];let html='';
 for(const d of dates){const events=rows.filter(r=>r.day===d);if(!events.length)continue;
  html+=`<h3 class="ind-day-title">115 年 ${d}（${{'11/24':'二','11/25':'三','11/26':'四'}[d]}） · ${events.length} 項</h3>`;
  for(const e of events){let desc=String(e.detail||'');
   html+=`<div class="ind-entry"><time>${esc(e.time||'時間依原表')}</time><div><strong>${esc(e.subject)}</strong>${desc?(desc.length>320?`<details><summary>查看完整考試項目／內容</summary><p>${esc(desc)}</p></details>`:`<p>${esc(desc)}</p>`):''}${e.note?`<small>${esc(e.note)}</small>`:''}</div></div>`;
  }
 }
 $('#indEvents').innerHTML=html||'<p>這一日原始表中沒有列出獨立活動，請依職種最新公告。</p>';
 const u=new URL(location.href);u.searchParams.set('skill',p.id);try{history.replaceState(null,'',u.pathname+u.search+u.hash)}catch(err){}
 $('#indOpenLink').href=u.href;$('#indOpenLink').textContent='開啟 '+p.id+' '+p.name+' 專屬網址 ↗';
}
select.addEventListener('change',render);day.addEventListener('change',render);
$('#copyCurrent').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#indOpenLink').href);$('#copyCurrent').textContent='✓ 已複製網址';setTimeout(()=>$('#copyCurrent').textContent='複製職種專屬網址',2000)}catch(e){$('#copyCurrent').textContent='請複製網址列'} });
$('#printCurrent').addEventListener('click',()=>window.print());render();
})();
