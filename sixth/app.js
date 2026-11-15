/* 115工科賽 — 離線可用的七場域互動導覽。無外部套件、無資料傳輸。 */
(() => {
  'use strict';
  const DATA = window.GK_DATA;
  const FOCUS = window.GK_FOCUS || {};
  const DIAGRAMS = window.GK_DIAGRAMS?.items || {};
  const IS_EDITOR = document.body.dataset.mode === 'editor';
  if (!DATA || !Array.isArray(DATA.programs)) { document.body.textContent='導覽資料未載入，請確認 data.js 是否與 index.html 放在同一資料夾。'; return; }
  const $ = id => document.getElementById(id);
  const byId = id => DATA.programs.find(p => p.id === id);
  const sites = DATA.sites;
  const STORAGE_KEY = 'gk115-map-corrections-v2';
  const PREVIOUS_STORAGE_KEY = 'gk115-map-corrections-v1';
  let site = '北科附工', mapId = 'map-03', current = '01', currentService='01', zoom = 1, editMode = false, mapMode='focus';
  let loadSequence=0;
  let currentPublicShareUrl='';
  let routeReady=false;
  let editAction='move', editIndex=0, currentCluster=null, cardType='program';
  let corrections = {};
  const elements = {
    siteTabs:$('siteTabs'),globalProgram:$('globalProgram'),programSearch:$('programSearch'),programList:$('programList'),siteProgramCount:$('siteProgramCount'),
    mapSelect:$('mapSelect'),mapTitle:$('mapTitle'),mapSubtitle:$('mapSubtitle'),originalLink:$('originalLink'),downloadOriginal:$('downloadOriginal'),mapImage:$('mapImage'),mapLoading:$('mapLoading'),focusMode:$('focusMode'),fullMode:$('fullMode'),
    mapStage:$('mapStage'),mapViewport:$('mapViewport'),mapStatus:$('mapStatus'),pinLayer:$('pinLayer'),pinCount:$('pinCount'),
    zoomLabel:$('zoomLabel'),detailNumber:$('detailNumber'),detailTitle:$('detail-title'),detailSite:$('detailSite'),
    detailRegistration:$('detailRegistration'),detailTheory:$('detailTheory'),detailPractical:$('detailPractical'),detailMeeting:$('detailMeeting'),
    detailRegistrationDate:$('detailRegistrationDate'),detailRegistrationTime:$('detailRegistrationTime'),registrationTag:$('registrationTag'),registrationTasksBox:$('registrationTasksBox'),registrationTasksList:$('registrationTasksList'),
    detailNotes:$('detailNotes'),detailVerification:$('detailVerification'),locateBtn:$('locateBtn'),mapNotes:$('mapNotes'),editToggle:$('editToggle'),editStatus:$('editStatus'),toast:$('toast'),
    serviceSection:$('serviceSection'),disciplineDetails:$('disciplineDetails'),serviceList:$('serviceList'),serviceSearch:$('serviceSearch'),serviceDetail:$('serviceDetail'),serviceLocateBtn:$('serviceLocateBtn'),adminPanel:$('adminPanel'),
    mapShortcutBox:$('mapShortcutBox'),mapShortcutHeading:$('mapShortcutHeading'),mapShortcutExplain:$('mapShortcutExplain'),mapShortcutList:$('mapShortcutList'),clusterChooser:$('clusterChooser'),clusterTitle:$('clusterTitle'),clusterItems:$('clusterItems'),
    mobileCard:$('mobileCard'),mobileCardTitle:$('mobileCardTitle'),mobileCardText:$('mobileCardText'),mobileCardLabel:$('mobileCardLabel'),pinIndex:$('pinIndex'),movePinMode:$('movePinMode'),addPinMode:$('addPinMode'),removePin:$('removePin'),
    venueGuideSummary:$('venueGuideSummary'),venueGuideBtn:$('venueGuideBtn'),venueGuideOriginal:$('venueGuideOriginal'),indoorDiagramStatus:$('indoorDiagramStatus'),indoorDiagramList:$('indoorDiagramList'),indoorDiagramPending:$('indoorDiagramPending'),
    shareUrlText:$('shareUrlText'),shareHelp:$('shareHelp'),copyProgramLink:$('copyProgramLink'),copyProgramSummary:$('copyProgramSummary'),
  };
  function toast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => elements.toast.classList.remove('show'), 2600);
  }
  function readCorrections() {
    try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(PREVIOUS_STORAGE_KEY) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
    catch (error) { return {}; }
  }
  function storeCorrections() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(corrections)); elements.editStatus.textContent='已保存於本機瀏覽器；請匯出 JSON 才能帶到其他電腦。'; }
    catch (error) { elements.editStatus.textContent='瀏覽器無法保留本機資料，請立刻使用「匯出定位 JSON」。'; }
  }
  function create(tag,className,text) {
    const el=document.createElement(tag); if(className)el.className=className; if(text!=null)el.textContent=String(text); return el;
  }
  function getMap() { return DATA.maps.find(m=>m.id===mapId); }
  function forSite(name) { return DATA.programs.filter(p=>p.site===name); }
  function availableMaps(name) { return DATA.maps.filter(m=>m.site===name); }
  function defaultProgramMap(program){
    if(!program)return null;
    return program.site==='北科附工'?'map-03':availableMaps(program.site)[0]?.id;
  }
  function currentShareUrl(programId){
    const url=new URL(window.location.href);
    url.searchParams.set('program',programId);
    url.searchParams.delete('service');
    url.hash='explorer';
    return url.href;
  }
  function isPublicWebUrl(){
    return location.protocol==='https:' && !['localhost','127.0.0.1'].includes(location.hostname);
  }
  function syncUrl(programId){
    if(!routeReady || IS_EDITOR || location.protocol==='file:')return;
    try {window.history.replaceState({program:programId},'',currentShareUrl(programId));}
    catch(err){/* 本機或受限網頁不修改網址列 */}
  }
  function renderProgramExtra(){
    const p=byId(current);
    if(!p || !elements.shareUrlText)return;
    const map=DATA.maps.find(m=>m.id===defaultProgramMap(p));
    const locs=DATA.pins.filter(pin=>pin.programId===p.id);
    const pending=locs.filter(pin=>pin.verification==='pending').length;
    elements.venueGuideSummary.textContent=map?`${p.site}｜${map.title}；${locs.length} 處圖面定位${pending?`，其中 ${pending} 處待現場核對`:''}。並非精確出入口。`:'此職種沒有對應的場域導覽圖。';
    elements.venueGuideBtn.disabled=!map;
    elements.venueGuideOriginal.hidden=!map;
    if(map)elements.venueGuideOriginal.href=map.original||map.preview;
    const rawDiagrams=DIAGRAMS[p.id];
    const possible=Array.isArray(rawDiagrams)?rawDiagrams:(rawDiagrams?[rawDiagrams]:[]);
    const validDiagrams=possible.filter(d=>d && typeof d.path==='string' && /^assets\/diagrams\/[\w\-.]+\.(png|jpg|jpeg|webp|svg|pdf)$/i.test(d.path));
    elements.indoorDiagramStatus.textContent=validDiagrams.length?`此職種已連結 ${validDiagrams.length} 份獨立配置圖；請確認版本、崗位位置與可公開性。`:'來源僅有場域導覽圖，尚無此職種已上傳的獨立室內崗位配置圖。';
    elements.indoorDiagramList.hidden=!validDiagrams.length;
    elements.indoorDiagramPending.hidden=!!validDiagrams.length;
    elements.indoorDiagramList.replaceChildren();
    for(const d of validDiagrams){
      const a=create('a','feature-link',`${d.title||'職種崗位配置圖'} ↗`);
      a.href=d.path;a.target='_blank';a.rel='noopener';elements.indoorDiagramList.append(a);
    }
    const publicWeb=isPublicWebUrl();
    let unifiedUrl='';try{unifiedUrl=new URL('../individual.html?skill='+encodeURIComponent(p.id),window.location.href).href;}catch(err){/* 無網址的預覽環境不產生公開分享連結 */}
    currentPublicShareUrl=publicWeb?unifiedUrl:'';
    elements.shareUrlText.textContent=publicWeb?currentPublicShareUrl:'本機／預覽模式：尚未取得可讓其他裝置連線的正式網址。';
    elements.shareHelp.textContent=publicWeb?'可複製此職種的專屬網址分享給其他人；發布前請確認資料可對外公開。':'部署至 GitHub Pages 的 HTTPS 網址後，即可分享本職種的公開網址。';
    elements.copyProgramLink.disabled=!publicWeb;
  }
  async function copyText(textValue){
    try{
      if(navigator.clipboard && window.isSecureContext){await navigator.clipboard.writeText(textValue);return true;}
    }catch(err){/* fallback */}
    const ta=create('textarea');ta.value=textValue;ta.readOnly=true;ta.style.position='fixed';ta.style.left='-9999px';document.body.append(ta);ta.focus();ta.select();
    let copied=false;try{copied=document.execCommand('copy');}catch(err){}ta.remove();return copied;
  }
  function scrollToProgramLocation(){
    const pin=shownPins().find(x=>x.programId===current);
    if(!pin){elements.disciplineDetails.scrollIntoView({block:'start',behavior:'smooth'});toast('本圖暫無核定定位點，請參考文字資料');return;}
    if(zoom<1.55)setZoom(1.55,false);
    if(window.innerWidth<=820)elements.mapViewport.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(locateSelected,260);
  }

  function selectedPins() {
    const grouped=new Map();
    for(const p of DATA.pins.filter(x=>x.mapId===mapId)) {
      if(!grouped.has(p.programId)) grouped.set(p.programId,[]);
      grouped.get(p.programId).push(p);
    }
    for(const [key,pins] of Object.entries(corrections)) {
      const [m,program]=key.split(':');
      if(m===mapId && Array.isArray(pins)) grouped.set(program,pins.map(o=>({...o,mapId:m,programId:program,edited:true})));
    }
    return [...grouped.values()].flat().filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100);
  }
  // Coordinates in DATA.pins and exported JSON always refer to the un-cropped original full image.
  function activeFocus() { return mapMode==='focus' ? (FOCUS[mapId] || null) : null; }
  function screenPoint(p) {
    const f=activeFocus();
    return f ? {...p, x:p.x, y:(p.y/100*f.sourceHeight-f.top)/f.height*100} : {...p};
  }
  function originalPointFromScreen(x,y) {
    const f=activeFocus();
    return {x, y:f ? (f.top+y/100*f.height)/f.sourceHeight*100 : y};
  }
  function shownPins(){return selectedPins().map(screenPoint).filter(p=>p.y>=0&&p.y<=100);}
  function shownServicePins(){return DATA.servicePins.filter(p=>p.mapId===mapId).map(screenPoint).filter(p=>p.y>=0&&p.y<=100);}
  function displayedAspect(){const f=activeFocus();const m=getMap();return f?f.height/f.width:m.height/m.width;}
  function updateModeButtons(){
    elements.focusMode.setAttribute('aria-pressed',String(mapMode==='focus'));
    elements.fullMode.setAttribute('aria-pressed',String(mapMode==='full'));
  }
  function siteButtons() {
    elements.siteTabs.replaceChildren();
    for (const venue of sites) {
      const btn=create('button','site-tab');btn.type='button';btn.dataset.site=venue.name;btn.setAttribute('aria-pressed',String(site===venue.name));
      btn.append(create('span','',String(forSite(venue.name).length).padStart(2,'0')),document.createTextNode(venue.name));
      btn.addEventListener('click',()=>chooseSite(venue.name));elements.siteTabs.append(btn);
    }
  }
  function globalSelect() {
    const optFrag=document.createDocumentFragment();
    for(const p of [...DATA.programs].sort((a,b)=>a.id.localeCompare(b.id))) {const opt=create('option','',`${p.id}｜${p.name} · ${p.site}`); opt.value=p.id;optFrag.append(opt);}
    elements.globalProgram.append(optFrag);
  }
  function chooseSite(name) {
    if(!sites.some(x=>x.name===name))return;
    site=name;
    elements.programSearch.value='';
    const maps=availableMaps(site);
    mapId=site==='北科附工'?'map-03':maps[0].id;
    current=forSite(site)[0]?.id||'';
    zoom=1;
    hideMobileCard();closeCluster();renderAll();
    if(current)syncUrl(current);
  }
  function chooseProgram(id,{focus=true,preserveMap=false,updateUrl=true}={}) {
    const p=byId(id);if(!p)return;
    const targetMap=defaultProgramMap(p);
    const shouldChange=site!==p.site || mapId==='map-00' || (!preserveMap && mapId!==targetMap);
    site=p.site;current=id;
    if(shouldChange){
      mapId=targetMap;zoom=1;
      elements.programSearch.value='';
      closeCluster();renderAll();
    }else{
      closeCluster();renderProgramList();renderDetails();renderPins();renderShortcuts();renderEditorUI();
    }
    elements.globalProgram.value=id;
    if(updateUrl)syncUrl(id);
    showMobileCard('program');
    if(focus){requestAnimationFrame(()=>setTimeout(scrollToProgramLocation,shouldChange?250:90));}
  }
  function renderMapSelect(){
    const options=availableMaps(site);elements.mapSelect.replaceChildren();
    for(const m of options){const opt=create('option','',m.title);opt.value=m.id;elements.mapSelect.append(opt);}
    elements.mapSelect.value=mapId;
  }
  function renderProgramList() {
    const q=elements.programSearch.value.trim().toLocaleLowerCase();
    const filtered=forSite(site).filter(p=>!q||[p.id,p.name,p.theory,p.practical,p.registration,p.meeting,p.registrationTime,...p.aliases].join(' ').toLocaleLowerCase().includes(q));
    elements.siteProgramCount.textContent=`${filtered.length} / ${forSite(site).length} 項`;
    elements.programList.replaceChildren();
    if(!filtered.length) {elements.programList.append(create('p','list-empty','查無符合的職種；請嘗試其他名稱或編號。'));return;}
    for(const p of filtered) {
      const btn=create('button','program-item');btn.type='button';btn.setAttribute('role','listitem');btn.setAttribute('aria-pressed',String(current===p.id));
      const lbl=create('span','program-label');lbl.append(create('span','program-label-name',p.name),create('span','program-mini-time',`11/24 報到 ${p.registrationTime||'待確認'}`));
      btn.append(create('span','program-no',p.id),lbl);
      if(DATA.pins.some(pin=>pin.programId===p.id&&pin.verification==='pending') || Object.keys(corrections).some(k=>k.endsWith(`:${p.id}`))) btn.append(create('span','program-review','待核對'));
      btn.append(create('span','program-arrow','›'));
      btn.addEventListener('click',()=>chooseProgram(p.id));elements.programList.append(btn);
    }
  }
  function renderDetails(){
    const p=byId(current);if(!p)return;
    elements.detailNumber.textContent=p.id;elements.detailTitle.textContent=p.name;elements.detailSite.textContent=`所屬場域：${p.site}　｜　資料來源：Excel 職種清冊`;
    elements.detailRegistrationDate.textContent=p.registrationDateLabel||'待確認';
    elements.detailRegistrationTime.textContent=p.registrationTime||'待確認';
    const special=Boolean(p.registrationTime&&p.registrationTime!=='13:00–14:00');
    elements.registrationTag.textContent=special?'特別報到時段 · 請留意':'依個別職種報到表';
    elements.registrationTag.className=special?'special-time-tag':'standard-time-tag';
    elements.registrationTasksBox.hidden=!p.registrationTasks?.length;
    elements.registrationTasksList.replaceChildren();
    for(const item of p.registrationTasks||[]) elements.registrationTasksList.append(create('li','',item));
    elements.detailRegistration.textContent=p.registration||'原始 Excel 未填';elements.detailTheory.textContent=p.theory||'原始 Excel 未填';
    elements.detailPractical.textContent=p.practical||'原始 Excel 未填';elements.detailMeeting.textContent=p.meeting||'原始 Excel 未填';
    elements.detailNotes.hidden=!p.notes?.length;
    elements.detailNotes.textContent=(p.notes||[]).join(' ');
    elements.globalProgram.value=p.id;
    const uncertain=DATA.pins.filter(pin=>pin.programId===p.id&&pin.verification==='pending');
    const changed=Object.entries(corrections).filter(([key])=>key.endsWith(`:${p.id}`));
    const editedCount=changed.reduce((n,[key,points])=>n+(Array.isArray(points)?Math.max(1,points.filter(point=>point.verification==='pending').length):1),0);
    const verify=elements.detailVerification;
    verify.replaceChildren();
    verify.className='verify-banner '+(uncertain.length||editedCount?'verify-pending':'verify-source');
    if(uncertain.length||editedCount){
      verify.append(create('strong','',`⚠ 待現場核對：${uncertain.length} 處原圖估位${editedCount?`，另有 ${editedCount} 項本機校正草稿`:''}`),create('span','','圖面估位與本機人工調整皆非已核定的入口、樓層或動線；請依現場人員指示。')); 
    }else{
      verify.append(create('strong','','依原始圖面對位'),create('span','','圖面標點僅供辨識場地相對位置，不代表現場入口實測或已完成核定。'));
    }
    renderProgramExtra();
    window.dispatchEvent(new CustomEvent('gk:programchange',{detail:{id:p.id}}));
  }
  function renderServices(){
    const isService=mapId==='map-00';
    elements.serviceSection.hidden=!isService;
    elements.disciplineDetails.hidden=isService;
    if(elements.adminPanel)elements.adminPanel.hidden=isService;
    if(!isService)return;
    renderServiceList();
  }
  function serviceById(id){return DATA.services.find(s=>s.id===id);}
  function chooseService(id,{focus=true}={}){
    if(!serviceById(id))return;
    currentService=id;closeCluster();renderServiceList();renderPins();showMobileCard('service');
    if(focus && window.innerWidth>520)requestAnimationFrame(()=>setTimeout(locateSelected,40));
  }
  function renderServiceList(){
    const q=elements.serviceSearch.value.trim().toLocaleLowerCase();
    elements.serviceList.replaceChildren();
    const hits=DATA.services.filter(s=>!q||`${s.id} ${s.name} ${s.place}`.toLocaleLowerCase().includes(q));
    for(const svc of hits){
      const btn=create('button','service-item');btn.type='button';btn.setAttribute('aria-pressed',String(svc.id===currentService));
      btn.append(create('span','service-no',svc.id),create('span','service-item-name',svc.name));
      if(svc.pending){btn.classList.add('pending-service');btn.append(create('span','service-review','待公告'));}
      btn.addEventListener('click',()=>chooseService(svc.id));elements.serviceList.append(btn);
    }
    if(!hits.length)elements.serviceList.append(create('p','list-empty','找不到符合的服務項目。'));
    const s=serviceById(currentService);if(!s)return;
    elements.serviceDetail.replaceChildren();
    elements.serviceDetail.append(create('h4','',`${s.id}｜${s.name}`),create('p','',`場地／位置：${s.place}`));
    const status=create('div',`service-status ${s.pending?'is-pending':''}`,
      s.pending?'⚠ 尚待正式公告；請勿將候選日期或場地視為實際指引':s.hasPin?'圖上有編號定位（非實測入口／車位）':s.referencePinServiceId?'無固定停車位置點；可參考校門入口':'無固定定位點，請參考文字說明');
    elements.serviceDetail.append(status);
    if(s.statusNote) elements.serviceDetail.append(create('p','service-clarification',s.statusNote));
    const hasPoint=DATA.servicePins.some(p=>p.mapId===mapId&&p.serviceId===currentService);
    const hasReference=Boolean(s.referencePinServiceId&&DATA.servicePins.some(p=>p.mapId===mapId&&p.serviceId===s.referencePinServiceId));
    elements.serviceLocateBtn.disabled=!(hasPoint||hasReference);
    elements.serviceLocateBtn.textContent=hasPoint?'⌖ 在圖上定位此服務項目':hasReference?`⌖ 查看${s.referenceLabel||'入口'}`:'⌖ 本項目沒有圖面定位';
  }
  function clusteringGroups(all){
    const map=getMap(),stageW=elements.mapStage.getBoundingClientRect().width||elements.mapViewport.clientWidth||720;
    const stageH=stageW*displayedAspect();
    const threshold=(window.innerWidth<=520?42:34);
    if(editMode) return all.map(p=>[p]); // 校正時每一處必須能單獨選取
    const groups=[];
    for(const point of all){
      let winner=null,best=Infinity;
      for(const group of groups){
        const cx=group.reduce((n,p)=>n+p.x,0)/group.length;
        const cy=group.reduce((n,p)=>n+p.y,0)/group.length;
        const d=Math.hypot((point.x-cx)*stageW/100,(point.y-cy)*stageH/100);
        if(d<threshold && d<best){winner=group;best=d;}
      }
      if(winner)winner.push(point);else groups.push([point]);
    }
    return groups;
  }
  function closeCluster(){elements.clusterChooser.hidden=true;currentCluster=null;}
  function openCluster(points,isService){
    hideMobileCard();currentCluster=points;
    elements.clusterTitle.textContent=`此處有 ${points.length} 個定位點`;
    elements.clusterItems.replaceChildren();
    for(const p of points){
      const id=isService?p.serviceId:p.programId,datum=isService?serviceById(id):byId(id);
      const button=create('button','');button.type='button';
      const idTag=create('b','',id);const content=create('span','',datum?.name||id);
      if(p.verification==='pending'||datum?.pending)content.append(create('small','','待核對／待公告'));
      button.append(idTag,content);
      button.addEventListener('click',()=>{
        closeCluster();if(isService)chooseService(id,{focus:false});else chooseProgram(id,{focus:false,preserveMap:true});
      });elements.clusterItems.append(button);
    }
    elements.clusterChooser.hidden=false;
  }
  function renderPins(){
    const isService=mapId==='map-00';
    const all=isService?shownServicePins():shownPins();
    const groups=clusteringGroups(all);
    elements.pinLayer.replaceChildren();
    for(const group of groups){
      if(group.length>1){
        const x=group.reduce((a,p)=>a+p.x,0)/group.length,y=group.reduce((a,p)=>a+p.y,0)/group.length;
        const btn=create('button','map-pin pin-cluster',`+${group.length}`);btn.type='button';
        btn.style.left=`${x}%`;btn.style.top=`${y}%`;
        btn.title=`${group.length} 處位置重疊，點選展開`;
        btn.setAttribute('aria-label',`此處有 ${group.length} 個定位點，點選展開清單`);
        btn.dataset.cluster=String(group.length);
        btn.addEventListener('click',e=>{e.stopPropagation();openCluster(group,isService);});
        elements.pinLayer.append(btn);continue;
      }
      const p=group[0],id=isService?p.serviceId:p.programId,datum=isService?serviceById(id):byId(id);
      if(!datum)continue;
      const active=isService?(id===currentService):(id===current);
      const needsReview=isService?Boolean(datum.pending):(p.verification==='pending'||DATA.pins.some(x=>x.mapId===mapId&&x.programId===id&&x.verification==='pending'));
      const within=all.filter(q=>(isService?q.serviceId:q.programId)===id),index=within.indexOf(p);
      const editorTarget=editMode&&!isService&&active&&index===editIndex;
      const btn=create('button',`map-pin ${active?'is-active':''} ${p.edited?'is-edited':''} ${needsReview?'needs-review':''} ${editorTarget?'is-editor-target':''}`,id);
      btn.type='button';btn.style.left=`${p.x}%`;btn.style.top=`${p.y}%`;
      if(isService)btn.dataset.service=id;else btn.dataset.program=id;
      btn.title=`${id} ${datum.name}${within.length>1?`（第 ${index+1} 處）`:''}｜${needsReview?'待核對：':''}${p.status||'圖面定位'}`;
      btn.setAttribute('aria-label',`${id} ${datum.name}${within.length>1?`第 ${index+1} 處`:''}，${needsReview?'待核對／待公告，':''}點選查看`);
      btn.addEventListener('click',ev=>{
        ev.stopPropagation();closeCluster();
        if(isService) chooseService(id,{focus:false});
        else if(editMode){current=id;editIndex=index;renderProgramList();renderDetails();renderEditorUI();renderPins();toast(`已選擇 ${id} 第 ${index+1} 處，點地圖可移動此點`);}
        else chooseProgram(id,{focus:false,preserveMap:true});
      });elements.pinLayer.append(btn);
    }
    elements.pinCount.textContent=`原始／校正點 ${all.length} 處 · 畫面 ${groups.length} 組`;
    if(isService){
      const selected=all.filter(x=>x.serviceId===currentService),svc=serviceById(currentService);
      if(svc?.pending)elements.mapStatus.textContent=`⚠ ${currentService} ${svc.name}：日期／場地尚待公告，請勿依候選資訊前往。`;
      else if(selected.length)elements.mapStatus.textContent=`${currentService}｜${svc?.name||''}（${selected.length} 處）。若點位重疊，請點「＋數量」展開；非實測入口。`;
      else if(svc?.referencePinServiceId)elements.mapStatus.textContent=`${currentService} 未提供固定點位；可參考 ${svc.referencePinServiceId} 校門入口，但不是停車位。`;
      else elements.mapStatus.textContent='本項目沒有固定地圖定位，請參考服務對照表。';
      return;
    }
    const selected=all.filter(x=>x.programId===current);
    elements.locateBtn.disabled=(!selected.length && !DATA.pins.some(x=>x.programId===current));
    elements.locateBtn.textContent=selected.length?'⌖ 在地圖上定位':'⌖ 切換至職種術科圖定位';
    if(selected.length){
      const pending=selected.filter(p=>p.verification==='pending'||DATA.pins.some(x=>x.mapId===mapId&&x.programId===current&&x.verification==='pending')).length;
      elements.mapStatus.textContent=pending?`⚠ ${current} ${byId(current)?.name||''}：${pending} 處定位待現場核對；點位僅作圖面參考。`:`${current} ${byId(current)?.name||''}（${selected.length} 處；密集點可展開群組）。`;
    }else if(mapId==='map-01'||mapId==='map-02'){
      elements.mapStatus.textContent='這張圖尚未有經確認的職種標點座標；已提供下方互動教室索引，可點選職種查看 Excel 報到／學科資訊。';
    }else elements.mapStatus.textContent=`本圖未提供 ${current} 的圖面熱點，請參考原始導覽圖。`;
  }
  function renderShortcuts(){
    const map=getMap(),isIndexed=mapId==='map-01'||mapId==='map-02';
    elements.mapShortcutBox.hidden=!isIndexed;
    if(!isIndexed)return;
    const registration=mapId==='map-01';
    elements.mapShortcutHeading.textContent=registration?'報到圖互動索引｜點選職種查看報到／會議資訊':'學科圖互動索引｜點選職種查看學科教室';
    elements.mapShortcutExplain.textContent='此索引直接使用 Excel 欄位；可切換資訊卡，但不假裝圖上已有核定座標。選職種後如需新增定位，請使用校正工具並另行核對。';
    elements.mapShortcutList.replaceChildren();
    for(const p of forSite(site)){
      const btn=create('button','shortcut-item');btn.type='button';btn.setAttribute('aria-pressed',String(p.id===current));
      btn.append(create('b','',`${p.id} ${p.name}`),create('span','',registration?`11/24 ${p.registrationTime||'待確認'}｜${p.registration||'未填'}`:`學科：${p.theory||'未填'}`));
      btn.addEventListener('click',()=>chooseProgram(p.id,{focus:false,preserveMap:true}));elements.mapShortcutList.append(btn);
    }
  }
  function hideMobileCard(){elements.mobileCard.hidden=true;}
  function showMobileCard(kind){
    cardType=kind;
    if(window.innerWidth>520 || editMode)return;
    const datum=kind==='service'?serviceById(currentService):byId(current);
    if(!datum)return;
    elements.mobileCardTitle.textContent=`${datum.id}｜${datum.name}`;
    elements.mobileCardLabel.textContent=kind==='service'?'北科附工大會服務':'職種快速資訊';
    const area=kind==='service'?datum.place:(mapId==='map-01'?datum.registration:mapId==='map-02'?datum.theory:datum.practical);
    const note=kind==='service'&&datum.pending?'【待公告】':kind==='program'&&DATA.pins.some(x=>x.programId===datum.id&&x.verification==='pending')?'【部分點位待核對】':'';
    elements.mobileCardText.textContent=kind==='service'?`${note}位置：${area||'未提供'}`:`${note}11/24 報到 ${datum.registrationTime||'待確認'}｜${(mapId==='map-01'?'報到':mapId==='map-02'?'學科':'術科')}：${area||'未提供'}`;
    elements.mobileCard.hidden=false;
  }
  function renderEditorUI(){
    if(!elements.pinIndex)return;
    const points=selectedPins().filter(p=>p.programId===current);
    if(editIndex>=points.length)editIndex=Math.max(0,points.length-1);
    elements.pinIndex.replaceChildren();
    if(!points.length){const o=create('option','','目前無定位點（可新增）');o.value='0';elements.pinIndex.append(o);}
    else for(let i=0;i<points.length;i++){
      const p=points[i],o=create('option','',`第 ${i+1} 處 · x ${p.x.toFixed(2)}%／y ${p.y.toFixed(2)}%`);
      o.value=String(i);elements.pinIndex.append(o);
    }
    elements.pinIndex.value=String(editIndex);
    elements.movePinMode.disabled=!points.length;
    elements.removePin.disabled=!editMode||!points.length;
    elements.pinIndex.disabled=!editMode||!points.length;
    elements.movePinMode.setAttribute('aria-pressed',String(editAction==='move'));
    elements.addPinMode.setAttribute('aria-pressed',String(editAction==='add'));
  }
  function renderMap(){
    const map=getMap();if(!map)return;
    const focus=activeFocus(); updateModeButtons();
    elements.mapViewport.style.setProperty('--map-aspect',String(1/displayedAspect()));
    elements.mapTitle.textContent=`${site}｜${map.title}`;elements.mapSubtitle.textContent=`${focus?'重點地圖（裁切檢視）':'完整圖面（保留原版面）'}｜來源：${map.sourceName}`;
    elements.originalLink.href=map.original||map.preview;
    elements.downloadOriginal.hidden=!map.original; if(map.original){elements.downloadOriginal.href=map.original;elements.downloadOriginal.download=map.sourceName;}
    elements.originalLink.textContent=map.original?'開啟原始高解析圖 ↗':'開啟完整網頁版圖面 ↗';
    elements.originalLink.removeAttribute('download');
    elements.mapImage.alt=`${site} ${map.title}｜${focus?'重點地圖':'完整導覽圖'}`;
    const selectedSrc=focus?focus.src:map.preview;
    const seq=++loadSequence;
    elements.mapLoading.hidden=false;
    elements.mapImage.style.opacity='0.42';
    elements.mapImage.onload=()=>{if(seq!==loadSequence)return;elements.mapLoading.hidden=true;elements.mapImage.style.opacity='1';requestAnimationFrame(()=>{renderPins();setTimeout(locateSelected,90);});};
    elements.mapImage.onerror=()=>{if(seq!==loadSequence)return;elements.mapLoading.hidden=true;elements.mapImage.style.opacity='1';elements.mapStatus.textContent='地圖無法載入，請檢查 assets/maps 檔案路徑。';};
    elements.mapImage.src=selectedSrc;
    elements.mapSelect.value=mapId;
    setZoom(zoom,false);
    closeCluster();hideMobileCard();renderServices();renderShortcuts();renderPins();renderEditorUI();
    if(elements.mapImage.complete&&elements.mapImage.naturalWidth>0){elements.mapLoading.hidden=true;elements.mapImage.style.opacity='1';requestAnimationFrame(renderPins);}
  }
  function renderNotes(){
    const venue=sites.find(x=>x.name===site);
    elements.mapNotes.replaceChildren();
    for(const n of venue?.mapNotes||[])elements.mapNotes.append(create('li','',n));
  }
  function renderAll() {
    siteButtons();renderMapSelect();renderProgramList();renderDetails();renderNotes();renderMap();
  }
  function setZoom(value, focus=true){
    const old=zoom;zoom=Math.min(3.75,Math.max(1,Math.round(value*100)/100));
    elements.mapStage.style.width=`${Math.round(zoom*100)}%`;
    elements.zoomLabel.textContent=`${Math.round(zoom*100)}%`;
    requestAnimationFrame(renderPins);
    if(focus) requestAnimationFrame(()=>setTimeout(locateSelected,65));
  }
  function locateSelected(){
    const targetServiceId=(mapId==='map-00'&&serviceById(currentService)?.referencePinServiceId)||currentService;
    const pin=mapId==='map-00'?shownServicePins().find(x=>x.serviceId===targetServiceId):shownPins().find(x=>x.programId===current);
    if(!pin)return;
    const stage=elements.mapStage.getBoundingClientRect(),view=elements.mapViewport.getBoundingClientRect();
    const x=stage.left+stage.width*pin.x/100,y=stage.top+stage.height*pin.y/100;
    elements.mapViewport.scrollTo({left:elements.mapViewport.scrollLeft+x-(view.left+view.width/2),top:elements.mapViewport.scrollTop+y-(view.top+view.height/2),behavior:'smooth'});
  }
  function clickOnMap(ev){
    if(!editMode||mapId==='map-00')return;
    if(!current){toast('請先選擇職種');return;}
    const box=elements.mapStage.getBoundingClientRect();if(!box.width||!box.height)return;
    const xView=Math.max(0,Math.min(100,((ev.clientX-box.left)/box.width)*100));
    const yView=Math.max(0,Math.min(100,((ev.clientY-box.top)/box.height)*100));
    const {x,y}=originalPointFromScreen(xView,yView);
    const key=`${mapId}:${current}`;
    const arr=selectedPins().filter(p=>p.programId===current).map(p=>({...p}));
    const newPoint={x:Number(x.toFixed(3)),y:Number(y.toFixed(3)),verification:'pending',source:'本機校正（未現場核定）',status:'本機自訂位置，待核定'};
    if(editAction==='add'){arr.push(newPoint);editIndex=arr.length-1;}
    else if(arr.length){arr[editIndex]={...arr[editIndex],...newPoint};}
    else{toast('目前沒有可移動的點，請先選擇「新增一處」');return;}
    corrections[key]=arr;
    storeCorrections();renderPins();renderEditorUI();renderDetails();renderProgramList();
    toast(editAction==='add'?`已新增第 ${arr.length} 處（不影響其他點）`:`已移動第 ${editIndex+1} 處（其他位置保留）`);
  }
  function exportCorrections(){
    const content=JSON.stringify({format:'GK115-map-overrides-v2',created:new Date().toISOString(),changes:corrections},null,2);
    const blob=new Blob([content],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='115工科賽_互動地圖_校正座標.json';document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);toast('已匯出定位座標檔');
  }
  async function importCorrections(file){
    if(!file)return;
    try{
      const json=JSON.parse(await file.text());
      if(!['GK115-map-overrides-v1','GK115-map-overrides-v2'].includes(json.format)||!json.changes||typeof json.changes!=='object') throw Error('座標檔格式不符');
      const clean={};
      for(const [key,values] of Object.entries(json.changes)){
        if(!/^map-\d{2}:\d{2}$/.test(key)||!Array.isArray(values))continue;
        if(!DATA.maps.some(m=>m.id===key.slice(0,6))||!byId(key.slice(7)))continue;
        const positions=values.filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&v.x>=0&&v.y>=0&&v.x<=100&&v.y<=100);
        clean[key]=positions.map(v=>({...v,x:v.x,y:v.y,verification:'pending',source:'匯入座標（未現場核定）',status:'人工校正草稿，待核定'}));
      }
      corrections={...corrections,...clean};storeCorrections();renderPins();renderEditorUI();renderDetails();renderProgramList();toast(`已匯入 ${Object.keys(clean).length} 項座標`);
    } catch(err){toast(`匯入失敗：${err.message}`);}
  }
  function setup(){
    corrections=IS_EDITOR?readCorrections():{};
    const params=new URLSearchParams(location.search);
    const requested=params.get('program');
    const venueNames={nkh:'北科附工',division:'桃竹苗分署',vanung:'萬能科大',nangang:'南港高工',sanchong:'三重商工',taishan:'泰山高中',xinxing:'新興高中'};
    const requestedVenue=venueNames[params.get('venue')];
    // 職種指定優先；單獨提供 venue 時直接載入該場域，而非假裝使用者已選擇首個職種。
    if(requested && byId(requested)){
      current=requested;site=byId(requested).site;mapId=defaultProgramMap(byId(requested));
    }else if(requestedVenue && sites.some(x=>x.name===requestedVenue)){
      site=requestedVenue;current=forSite(site)[0]?.id||'01';
      mapId=site==='北科附工'?'map-03':availableMaps(site)[0]?.id||'map-03';
    }
    globalSelect();renderAll();routeReady=true;
    if(requested && byId(requested) && !IS_EDITOR){
      requestAnimationFrame(()=>setTimeout(scrollToProgramLocation,340));
    }
    elements.globalProgram.addEventListener('change',e=>{if(e.target.value)chooseProgram(e.target.value);});
    elements.venueGuideBtn.addEventListener('click',()=>chooseProgram(current,{focus:true,preserveMap:false,updateUrl:false}));
    elements.copyProgramLink.addEventListener('click',async()=>{
      if(!currentPublicShareUrl){toast('請先部署至 GitHub Pages，才有可分享的網站網址');return;}
      toast(await copyText(currentPublicShareUrl)?'已複製職種專屬網址':'複製失敗，請手動複製網址列');
    });
    elements.copyProgramSummary.addEventListener('click',async()=>{
      const p=byId(current);if(!p)return;
      const src=`115工科賽｜${p.id} ${p.name}\n場域：${p.site}\n11/24 報到：${p.registrationTime||'待確認'}｜${p.registration||'待確認'}\n學科：${p.theory||'待確認'}\n術科：${p.practical||'待確認'}\n領隊／檢討：${p.meeting||'待確認'}\n${currentPublicShareUrl?'導覽：'+currentPublicShareUrl+'\n':''}圖面位置非現場入口實測；以主辦單位最新公告為準。`;
      toast(await copyText(src)?'已複製職種資訊':'無法自動複製，請改用瀏覽器選取文字');
    });

    elements.programSearch.addEventListener('input',renderProgramList);
    $('clearSearch').addEventListener('click',()=>{elements.programSearch.value='';renderProgramList();});
    elements.mapSelect.addEventListener('change',e=>{mapId=e.target.value;zoom=1;editIndex=0;renderMap();});
    elements.focusMode.addEventListener('click',()=>{if(mapMode==='focus')return;mapMode='focus';zoom=1;renderMap();elements.mapViewport.scrollTop=0;});
    elements.fullMode.addEventListener('click',()=>{if(mapMode==='full')return;mapMode='full';zoom=1;renderMap();elements.mapViewport.scrollTop=0;});
    $('zoomIn').addEventListener('click',()=>setZoom(zoom+.3));
    $('zoomOut').addEventListener('click',()=>setZoom(zoom-.3));
    $('zoomReset').addEventListener('click',()=>{setZoom(1);elements.mapViewport.scrollLeft=0;});
    elements.locateBtn.addEventListener('click',()=>{if(!elements.locateBtn.disabled){scrollToProgramLocation();}else chooseProgram(current,{focus:true,preserveMap:false,updateUrl:false});});
    elements.serviceLocateBtn.addEventListener('click',()=>{
      const s=serviceById(currentService);
      if(s?.referencePinServiceId) toast('僅參考校門入口，不是停車位或裝卸位置');
      locateSelected();
    });
    elements.serviceSearch.addEventListener('input',renderServiceList);
    if(IS_EDITOR){
    elements.editToggle.addEventListener('click',()=>{editMode=!editMode;editAction='move';editIndex=0;closeCluster();hideMobileCard();elements.editToggle.setAttribute('aria-pressed',String(editMode));elements.editToggle.textContent=editMode?'結束校正模式':'開啟校正模式';elements.mapStage.classList.toggle('edit-mode',editMode);elements.editStatus.textContent=editMode?'先選擇要移動的第幾處點位，再在地圖點新位置；也可切換新增模式。變更僅存於本機。':'校正模式已關閉。';renderEditorUI();renderPins();});
    elements.mapStage.addEventListener('click',clickOnMap);
    elements.pinIndex.addEventListener('change',e=>{editIndex=Number(e.target.value)||0;renderPins();});
    elements.movePinMode.addEventListener('click',()=>{if(!editMode)return;editAction='move';renderEditorUI();});
    elements.addPinMode.addEventListener('click',()=>{if(!editMode)return;editAction='add';renderEditorUI();});
    elements.removePin.addEventListener('click',()=>{if(!editMode)return;const key=`${mapId}:${current}`,arr=selectedPins().filter(p=>p.programId===current).map(p=>({...p}));if(!arr.length)return;if(!confirm(`確定刪除 ${current} 第 ${editIndex+1} 處本機定位點？其他位置將保留。`))return;arr.splice(editIndex,1);corrections[key]=arr;storeCorrections();renderPins();renderEditorUI();renderDetails();renderProgramList();toast('已刪除指定一處；其他定位保留');});
    }
    $('clusterClose').addEventListener('click',closeCluster);
    $('mobileCardClose').addEventListener('click',hideMobileCard);
    $('mobileCardLocate').addEventListener('click',()=>{hideMobileCard();elements.mapViewport.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(locateSelected,300);});
    $('mobileCardDetails').addEventListener('click',()=>{hideMobileCard();(cardType==='service'?elements.serviceSection:elements.disciplineDetails).scrollIntoView({behavior:'smooth',block:'start'});});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeCluster();hideMobileCard();}});
    window.addEventListener('resize',()=>requestAnimationFrame(renderPins));
    // 閱讀完整資訊時自動收起手機快捷卡，避免擋住配置圖。
    window.addEventListener('scroll',()=>{
      if(window.innerWidth>520 || elements.mobileCard.hidden || elements.disciplineDetails.hidden)return;
      const rect=elements.disciplineDetails.getBoundingClientRect();
      if(rect.top < window.innerHeight*0.7) hideMobileCard();
    },{passive:true});
    window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('program');if(byId(id))chooseProgram(id,{focus:true,updateUrl:false});});
    if(IS_EDITOR){
    $('exportPins').addEventListener('click',exportCorrections);
    $('importPins').addEventListener('change',async ev=>{await importCorrections(ev.target.files?.[0]);ev.target.value='';});
    $('clearPin').addEventListener('click',()=>{if(!editMode){toast('請先開啟校正模式');return;}const key=`${mapId}:${current}`;if(Object.prototype.hasOwnProperty.call(corrections,key)){if(!confirm('確定還原本職種在此圖上的全部原始位置？'))return;delete corrections[key];editIndex=0;storeCorrections();renderPins();renderEditorUI();renderDetails();renderProgramList();toast('已還原本職種原始定位點');}else toast('目前沒有本職種自訂座標');});
    }
  }
  setup();
})();
