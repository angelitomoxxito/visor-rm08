const DATA_PATHS={schoolsGeoJSON:'data/indicemantenimiento.json',schoolsCSV:'data/basededatosrm08cc.csv',alcaldias:'data/alcaldias.json',agebs:'data/ageb.json',subsidencias:'data/subsidencias.json',fracturamiento:'data/fracturamiento.json',mantenimiento:'data/mantenimiento.json',reforzamiento:'data/reforzamiento.json',famPotenciado:'data/fam_potenciado_2025.json',programa123_2026:'data/123_por_mi_escuela_2026.json',alcaldiaApoyo:'data/beneficiadas_alcaldia_iztapalapa.json',famPotenciadoBasico2026:'data/fam_potenciado_basico_2026.json'};
const FIELDS={alcaldia:'alcaldia',nivel:'principal',nombre:'inmueble',ccts:['cct1','cct2','cct3','cct4'],x:'coord_x',y:'coord_y',indice:'Indice_Man'};
const MAINTENANCE_FIELDS=['impermeabi','interior','exterior1','loseta','ventanas','ventanas1','ventanas2','puertas','escaleras','pluviales','techos','desazolve','deterioro','concreto','tinacos','cisterna','agua','agua1','hidrosanit','sanitarios','luminarias','electrica','transforma','lamina'];
const MAINTENANCE_LABELS={impermeabi:'Impermeabilización',interior:'Pintura interior',exterior1:'Pintura exterior',loseta:'Loseta',ventanas:'Vidrios / ventanas',ventanas1:'Cancelería de aluminio / ventanas',ventanas2:'Cancelería de herrería / ventanas',puertas:'Puertas',escaleras:'Barandales, pasillos o escaleras',pluviales:'Bajadas pluviales',techos:'Muros o techos',desazolve:'Desazolve',deterioro:'Deterioro de estructura o acabados',concreto:'Concreto',tinacos:'Tinacos',cisterna:'Cisterna',agua:'Agua potable',agua1:'Red o abastecimiento de agua',hidrosanit:'Instalación hidrosanitaria',sanitarios:'Sanitarios',luminarias:'Luminarias',electrica:'Instalación eléctrica',transforma:'Transformador',lamina:'Lámina'};
const SUPPORT_KEYWORDS={impermeabi:['impermeabil'],interior:['pintura en edificios','pintura de aulas','pintura interior','pintura en aulas'],exterior1:['pintura en fachada','pintura de fachada','pintura exterior','fachada'],loseta:['loseta','piso','pisos'],ventanas:['vidrio','vidrios','ventana','ventanas'],ventanas1:['canceleria de aluminio','aluminio'],ventanas2:['canceleria','herreria'],puertas:['puerta','puertas'],escaleras:['escalera','escaleras','barandal','barandales','pasillo','pasillos'],pluviales:['pluvial','pluviales','bajada de agua'],techos:['techo','techos','azotea','azoteas'],desazolve:['desazolve'],deterioro:['estructura','estructural','acabados','grieta','grietas'],concreto:['concreto'],tinacos:['tinaco','tinacos'],cisterna:['cisterna','cisternas'],agua:['agua potable'],agua1:['red de agua','abastecimiento de agua'],hidrosanit:['hidrosanitaria','hidrosanitarias'],sanitarios:['sanitario','sanitarios','nucleo sanitario','nucleos sanitarios'],luminarias:['luminaria','luminarias','alumbrado'],electrica:['electrica','electricas','electrico','electricos'],transforma:['transformador','transformadores'],lamina:['lamina','laminas','cubierta','cubiertas']};
const STRUCTURAL_RELATED_FIELDS=new Set(['deterioro','concreto','techos','escaleras']);
const COLORS={'Muy baja':'#2ca25f','Baja':'#a1d99b','Media':'#ffd166','Alta':'#f97316','Muy alta':'#dc2626'};
const OBS_COLORS={fractura:'#c2410c',subsidencia:'#ca8a04',combinada:'#b91c1c',reforzada:'#7c3aed',neutral:'#64748b'};
let allSchools=[],filteredSchools=[],alcaldiasGeoJSON=null,agebsGeoJSON=null,subsidenciasGeoJSON=null,fracturamientoGeoJSON=null,activeMode='mantenimiento',schoolsVisible=true,selectedFractureLayer=null;
let schoolLayer=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:28,spiderfyOnMaxZoom:true,disableClusteringAtZoom:13}),alcaldiaSummaryLayer=L.layerGroup(),agebSummaryLayer=L.layerGroup(),alcaldiaBoundaryLayer=null,agebBoundaryLayer=null,subsidenciaLayer=null,fracturamientoLayer=null;
const map=L.map('map',{zoomControl:true,preferCanvas:true}).setView([19.35,-99.13],10);
const baseLayers={'Mapa claro':L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:20,attribution:'© OpenStreetMap © CARTO'}),'OpenStreetMap':L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}),'Satélite':L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'}),'Mapa oscuro':L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:20,attribution:'© OpenStreetMap © CARTO'})};
baseLayers['Mapa claro'].addTo(map);L.control.layers(baseLayers,{}, {collapsed:true,position:'bottomright'}).addTo(map);schoolLayer.addTo(map);
document.addEventListener('DOMContentLoaded',init);
async function init(){buildMaintenanceMenu();bindUI();const [schools,alcaldias,agebs,subs,fracs,mant,ref,famPot,p123_2026,alcApoyo,famPB2026]=await Promise.all([loadSchools(),fetchJsonSafe(DATA_PATHS.alcaldias),fetchJsonSafe(DATA_PATHS.agebs),fetchJsonSafe(DATA_PATHS.subsidencias),fetchJsonSafe(DATA_PATHS.fracturamiento),fetchJsonSafe(DATA_PATHS.mantenimiento),fetchJsonSafe(DATA_PATHS.reforzamiento),fetchJsonSafe(DATA_PATHS.famPotenciado),fetchJsonSafe(DATA_PATHS.programa123_2026),fetchJsonSafe(DATA_PATHS.alcaldiaApoyo),fetchJsonSafe(DATA_PATHS.famPotenciadoBasico2026)]);allSchools=schools;joinImprovements(allSchools,mant||[],ref||[],famPot||[],p123_2026||[],alcApoyo||[],famPB2026||[]);filteredSchools=[...allSchools];alcaldiasGeoJSON=alcaldias;agebsGeoJSON=agebs;subsidenciasGeoJSON=subs;fracturamientoGeoJSON=fracs;drawBoundaries();drawExtraLayers();populateFilters();restoreState();updateMap();}
async function loadSchools(){const geo=await fetchJsonSafe(DATA_PATHS.schoolsGeoJSON);if(geo?.features?.length)return geo.features.map(normalizeFeature).filter(Boolean);return new Promise((resolve,reject)=>Papa.parse(DATA_PATHS.schoolsCSV,{download:true,header:true,dynamicTyping:true,skipEmptyLines:true,complete:r=>resolve(r.data.map(normalizeRow).filter(Boolean)),error:reject}));}
async function fetchJsonSafe(url){try{const r=await fetch(url,{cache:'no-store'});return r.ok?await r.json():null}catch{return null}}
function normalizeFeature(f,i){const p=f.properties||{},c=f.geometry?.coordinates||[];const lon=Number(c[0]??p[FIELDS.x]),lat=Number(c[1]??p[FIELDS.y]);return Number.isFinite(lat)&&Number.isFinite(lon)?normalizeCommon(p,lat,lon,i):null}
function normalizeRow(p,i){const lon=Number(p[FIELDS.x]),lat=Number(p[FIELDS.y]);return Number.isFinite(lat)&&Number.isFinite(lon)?normalizeCommon(p,lat,lon,i):null}
function normalizeCommon(p,lat,lon,i){const indice=Number.isFinite(Number(p[FIELDS.indice]))?Number(p[FIELDS.indice]):MAINTENANCE_FIELDS.reduce((a,f)=>a+toBinary(p[f]),0);return{id:cleanText(p.idinmueble)||`escuela-${i}`,lat,lon,props:p,nombre:cleanText(p[FIELDS.nombre])||'Escuela sin nombre',alcaldia:normalizeAlcaldia(p[FIELDS.alcaldia]),nivel:normalizeText(p[FIELDS.nivel]),ccts:FIELDS.ccts.map(f=>normalizeCCT(p[f])).filter(Boolean),indice,clasificacion:classifyIndex(indice),needs:MAINTENANCE_FIELDS.filter(f=>toBinary(p[f])===1),subsidenciaNivel:Number(p.subsidencia_nivel)||null,subsidenciaClase:cleanText(p.subsidencia_clase),distFractura:Number.isFinite(Number(p.dist_fractura_m))?Number(p.dist_fractura_m):null,mantenimiento:null,reforzamiento:null,famPotenciado:null,programa123_2026:null,alcaldiaApoyo:null,famPotenciadoBasico2026:null,marker:null};}
function joinImprovements(schools,mant,ref,famPot,p123_2026,alcApoyo,famPB2026){const mm=new Map(),rr=new Map(),ff=new Map(),p26=new Map(),aa=new Map(),fpb26=new Map();mant.forEach(x=>{const c=normalizeCCT(x.cct);if(c)mm.set(c,x)});ref.forEach(x=>{const c=normalizeCCT(x.cct);if(c)rr.set(c,x)});famPot.forEach(x=>{const c=normalizeCCT(x.cct);if(c)ff.set(c,x)});p123_2026.forEach(x=>{const c=normalizeCCT(x.cct);if(c)p26.set(c,x)});alcApoyo.forEach(x=>{const c=normalizeCCT(x.cct);if(c)aa.set(c,x)});famPB2026.forEach(x=>{const c=normalizeCCT(x.cct);if(c)fpb26.set(c,x)});schools.forEach(s=>{s.mantenimiento=s.ccts.map(c=>mm.get(c)).find(Boolean)||null;s.reforzamiento=s.ccts.map(c=>rr.get(c)).find(Boolean)||null;s.famPotenciado=s.ccts.map(c=>ff.get(c)).find(Boolean)||null;s.programa123_2026=s.ccts.map(c=>p26.get(c)).find(Boolean)||null;s.alcaldiaApoyo=s.ccts.map(c=>aa.get(c)).find(Boolean)||null;s.famPotenciadoBasico2026=s.ccts.map(c=>fpb26.get(c)).find(Boolean)||null;});}
function buildMaintenanceMenu(){q('maintenanceFilters').innerHTML=MAINTENANCE_FIELDS.map(f=>`<label><input type="checkbox" value="${f}"><span>${MAINTENANCE_LABELS[f]}</span></label>`).join('')}
function bindUI(){q('btnAplicar').onclick=applyFilters;q('btnLimpiar').onclick=clearFilters;q('filtroAlcaldia').onchange=()=>{applyFilters();zoomToSelectedAlcaldia()};q('filtroNivel').onchange=applyFilters;const runSearch=(type,e)=>{if(e.key==='Enter'){e.preventDefault();applyFilters();zoomToMatchedSchool(type)}};q('buscarCCT').addEventListener('keydown',e=>runSearch('cct',e));q('buscarNombre').addEventListener('keydown',e=>runSearch('nombre',e));q('buscarCCT').onchange=()=>zoomToMatchedSchool('cct');q('buscarNombre').onchange=()=>zoomToMatchedSchool('nombre');q('maintenanceFilters').onchange=()=>{setMode('mantenimiento');applyFilters()};q('toggleSchools').onchange=e=>{schoolsVisible=e.target.checked;saveState();updateVisibilityByZoom()};q('modeMaintenance').onclick=()=>setMode('mantenimiento');document.querySelectorAll('input[name="themeMode"]').forEach(r=>r.onchange=e=>setMode(e.target.value));q('toggleMejoras').onclick=()=>toggleMenu('mejorasBody','mejorasArrow','toggleMejoras');q('toggleRiesgos').onclick=()=>toggleMenu('riesgosBody','riesgosArrow','toggleRiesgos');q('toggleDownloads').onclick=()=>toggleMenu('downloadsBody','downloadsArrow','toggleDownloads');const clearMejoras=q('clearMejoras');if(clearMejoras)clearMejoras.onclick=clearThemeSelection;const clearRiesgos=q('clearRiesgos');if(clearRiesgos)clearRiesgos.onclick=clearThemeSelection;q('toggleSubsidencias').onchange=e=>{toggleSubsidencias(e.target.checked);saveState()};q('toggleFracturamiento').onchange=e=>{toggleFracturamiento(e.target.checked);saveState()};q('closeDetail').onclick=()=>q('detailPanel').classList.remove('open');q('toggleLegend').onclick=()=>toggleBox('legendBody','toggleLegend');q('toggleSubLegend').onclick=()=>toggleBox('subLegendBody','toggleSubLegend');q('toggleSidebar').onclick=collapseSidebar;q('showSidebar').onclick=expandSidebar;q('statsLink').onclick=saveState;map.on('zoomend',updateVisibilityByZoom)}
function setMode(mode){activeMode=mode;q('modeMaintenance').classList.toggle('active',mode==='mantenimiento');document.querySelectorAll('input[name="themeMode"]').forEach(r=>r.checked=r.value===mode);applyFilters();renderLegend()}
function clearThemeSelection(){
  activeMode='mantenimiento';
  document.querySelectorAll('input[name="themeMode"]').forEach(r=>r.checked=false);
  q('modeMaintenance').classList.add('active');
  applyFilters();
  renderLegend();
}
function applyFilters(){const a=q('filtroAlcaldia').value,n=q('filtroNivel').value,c=q('buscarCCT').value.trim().toLowerCase(),name=q('buscarNombre').value.trim().toLowerCase(),needs=selectedNeeds();filteredSchools=allSchools.filter(s=>{if(a&&s.alcaldia!==a)return false;if(n&&s.nivel!==n)return false;if(c&&!s.ccts.some(v=>v.toLowerCase().includes(c)))return false;if(name&&!s.nombre.toLowerCase().includes(name))return false;if(needs.length&&!needs.every(f=>s.needs.includes(f)))return false;if(activeMode==='fam_regular'&&!(s.mantenimiento&&isILIFE(s.mantenimiento)))return false;if(activeMode==='programa_123'&&!(s.mantenimiento&&isDGCOP(s.mantenimiento)))return false;if(activeMode==='fam_potenciado'&&!s.famPotenciado)return false;if(activeMode==='fam_potenciado_basico_2026'&&!s.famPotenciadoBasico2026)return false;if(activeMode==='fam_reforzamiento'&&!s.reforzamiento)return false;if(activeMode==='programa_123_2026'&&!s.programa123_2026)return false;if(activeMode==='alcaldia_apoyo'&&!s.alcaldiaApoyo)return false;if(activeMode==='ambas'&&!(s.mantenimiento&&s.reforzamiento))return false;if(activeMode==='obs_fractura'&&!hasFractureObservation(s))return false;if(activeMode==='obs_subsidencia'&&!hasSubsidenceObservation(s))return false;if(activeMode==='obs_combinada'&&!(hasFractureObservation(s)&&hasSubsidenceObservation(s)))return false;return true});saveState();updateMap()}
function clearFilters(){q('filtroAlcaldia').value='';q('filtroNivel').value='';q('buscarCCT').value='';q('buscarNombre').value='';document.querySelectorAll('#maintenanceFilters input').forEach(i=>i.checked=false);activeMode='mantenimiento';document.querySelectorAll('input[name="themeMode"]').forEach(r=>r.checked=false);q('modeMaintenance').classList.add('active');filteredSchools=[...allSchools];saveState();updateMap();if(filteredSchools.length)fitToSchools(filteredSchools,12)}
function updateMap(){drawSchools();drawSummaries();updateStats();renderLegend();updateVisibilityByZoom()}
function drawSchools(){schoolLayer.clearLayers();allSchools.forEach(s=>s.marker=null);filteredSchools.forEach(s=>{const hasSupport=hasAnySupport(s);const marker=L.circleMarker([s.lat,s.lon],{radius:7,color:borderForSchool(s),weight:hasSupport?2.4:1.3,fillColor:colorForSchool(s),fillOpacity:.92});s.marker=marker;marker.bindPopup(buildPopup(s),{maxWidth:330});marker.on('click',()=>openDetail(s));schoolLayer.addLayer(marker)});if(filteredSchools.length&&!map._initialFitDone){fitToSchools(filteredSchools,12);map._initialFitDone=true}}
function colorForSchool(s){if(activeMode==='obs_fractura')return s.reforzamiento?OBS_COLORS.reforzada:OBS_COLORS.fractura;if(activeMode==='obs_subsidencia')return s.reforzamiento?OBS_COLORS.reforzada:OBS_COLORS.subsidencia;if(activeMode==='obs_combinada')return s.reforzamiento?OBS_COLORS.reforzada:OBS_COLORS.combinada;if(activeMode==='fam_regular')return '#0f766e';if(activeMode==='programa_123')return '#2563eb';if(activeMode==='fam_potenciado')return '#ca8a04';if(activeMode==='fam_potenciado_basico_2026')return '#15803d';if(activeMode==='fam_reforzamiento')return '#7c3aed';if(activeMode==='programa_123_2026')return '#0891b2';if(activeMode==='alcaldia_apoyo')return '#be123c';if(activeMode==='ambas')return '#111827';return COLORS[s.clasificacion]}
function borderForSchool(s){if(s.mantenimiento&&s.reforzamiento)return '#111827';if(s.reforzamiento)return '#7c3aed';if(s.famPotenciadoBasico2026)return '#15803d';if(s.alcaldiaApoyo)return '#be123c';if(s.programa123_2026)return '#0891b2';if(s.famPotenciado)return '#ca8a04';if(s.mantenimiento)return isILIFE(s.mantenimiento)?'#0f766e':'#2563eb';return '#fff'}
function buildPopup(s){const support=matchingSupportFields(s);return `<div class="popup-title">${escapeHtml(s.nombre)}</div><div class="popup-meta">CCT: ${escapeHtml(s.ccts.join(', ')||'No registrado')}<br>Alcaldía: ${escapeHtml(s.alcaldia||'No registrada')}<br>${activeMetricLine(s)}</div><div class="popup-flags">${s.mantenimiento&&isILIFE(s.mantenimiento)?'<span class="mini-tag teal">FAM Regular 2025</span>':''}${s.mantenimiento&&isDGCOP(s.mantenimiento)?'<span class="mini-tag blue">1, 2, 3 por mi Escuela</span>':''}${s.famPotenciado?'<span class="mini-tag gold">FAM Potenciado 2025</span>':''}${s.famPotenciadoBasico2026?'<span class="mini-tag teal">FAM Potenciado + FAM Básico 2026</span>':''}${s.reforzamiento?'<span class="mini-tag purple">FAM Reforzamiento estructural</span>':''}${s.programa123_2026?'<span class="mini-tag blue">1, 2, 3 por mi Escuela 2026</span>':''}${s.alcaldiaApoyo?'<span class="mini-tag warning">Alcaldía</span>':''}${support.length?'<span class="mini-tag warning">✓ Apoyo previo</span>':''}</div>`}
function activeMetricLine(s){if(activeMode.startsWith('obs_'))return `Observación: <strong>${escapeHtml(observationText(s))}</strong>`;return `Atenciones de revisión registradas: <strong>${s.indice}</strong>${activeMode==='mantenimiento'?` (${s.clasificacion})`:''}`}
function openDetail(s){q('detailPanel').classList.add('open');q('detailTitle').textContent=s.nombre;const support=matchingSupportFields(s);const needs=s.needs.map(f=>{const match=support.some(x=>x.field===f);return `<li class="${match?'need-with-support':''}"><span>${escapeHtml(MAINTENANCE_LABELS[f])}</span>${match?'<span class="support-signal">✓ Apoyo previo</span>':''}</li>`}).join('')||'<li>No se registraron atenciones de revisión de las variables seleccionadas.</li>';const supportSignal=support.length?'<div class="support-warning compact-support"><strong>✓ Apoyo previo</strong></div>':'';const famRegular=s.mantenimiento&&isILIFE(s.mantenimiento)?supportCard('FAM Regular 2025',s.mantenimiento,'teal-card'):'';const programa123=s.mantenimiento&&isDGCOP(s.mantenimiento)?supportCard('1, 2, 3 por mi Escuela',s.mantenimiento,'blue-card'):'';const famPot=s.famPotenciado?`<div class="info-card gold-card"><h3>FAM Potenciado 2025</h3><dl>${detailRow('Código',s.famPotenciado.codigo)}${detailRow('Monto / registro',s.famPotenciado.fam_potenciado_2025)}${detailRow('Colonia',s.famPotenciado.colonia)}</dl></div>`:'';const famPotBasico2026=s.famPotenciadoBasico2026?`<div class="info-card teal-card"><h3>FAM Potenciado + FAM Básico 2026</h3><dl>${detailRow('Código',s.famPotenciadoBasico2026.codigo)}${detailRow('Alcaldía',s.famPotenciadoBasico2026.alcaldia)}${detailRow('Colonia',s.famPotenciadoBasico2026.colonia)}${detailRow('Dirección',s.famPotenciadoBasico2026.direccion)}${detailRow('Nivel',s.famPotenciadoBasico2026.nivel)}</dl></div>`:'';const ref=s.reforzamiento?`<div class="info-card purple-card"><h3>FAM Reforzamiento estructural</h3><dl>${detailRow('Código',s.reforzamiento.codigo)}${detailRow('Intervención',s.reforzamiento.intervencion)}${detailRow('Dirección',s.reforzamiento.direccion)}</dl></div>`:'';const programa2026=s.programa123_2026?`<div class="info-card blue-card"><h3>1, 2, 3 por mi Escuela 2026</h3><dl>${detailRow('Alcaldía',s.programa123_2026.alcaldia)}${detailRow('Colonia',s.programa123_2026.colonia)}${detailRow('Dirección',s.programa123_2026.direccion)}${detailRow('Nivel',s.programa123_2026.nivel)}${detailRow('AEFCM',s.programa123_2026.aefcm)}${detailRow('SECTEI',s.programa123_2026.sectei)}${detailRow('SOBSE',s.programa123_2026.sobse)}</dl></div>`:'';const alcaldiaCard=s.alcaldiaApoyo?`<div class="info-card"><h3>Alcaldía</h3><dl>${detailRow('Territorial',s.alcaldiaApoyo.territorial)}${detailRow('Nivel',s.alcaldiaApoyo.nivel)}${detailRow('Domicilio',s.alcaldiaApoyo.domicilio)}${detailRow('Colonia',s.alcaldiaApoyo.colonia)}${detailRow('Región',s.alcaldiaApoyo.region)}</dl></div>`:'';const improvements=famRegular+programa123+famPot+famPotBasico2026+ref+programa2026+alcaldiaCard||'<p class="muted-box">No tiene apoyos registrados en las bases incorporadas.</p>';q('detailContent').innerHTML=`<div class="detail-tabs"><button class="tab-btn active" data-tab="general">General</button><button class="tab-btn" data-tab="mantenimiento">Mantenimiento</button><button class="tab-btn" data-tab="mejoras">Mejoras</button><button class="tab-btn" data-tab="riesgos">Observaciones</button></div><div class="tab-pane active" data-pane="general"><dl>${detailRow('CCT',s.ccts.join(', '))}${detailRow('Alcaldía',s.alcaldia)}${detailRow('Nivel',s.nivel)}<dt>Atención de Revisión</dt><dd>${s.indice}</dd><dt>Atención de Revisión</dt><dd><span class="badge ${classSlug(s.clasificacion)}">${s.clasificacion}</span></dd></dl></div><div class="tab-pane" data-pane="mantenimiento"><p>${maintenanceSummary(s)}</p>${supportSignal}<ul class="need-list">${needs}</ul></div><div class="tab-pane" data-pane="mejoras">${improvements}</div><div class="tab-pane" data-pane="riesgos">${riskDetail(s)}</div>`;activateDetailTabs()}
function supportCard(title,data,cardClass){return `<div class="info-card ${cardClass}"><h3>${escapeHtml(title)}</h3><dl>${detailRow('Estado',data.estado)}${detailRow('Avance',data.avance)}${detailRow('Responsable',data.responsable)}${detailRow('Modalidad',data.modalidad)}</dl>${cleanText(data.trabajos_finales)?`<p><strong>Trabajos finales:</strong><br>${formatMultiline(data.trabajos_finales)}</p>`:''}</div>`}
function activateDetailTabs(){
  const root=q('detailContent');
  if(!root)return;
  const buttons=root.querySelectorAll('.tab-btn');
  const panes=root.querySelectorAll('.tab-pane');
  buttons.forEach(button=>{
    button.addEventListener('click',()=>{
      const target=button.dataset.tab;
      buttons.forEach(b=>b.classList.toggle('active',b===button));
      panes.forEach(p=>p.classList.toggle('active',p.dataset.pane===target));
    });
  });
}
function detailRow(label,value){const v=cleanText(value);return v?`<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(v)}</dd>`:''}
function riskDetail(s){const rows=[];if(hasFractureObservation(s))rows.push(`<div class="observation-card"><strong>Revisión por cercanía a fracturamiento</strong><p>La escuela se encuentra aproximadamente a ${Math.round(s.distFractura).toLocaleString('es-MX')} m del fracturamiento más cercano. Se recomienda una revisión técnica del inmueble y seguimiento de posibles afectaciones.</p></div>`);if(hasSubsidenceObservation(s))rows.push(`<div class="observation-card"><strong>Seguimiento por subsidencia</strong><p>La escuela se localiza en una zona clasificada con subsidencia ${escapeHtml(s.subsidenciaClase.toLowerCase())}. Se recomienda observar asentamientos diferenciales, grietas y cambios en elementos constructivos.</p></div>`);if(s.reforzamiento)rows.push(`<div class="observation-card reinforced"><strong>Reforzamiento estructural registrado</strong><p>La escuela cuenta con una intervención estructural registrada. Esta condición se considera como antecedente de atención, pero se recomienda conservar el seguimiento técnico.</p></div>`);if(!rows.length)rows.push('<p class="muted-box">No se identificó una observación territorial con los criterios actuales.</p>');return rows.join('')}
function updateStats(){
  const s=filteredSchools;
  const total=s.length;
  const base=allSchools.filter(passesGeneralFilters);
  let title='Resumen visible';
  let items;

  if(activeMode==='mantenimiento'){
    const selected=selectedNeeds();
    if(selected.length){
      title='Atención de Revisión seleccionada';
      items=[
        [total,'Escuelas con la selección'],
        [total?Math.max(...s.map(x=>x.indice)):0,'Mayor Atención de Revisión'],
        [`${pct(total,base.length)}%`,'De escuelas filtradas'],
        [selected.length,'Variables activas']
      ];
    }else{
      items=[
        [total,'Escuelas'],
        [total?Math.max(...s.map(x=>x.indice)):0,'Mayor Atención de Revisión'],
        [s.filter(x=>x.indice>=15).length,'Con 15 o más'],
        [unique(s.map(x=>x.alcaldia)).length,'Alcaldías']
      ];
    }
  }else if(activeMode==='fam_regular'){
    title='FAM Regular 2025';
    items=[[total,'Escuelas'],[unique(s.map(x=>x.alcaldia)).length,'Alcaldías'],[total?Math.max(...s.map(x=>x.indice)):0,'Mayor Atención de Revisión'],[`${pct(total,base.length)}%`,'De escuelas filtradas']];
  }else if(activeMode==='programa_123'){
    title='1, 2, 3 por mi Escuela';
    items=[[total,'Escuelas'],[s.filter(x=>parseFloat(String(x.mantenimiento?.avance||'0').replace('%',''))>=100).length,'100% de avance'],[unique(s.map(x=>normalizeText(x.mantenimiento?.responsable))).length,'Responsables'],[`${pct(total,base.length)}%`,'De escuelas filtradas']];
  }else if(activeMode==='fam_potenciado'){
    title='FAM Potenciado 2025';
    items=[[total,'Escuelas'],[unique(s.map(x=>x.alcaldia)).length,'Alcaldías'],[unique(s.map(x=>x.nivel)).length,'Niveles'],[`${pct(total,base.length)}%`,'De escuelas filtradas']];
  }else if(activeMode==='fam_reforzamiento'){
    title='FAM Reforzamiento estructural';
    items=[[total,'Escuelas'],[unique(s.map(x=>x.alcaldia)).length,'Alcaldías'],[unique(s.map(x=>x.nivel)).length,'Niveles'],[`${pct(total,base.length)}%`,'De escuelas filtradas']];
  }else if(activeMode==='programa_123_2026'){
    title='1, 2, 3 por mi Escuela 2026';
    items=[[total,'Escuelas'],[unique(s.map(x=>x.alcaldia)).length,'Alcaldías'],[unique(s.map(x=>x.nivel)).length,'Niveles'],[`${pct(total,base.length)}%`,'De escuelas filtradas']];
  }else if(activeMode==='alcaldia_apoyo'){
    title='Alcaldía';
    items=[[total,'Escuelas'],[unique(s.map(x=>x.alcaldia)).length,'Alcaldías'],[unique(s.map(x=>x.nivel)).length,'Niveles'],[`${pct(total,base.length)}%`,'De escuelas filtradas']];
  }else if(activeMode==='ambas'){
    title='Escuelas con ambas mejoras';
    items=[[total,'Escuelas'],[total?Math.max(...s.map(x=>x.indice)):0,'Mayor Atención de Revisión'],[unique(s.map(x=>x.alcaldia)).length,'Alcaldías'],[`${pct(total,base.length)}%`,'De escuelas filtradas']];
  }else{
    title=modeTitle(activeMode);
    items=[[total,'Escuelas observadas'],[s.filter(x=>x.reforzamiento).length,'Con reforzamiento'],[unique(s.map(x=>x.alcaldia)).length,'Alcaldías'],[`${pct(total,base.length)}%`,'De escuelas filtradas']];
  }

  q('summaryTitle').textContent=title;
  items.forEach((it,i)=>{
    q(`kpi${i+1}`).textContent=it[0];
    q(`kpiLabel${i+1}`).textContent=it[1];
  });
}
function passesGeneralFilters(s){const a=q('filtroAlcaldia').value,n=q('filtroNivel').value,c=q('buscarCCT').value.trim().toLowerCase(),name=q('buscarNombre').value.trim().toLowerCase();return(!a||s.alcaldia===a)&&(!n||s.nivel===n)&&(!c||s.ccts.some(v=>v.toLowerCase().includes(c)))&&(!name||s.nombre.toLowerCase().includes(name))}
function renderLegend(){
  let title='Atención de Revisión Diagnóstico';
  let rows=classificationRows();

  if(activeMode==='fam_regular'){
    title='FAM Regular 2025';
    rows=[['#0f766e','Escuela beneficiada']];
  }else if(activeMode==='programa_123'){
    title='1, 2, 3 por mi Escuela';
    rows=[['#2563eb','Escuela beneficiada']];
  }else if(activeMode==='fam_potenciado'){
    title='FAM Potenciado 2025';
    rows=[['#ca8a04','Escuela beneficiada']];
  }else if(activeMode==='fam_reforzamiento'){
    title='FAM Reforzamiento estructural';
    rows=[['#7c3aed','Escuela intervenida']];
  }else if(activeMode==='programa_123_2026'){
    title='1, 2, 3 por mi Escuela 2026';
    rows=[['#0891b2','Escuela beneficiada']];
  }else if(activeMode==='alcaldia_apoyo'){
    title='Alcaldía';
    rows=[['#be123c','Escuela beneficiada']];
  }else if(activeMode==='ambas'){
    title='Ambas mejoras';
    rows=[['#111827','Mantenimiento y reforzamiento']];
  }else if(activeMode==='obs_fractura'){
    title='Revisión por fracturamiento';
    rows=[[OBS_COLORS.fractura,'Requiere revisión'],[OBS_COLORS.reforzada,'Con reforzamiento registrado']];
  }else if(activeMode==='obs_subsidencia'){
    title='Seguimiento por subsidencia';
    rows=[[OBS_COLORS.subsidencia,'Requiere seguimiento'],[OBS_COLORS.reforzada,'Con reforzamiento registrado']];
  }else if(activeMode==='obs_combinada'){
    title='Observación combinada';
    rows=[[OBS_COLORS.combinada,'Fracturamiento y subsidencia'],[OBS_COLORS.reforzada,'Con reforzamiento registrado']];
  }

  q('legendTitle').textContent=title;
  q('legendBody').innerHTML=rows.map(([c,l])=>`<div><span class="swatch" style="background:${c}"></span>${l}</div>`).join('');
}
function classificationRows(){return[['#2ca25f','Muy baja'],['#a1d99b','Baja'],['#ffd166','Media'],['#f97316','Alta'],['#dc2626','Muy alta']]}
function drawBoundaries(){if(alcaldiasGeoJSON)alcaldiaBoundaryLayer=L.geoJSON(alcaldiasGeoJSON,{style:{color:'#1f4e79',weight:1,fillOpacity:0,opacity:.55}}).addTo(map);if(agebsGeoJSON)agebBoundaryLayer=L.geoJSON(agebsGeoJSON,{style:{color:'#64748b',weight:.5,fillOpacity:0,opacity:.25}})}
function drawSummaries(){alcaldiaSummaryLayer.clearLayers();agebSummaryLayer.clearLayers();if(alcaldiasGeoJSON)drawPolygonSummary(alcaldiasGeoJSON,alcaldiaSummaryLayer,'alcaldía');if(agebsGeoJSON)drawPolygonSummary(agebsGeoJSON,agebSummaryLayer,'AGEB')}
function drawPolygonSummary(geo,layer,type){geo.features.forEach(f=>{const ss=filteredSchools.filter(s=>pointInFeature([s.lon,s.lat],f));if(!ss.length)return;addSummaryMarker(layer,getFeatureCenter(f),getAreaName(f,type),ss,type)})}
function addSummaryMarker(layer,latlng,name,schools,type){const count=schools.length,size=Math.max(34,Math.min(64,28+Math.sqrt(count)*4)),icon=L.divIcon({className:'',html:`<div class="summary-marker" style="width:${size}px;height:${size}px">${count}</div>`,iconSize:[size,size],iconAnchor:[size/2,size/2]});const marker=L.marker(latlng,{icon,title:`${name}: ${count} escuelas`});marker.bindTooltip(`${escapeHtml(name)}: ${count} escuelas`,{direction:'top'});marker.on('click',()=>{fitToSchools(schools,type==='alcaldía'?12:14)});marker.addTo(layer)}
function updateVisibilityByZoom(){[schoolLayer,alcaldiaSummaryLayer,agebSummaryLayer].forEach(l=>map.removeLayer(l));if(!schoolsVisible)return;const z=map.getZoom();if(z<11)alcaldiaSummaryLayer.addTo(map);else if(z<13)agebSummaryLayer.addTo(map);else schoolLayer.addTo(map)}
function drawExtraLayers(){if(subsidenciasGeoJSON)subsidenciaLayer=L.geoJSON(subsidenciasGeoJSON,{style:styleSubsidencia,onEachFeature:(f,l)=>{const code=Number(f.properties?.gridcode);l.bindPopup(`<div class="popup-title">Subsidencia</div><div class="popup-meta">Clasificación: <strong>${subClass(code)}</strong></div>`)}});if(fracturamientoGeoJSON)fracturamientoLayer=L.geoJSON(fracturamientoGeoJSON,{style:fractureStyle(false),onEachFeature:onEachFracture})}
function toggleSubsidencias(on){if(!subsidenciaLayer)return;if(on){subsidenciaLayer.addTo(map);q('subsidenciaLegend').classList.remove('hidden')}else{map.removeLayer(subsidenciaLayer);q('subsidenciaLegend').classList.add('hidden')}}
function toggleFracturamiento(on){if(!fracturamientoLayer)return;if(on)fracturamientoLayer.addTo(map);else map.removeLayer(fracturamientoLayer)}
function styleSubsidencia(f){const c=Number(f.properties?.gridcode);return{color:'#fff',weight:.3,opacity:.7,fillColor:COLORS[subClass(c)]||'#64748b',fillOpacity:.48}}
function subClass(c){return({1:'Muy baja',2:'Baja',3:'Media',4:'Alta',5:'Muy alta'})[c]||'No clasificada'}
function fractureStyle(selected){return{color:selected?'#0f172a':'#7c2d12',weight:selected?4:2.2,opacity:selected?1:.8}}
function onEachFracture(f,l){const p=f.properties||{},len=Number(p.MAGNI_NUM||p.Shape_Leng||0);l.bindTooltip(len?`Longitud: ${len.toFixed(1)} m`:'Fracturamiento',{sticky:true,className:'fracture-tooltip'});l.on('click',()=>{if(selectedFractureLayer&&selectedFractureLayer!==l)selectedFractureLayer.setStyle(fractureStyle(false));selectedFractureLayer=l;l.setStyle(fractureStyle(true));l.bindPopup(`<div class="popup-title">Fracturamiento</div><div class="popup-meta">Tipo: <strong>${escapeHtml(p.TIPO||'No registrado')}</strong><br>Longitud: <strong>${len?len.toFixed(1)+' m':'No registrada'}</strong></div>`).openPopup()})}
function populateFilters(){
  const alcaldias=unique(
    allSchools
      .map(s=>normalizeAlcaldia(s.alcaldia))
      .filter(Boolean)
  );

  // Unificar también el valor guardado en cada escuela para que los filtros coincidan.
  allSchools.forEach(s=>{
    s.alcaldia=normalizeAlcaldia(s.alcaldia);
  });

  fillSelect('filtroAlcaldia',alcaldias);
  fillSelect('filtroNivel',unique(allSchools.map(s=>s.nivel)));
  q('listaCCT').innerHTML=unique(allSchools.flatMap(s=>s.ccts))
    .map(v=>`<option value="${escapeHtml(v)}"></option>`).join('');
  q('listaNombres').innerHTML=unique(allSchools.map(s=>s.nombre))
    .map(v=>`<option value="${escapeHtml(v)}"></option>`).join('');
}
function fillSelect(id,vals){const el=q(id),first=el.querySelector('option').outerHTML;el.innerHTML=first+vals.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}

