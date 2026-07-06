/* Visor RM08 - mantenimiento escolar
   Archivos esperados:
   data/indicemantenimiento.json
   data/basededatosrm08cc.csv
   data/alcaldias.json
   data/ageb.json
*/

const DATA_PATHS = {
  schoolsGeoJSON: "data/indicemantenimiento.json",
  schoolsCSV: "data/basededatosrm08cc.csv",
  alcaldias: "data/alcaldias.json",
  agebs: "data/ageb.json"
};

const FIELDS = {
  alcaldia: "alcaldia",
  nivel: "principal",
  nombre: "inmueble",
  ccts: ["cct1", "cct2", "cct3", "cct4"],
  x: "coord_x",
  y: "coord_y",
  indice: "Indice_Man"
};

const MAINTENANCE_FIELDS = [
  "impermeabi","interior","exterior1","loseta","ventanas","ventanas1","ventanas2",
  "puertas","escaleras","pluviales","techos","desazolve","deterioro","concreto",
  "tinacos","cisterna","agua","agua1","hidrosanit","sanitarios","luminarias",
  "electrica","transforma","lamina"
];

const MAINTENANCE_LABELS = {
  impermeabi:"Impermeabilización",
  interior:"Pintura interior",
  exterior1:"Pintura exterior",
  loseta:"Loseta",
  ventanas:"Vidrios / ventanas",
  ventanas1:"Cancelería de aluminio / ventanas",
  ventanas2:"Cancelería de herrería / ventanas",
  puertas:"Puertas",
  escaleras:"Barandales, pasillos o escaleras",
  pluviales:"Bajadas pluviales",
  techos:"Muros o techos",
  desazolve:"Desazolve",
  deterioro:"Deterioro de estructura o acabados",
  concreto:"Concreto",
  tinacos:"Tinacos",
  cisterna:"Cisterna",
  agua:"Agua potable",
  agua1:"Red o abastecimiento de agua",
  hidrosanit:"Instalación hidrosanitaria",
  sanitarios:"Sanitarios",
  luminarias:"Luminarias",
  electrica:"Instalación eléctrica",
  transforma:"Transformador",
  lamina:"Lámina"
};

let allSchools = [];
let filteredSchools = [];
let alcaldiasGeoJSON = null;
let agebsGeoJSON = null;

let schoolLayer = L.markerClusterGroup({
  showCoverageOnHover:false,
  maxClusterRadius:32,
  spiderfyOnMaxZoom:true,
  disableClusteringAtZoom:16
});
let alcaldiaSummaryLayer = L.layerGroup();
let agebSummaryLayer = L.layerGroup();
let alcaldiaBoundaryLayer = null;
let agebBoundaryLayer = null;

const map = L.map("map", {
  zoomControl:true,
  preferCanvas:true
}).setView([19.35, -99.13], 10);

const baseLayers = {
  "OpenStreetMap": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom:19,
    attribution:"© OpenStreetMap"
  }),
  "Mapa claro": L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom:20,
    attribution:"© OpenStreetMap © CARTO"
  }),
  "Mapa oscuro": L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom:20,
    attribution:"© OpenStreetMap © CARTO"
  }),
  "Satélite": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom:19,
    attribution:"Tiles © Esri"
  })
};

baseLayers["Mapa claro"].addTo(map);

const overlayLayers = {
  "Escuelas": schoolLayer,
  "Resumen por alcaldía": alcaldiaSummaryLayer,
  "Resumen por AGEB": agebSummaryLayer
};

L.control.layers(baseLayers, overlayLayers, {collapsed:true}).addTo(map);
schoolLayer.addTo(map);

document.addEventListener("DOMContentLoaded", init);

async function init(){
  buildMaintenanceMenu();
  bindUI();

  const [schools, alcaldias, agebs] = await Promise.all([
    loadSchools(),
    fetchJsonSafe(DATA_PATHS.alcaldias),
    fetchJsonSafe(DATA_PATHS.agebs)
  ]);

  allSchools = schools;
  filteredSchools = [...allSchools];
  alcaldiasGeoJSON = alcaldias;
  agebsGeoJSON = agebs;

  drawBoundaries();
  populateFilters();
  updateMap();
}

