const DATA_PATHS = {
  schoolsGeoJSON: "data/indicemantenimiento.json",
  schoolsCSV: "data/basededatosrm08cc.csv"
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

document.addEventListener("DOMContentLoaded", initStats);

async function initStats(){
  const schools = await loadSchools();
  renderStats(schools);
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
      complete: results => resolve(results.data.map((r, i) => normalizeRow(r, i)).filter(Boolean)),
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
    return null;
  }
}

function normalizeFeature(feature, i){
  const p = feature.properties || {};
  return normalizeCommon(p, i);
}

function normalizeRow(row, i){
  return normalizeCommon(row, i);
}

function normalizeCommon(p, i){
  const indice = Number.isFinite(Number(p[FIELDS.indice]))
    ? Number(p[FIELDS.indice])
    : MAINTENANCE_FIELDS.reduce((sum, field) => sum + toBinary(p[field]), 0);

  const ccts = FIELDS.ccts.map(f => cleanText(p[f])).filter(Boolean);

  return {
    id: cleanText(p.idinmueble) || `escuela-${i}`,
    nombre: cleanText(p[FIELDS.nombre]) || "Sin nombre",
    alcaldia: cleanText(p[FIELDS.alcaldia]) || "Sin dato",
    nivel: cleanText(p[FIELDS.nivel]) || "Sin dato",
    ccts,
    indice,
    clasificacion: classifyIndex(indice)
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
  return s.replace(/\s+/g, " ");
}

function classifyIndex(v){
  if(v <= 6) return "Muy baja";
  if(v <= 10) return "Baja";
  if(v <= 14) return "Media";
  if(v <= 18) return "Alta";
  return "Muy alta";
}

function renderStats(schools){
  const total = schools.length;
  const indices = schools.map(s => s.indice);

  document.getElementById("stTotal").textContent = total.toLocaleString("es-MX");
  document.getElementById("stPromedio").textContent = avg(indices).toFixed(1);
  document.getElementById("stMin").textContent = total ? Math.min(...indices) : 0;
  document.getElementById("stMax").textContent = total ? Math.max(...indices) : 0;

  renderClassification(schools);
  renderGroupedTable(schools, "alcaldia", "tablaAlcaldia", true);
  renderGroupedTable(schools, "nivel", "tablaNivel", false);
  renderRanking(schools);
}

function renderClassification(schools){
  const order = ["Muy baja","Baja","Media","Alta","Muy alta"];
  const groups = groupBy(schools, s => s.clasificacion);
  const total = schools.length;

  document.getElementById("tablaClasificacion").innerHTML = order.map(label => {
    const count = (groups[label] || []).length;
    const pct = total ? (count / total * 100) : 0;
    return `<tr>
      <td>${label}</td>
      <td>${count.toLocaleString("es-MX")}</td>
      <td>
        ${pct.toFixed(1)}%
        <div class="bar"><span style="width:${pct}%"></span></div>
      </td>
    </tr>`;
  }).join("");
}

function renderGroupedTable(schools, field, targetId, full){
  const groups = groupBy(schools, s => s[field] || "Sin dato");
  const rows = Object.entries(groups)
    .map(([name, arr]) => ({
      name,
      total:arr.length,
      promedio:avg(arr.map(s => s.indice)),
      min:Math.min(...arr.map(s => s.indice)),
      max:Math.max(...arr.map(s => s.indice)),
      alta:arr.filter(s => s.indice >= 15).length
    }))
    .sort((a,b) => b.promedio - a.promedio);

  document.getElementById(targetId).innerHTML = rows.map(r => {
    if(full){
      return `<tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${r.total.toLocaleString("es-MX")}</td>
        <td>${r.promedio.toFixed(1)}</td>
        <td>${r.min}</td>
        <td>${r.max}</td>
        <td>${r.alta.toLocaleString("es-MX")}</td>
      </tr>`;
    }

    return `<tr>
      <td>${escapeHtml(r.name)}</td>
      <td>${r.total.toLocaleString("es-MX")}</td>
      <td>${r.promedio.toFixed(1)}</td>
      <td>${r.max}</td>
    </tr>`;
  }).join("");
}

function renderRanking(schools){
  const rows = [...schools].sort((a,b) => b.indice - a.indice).slice(0, 25);
  document.getElementById("tablaRanking").innerHTML = rows.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(s.nombre)}</td>
      <td>${escapeHtml(s.ccts.join(", ") || "Sin dato")}</td>
      <td>${escapeHtml(s.alcaldia)}</td>
      <td>${escapeHtml(s.nivel)}</td>
      <td><strong>${s.indice}</strong></td>
      <td>${s.clasificacion}</td>
    </tr>
  `).join("");
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