function resetSelectionsForSchoolSearch(){
  activeMode='mantenimiento';
  document.querySelectorAll('input[name="themeMode"]').forEach(r=>r.checked=false);
  const modeMaintenance=q('modeMaintenance');
  if(modeMaintenance)modeMaintenance.classList.add('active');

  const alcaldia=q('filtroAlcaldia');
  const nivel=q('filtroNivel');
  if(alcaldia)alcaldia.value='';
  if(nivel)nivel.value='';

  document.querySelectorAll('#maintenanceFilters input').forEach(i=>i.checked=false);

  schoolsVisible=true;
  const toggle=q('toggleSchools');
  if(toggle)toggle.checked=true;

  const detail=q('detailPanel');
  if(detail)detail.classList.remove('open');
}

function zoomToMatchedSchool(type){
  const input=q(type==='cct'?'buscarCCT':'buscarNombre');
  const raw=input?input.value.trim():'';
  if(!raw)return;

  const value=raw.toLowerCase();
  let school=allSchools.find(s=>
    type==='cct'
      ? s.ccts.some(c=>c.toLowerCase()===value)
      : s.nombre.toLowerCase()===value
  );

  if(!school){
    school=allSchools.find(s=>
      type==='cct'
        ? s.ccts.some(c=>c.toLowerCase().includes(value))
        : s.nombre.toLowerCase().includes(value)
    );
  }

  if(!school)return;

  resetSelectionsForSchoolSearch();

  // Se conserva únicamente el texto de búsqueda utilizado.
  if(type==='cct'){
    q('buscarNombre').value='';
    q('buscarCCT').value=school.ccts.find(c=>c.toLowerCase().includes(value))||raw;
  }else{
    q('buscarCCT').value='';
    q('buscarNombre').value=school.nombre;
  }

  // Volver a mostrar todas las escuelas y reconstruir marcadores sin filtros anteriores.
  filteredSchools=[...allSchools];
  saveState();
  updateMap();

  map.setView([school.lat,school.lon],17,{animate:true});

  setTimeout(()=>{
    updateVisibilityByZoom();
    const marker=school.marker;
    if(marker){
      schoolLayer.zoomToShowLayer(marker,()=>{
        marker.openPopup();
        openDetail(school);
      });
    }else{
      openDetail(school);
    }
  },450);
}
function zoomToSelectedAlcaldia(){const a=q('filtroAlcaldia').value;if(!a)return;const ss=filteredSchools.filter(s=>s.alcaldia===a);if(ss.length)fitToSchools(ss,12)}
function fitToSchools(ss,maxZoom=14){if(!ss.length)return;if(ss.length===1){map.setView([ss[0].lat,ss[0].lon],Math.min(maxZoom,17),{animate:true});return}map.fitBounds(L.latLngBounds(ss.map(s=>[s.lat,s.lon])),{padding:[45,45],maxZoom,animate:true})}
function toggleMenu(body,arrow,button){const open=q(body).classList.contains('hidden');q(body).classList.toggle('hidden',!open);q(arrow).textContent=open?'⌄':'›';q(button).setAttribute('aria-expanded',String(open))}
function toggleBox(body,button){const b=q(body),hidden=b.style.display==='none';b.style.display=hidden?'block':'none';q(button).textContent=hidden?'−':'+'}
function collapseSidebar(){q('layout').classList.add('sidebar-collapsed');q('showSidebar').classList.remove('hidden');setTimeout(()=>map.invalidateSize(),220)}
function expandSidebar(){q('layout').classList.remove('sidebar-collapsed');q('showSidebar').classList.add('hidden');setTimeout(()=>map.invalidateSize(),220)}
function normalizeSearchText(v){return cleanText(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function matchingSupportFields(s){const out=[];const mantText=normalizeSearchText(`${s.mantenimiento?.trabajos_finales||''} ${s.mantenimiento?.trabajos_solicitados||''}`);s.needs.forEach(field=>{const words=SUPPORT_KEYWORDS[field]||[];const matched=mantText&&words.some(w=>mantText.includes(normalizeSearchText(w)));if(matched)out.push({field});else if(s.reforzamiento&&STRUCTURAL_RELATED_FIELDS.has(field))out.push({field})});return out}
function isILIFE(data){return normalizeSearchText(data?.responsable).includes('ilife')}
function isDGCOP(data){return normalizeSearchText(data?.responsable).includes('dgcop')}
function hasAnySupport(s){return !!(s.mantenimiento||s.famPotenciado||s.reforzamiento||s.programa123_2026||s.alcaldiaApoyo||s.famPotenciadoBasico2026)}
function maintenanceSummary(s){return `La escuela registra ${s.indice} atenciones de revisión diagnóstico de las variables consideradas. El mayor número de necesidades dentro de la selección visible se utiliza como referencia comparativa.`}
function hasFractureObservation(s){return s.distFractura!==null&&s.distFractura<=250}
function hasSubsidenceObservation(s){return s.subsidenciaNivel!==null&&s.subsidenciaNivel>=4}
function observationText(s){const f=hasFractureObservation(s),sub=hasSubsidenceObservation(s);if(f&&sub)return s.reforzamiento?'Observación combinada con reforzamiento estructural registrado':'Revisión integral por fracturamiento y subsidencia';if(f)return s.reforzamiento?'Cercanía a fracturamiento con reforzamiento registrado':'Revisión por cercanía a fracturamiento';if(sub)return s.reforzamiento?'Subsidencia alta con reforzamiento registrado':'Seguimiento por subsidencia alta';return'No se identificó observación territorial con los criterios actuales'}
function modeTitle(mode){return({obs_fractura:'Revisión por cercanía a fracturamiento',obs_subsidencia:'Seguimiento por subsidencia alta',obs_combinada:'Observación territorial combinada'})[mode]||'Observaciones territoriales'}
function selectedNeeds(){return[...document.querySelectorAll('#maintenanceFilters input:checked')].map(i=>i.value)}
function saveState(){const state={mode:activeMode,alcaldia:q('filtroAlcaldia')?.value||'',nivel:q('filtroNivel')?.value||'',cct:q('buscarCCT')?.value||'',nombre:q('buscarNombre')?.value||'',needs:selectedNeeds(),schoolsVisible,subsidencias:q('toggleSubsidencias')?.checked||false,fracturamiento:q('toggleFracturamiento')?.checked||false};localStorage.setItem('rm08ViewerState',JSON.stringify(state))}
function restoreState(){try{const st=JSON.parse(localStorage.getItem('rm08ViewerState')||'null');if(!st)return;q('filtroAlcaldia').value=st.alcaldia||'';q('filtroNivel').value=st.nivel||'';q('buscarCCT').value=st.cct||'';q('buscarNombre').value=st.nombre||'';document.querySelectorAll('#maintenanceFilters input').forEach(i=>i.checked=(st.needs||[]).includes(i.value));schoolsVisible=st.schoolsVisible!==false;q('toggleSchools').checked=schoolsVisible;q('toggleSubsidencias').checked=!!st.subsidencias;q('toggleFracturamiento').checked=!!st.fracturamiento;activeMode=st.mode||'mantenimiento';q('modeMaintenance').classList.toggle('active',activeMode==='mantenimiento');document.querySelectorAll('input[name="themeMode"]').forEach(r=>r.checked=r.value===activeMode);toggleSubsidencias(!!st.subsidencias);toggleFracturamiento(!!st.fracturamiento);applyFilters()}catch{}}
function pointInFeature(p,f){const g=f.geometry;if(!g)return false;if(g.type==='Polygon')return pointInPolygon(p,g.coordinates);if(g.type==='MultiPolygon')return g.coordinates.some(x=>pointInPolygon(p,x));return false}
function pointInPolygon(p,poly){if(!pointInRing(p,poly[0]))return false;for(let i=1;i<poly.length;i++)if(pointInRing(p,poly[i]))return false;return true}
function pointInRing([x,y],r){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,yi]=r[i],[xj,yj]=r[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/((yj-yi)||1e-12)+xi))inside=!inside}return inside}
function getFeatureCenter(f){const c=[];collectCoords(f.geometry.coordinates,c);return[avg(c.map(x=>x[1])),avg(c.map(x=>x[0]))]}
function collectCoords(o,out){if(typeof o[0]==='number')out.push(o);else o.forEach(x=>collectCoords(x,out))}
function getAreaName(f,fb){const p=f.properties||{};for(const k of ['alcaldia','NOMGEO','NOM_ALC','NOMBRE','nombre','CVEGEO','CVE_AGEB'])if(cleanText(p[k]))return cleanText(p[k]);return fb}
function classifyIndex(v){return v<=6?'Muy baja':v<=10?'Baja':v<=14?'Media':v<=18?'Alta':'Muy alta'}
function classSlug(s){return cleanText(s).toLowerCase().replace(/\s+/g,'-')}
function toBinary(v){return Number(v)===1?1:0}

function normalizeAlcaldia(value){
  const original=cleanText(value);
  if(!original)return '';
  const key=original
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ')
    .trim()
    .toUpperCase();

  const names={
    'ALVARO OBREGON':'ÁLVARO OBREGÓN',
    'BENITO JUAREZ':'BENITO JUÁREZ',
    'COYOACAN':'COYOACÁN',
    'CUAUHTEMOC':'CUAUHTÉMOC'
  };

  return names[key]||key;
}

function normalizeCCT(v){return cleanText(v).replace(/\s+/g,'').toUpperCase()}
function cleanText(v){if(v===null||v===undefined)return'';const s=String(v).trim();return!s||s.toLowerCase()==='nan'?'':s}
function normalizeText(v){return cleanText(v).replace(/\s+/g,' ')}
function formatMultiline(v){const s=cleanText(v);return escapeHtml(s).replace(/\n/g,'<br>')}
function avg(a){return a.length?a.reduce((x,y)=>x+Number(y||0),0)/a.length:0}
function unique(a){return[...new Set(a.filter(Boolean))].sort((x,y)=>x.localeCompare(y,'es'))}
function pct(a,b){return b?(a/b*100).toFixed(1):'0.0'}
function q(id){return document.getElementById(id)}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