async function loadSchools(){
  const geo = await fetchJsonSafe(DATA_PATHS.schoolsGeoJSON);
  if(geo && geo.features && geo.features.length){
    return geo.features.map((f, i) => normalizeFeature(f, i)).filter(Boolean);
  }

  return new Promise((resolve, reject) => {
    Papa.parse(DATA_PATHS.schoolsCSV, {
      download:true,
      header:true,
      dynamicTyping:true,
      skipEmptyLines:true,
      complete: results => {
        const rows = results.data.map((row, i) => normalizeRow(row, i)).filter(Boolean);
        resolve(rows);
      },
      error: err => reject(err)
    });
  });
}

async function fetchJsonSafe(url){
  try{
    const res = await fetch(url, {cache:"no-store"});
    if(!res.ok) return null;
    return await res.json();
  }catch(e){
    console.warn(`No se pudo cargar ${url}`, e);
    return null;
  }
}

function normalizeFeature(feature, i){
  const p = feature.properties || {};
  let lon, lat;

  if(feature.geometry && feature.geometry.type === "Point"){
    lon = Number(feature.geometry.coordinates[0]);
    lat = Number(feature.geometry.coordinates[1]);
  }else{
    lon = Number(p[FIELDS.x]);
    lat = Number(p[FIELDS.y]);
  }

  if(!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return normalizeCommon(p, lat, lon, i);
}

function normalizeRow(row, i){
  const lon = Number(row[FIELDS.x]);
  const lat = Number(row[FIELDS.y]);
  if(!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return normalizeCommon(row, lat, lon, i);
}

function normalizeCommon(p, lat, lon, i){
  const indice = Number.isFinite(Number(p[FIELDS.indice]))
    ? Number(p[FIELDS.indice])
    : MAINTENANCE_FIELDS.reduce((sum, field) => sum + toBinary(p[field]), 0);

  const ccts = FIELDS.ccts
    .map(f => cleanText(p[f]))
    .filter(Boolean);

  return {
    id: cleanText(p.idinmueble) || `escuela-${i}`,
    lat,
    lon,
    props:p,
    nombre: cleanText(p[FIELDS.nombre]) || "Sin nombre",
    alcaldia: normalizeText(p[FIELDS.alcaldia]),
    nivel: normalizeText(p[FIELDS.nivel]),
    ccts,
    indice,
    clasificacion: classifyIndex(indice),
    needs: MAINTENANCE_FIELDS.filter(f => toBinary(p[f]) === 1)
  };
}

function toBinary(value){
  if(value === 1 || value === "1") return 1;
  const n = Number(value);
  return Number.isFinite(n) && n === 1 ? 1 : 0;
}

function cleanText(value){
  if(value === null || value === undefined) return "";
  const s = String(value).trim();
  if(!s || s.toLowerCase() === "nan") return "";
  return s;
}

function normalizeText(value){
  return cleanText(value).replace(/\s+/g, " ");
}

function classifyIndex(v){
  if(v <= 6) return "Muy baja";
  if(v <= 10) return "Baja";
  if(v <= 14) return "Media";
  if(v <= 18) return "Alta";
  return "Muy alta";
}

function colorByIndex(v){
  if(v <= 6) return "#2ca25f";
  if(v <= 10) return "#a1d99b";
  if(v <= 14) return "#ffd166";
  if(v <= 18) return "#f97316";
  return "#dc2626";
}

function classSlug(label){
  return label.toLowerCase().replace(/\s+/g, "-");
}

function buildMaintenanceMenu(){
  const container = document.getElementById("maintenanceFilters");
  container.innerHTML = MAINTENANCE_FIELDS.map(field => `
    <label>
      <input type="checkbox" value="${field}">
      <span>${MAINTENANCE_LABELS[field] || field}</span>
    </label>
  `).join("");
}

function bindUI(){
  document.getElementById("btnAplicar").addEventListener("click", applyFilters);
  document.getElementById("btnLimpiar").addEventListener("click", clearFilters);

  document.getElementById("filtroAlcaldia").addEventListener("change", () => {
    applyFilters();
    zoomToSelectedAlcaldia();
  });
  document.getElementById("filtroNivel").addEventListener("change", applyFilters);
  document.getElementById("buscarCCT").addEventListener("input", applyFilters);
  document.getElementById("buscarNombre").addEventListener("input", applyFilters);

  document.getElementById("maintenanceFilters").addEventListener("change", applyFilters);

  document.getElementById("closeDetail").addEventListener("click", () => {
    document.getElementById("detailPanel").classList.remove("open");
  });

  document.getElementById("toggleLegend").addEventListener("click", () => {
    const body = document.getElementById("legendBody");
    const btn = document.getElementById("toggleLegend");
    const hidden = body.style.display === "none";
    body.style.display = hidden ? "block" : "none";
    btn.textContent = hidden ? "−" : "+";
  });

  map.on("zoomend", updateVisibilityByZoom);
}

function populateFilters(){
  fillSelect("filtroAlcaldia", unique(allSchools.map(s => s.alcaldia)));
  fillSelect("filtroNivel", unique(allSchools.map(s => s.nivel)));

  const cctOptions = unique(allSchools.flatMap(s => s.ccts));
  document.getElementById("listaCCT").innerHTML = cctOptions.map(v => `<option value="${escapeHtml(v)}"></option>`).join("");

  const nameOptions = unique(allSchools.map(s => s.nombre));
  document.getElementById("listaNombres").innerHTML = nameOptions.map(v => `<option value="${escapeHtml(v)}"></option>`).join("");
}

function fillSelect(id, values){
  const select = document.getElementById(id);
  const first = select.querySelector("option").outerHTML;
  select.innerHTML = first + values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
}

function unique(arr){
  return [...new Set(arr.filter(Boolean))].sort((a,b) => a.localeCompare(b, "es"));
}

function applyFilters(){
  const alcaldia = document.getElementById("filtroAlcaldia").value;
  const nivel = document.getElementById("filtroNivel").value;
  const cct = document.getElementById("buscarCCT").value.trim().toLowerCase();
  const nombre = document.getElementById("buscarNombre").value.trim().toLowerCase();
  const activeNeeds = [...document.querySelectorAll("#maintenanceFilters input:checked")].map(i => i.value);

  filteredSchools = allSchools.filter(s => {
    if(alcaldia && s.alcaldia !== alcaldia) return false;
    if(nivel && s.nivel !== nivel) return false;
    if(cct && !s.ccts.some(v => v.toLowerCase().includes(cct))) return false;
    if(nombre && !s.nombre.toLowerCase().includes(nombre)) return false;
    if(activeNeeds.length && !activeNeeds.every(f => s.needs.includes(f))) return false;
    return true;
  });

  updateMap();
}

function clearFilters(){
  document.getElementById("filtroAlcaldia").value = "";
  document.getElementById("filtroNivel").value = "";
  document.getElementById("buscarCCT").value = "";
  document.getElementById("buscarNombre").value = "";
  document.querySelectorAll("#maintenanceFilters input").forEach(i => i.checked = false);
  filteredSchools = [...allSchools];
  updateMap();
  if(filteredSchools.length) fitToSchools(filteredSchools);
}

function updateMap(){
  drawSchools();
  drawSummaries();
  updateKpis();
  updateVisibilityByZoom();
}

function drawSchools(){
  schoolLayer.clearLayers();

  filteredSchools.forEach(s => {
    const marker = L.circleMarker([s.lat, s.lon], {
      radius:7,
      color:"#ffffff",
      weight:1.4,
      fillColor:colorByIndex(s.indice),
      fillOpacity:.9
    });

    marker.bindPopup(buildPopup(s), {maxWidth:280});
    marker.on("click", () => openDetail(s));
    schoolLayer.addLayer(marker);
  });

  if(filteredSchools.length && !map._initialFitDone){
    fitToSchools(filteredSchools);
    map._initialFitDone = true;
  }
}

function buildPopup(s){
  const needs = s.needs.map(f => `<li>${escapeHtml(MAINTENANCE_LABELS[f] || f)}</li>`).join("");
  return `
    <div class="popup-title">${escapeHtml(s.nombre)}</div>
    <div class="popup-meta">
      CCT: ${escapeHtml(s.ccts.join(", ") || "Sin dato")}<br>
      Alcaldía: ${escapeHtml(s.alcaldia || "Sin dato")}<br>
      Índice: <strong>${s.indice}</strong> (${s.clasificacion})
    </div>
    <details class="popup-details">
      <summary>Necesidades detectadas</summary>
      <ul>${needs || "<li>Sin necesidades registradas</li>"}</ul>
    </details>
  `;
}

function openDetail(s){
  document.getElementById("detailPanel").classList.add("open");
  document.getElementById("detailTitle").textContent = s.nombre;

  const needs = s.needs.map(f => `<li>${escapeHtml(MAINTENANCE_LABELS[f] || f)}</li>`).join("");
  const summary = maintenanceSummary(s);

  document.getElementById("detailContent").innerHTML = `
    <dl>
      <dt>CCT</dt><dd>${escapeHtml(s.ccts.join(", ") || "Sin dato")}</dd>
      <dt>Alcaldía</dt><dd>${escapeHtml(s.alcaldia || "Sin dato")}</dd>
      <dt>Nivel</dt><dd>${escapeHtml(s.nivel || "Sin dato")}</dd>
      <dt>Índice</dt><dd>${s.indice}</dd>
      <dt>Clasificación</dt><dd><span class="badge ${classSlug(s.clasificacion)}">${s.clasificacion}</span></dd>
    </dl>

    <h3>Resumen de mantenimiento</h3>
    <p>${summary}</p>

    <h3>Necesidades detectadas</h3>
    <ul class="need-list">${needs || "<li>Sin necesidades registradas</li>"}</ul>

    <details>
      <summary>Mostrar todas las variables con Sí/No</summary>
      <dl>
        ${MAINTENANCE_FIELDS.map(f => `
          <dt>${escapeHtml(MAINTENANCE_LABELS[f] || f)}</dt>
          <dd>${s.needs.includes(f) ? "Sí" : "No"}</dd>
        `).join("")}
      </dl>
    </details>
  `;
}

function maintenanceSummary(s){
  if(s.indice <= 6) return "El inmueble presenta un nivel bajo de necesidades registradas. Se sugiere seguimiento preventivo.";
  if(s.indice <= 10) return "El inmueble presenta necesidades puntuales de mantenimiento. Se recomienda revisión operativa.";
  if(s.indice <= 14) return "El inmueble presenta un nivel medio de necesidades. Conviene priorizar una visita técnica.";
  if(s.indice <= 18) return "El inmueble presenta alta concentración de necesidades. Se recomienda atención prioritaria.";
  return "El inmueble presenta muy alta concentración de necesidades. Se recomienda intervención prioritaria y revisión integral.";
}

function drawBoundaries(){
  if(alcaldiasGeoJSON){
    alcaldiaBoundaryLayer = L.geoJSON(alcaldiasGeoJSON, {
      style:{color:"#1f4e79", weight:1, fillOpacity:0, opacity:.55}
    }).addTo(map);
  }

  if(agebsGeoJSON){
    agebBoundaryLayer = L.geoJSON(agebsGeoJSON, {
      style:{color:"#64748b", weight:.5, fillOpacity:0, opacity:.25}
    });
  }
}

function drawSummaries(){
  alcaldiaSummaryLayer.clearLayers();
  agebSummaryLayer.clearLayers();

  if(alcaldiasGeoJSON) drawPolygonSummary(alcaldiasGeoJSON, alcaldiaSummaryLayer, "alcaldía");
  else drawAttributeSummary("alcaldia", alcaldiaSummaryLayer);

  if(agebsGeoJSON) drawPolygonSummary(agebsGeoJSON, agebSummaryLayer, "AGEB");
}

function drawAttributeSummary(attr, layer){
  const groups = groupBy(filteredSchools, s => s[attr] || "Sin dato");
  Object.entries(groups).forEach(([name, schools]) => {
    const lat = avg(schools.map(s => s.lat));
    const lon = avg(schools.map(s => s.lon));
    addSummaryMarker(layer, [lat, lon], name, schools);
  });
}

function drawPolygonSummary(geojson, layer, type){
  geojson.features.forEach(feature => {
    const schools = filteredSchools.filter(s => pointInFeature([s.lon, s.lat], feature));
    if(!schools.length) return;

    const center = getFeatureCenter(feature);
    const name = getAreaName(feature, type);
    addSummaryMarker(layer, center, name, schools);
  });
}

function addSummaryMarker(layer, latlng, name, schools){
  const count = schools.length;
  const mean = avg(schools.map(s => s.indice));
  const size = Math.max(34, Math.min(64, 28 + Math.sqrt(count) * 4));

  const icon = L.divIcon({
    className:"",
    html:`<div class="summary-marker" style="width:${size}px;height:${size}px">${count}</div>`,
    iconSize:[size,size],
    iconAnchor:[size/2,size/2]
  });

  const marker = L.marker(latlng, {icon});
  marker.bindPopup(`
    <div class="popup-title">${escapeHtml(name)}</div>
    <div class="popup-meta">
      Escuelas: <strong>${count}</strong><br>
      Promedio del índice: <strong>${mean.toFixed(1)}</strong><br>
      Alta y muy alta: <strong>${schools.filter(s => s.indice >= 15).length}</strong>
    </div>
  `);

  layer.addLayer(marker);
}

function updateVisibilityByZoom(){
  const z = map.getZoom();

  map.removeLayer(alcaldiaSummaryLayer);
  map.removeLayer(agebSummaryLayer);
  map.removeLayer(schoolLayer);

  if(z < 11){
    alcaldiaSummaryLayer.addTo(map);
  }else if(z < 14){
    agebSummaryLayer.addTo(map);
    if(agebBoundaryLayer && !map.hasLayer(agebBoundaryLayer)) agebBoundaryLayer.addTo(map);
  }else{
    schoolLayer.addTo(map);
  }

  if(z < 11 && agebBoundaryLayer && map.hasLayer(agebBoundaryLayer)){
    map.removeLayer(agebBoundaryLayer);
  }
}

function updateKpis(){
  const total = filteredSchools.length;
  const mean = total ? avg(filteredSchools.map(s => s.indice)) : 0;
  const high = filteredSchools.filter(s => s.indice >= 15).length;

  document.getElementById("kpiTotal").textContent = total.toLocaleString("es-MX");
  document.getElementById("kpiPromedio").textContent = mean.toFixed(1);
  document.getElementById("kpiAlta").textContent = high.toLocaleString("es-MX");
}

function fitToSchools(schools){
  const bounds = L.latLngBounds(schools.map(s => [s.lat, s.lon]));
  map.fitBounds(bounds, {padding:[35,35], maxZoom:13});
}

function zoomToSelectedAlcaldia(){
  const selected = document.getElementById("filtroAlcaldia").value;
  if(!selected) return;

  if(alcaldiaBoundaryLayer){
    let found = null;
    alcaldiaBoundaryLayer.eachLayer(layer => {
      const name = getAreaName(layer.feature, "alcaldía").toUpperCase();
      if(name === selected.toUpperCase()) found = layer;
    });
    if(found){
      map.fitBounds(found.getBounds(), {padding:[30,30]});
      return;
    }
  }

  const schools = filteredSchools.filter(s => s.alcaldia === selected);
  if(schools.length) fitToSchools(schools);
}

function getAreaName(feature, fallback){
  const p = feature.properties || {};
  const candidates = [
    "alcaldia","NOMGEO","nomgeo","NOM_ALC","NOMBRE","nombre","municipio",
    "CVEGEO","cvegeo","AGEB","ageb","CVE_AGEB"
  ];
  for(const c of candidates){
    if(cleanText(p[c])) return cleanText(p[c]);
  }
  return fallback;
}

function getFeatureCenter(feature){
  try{
    const coords = [];
    collectCoords(feature.geometry.coordinates, coords);
    const lon = avg(coords.map(c => c[0]));
    const lat = avg(coords.map(c => c[1]));
    return [lat, lon];
  }catch(e){
    return [19.35, -99.13];
  }
}

function collectCoords(obj, out){
  if(typeof obj[0] === "number"){
    out.push(obj);
  }else{
    obj.forEach(o => collectCoords(o, out));
  }
}

function pointInFeature(point, feature){
  const geom = feature.geometry;
  if(!geom) return false;

  if(geom.type === "Polygon"){
    return pointInPolygon(point, geom.coordinates);
  }

  if(geom.type === "MultiPolygon"){
    return geom.coordinates.some(poly => pointInPolygon(point, poly));
  }

  return false;
}

function pointInPolygon(point, polygon){
  const insideOuter = pointInRing(point, polygon[0]);
  if(!insideOuter) return false;
  for(let i=1;i<polygon.length;i++){
    if(pointInRing(point, polygon[i])) return false;
  }
  return true;
}

function pointInRing(point, ring){
  const x = point[0], y = point[1];
  let inside = false;
  for(let i=0, j=ring.length-1; i<ring.length; j=i++){
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi);
    if(intersect) inside = !inside;
  }
  return inside;
}

function groupBy(arr, fn){
  return arr.reduce((acc, item) => {
    const key = fn(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

function avg(arr){
  if(!arr.length) return 0;
  return arr.reduce((a,b) => a + Number(b || 0), 0) / arr.length;
}

function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
