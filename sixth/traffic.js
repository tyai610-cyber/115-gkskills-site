/* 北科附工樹木避讓動畫 v0.3：不宣稱已核定通行，路網碰撞只依圖面遮罩。 */
(()=>{
'use strict';
const D=window.GK_ANY_DATA;if(!D)throw Error('未載入交通圖資料');
const $=s=>document.querySelector(s), byId=Object.fromEntries(D.locations.map(p=>[p.id,p]));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const pos=p=>[p.x,p.y];
const MAP_W=1000,MAP_H=667,STEP=8,W=126,H=84;
let start=byId.gate,end=byId.admin,mode='walk',pick=null,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,zoom=1,showAvoidance=true;
let latest={pts:[],error:'未計算',distance:0};
const $map=$('#mapCanvas'),$viewport=$('#viewport'),$svg=$('#routeSvg');
const clearance=()=>mode==='wide'?12:5;
function blocked([x,y],pad=5){
 if(x<0||x>MAP_W||y<0||y>MAP_H)return true;
 return D.obstacles.some(o=>{
  if(o.shape==='rect')return x>=o.x-pad&&x<=o.x+o.w+pad&&y>=o.y-pad&&y<=o.y+o.h+pad;
  const rx=o.rx+pad,ry=o.ry+pad;return ((x-o.cx)/rx)**2+((y-o.cy)/ry)**2<=1;
 });
}
function hitsObstacle([x,y]){
 return D.obstacles.find(o=>{
  if(o.shape==='rect')return x>=o.x&&x<=o.x+o.w&&y>=o.y&&y<=o.y+o.h;
  return ((x-o.cx)/o.rx)**2+((y-o.cy)/o.ry)**2<=1;
 });
}
function lineClear(a,b,pad){
 const length=dist(a,b),steps=Math.max(1,Math.ceil(length/2.5));
 for(let i=0;i<=steps;i++){const t=i/steps;if(blocked([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],pad))return false;}
 return true;
}
const grids={};
function makeGrid(pad){
 const key=String(pad);if(grids[key])return grids[key];
 const a=new Uint8Array(W*H);for(let j=0;j<H;j++)for(let i=0;i<W;i++)a[j*W+i]=+blocked([i*STEP,j*STEP],pad);
 return(grids[key]=a);
}
function nearestGrid(p,pad,occ){
 // Only candidates connected to the original point without crossing a blocked zone.
 let best=null;const i0=Math.round(p[0]/STEP),j0=Math.round(p[1]/STEP);
 for(let r=0;r<=13;r++){
  for(let j=Math.max(0,j0-r);j<=Math.min(H-1,j0+r);j++)for(let i=Math.max(0,i0-r);i<=Math.min(W-1,i0+r);i++){
   if(Math.max(Math.abs(i-i0),Math.abs(j-j0))!==r)continue;
   const ix=j*W+i;if(occ[ix])continue;
   const q=[i*STEP,j*STEP],d=dist(p,q);if(best&&d>=best.distance)continue;
   if(lineClear(p,q,pad))best={ix,distance:d};
  }
  if(best&&r*STEP>best.distance+STEP)break;
 }
 return best?.ix??null;
}
function heapPush(h,e){h.push(e);let k=h.length-1;while(k>0){let p=(k-1)>>1;if(h[p][0]<=e[0])break;h[k]=h[p];k=p;}h[k]=e;}
function heapPop(h){let top=h[0],last=h.pop();if(h.length){let k=0;while(true){let l=k*2+1;if(l>=h.length)break;let r=l+1,c=r<h.length&&h[r][0]<h[l][0]?r:l;if(last[0]<=h[c][0])break;h[k]=h[c];k=c;}h[k]=last;}return top;}
const around=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
function pathGrid(a,b,pad){
 const occ=makeGrid(pad),origin=nearestGrid(a,pad,occ),goal=nearestGrid(b,pad,occ);
 if(origin===null||goal===null)return null;
 const total=W*H,g=new Float64Array(total);g.fill(Infinity);
 const came=new Int32Array(total);came.fill(-1);
 const visited=new Uint8Array(total),open=[];
 const targetX=goal%W,targetY=Math.floor(goal/W);
 const heuristic=ix=>Math.hypot((ix%W-targetX)*STEP,(Math.floor(ix/W)-targetY)*STEP);
 g[origin]=0;heapPush(open,[heuristic(origin),origin]);
 while(open.length){
  const [,u]=heapPop(open);if(visited[u])continue;visited[u]=1;
  if(u===goal)break;
  const x=u%W,y=(u/W)|0;
  for(const [dx,dy,cost] of around){
   const nx=x+dx,ny=y+dy;if(nx<0||nx>=W||ny<0||ny>=H)continue;
   const v=ny*W+nx;if(visited[v]||occ[v])continue;
   // Corner-cut prevention: a diagonal cannot pass between two blocked cells.
   if(dx&&dy&&(occ[y*W+nx]||occ[ny*W+x]))continue;
   const value=g[u]+cost*STEP;if(value>=g[v])continue;
   g[v]=value;came[v]=u;heapPush(open,[value+heuristic(v),v]);
  }
 }
 if(!Number.isFinite(g[goal]))return null;
 const route=[];let u=goal;while(u>=0){route.push([(u%W)*STEP,Math.floor(u/W)*STEP]);if(u===origin)break;u=came[u];}
 route.reverse();const pts=[a,...route,b].filter((p,i,arr)=>i===0||dist(p,arr[i-1])>0.1);
 // Greedy line-of-sight smoothing; every resulting segment is collision-tested.
 const clean=[pts[0]];let i=0;while(i<pts.length-1){let j=pts.length-1;while(j>i+1&&!lineClear(pts[i],pts[j],pad))j--;if(!lineClear(pts[i],pts[j],pad))return null;clean.push(pts[j]);i=j;}
 return clean;
}
function getRoute(a,b,md=mode){
 const pad=md==='wide'?12:5;
 if(dist(a,b)<1)return {pts:[a],error:null,distance:0};
 if(blocked(a,pad))return {pts:[],error:'起點落在樹木／花圃避讓區，請在周邊道路重新選點。'};
 if(blocked(b,pad))return {pts:[],error:'終點落在樹木／花圃避讓區，請在周邊道路重新選點。'};
 const pts=pathGrid(a,b,pad);
 if(!pts)return {pts:[],error:'目前遮罩下沒有可驗證的避樹示意路線。請改選外緣位置或縮小避讓距離。'};
 if(pts.some((p,i)=>i>0&&!lineClear(pts[i-1],p,pad)))return {pts:[],error:'碰撞檢查未通過，停止顯示路線。'};
 return {pts,error:null,distance:pts.slice(1).reduce((sum,p,i)=>sum+dist(p,pts[i]),0)};
}
function pointToken(p){return p.id==='custom'?`p:${Math.round(p.x*10)/10},${Math.round(p.y*10)/10}`:p.id;}
function decodePoint(raw){
 if(!raw)return null;if(byId[raw])return byId[raw];
 const m=/^p:([0-9.]+),([0-9.]+)$/.exec(raw);
 if(m){const x=+m[1],y=+m[2];if(Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=MAP_W&&y>=0&&y<=MAP_H)return{id:'custom',name:`地圖自選位置（${Math.round(x)}, ${Math.round(y)}）`,group:'自選',x,y};}
 return null;
}
function updateOptions(which){
 const el=$('#'+which+'Select'),p=which==='start'?start:end;
 el.innerHTML=['入口','服務','學科','建築','設施'].map(group=>`<optgroup label="${group}">${D.locations.filter(x=>x.group===group).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</optgroup>`).join('');
 if(p.id==='custom')el.innerHTML=`<optgroup label="自選點"><option value="custom">${esc(p.name)}</option></optgroup>`+el.innerHTML;
 el.value=p.id;
}
function syncUrl(){try{const url=new URL(location.href);url.searchParams.set('from',pointToken(start));url.searchParams.set('to',pointToken(end));url.searchParams.set('mode',mode);history.replaceState(null,'',url.pathname+url.search+url.hash);}catch(e){}}
function zoneSvg(){
 if(!showAvoidance)return '';
 const shape=o=>o.shape==='rect'?`<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="2"/>`:`<ellipse cx="${o.cx}" cy="${o.cy}" rx="${o.rx}" ry="${o.ry}"/>`;
 return `<defs><pattern id="avoid-hatch" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(45)"><rect width="9" height="9" fill="#b14b42" fill-opacity=".10"/><line x1="0" y1="0" x2="0" y2="9" stroke="#b14b42" stroke-opacity=".45" stroke-width="3"/></pattern></defs>`+D.obstacles.map(o=>`<g class="avoid-zone" aria-label="避讓區：${esc(o.name)}"><title>${esc(o.name)}（不可穿越示意）</title>${shape(o).replace('/>',' fill="url(#avoid-hatch)" stroke="#c05a4c" stroke-width="2" stroke-dasharray="6 5"/>')}</g>`).join('');
}
function render(updateUrl=true){
 updateOptions('start');updateOptions('end');$('#fromLabel').textContent=start.name;$('#toLabel').textContent=end.name;
 const vehicle=['rear','truck22','car23'].includes(start.id)||['rear','truck22','car23'].includes(end.id);
 const p=pos(start),q=pos(end);latest=getRoute(p,q);
 const result=latest,pts=result.pts;
 document.querySelectorAll('.mode-btn').forEach(b=>{let selected=b.dataset.mode===mode;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
 $('#modeExplain').textContent=mode==='wide'?'樹木避讓範圍加寬，若沒有可用路線則不繪製穿越樹木的捷徑。':'沿圖面樹木與花圃之外尋找較短的示意路線，不能保證校園道路可通行。';
 const labels=(v,word,type)=>`<g><circle cx="${v.x}" cy="${v.y}" r="14" class="point-ring"/><circle cx="${v.x}" cy="${v.y}" r="11" class="pin pin-${type}"/><text x="${v.x}" y="${v.y+4.5}" text-anchor="middle" fill="white" font-weight="900" font-size="11">${type==='start'?'起':'終'}</text><text class="map-label" x="${clamp(v.x+17,18,840)}" y="${clamp(v.y-13,18,641)}">${esc(word)}</text></g>`;
 $('#poiMarkers').innerHTML=labels(start,'起點','start')+labels(end,'終點','end');
 $('#graphPath').innerHTML=zoneSvg();
 if(result.error){$('#animatedPath').innerHTML='';$('#tripMeta').textContent='未產生路線：'+result.error;}
 else if(pts.length<2){$('#animatedPath').innerHTML='';$('#tripMeta').textContent='同一位置（如不同樓層），請參考館舍樓層圖。';}
 else {
  const line=pts.map(a=>a.join(',')).join(' '),path='M '+pts.map(a=>a[0]+' '+a[1]).join(' L ');
  const duration=clamp(result.distance/95,2.8,15).toFixed(1);
  $('#animatedPath').innerHTML=`<polyline class="route-halo" points="${line}"/><polyline class="route-stroke ${playing?'':'paused'}" points="${line}"/><path id="motionRoute" d="${path}" stroke="none" fill="none"/><g id="movingArrow"><path d="M -9 -6 L 7 0 L -9 6 Z" fill="#f4b642" stroke="white" stroke-width="2"/><animateMotion dur="${duration}s" repeatCount="indefinite" rotate="auto"><mpath href="#motionRoute"/></animateMotion></g>`;
  $('#tripMeta').textContent=`已計算不穿越樹木遮罩的示意折線｜${pts.length-1} 段｜避讓區 ${D.obstacles.length} 處`;
 }
 $('#routeWarning').textContent=(vehicle?'⚠ 本次涉及車輛入口，避樹動畫絕非核定車行路線，請勿據此駕駛。 ':'⚠ 僅完成樹木與花圃圖面避讓；其他建築、施工與步道仍待現勘。 ')+(D.disclaimers[mode]||'');
 $('#instructions').innerHTML=`<li>起點：「${esc(start.name)}」。</li><li>${result.error?esc(result.error):pts.length<2?'起終點共用圖面位置，請查看樓層資訊。':'沿青綠色動畫折線查看位置關係；路線已避開圖上的樹木遮罩，但不是已確認的可步行路徑。'}</li><li>目的地：「${esc(end.name)}」。正式行走請以現場指引為準。</li>`;
 if(!playing||matchMedia('(prefers-reduced-motion:reduce)').matches)$svg.pauseAnimations?.();else $svg.unpauseAnimations?.();
 if(updateUrl)syncUrl();
}
function pickMode(p){pick=pick===p?null:p;$map.classList.toggle('picking',!!pick);$('#mapClick').style.display=pick?'block':'none';$('#pickStart').classList.toggle('active',pick==='start');$('#pickEnd').classList.toggle('active',pick==='end');$('#pickStatus').textContent=pick?(pick==='start'?'點選地圖的開放空間作為起點':'點選地圖的開放空間作為終點'):'目前：下拉選擇模式（路線自動避讓樹木）';}
function tapMap(ev){
 if(!pick)return;const rect=$('#mapClick').getBoundingClientRect();let x=clamp((ev.clientX-rect.left)/rect.width*MAP_W,0,MAP_W),y=clamp((ev.clientY-rect.top)/rect.height*MAP_H,0,MAP_H);
 if(blocked([x,y],clearance())){$('#pickStatus').textContent='此處位於樹木／花圃避讓區，請在區外選點。';return;}
 const v={id:'custom',name:`地圖自選（${Math.round(x)}, ${Math.round(y)}）`,group:'自選',x:+x.toFixed(1),y:+y.toFixed(1)};
 if(pick==='start'){start=v;pickMode(null);pickMode('end');}else{end=v;pickMode(null);}render();
}
function setZoom(value){
 value=clamp(Math.round(value*10)/10,1,3.2);const prevW=$map.scrollWidth,prevH=$map.scrollHeight;
 const fx=prevW?($viewport.scrollLeft+$viewport.clientWidth/2)/prevW:.5,fy=prevH?($viewport.scrollTop+$viewport.clientHeight/2)/prevH:.5;
 zoom=value;$map.style.setProperty('--zoom',zoom);$('#zoomText').textContent=Math.round(zoom*100)+'%';
 requestAnimationFrame(()=>{$viewport.scrollLeft=Math.max(0,fx*$map.scrollWidth-$viewport.clientWidth/2);$viewport.scrollTop=Math.max(0,fy*$map.scrollHeight-$viewport.clientHeight/2);});
}
$('#startSelect').addEventListener('change',e=>{if(e.target.value==='custom')return;start=byId[e.target.value];render();});
$('#endSelect').addEventListener('change',e=>{if(e.target.value==='custom')return;end=byId[e.target.value];render();});
$('#swapPoints').addEventListener('click',()=>{[start,end]=[end,start];render();});
document.querySelectorAll('.mode-btn').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;render();}));
$('#pickStart').addEventListener('click',()=>pickMode('start'));$('#pickEnd').addEventListener('click',()=>pickMode('end'));$('#mapClick').addEventListener('click',tapMap);
$('#mapClick').addEventListener('dblclick',e=>{e.preventDefault();setZoom(zoom+.3);});
$('#zoomIn').addEventListener('click',()=>setZoom(zoom+.3));$('#zoomOut').addEventListener('click',()=>setZoom(zoom-.3));$('#zoomFit').addEventListener('click',()=>setZoom(1));
$('#playToggle').addEventListener('click',()=>{playing=!playing;$('#playToggle').textContent=playing?'⏸ 暫停動畫':'▶ 播放動畫';render(false);});
$('#toggleNodes').addEventListener('click',()=>{showAvoidance=!showAvoidance;$('#toggleNodes').textContent=showAvoidance?'隱藏樹木避讓區':'顯示樹木避讓區';render(false);});
$('#clearCustom').addEventListener('click',()=>{start=byId.gate;end=byId.admin;mode='walk';pickMode(null);render();});
$('#copyLink').addEventListener('click',async()=>{let copied=false;try{await navigator.clipboard.writeText(location.href);copied=true;}catch(e){const t=document.createElement('textarea');t.value=location.href;document.body.appendChild(t);t.select();copied=document.execCommand('copy');t.remove();}$('#copyLink').textContent=copied?'✓ 已複製':'請手動複製網址';setTimeout(()=>$('#copyLink').textContent='⧉ 複製專屬路線',1600);});
try{const qs=new URLSearchParams(location.search);start=decodePoint(qs.get('from'))||start;end=decodePoint(qs.get('to'))||end;mode=qs.get('mode')==='wide'?'wide':'walk';}catch(e){}
window.GK_ROUTE_TEST={getRoute,blocked,lineClear,obstacles:D.obstacles,locations:D.locations};
render(false);setZoom(1);
})();
