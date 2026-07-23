import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";

// ── Constants ─────────────────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();

const ZONE_DISTANCES = {
  "Marbella": 1, "Nueva Andalucía": 4, "Puerto Banús": 6, "Las Chapas": 10,
  "Elviria": 8, "San Pedro de Alcántara": 12, "Guadalmina": 14, "Cancelada": 18,
  "Estepona": 28, "Selwo": 22, "Ojén": 8, "Benahavís": 18, "Istán": 12,
  "Mijas": 20, "Mijas Costa": 22, "Fuengirola": 28, "Benalmádena": 35,
  "Torremolinos": 42, "Málaga capital": 55, "Manilva": 50, "Sabinillas": 48, "Casares": 44,
};

const PLANTA_ORDER = { "Bajo": 0, "1ª": 1, "2ª": 2, "3ª": 3, "4ª": 4, "5ª": 5, "Ático": 6 };

const ORIENTACION_SCORE = {
  "Sur": 1, "Norte-Sur": 0.9, "Suroeste": 0.85, "Sureste": 0.85,
  "Este-Oeste": 0.7, "Este": 0.65, "Oeste": 0.65,
  "Noroeste": 0.35, "Noreste": 0.35, "Norte": 0,
};

const VISTAS_SCORE = {
  "Mar": 1, "Montaña": 0.85, "Campo de golf": 0.75,
  "Jardín": 0.65, "Interior urbanización": 0.65, "Piscina": 0.55,
  "Calle": 0.35, "Sin vistas": 0,
};

const DEFAULT_CRITERIA = [
  { id: "price",       label: "Precio",           weight: 10, type: "range",      min: 240000, max: 320000, unit: "€" },
  { id: "sizeUtil",    label: "M² útiles",         weight: 5,  type: "range",      min: 140,    max: 65,     unit: "m²" },
  { id: "trastero",    label: "Trastero",           weight: 7,  type: "boolean" },
  { id: "garaje",      label: "Garaje",             weight: 5,  type: "boolean" },
  { id: "terraza",     label: "Terraza",            weight: 4,  type: "boolean" },
  { id: "piscina",     label: "Piscina",            weight: 3,  type: "boolean" },
  { id: "aireCond",    label: "Aire acond.",        weight: 3,  type: "boolean" },
  { id: "ascensor",    label: "Ascensor",           weight: 4,  type: "boolean" },
  { id: "jardin",      label: "Jardín",             weight: 3,  type: "boolean" },
  { id: "amueblado",   label: "Amueblado",          weight: 1,  type: "boolean" },
  { id: "orientacion", label: "Orientación",        weight: 5,  type: "orientacion" },
  { id: "comunidad",   label: "Comunidad",          weight: 4,  type: "range",      min: 0,      max: 250,    unit: "€/mes" },
  { id: "ibi",         label: "IBI",                weight: 2,  type: "range",      min: 0,      max: 1500,   unit: "€/año" },
  { id: "distanciaKm", label: "Distancia trabajo",  weight: 5,  type: "range",      min: 0,      max: 70,     unit: "km" },
  { id: "planta",      label: "Planta",             weight: 4,  type: "planta" },
  { id: "vistas",      label: "Vistas",             weight: 5,  type: "vistas" },
  { id: "lavadero",    label: "Lavadero",           weight: 2,  type: "boolean" },
  { id: "soleria",     label: "Solería",            weight: 2,  type: "soleria" },
  { id: "precioM2",    label: "Precio / m²",        weight: 4,  type: "range",   min: 2400, max: 4000, unit: "€/m²" },
  { id: "estadoBanos", label: "Estado baños",        weight: 4,  type: "mapped",  scoreMap: "BANOS_SCORE" },
  { id: "estadoCocina",label: "Estado cocina",       weight: 4,  type: "mapped",  scoreMap: "COCINA_SCORE_MAP" },
  { id: "tipoAire",    label: "Tipo A/C",            weight: 4,  type: "mapped",  scoreMap: "AIRE_SCORE_MAP" },
];

const ZONES = ["Málaga capital","Torremolinos","Benalmádena","Fuengirola","Mijas","Mijas Costa","Marbella","Las Chapas","Elviria","Nueva Andalucía","Puerto Banús","San Pedro de Alcántara","Guadalmina","Cancelada","Estepona","Selwo","Manilva","Sabinillas","Casares","Ojén","Istán","Benahavís"];

const SOLERIA_SCORE = { "Mármol": 1, "Tarima flotante": 0.7, "Gres": 0.4 };

const BANOS_CATS = [
  { val: "reforma_urgente",   label: "Reforma urgente",     icon: "🔴", desc: "Muy viejos, instalación deficiente",              score: 0 },
  { val: "anticuado",         label: "Anticuado funcional", icon: "🟠", desc: "Viejos pero operativos, no son de tu gusto",      score: 0.25 },
  { val: "clasico_elegante",  label: "Clásico elegante",    icon: "🟡", desc: "Estética de hace años pero cuidados y con clase", score: 0.55 },
  { val: "actualizado",       label: "Actualizado",         icon: "🟢", desc: "Reformado recientemente, estética actual",        score: 0.8 },
  { val: "lujo",              label: "De lujo",             icon: "✨", desc: "Diseño contemporáneo, materiales premium",        score: 1 },
];

const COCINA_CATS = [
  { val: "muy_antigua",       label: "Muy antigua",         icon: "🔴", desc: "Muebles muy viejos, sin reformar",                score: 0 },
  { val: "antigua_funcional", label: "Antigua funcional",   icon: "🟠", desc: "Antigua pero operativa, reforma a medio plazo",   score: 0.25 },
  { val: "correcta",          label: "Correcta",            icon: "🟡", desc: "Estética pasada pero bien conservada",            score: 0.5 },
  { val: "moderna",           label: "Moderna",             icon: "🟢", desc: "Reformada, electrodomésticos actuales",           score: 0.8 },
  { val: "premium",           label: "Premium",             icon: "✨", desc: "Alto nivel, isla o barra, electrodomésticos top", score: 1 },
];

const COCINA_POSITIVOS = [
  { val: "reformada",    label: "Reformada / moderna" },
  { val: "grande",       label: "Grande y espaciosa" },
  { val: "luz_natural",  label: "Luz natural / ventana" },
  { val: "pasaplatos",   label: "Comunicada con salón / pasaplatos" },
  { val: "electro_alta", label: "Electrodomésticos gama alta" },
  { val: "isla",         label: "Con isla o barra" },
];

const COCINA_NEGATIVOS = [
  { val: "termo",          label: "Termo eléctrico dentro" },
  { val: "lavadora",       label: "Lavadora dentro (sin lavadero)" },
  { val: "muebles_viejos", label: "Muebles muy viejos" },
  { val: "pequena",        label: "Cocina pequeña" },
  { val: "interior",       label: "Interior sin luz" },
  { val: "electro_ant",    label: "Electrodomésticos anticuados" },
];

const AIRE_CATS = [
  { val: "centralizado", label: "Centralizado",  icon: "❄️",  desc: "Con rejillas de impulsión y retorno", score: 1 },
  { val: "splits",       label: "Por splits",    icon: "🌬️", desc: "Unidades individuales por estancia",  score: 0.5 },
  { val: "sin_ac",       label: "Sin A/C",       icon: "🌡️", desc: "No tiene aire acondicionado",         score: 0 },
];

const BANOS_SCORE    = Object.fromEntries(BANOS_CATS.map(c => [c.val, c.score]));
const COCINA_SCORE_MAP = Object.fromEntries(COCINA_CATS.map(c => [c.val, c.score]));
const AIRE_SCORE_MAP = Object.fromEntries(AIRE_CATS.map(c => [c.val, c.score]));
const CERT_COLORS = { "A": "#1a5c3a", "B": "#2d8a4e", "C": "#e07b00", "D": "#e06000", "E": "#cc4400", "F": "#b83200", "G": "#991b1b" };

const CERT_DESC = {
  "A": "Máxima eficiencia energética. Consumo muy bajo, excelente aislamiento. Ahorro significativo en facturas de luz y calefacción. La mejor calificación posible.",
  "B": "Alta eficiencia. Consumo bajo y buen aislamiento. Facturas reducidas respecto a la media. Muy buena calificación.",
  "C": "Eficiencia media-alta. Consumo moderado. Puede requerir pequeñas mejoras a largo plazo, pero es una calificación aceptable.",
  "D": "Eficiencia media. Es la calificación más común en viviendas de segunda mano. Consumo notable pero no excesivo. Posible margen de mejora.",
  "E": "Eficiencia baja. Consumo elevado. Facturas altas. Recomendable estudiar mejoras de aislamiento o instalaciones.",
  "F": "Eficiencia muy baja. Consumo muy alto. Facturas considerablemente elevadas. Probable necesidad de reforma para mejorar el aislamiento.",
  "G": "La peor calificación. Consumo extremadamente alto. Facturas muy elevadas. Reforma energética prácticamente necesaria.",
};

// ── Scoring ───────────────────────────────────────────────────────────────────
function scoreColor(pts) {
  return pts >= 75 ? "#1a5c3a" : pts >= 48 ? "#8a5c00" : "#991b1b";
}

function calcScore(prop, criteria) {
  let total = 0, max = 0;
  const bd = [];
  // Virtual field: precioM2
  const m2 = prop.sizeUtil || prop.sizeConstruida || 0;
  const propWithVirtual = { ...prop, precioM2: m2 && prop.price ? Math.round(prop.price / m2) : null };
  criteria.forEach(c => {
    if (!c.weight) return;
    const v = propWithVirtual[c.id];
    let s = 0;

    if (c.type === "boolean") {
      s = v ? 1 : 0;
    } else if (c.type === "range") {
      const best = c.min, worst = c.max;
      if (v == null) { s = 0; }
      else if (best < worst) {
        // lower is better (price, comunidad, distancia, ibi)
        s = v <= best ? 1 : v >= worst ? 0 : 1 - (v - best) / (worst - best);
      } else {
        // higher is better (m²)
        s = v >= best ? 1 : v <= worst ? 0 : (v - worst) / (best - worst);
      }
    } else if (c.type === "orientacion") {
      s = v && ORIENTACION_SCORE[v] != null ? ORIENTACION_SCORE[v] : 0;
    } else if (c.type === "planta") {
      if (!v) { s = 0; }
      else { const r = PLANTA_ORDER[v]; s = r != null ? r / 6 : 0; }
    } else if (c.type === "vistas") {
      const vistas = prop.vistas || [];
      s = vistas.length === 0 ? 0 : Math.max(...vistas.map(vi => VISTAS_SCORE[vi] ?? 0));
    } else if (c.type === "soleria") {
      s = v && SOLERIA_SCORE[v] != null ? SOLERIA_SCORE[v] : 0;
    } else if (c.type === "mapped") {
      const map = c.scoreMap === "BANOS_SCORE" ? BANOS_SCORE : c.scoreMap === "COCINA_SCORE_MAP" ? COCINA_SCORE_MAP : AIRE_SCORE_MAP;
      s = v && map[v] != null ? map[v] : 0;
    }

    total += s * c.weight;
    max += c.weight;
    bd.push({ ...c, s, v });
  });
  return { pts: max ? Math.round((total / max) * 100) : 0, bd };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

const fmtPrice = (n) => n ? Number(n).toLocaleString("es-ES") + " €" : "—";

function comunidadColor(n) {
  if (!n || n === 0) return "#991b1b"; // red for missing
  if (n <= 130) return "#1a5c3a";      // green 90-130
  if (n <= 160) return "#e07b00";      // orange 131-160
  return "#991b1b";                    // red 161+
}

async function extractFromText(text, url) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "REEMPLAZA_CON_TU_CLAVE", "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 1000,
        messages: [{ role: "user", content: "Extrae datos del anuncio. SOLO JSON sin markdown:\n{\"title\":\"\",\"address\":\"\",\"zone\":\"\",\"price\":0,\"sizeUtil\":0,\"sizeConstruida\":0,\"rooms\":0,\"bathrooms\":0,\"trastero\":false,\"garaje\":false,\"terraza\":false,\"piscina\":false,\"aireCond\":false,\"distanciaKm\":0,\"comunidad\":0,\"ibi\":0,\"inmobiliaria\":\"\",\"notes\":\"\"}\nTexto: " + (text || "") + "\nURL: " + (url || "") }],
      }),
    });
    const d = await res.json();
    const t = d.content?.map(b => b.text || "").join("") || "";
    return JSON.parse(t.replace(/```json|```/g, "").trim());
  } catch (e) { return { error: e.message }; }
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f4f4f2; --surface: #ffffff; --dim: #f0f0ee;
    --border: #e0e0dc; --borderMid: #c4c4c0;
    --ink: #111110; --inkMid: #444440; --inkDim: #888884; --inkFaint: #bbbbba;
    --green: #1a5c3a; --greenBg: #edf7f2;
    --amber: #8a5c00; --amberBg: #fdf6e3;
    --red: #991b1b; --redBg: #fef2f2;
    --blue: #1d3f7a; --blueBg: #eff4ff;
    --sh: 0 1px 3px rgba(0,0,0,0.08); --shMd: 0 4px 16px rgba(0,0,0,0.1);
  }
  body { background:var(--bg); color:var(--ink); font-family:'Outfit',sans-serif; min-height:100vh; font-size:14px; }
  ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:var(--bg)} ::-webkit-scrollbar-thumb{background:var(--borderMid);border-radius:2px}
  input,textarea,select{font-family:'Outfit',sans-serif;background:var(--dim);border:1px solid var(--border);border-radius:6px;color:var(--ink);padding:8px 11px;font-size:13px;outline:none;transition:border-color 0.15s,box-shadow 0.15s;width:100%}
  input:focus,textarea:focus,select:focus{border-color:var(--ink);box-shadow:0 0 0 2px rgba(0,0,0,0.06)}
  button{cursor:pointer;font-family:'Outfit',sans-serif}
  h1,h2,h3{font-family:'Outfit',sans-serif}
  .label{font-size:11px;color:var(--inkDim);font-weight:500;letter-spacing:0.06em;text-transform:uppercase;display:block;margin-bottom:4px}
  .pulse{animation:pulse 1.8s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  .card-enter{animation:cardIn 0.3s cubic-bezier(0.22,1,0.36,1) both}
  @keyframes cardIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn 0.15s ease both}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  .modal-box{background:var(--surface);border-radius:12px;width:100%;max-width:580px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2);animation:slideUp 0.22s cubic-bezier(0.22,1,0.36,1) both}
  @keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
  .btn{border:none;border-radius:7px;padding:9px 16px;font-size:13px;font-weight:500;transition:all 0.15s;display:inline-flex;align-items:center;gap:6px}
  .btn-dark{background:var(--ink);color:#fff}.btn-dark:hover{background:#2a2a28}
  .btn-ghost{background:transparent;color:var(--inkMid);border:1px solid var(--border)}.btn-ghost:hover{background:var(--dim)}
  .btn-danger{background:var(--redBg);color:var(--red);border:1px solid #fccfcf}
  .btn-sm{padding:6px 11px;font-size:12px}
  .toggle{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:6px;border:1px solid var(--border);cursor:pointer;font-size:12px;font-weight:500;transition:all 0.15s;user-select:none;background:var(--surface);color:var(--inkMid)}
  .toggle.on{background:var(--greenBg);border-color:#a8d5be;color:var(--green)}
  .toggle-dot{width:13px;height:13px;border-radius:50%;border:1.5px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:8px;flex-shrink:0}
  .tag{display:inline-flex;align-items:center;gap:3px;background:var(--dim);border:1px solid var(--border);border-radius:4px;padding:3px 8px;font-size:13px;color:var(--inkMid);font-weight:500;white-space:nowrap}
  .tag-green{background:var(--greenBg);border-color:#a8d5be;color:var(--green)}
  .tag-blue{background:var(--blueBg);border-color:#93b4e8;color:var(--blue)}
  .tag-amber{background:var(--amberBg);border-color:#e8d598;color:var(--amber)}
  .tag-win{background:#111;color:white;border-color:#111}
  .prop-card{background:var(--surface);border-radius:10px;border:1px solid var(--border);cursor:pointer;transition:box-shadow 0.2s,border-color 0.2s;box-shadow:var(--sh);position:relative;overflow:hidden}
  .prop-card:hover{box-shadow:var(--shMd);border-color:var(--borderMid)}
  .rank-num{position:absolute;top:10px;left:10px;width:22px;height:22px;border-radius:50%;background:var(--ink);color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:1;font-family:'Outfit',sans-serif}
  .score-ring{position:relative;flex-shrink:0}
  .score-ring svg{display:block}
  .score-ring .sval{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .header{background:var(--ink);height:50px;display:flex;align-items:center;gap:12px;padding:0 22px;position:sticky;top:0;z-index:20}
  .stat-bar{background:var(--surface);border-bottom:1px solid var(--border);padding:10px 22px;display:flex;gap:0}
  .stat-item{padding:0 18px;border-right:1px solid var(--border)}
  .stat-item:first-child{padding-left:0}
  .stat-item:last-child{border-right:none}
  .sec{font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--inkFaint);margin-bottom:8px;margin-top:16px}
  .sec:first-child{margin-top:0}
  .dgrid{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--border);border-radius:8px;overflow:hidden}
  .dcell{padding:9px 13px;border-bottom:1px solid var(--border);border-right:1px solid var(--border)}
  .dcell:nth-child(even){border-right:none}
  .dcell:nth-last-child(-n+2){border-bottom:none}
  .dcell-l{font-size:10px;color:var(--inkFaint);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px}
  .dcell-v{font-size:13px;font-weight:500}
  .drop-zone{border:1.5px dashed var(--border);border-radius:8px;padding:16px;text-align:center;cursor:pointer;font-size:12px;color:var(--inkDim);transition:all 0.15s}
  .drop-zone:hover,.drop-zone.over{border-color:var(--ink);color:var(--ink);background:var(--dim)}
  .photo-thumb{width:62px;height:62px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:zoom-in}
  .tab-btn{padding:6px 13px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--inkMid);font-size:12px;font-weight:500;transition:all 0.15s}
  .tab-btn.active{background:var(--ink);border-color:var(--ink);color:white}
  .lightbox{position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:200;display:flex;align-items:center;justify-content:center}
  .lightbox img{max-width:95vw;max-height:95vh;object-fit:contain;border-radius:6px}
  .w-btn{width:27px;height:27px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--inkMid);font-size:12px;font-weight:600;transition:all 0.12s}
  .w-btn.active{background:var(--ink);border-color:var(--ink);color:white}
  .live-dot{width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;animation:lp 2s ease-in-out infinite}
  @keyframes lp{0%,100%{opacity:1}50%{opacity:0.3}}
  .print-ico{opacity:0;transition:opacity 0.2s}
  .prop-card:hover .print-ico{opacity:1}
  .carousel{position:relative;width:100%;height:220px;overflow:hidden;border-radius:12px 12px 0 0;background:#111}
  .carousel img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity 0.35s ease}
  .carousel-btn{position:absolute;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:white;border:none;width:34px;height:34px;border-radius:50%;font-size:18px;display:flex;align-items:center;justify-content:center;z-index:2;transition:background 0.15s}
  .carousel-btn:hover{background:rgba(0,0,0,0.8)}
  .carousel-dots{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:2}
  .carousel-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.5);transition:background 0.2s}
  .carousel-dot.active{background:white}
  .compare-col{flex:1;min-width:200px;border:1px solid var(--border);border-radius:10px;overflow:hidden}
  .compare-col.winner{border-color:#111;border-width:2px}
  .compare-row{display:flex;border-bottom:1px solid var(--border)}
  .compare-row:last-child{border-bottom:none}
  .compare-cell{flex:1;padding:8px 10px;font-size:12px;border-right:1px solid var(--border);min-height:36px;display:flex;align-items:center}
  .compare-cell:last-child{border-right:none}
  .compare-cell.best{background:var(--greenBg);color:var(--green);font-weight:600}
  .compare-label{width:130px;flex-shrink:0;font-size:11px;color:var(--inkFaint);text-transform:uppercase;letter-spacing:0.05em;padding:8px 10px;border-right:1px solid var(--border);display:flex;align-items:center;background:var(--dim)}
  @media print{.no-print{display:none!important}}
  .sold-overlay{position:absolute;inset:0;background:rgba(255,255,255,0.15);z-index:3;pointer-events:none;border-radius:10px}
  .sold-x{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:4;pointer-events:none}
  .sold-x::before,.sold-x::after{content:'';position:absolute;width:85%;height:5px;background:rgba(180,0,0,0.65);border-radius:3px}
  .sold-x::before{transform:rotate(30deg)}
  .sold-x::after{transform:rotate(-30deg)}
  .sold-btn{font-size:10px;font-weight:700;letter-spacing:0.08em;padding:3px 8px;border-radius:4px;border:1.5px solid;cursor:pointer;transition:all 0.15s;line-height:1}
  .sold-btn.unsold{background:transparent;color:var(--inkFaint);border-color:var(--border)}
  .sold-btn.unsold:hover{color:var(--red);border-color:var(--red)}
  .sold-btn.issold{background:#fef2f2;color:var(--red);border-color:#fccfcf}
  .descartada-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.55);z-index:3;border-radius:10px;display:flex;align-items:center;justify-content:center;pointer-events:none}
  .descartada-label{color:white;font-size:22px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;border:3px solid white;padding:6px 18px;border-radius:6px;transform:rotate(-8deg);opacity:0.92}
  .desc-btn{font-size:10px;font-weight:700;letter-spacing:0.08em;padding:3px 8px;border-radius:4px;border:1.5px solid;cursor:pointer;transition:all 0.15s;line-height:1}
  .desc-btn.nodesc{background:transparent;color:var(--inkFaint);border-color:var(--border)}
  .desc-btn.nodesc:hover{color:#8a5c00;border-color:#8a5c00}
  .desc-btn.isdesc{background:#fdf6e3;color:#8a5c00;border-color:#e8d598}
`;

// ── ScoreRing ─────────────────────────────────────────────────────────────────
function ScoreRing({ pts, size = 52, rank }) {
  const r = size / 2 - 5, circ = 2 * Math.PI * r;
  const col = scoreColor(pts);
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e0e0dc" strokeWidth={3} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={3}
          strokeDasharray={`${(pts/100)*circ} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.5s ease" }} />
      </svg>
      <div className="sval">
        <span style={{ fontSize: size*0.26, fontWeight: 700, color: col, fontFamily: "Outfit,sans-serif", lineHeight: 1 }}>{pts}</span>
        {rank && <span style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>#{rank}</span>}
      </div>
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────────
function Toggle({ val, onChange, label }) {
  return (
    <div className={`toggle${val ? " on" : ""}`} onClick={() => onChange(!val)}>
      <div className="toggle-dot">{val ? "✓" : ""}</div>
      {label}
    </div>
  );
}

// ── Carousel ──────────────────────────────────────────────────────────────────
function Carousel({ photos, onLightbox, height = 220, radius = "12px 12px 0 0" }) {
  const [idx, setIdx] = useState(0);
  if (!photos || photos.length === 0) return null;
  if (photos.length === 1) return (
    <img src={photos[0]} onClick={() => onLightbox && onLightbox(photos[0])}
      style={{ width: "100%", height, objectFit: "cover", borderRadius: radius, cursor: onLightbox ? "zoom-in" : "default", display: "block" }} alt="" />
  );
  return (
    <div style={{ position: "relative", width: "100%", height, borderRadius: radius, overflow: "hidden", background: "#111", flexShrink: 0 }}>
      {photos.map((src, i) => (
        <img key={i} src={src} alt="" onClick={() => onLightbox && onLightbox(src)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: i === idx ? 1 : 0, transition: "opacity 0.35s ease", cursor: onLightbox ? "zoom-in" : "default" }} />
      ))}
      <button className="carousel-btn" onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + photos.length) % photos.length); }} style={{ left: 8 }}>‹</button>
      <button className="carousel-btn" onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % photos.length); }} style={{ right: 8 }}>›</button>
      <div className="carousel-dots">
        {photos.map((_, i) => <div key={i} className={`carousel-dot${i === idx ? " active" : ""}`} onClick={e => { e.stopPropagation(); setIdx(i); }} />)}
      </div>
      <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", color: "white", fontSize: 11, padding: "2px 7px", borderRadius: 10 }}>
        {idx + 1} / {photos.length}
      </div>
    </div>
  );
}

// ── BreakdownBar ──────────────────────────────────────────────────────────────
function BreakdownBar({ bd }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {bd.filter(b => b.weight > 0).map(b => (
        <div key={b.id}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: "var(--inkMid)" }}>{b.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: scoreColor(Math.round(b.s * 100)) }}>{Math.round(b.s * 100)}%</span>
          </div>
          <div style={{ height: 4, background: "var(--dim)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${b.s * 100}%`, background: scoreColor(Math.round(b.s * 100)), borderRadius: 2, transition: "width 0.5s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── PhotoUploader ─────────────────────────────────────────────────────────────
function PhotoUploader({ photos = [], onChange }) {
  const inputRef = useRef();
  const [over, setOver] = useState(false);
  const addFiles = async (files) => {
    const n = await Promise.all(Array.from(files).map(fileToBase64));
    onChange([...photos, ...n]);
  };
  const remove = (i) => onChange(photos.filter((_, idx) => idx !== i));
  return (
    <div>
      <div className={`drop-zone${over ? " over" : ""}`} onClick={() => inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}>
        📷 Pulsa o arrastra fotos aquí
        <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => addFiles(e.target.files)} />
      </div>
      {photos.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {photos.map((src, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={src} className="photo-thumb" alt="" />
              <button onClick={() => remove(i)} style={{ position: "absolute", top: -5, right: -5, width: 18, height: 18, borderRadius: "50%", background: "#111", color: "white", border: "none", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Lightbox({ src, photos, onClose }) {
  const [idx, setIdx] = useState(photos ? photos.indexOf(src) : 0);
  useEffect(() => {
    const h = e => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && photos) setIdx(i => (i + 1) % photos.length);
      if (e.key === "ArrowLeft" && photos) setIdx(i => (i - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const current = photos ? photos[idx] : src;
  return (
    <div className="lightbox" onClick={onClose} style={{ flexDirection: "column", gap: 12 }}>
      <img src={current} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: "95vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 6 }} />
      {photos && photos.length > 1 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }} onClick={e => e.stopPropagation()}>
          <button onClick={() => setIdx(i => (i - 1 + photos.length) % photos.length)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", width: 36, height: 36, borderRadius: "50%", fontSize: 20, cursor: "pointer" }}>‹</button>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{idx + 1} / {photos.length}</span>
          <button onClick={() => setIdx(i => (i + 1) % photos.length)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", width: 36, height: 36, borderRadius: "50%", fontSize: 20, cursor: "pointer" }}>›</button>
        </div>
      )}
    </div>
  );
}

// ── Print PDF ─────────────────────────────────────────────────────────────────
function printPDF(prop, pts, rank) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none';
  document.body.appendChild(iframe);
  const w = iframe.contentDocument;
  const m2 = prop.sizeUtil || prop.sizeConstruida || 0;
  const ratio = m2 && prop.price ? Math.round(prop.price / m2).toLocaleString("es-ES") + " €/m²" : "—";
  const base = Math.max(prop.price || 0, prop.vrc || 0);
  const usaVrc = prop.vrc > prop.price;
  const itpReal = base ? Math.round(base * 0.07).toLocaleString("es-ES") + " €" : "—";
  const itpVenta = prop.price ? Math.round(prop.price * 0.07).toLocaleString("es-ES") + " €" : "—";
  const tags = [["trastero","Trastero"],["garaje","Garaje"],["terraza","Terraza"],["piscina","Piscina"],["aireCond","A/C"],["ascensor","Ascensor"],["jardin","Jardín"],["amueblado","Amueblado"],["lavadero","Lavadero"]].filter(([k]) => prop[k]).map(([,l]) => l);
  const banosCat = BANOS_CATS.find(c => c.val === prop.estadoBanos);
  const cocinaCat = COCINA_CATS.find(c => c.val === prop.estadoCocina);
  const aireCat = AIRE_CATS.find(c => c.val === prop.tipoAire);
  const pros = [...(prop.cocinaPositivos || []).map(v => COCINA_POSITIVOS.find(x => x.val === v)?.label).filter(Boolean)];
  const contras = [...(prop.cocinaNegativos || []).map(v => COCINA_NEGATIVOS.find(x => x.val === v)?.label).filter(Boolean)];
  if (usaVrc) contras.unshift("VRC superior al precio → ITP mayor");
  if (prop.orientacion === "Norte") contras.push("Orientación Norte");
  if (prop.distanciaKm > 20) contras.push(prop.distanciaKm + " km al trabajo");
  if (prop.comunidad > 160) contras.push("Comunidad alta: " + prop.comunidad + " €/mes");
  if (!prop.trastero) contras.push("Sin trastero");
  if (prop.otrosPros) pros.push(prop.otrosPros);
  if (prop.otrosContras) contras.push(prop.otrosContras);
  if (!prop.garaje) contras.push("Sin garaje");
  if (prop.orientacion === "Sur" || prop.orientacion === "Suroeste") pros.unshift("Orientación " + prop.orientacion);
  if (prop.trastero) pros.push("Tiene trastero");
  if (prop.garaje) pros.push("Tiene garaje");
  if ((prop.vistas || []).includes("Mar")) pros.unshift("Vistas al mar");

  // certEnergetico puede ser "Sí" (y la letra en consumoEnergetico) o directamente una letra A-G
  const certLetras = ["A","B","C","D","E","F","G"];
  const certKey = certLetras.includes(prop.certEnergetico) ? prop.certEnergetico
    : certLetras.includes(prop.consumoEnergetico) ? prop.consumoEnergetico
    : certLetras.includes(prop.emisionesEnergetico) ? prop.emisionesEnergetico
    : null;
  const certDesc = certKey ? CERT_DESC[certKey] || null : null;
  const mainPhoto = (prop.photos || [])[0] || "";
  const restPhotos = (prop.photos || []).slice(1);

  // Calculator block
  const calcBlock = (() => {
    if (!prop.price) return "";
    const precio = prop.price || 0;
    const vrc = prop.vrc || 0;
    const base = Math.max(precio, vrc);
    const itp = Math.round(base * 0.07);
    const notaria = 800, registro = 500, gestoria = 400, tasacion = 400, suministros = 200;
    const totalExtra = itp + notaria + registro + gestoria + tasacion + suministros;
    const costeTotal = precio + totalExtra;
    const ahorros = 200000;
    const capital = Math.min(Math.max(0, costeTotal - ahorros), precio * 0.8);
    const fmtC = x => x.toLocaleString("es-ES") + " €";
    const i = 0.032 / 12;
    const cuota20 = capital > 0 ? Math.round(capital * (i * Math.pow(1+i,240)) / (Math.pow(1+i,240)-1)) : 0;
    const cuota15 = capital > 0 ? Math.round(capital * (i * Math.pow(1+i,180)) / (Math.pow(1+i,180)-1)) : 0;
    const segurosMes = Math.round(900 / 12);
    const ibiMes = Math.round((prop.ibi || 0) / 12);
    const comunidadMes = prop.comunidad || 0;
    const esfuerzo20 = cuota20 + segurosMes + ibiMes + comunidadMes;
    const esfuerzo15 = cuota15 + segurosMes + ibiMes + comunidadMes;
    const itpRow = vrc > precio
      ? "<tr style=\"border-bottom:1px solid #eee;background:#fef2f2\"><td style=\"padding:5px 8px;color:#991b1b\">ITP real (s/ VRC " + fmtC(vrc) + ")</td><td style=\"padding:5px 8px;text-align:right;font-weight:600;color:#991b1b\">" + fmtC(itp) + "</td></tr>"
      : "<tr style=\"border-bottom:1px solid #eee\"><td style=\"padding:5px 8px;color:#888\">ITP (7% s/ precio)</td><td style=\"padding:5px 8px;text-align:right;font-weight:500\">" + fmtC(itp) + "</td></tr>";
    return "<div style=\"margin-top:0;padding-top:24px\">"
      + "<div style=\"font-size:10px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px\">Estimación de costes de compra · Orientativo (ITP 7%, LTV 80%, 3,2%)</div>"
      + "<table style=\"width:100%;border-collapse:collapse;font-size:12px\">"
      + "<tr style=\"border-bottom:1px solid #eee\"><td style=\"padding:5px 8px;color:#888\">Precio de compraventa</td><td style=\"padding:5px 8px;text-align:right;font-weight:500\">" + fmtC(precio) + "</td></tr>"
      + itpRow
      + "<tr style=\"border-bottom:1px solid #eee\"><td style=\"padding:5px 8px;color:#888\">Notaría</td><td style=\"padding:5px 8px;text-align:right\">" + fmtC(notaria) + "</td></tr>"
      + "<tr style=\"border-bottom:1px solid #eee\"><td style=\"padding:5px 8px;color:#888\">Registro</td><td style=\"padding:5px 8px;text-align:right\">" + fmtC(registro) + "</td></tr>"
      + "<tr style=\"border-bottom:1px solid #eee\"><td style=\"padding:5px 8px;color:#888\">Gestoría</td><td style=\"padding:5px 8px;text-align:right\">" + fmtC(gestoria) + "</td></tr>"
      + "<tr style=\"border-bottom:1px solid #eee\"><td style=\"padding:5px 8px;color:#888\">Tasación</td><td style=\"padding:5px 8px;text-align:right\">" + fmtC(tasacion) + "</td></tr>"
      + "<tr style=\"border-bottom:1px solid #eee\"><td style=\"padding:5px 8px;color:#888\">Suministros</td><td style=\"padding:5px 8px;text-align:right\">" + fmtC(suministros) + "</td></tr>"
      + "<tr style=\"border-bottom:2px solid #111;font-weight:700\"><td style=\"padding:7px 8px\">Coste total operación</td><td style=\"padding:7px 8px;text-align:right\">" + fmtC(costeTotal) + "</td></tr>"
      + "<tr style=\"border-bottom:1px solid #eee\"><td style=\"padding:5px 8px;color:#888\">Ahorros aportados</td><td style=\"padding:5px 8px;text-align:right\">-" + fmtC(ahorros) + "</td></tr>"
      + "<tr style=\"border-bottom:2px solid #111\"><td style=\"padding:5px 8px;color:#888\">Capital hipoteca estimado (80% LTV)</td><td style=\"padding:5px 8px;text-align:right;font-weight:600\">" + fmtC(capital) + "</td></tr>"
      + "<tr style=\"background:#f0f7ff\"><td colspan=\"2\" style=\"padding:6px 8px;font-size:10px;font-weight:700;color:#1d3f7a;text-transform:uppercase;letter-spacing:0.06em\">Escenario 20 años</td></tr>"
      + "<tr style=\"border-bottom:1px solid #eee;background:#f8f8f6;font-weight:700\"><td style=\"padding:6px 8px\">Cuota hipoteca (20 años · 3,2%)</td><td style=\"padding:6px 8px;text-align:right;font-size:15px\">" + fmtC(cuota20) + "/mes</td></tr>"
      + "<tr style=\"border-bottom:1px solid #eee\"><td style=\"padding:5px 8px 5px 20px;color:#888\">· Seguros hogar + vida (est.)</td><td style=\"padding:5px 8px;text-align:right;color:#555\">" + fmtC(segurosMes) + "/mes</td></tr>"
      + (ibiMes > 0 ? "<tr style=\"border-bottom:1px solid #eee\"><td style=\"padding:5px 8px 5px 20px;color:#888\">· IBI prorrateado</td><td style=\"padding:5px 8px;text-align:right;color:#555\">" + fmtC(ibiMes) + "/mes</td></tr>" : "")
      + (comunidadMes > 0 ? "<tr style=\"border-bottom:1px solid #eee\"><td style=\"padding:5px 8px 5px 20px;color:#888\">· Comunidad</td><td style=\"padding:5px 8px;text-align:right;color:#555\">" + fmtC(comunidadMes) + "/mes</td></tr>" : "")
      + "<tr style=\"background:#e8f0ff;font-weight:700;border-bottom:2px solid #111\"><td style=\"padding:7px 8px\">Esfuerzo mensual real (20 años)</td><td style=\"padding:7px 8px;text-align:right;font-size:14px;color:#1d3f7a\">" + fmtC(esfuerzo20) + "/mes</td></tr>"
      + "<tr style=\"background:#f0f7ff\"><td colspan=\"2\" style=\"padding:6px 8px;font-size:10px;font-weight:700;color:#1d3f7a;text-transform:uppercase;letter-spacing:0.06em\">Escenario 15 años</td></tr>"
      + "<tr style=\"border-bottom:1px solid #eee;background:#f8f8f6;font-weight:700\"><td style=\"padding:6px 8px\">Cuota hipoteca (15 años · 3,2%)</td><td style=\"padding:6px 8px;text-align:right;font-size:15px\">" + fmtC(cuota15) + "/mes</td></tr>"
      + "<tr style=\"border-bottom:1px solid #eee\"><td style=\"padding:5px 8px 5px 20px;color:#888\">· Seguros hogar + vida (est.)</td><td style=\"padding:5px 8px;text-align:right;color:#555\">" + fmtC(segurosMes) + "/mes</td></tr>"
      + (ibiMes > 0 ? "<tr style=\"border-bottom:1px solid #eee\"><td style=\"padding:5px 8px 5px 20px;color:#888\">· IBI prorrateado</td><td style=\"padding:5px 8px;text-align:right;color:#555\">" + fmtC(ibiMes) + "/mes</td></tr>" : "")
      + (comunidadMes > 0 ? "<tr style=\"border-bottom:1px solid #eee\"><td style=\"padding:5px 8px 5px 20px;color:#888\">· Comunidad</td><td style=\"padding:5px 8px;text-align:right;color:#555\">" + fmtC(comunidadMes) + "/mes</td></tr>" : "")
      + "<tr style=\"background:#e8f0ff;font-weight:700\"><td style=\"padding:7px 8px\">Esfuerzo mensual real (15 años)</td><td style=\"padding:7px 8px;text-align:right;font-size:14px;color:#1d3f7a\">" + fmtC(esfuerzo15) + "/mes</td></tr>"
      + (() => {
          const sueldo = 2600;
          const minSueldo20 = Math.round(esfuerzo20 / 0.35);
          const minSueldo15 = Math.round(esfuerzo15 / 0.35);
          const pct20 = Math.round((esfuerzo20 / sueldo) * 100);
          const pct15 = Math.round((esfuerzo15 / sueldo) * 100);
          const color = pct => pct <= 30 ? "#1a5c3a" : pct <= 35 ? "#e07b00" : pct <= 40 ? "#cc4400" : "#991b1b";
          const label = pct => pct <= 30 ? "Cómodo" : pct <= 35 ? "Ajustado" : pct <= 40 ? "Elevado" : "Muy elevado";
          return "<tr style=\"background:#f8f8f0;border-top:2px solid #111\"><td colspan=\"2\" style=\"padding:8px 8px 4px;font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.06em\">Análisis de esfuerzo (sueldo: 2.600 €/mes)</td></tr>"
            + "<tr style=\"background:#f8f8f0\"><td style=\"padding:4px 8px;color:#555;font-size:12px\">Sueldo mínimo necesario (35%) · 20 años</td><td style=\"padding:4px 8px;text-align:right;font-size:12px;font-weight:500\">" + fmtC(minSueldo20) + "/mes</td></tr>"
            + "<tr style=\"background:#f8f8f0\"><td style=\"padding:4px 8px 8px;color:#555;font-size:12px\">Sueldo mínimo necesario (35%) · 15 años</td><td style=\"padding:4px 8px 8px;text-align:right;font-size:12px;font-weight:500\">" + fmtC(minSueldo15) + "/mes</td></tr>"
            + "<tr style=\"background:#f8f8f0;border-top:1px solid #e0e0dc\"><td style=\"padding:6px 8px;font-size:12px;color:#555\">% esfuerzo real s/ tu sueldo · 20 años</td><td style=\"padding:6px 8px;text-align:right\"><span style=\"font-size:18px;font-weight:700;color:" + color(pct20) + "\">" + pct20 + "%</span> <span style=\"font-size:11px;color:" + color(pct20) + "\">" + label(pct20) + "</span></td></tr>"
            + "<tr style=\"background:#f8f8f0\"><td style=\"padding:6px 8px;font-size:12px;color:#555\">% esfuerzo real s/ tu sueldo · 15 años</td><td style=\"padding:6px 8px;text-align:right\"><span style=\"font-size:18px;font-weight:700;color:" + color(pct15) + "\">" + pct15 + "%</span> <span style=\"font-size:11px;color:" + color(pct15) + "\">" + label(pct15) + "</span></td></tr>";
        })()
      + "</table>"
      + (() => {
          const objetivo = 2600 * 0.30;
          const iRate = 0.032/12;
          const fnEsfuerzo = (p) => {
            const itpP = Math.round(Math.max(p,0)*0.07);
            const gastosP = itpP+800+500+400+400+200;
            const costeP = p+gastosP;
            const capP = Math.min(Math.max(0,costeP-200000),p*0.8);
            const cuotaP = capP>0?capP*(iRate*Math.pow(1+iRate,240))/(Math.pow(1+iRate,240)-1):0;
            return cuotaP+75+Math.round((prop.ibi||0)/12)+(prop.comunidad||0);
          };
          let lo=0,hi=precio*2;
          for(let k=0;k<60;k++){const mid=(lo+hi)/2;if(fnEsfuerzo(mid)<objetivo)lo=mid;else hi=mid;}
          const precioObj=Math.round((lo+hi)/2);
          const rebaja=precio-precioObj;
          const pctRebaja=Math.round((rebaja/precio)*100);
          return "<tr style=\"background:#f8f8f0;border-top:2px solid #111\"><td colspan=\"2\" style=\"padding:8px 8px 4px;font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.06em\">Precio objetivo (esfuerzo 30% del sueldo)</td></tr>"
            + "<tr style=\"background:#edf7f2\"><td style=\"padding:6px 8px;font-weight:700;color:#1a5c3a\">Precio para esfuerzo del 30%</td><td style=\"padding:6px 8px;text-align:right;font-size:17px;font-weight:700;color:#1a5c3a\">" + fmtC(precioObj) + "</td></tr>"
            + "<tr style=\"background:#fef2f2\"><td style=\"padding:6px 8px;color:#991b1b;font-weight:600\">Rebaja necesaria</td><td style=\"padding:6px 8px;text-align:right;font-weight:700;color:#991b1b\">-" + fmtC(rebaja) + " (" + pctRebaja + "% de descuento)</td></tr>";
        })()
      + "<div style=\"font-size:10px;color:#aaa;margin-top:8px;line-height:1.4\">Cálculo orientativo. Seguros estimados: 300€/año hogar + 600€/año vida. Sueldo de referencia: 2.600€/mes. Consulta tu banco para condiciones reales.</div>"
      + "</div>";
  })();

  w.open();
  w.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${prop.title || "Propiedad"}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Outfit',sans-serif;padding:14px 18px;color:#111;font-size:11px;line-height:1.4}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px}
    .logo{font-size:9px;color:#888;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:2px}
    h1{font-size:16px;font-weight:700;margin-bottom:2px;line-height:1.2}
    .subtitle{color:#666;font-size:10px;margin-bottom:8px}
    .score-box{text-align:center;border:2px solid #111;border-radius:6px;padding:5px 10px;flex-shrink:0}
    .score-n{font-size:22px;font-weight:700;line-height:1}
    .score-l{font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.08em}
    .score-r{font-size:10px;color:#555}
    .main-photo{width:100%;height:180px;object-fit:cover;border-radius:6px;margin-bottom:10px;display:block;background:#e0e0dc}
    .price-row{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e0e0dc}
    .price{font-size:22px;font-weight:700}
    .price-sub{font-size:10px;color:#666;margin-top:1px}
    .price-warn{font-size:10px;color:#991b1b;font-weight:600;margin-top:1px}
    .price-right{text-align:right}
    .com-val{font-size:15px;font-weight:700;color:#1a5c3a}
    .com-lbl{font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.05em}
    .ibi-val{font-size:10px;color:#555;margin-top:2px}
    .stats{display:flex;border:1px solid #e0e0dc;border-radius:6px;overflow:hidden;margin-bottom:10px}
    .stat{flex:1;padding:5px 6px;border-right:1px solid #e0e0dc;text-align:center}
    .stat:last-child{border-right:none}
    .stat-v{font-size:13px;font-weight:700}
    .stat-l{font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.03em;margin-top:1px}
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
    .sec{font-size:9px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;margin-top:8px}
    .data-grid{border:1px solid #e0e0dc;border-radius:5px;overflow:hidden}
    .dr{display:flex;border-bottom:1px solid #f0f0ee}
    .dr:last-child{border-bottom:none}
    .dl{width:90px;flex-shrink:0;padding:4px 7px;font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:0.03em;background:#f8f8f6;border-right:1px solid #e0e0dc;display:flex;align-items:center}
    .dv{padding:4px 7px;font-size:11px;font-weight:500;display:flex;align-items:center}
    .tags{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px}
    .tag{border:1px solid #e0e0dc;border-radius:3px;padding:1px 5px;font-size:10px;color:#555}
    .tag-g{background:#edf7f2;border-color:#a8d5be;color:#1a5c3a}
    .tag-r{background:#fef2f2;border-color:#fccfcf;color:#991b1b}
    .tag-b{background:#eff4ff;border-color:#93b4e8;color:#1d3f7a}
    .pros-contras{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
    .pros{background:#edf7f2;border:1px solid #a8d5be;border-radius:6px;padding:7px 9px}
    .contras{background:#fef2f2;border:1px solid #fccfcf;border-radius:6px;padding:7px 9px}
    .pros h3{font-size:9px;font-weight:700;color:#1a5c3a;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px}
    .contras h3{font-size:9px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px}
    .pros li,.contras li{font-size:10px;list-style:none;margin-bottom:2px}
    .pros li::before{content:"✓ ";font-weight:700;color:#1a5c3a}
    .contras li::before{content:"✗ ";font-weight:700;color:#991b1b}
    .notes{background:#fdf6e3;border:1px solid #e8d598;border-radius:6px;padding:7px 9px;font-size:10px;color:#555;line-height:1.5;margin-bottom:10px}
    .notes-t{font-size:9px;font-weight:700;color:#8a5c00;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px}
    .gallery{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-bottom:8px}
    .gallery img{width:100%;height:55px;object-fit:cover;border-radius:4px}
    .footer{border-top:1px solid #e0e0dc;padding-top:6px;display:flex;justify-content:space-between}
    .footer-t{font-size:9px;color:#aaa}
    .page-2{page-break-before:always;break-before:page;padding-top:14px} @media print{body{padding:10px 14px} .page-2{page-break-before:always!important;break-before:page!important}}
  </style></head><body>
  <div class="header">
    <div style="flex:1;padding-right:16px">
      <div class="logo">CasaFinder · Ficha de propiedad</div>
      <h1>${prop.title || "Sin título"}</h1>
      <div class="subtitle">${[prop.address, prop.zone].filter(Boolean).join(" · ")}</div>
    </div>
    <div class="score-box">
      <div class="score-n">${pts}</div>
      <div class="score-l">Idoneidad</div>
      <div class="score-r">Ranking #${rank}</div>
    </div>
  </div>

  ${mainPhoto ? `<img src="${mainPhoto}" class="main-photo" alt="">` : '<div class="main-photo" style="display:flex;align-items:center;justify-content:center;color:#aaa">Sin foto</div>'}

  <div class="price-row">
    <div>
      <div class="price">${prop.price ? Number(prop.price).toLocaleString("es-ES") + " €" : "—"}</div>
      <div class="price-sub">${ratio} · ITP s/ precio: ${itpVenta}</div>
      ${usaVrc ? `<div class="price-warn">⚠ VRC: ${Number(prop.vrc).toLocaleString("es-ES")} € → ITP real: ${itpReal} (+${Math.round((prop.vrc - prop.price) * 0.07).toLocaleString("es-ES")} € extra)</div>` : ""}
    </div>
    <div class="price-right">
      <div class="com-val" style="color:${prop.comunidad <= 130 ? "#1a5c3a" : prop.comunidad <= 160 ? "#e07b00" : "#991b1b"}">${prop.comunidad > 0 ? prop.comunidad + " €" : "?"}</div>
      <div class="com-lbl">Comunidad / mes</div>
      ${prop.ibi ? `<div class="ibi-val">IBI: ${Number(prop.ibi).toLocaleString("es-ES")} €/año</div>` : ""}
    </div>
  </div>

  <div class="stats">
    ${prop.sizeUtil > 0 ? `<div class="stat"><div class="stat-v">${prop.sizeUtil}</div><div class="stat-l">m² útiles</div></div>` : ""}
    ${prop.sizeConstruida > 0 ? `<div class="stat"><div class="stat-v">${prop.sizeConstruida}</div><div class="stat-l">m² const.</div></div>` : ""}
    ${prop.rooms > 0 ? `<div class="stat"><div class="stat-v">${prop.rooms}</div><div class="stat-l">Hab.</div></div>` : ""}
    ${prop.bathrooms > 0 ? `<div class="stat"><div class="stat-v">${prop.bathrooms}</div><div class="stat-l">Baños</div></div>` : ""}
    ${prop.planta ? `<div class="stat"><div class="stat-v">${prop.planta}</div><div class="stat-l">Planta</div></div>` : ""}
    ${prop.orientacion ? `<div class="stat"><div class="stat-v">${prop.orientacion}</div><div class="stat-l">Orient.</div></div>` : ""}
    ${prop.distanciaKm > 0 ? `<div class="stat"><div class="stat-v">${prop.distanciaKm} km</div><div class="stat-l">Al trabajo</div></div>` : ""}
  </div>

  <div class="two-col">
    <div>
      <div class="sec">Datos</div>
      <div class="data-grid">
        ${[
          ["Tipo", prop.tipoInmueble],
          ["Año constr.", prop.anoConstruccion > 1900 ? prop.anoConstruccion + " (" + (new Date().getFullYear() - prop.anoConstruccion) + " años)" : null],
          ["Solería", prop.soleria ? "🪨 " + prop.soleria : null],
          ["Aire acond.", aireCat ? aireCat.icon + " " + aireCat.label : null],
          ["Cert. energ.", prop.certEnergetico && !["En trámite","No indicado"].includes(prop.certEnergetico) ? prop.certEnergetico + (prop.consumoEnergetico ? " · " + prop.consumoEnergetico + " kWh/m²" : "") : prop.certEnergetico],
          ["Implicaciones cert.", certDesc],
          ["Emisiones", prop.emisionesEnergetico ? prop.emisionesEnergetico + " kg CO₂/m²" : null],
          ["Est. baños", banosCat ? banosCat.icon + " " + banosCat.label : null],
          ["Est. cocina", cocinaCat ? cocinaCat.icon + " " + cocinaCat.label : null],
          ["Inmobiliaria", prop.inmobiliaria],
          ["VRC", prop.vrc > 0 ? Number(prop.vrc).toLocaleString("es-ES") + " €" + (usaVrc ? " ⚠" : "") : null],
          ["ITP real", prop.price > 0 ? itpReal : null],
        ].filter(([,v]) => v).map(([l,v]) => `<div class="dr"><div class="dl">${l}</div><div class="dv">${v}</div></div>`).join("")}
        ${prop.visitada ? `
          <div class="dr"><div class="dl">Visita</div><div class="dv" style="color:#1a5c3a;font-weight:600">✓ Visitada</div></div>
          ${prop.fechaVisita ? `<div class="dr"><div class="dl">Fecha</div><div class="dv">${new Date(prop.fechaVisita).toLocaleDateString("es-ES")}</div></div>` : ""}
          ${prop.personaVisita ? `<div class="dr"><div class="dl">Agente</div><div class="dv">${prop.personaVisita}</div></div>` : ""}
        ` : ""}
      </div>
      ${certDesc ? `<div style="margin-top:8px;background:#f0f0ee;border-left:3px solid #888;padding:8px 12px;font-size:11px;color:#555;line-height:1.5"><strong>Calificación ${certKey}:</strong> ${certDesc}</div>` : ""}
    </div>
    <div>
      <div class="sec">Características</div>
      <div class="tags">${tags.map(t => `<span class="tag tag-g">${t}</span>`).join("")}</div>
      ${(prop.vistas || []).length > 0 ? `<div class="sec">Vistas</div><div class="tags">${(prop.vistas||[]).map(v=>`<span class="tag tag-b">👁 ${v}</span>`).join("")}</div>` : ""}
      ${pros.length > 0 ? `<div class="sec" style="margin-top:10px;color:#1a5c3a">Aspectos positivos cocina</div><div class="tags">${pros.slice(0,4).map(p=>`<span class="tag tag-g">✅ ${p}</span>`).join("")}</div>` : ""}
      ${contras.length > 0 && prop.cocinaNegativos?.length > 0 ? `<div class="sec" style="color:#991b1b">Aspectos negativos cocina</div><div class="tags">${(prop.cocinaNegativos||[]).map(v=>{const p=COCINA_NEGATIVOS.find(x=>x.val===v);return p?`<span class="tag tag-r">🔴 ${p.label}</span>`:""}).join("")}</div>` : ""}
    </div>
  </div>

  <div class="sec">Pros y contras</div>
  <div class="pros-contras">
    <div class="pros"><h3>✓ Pros</h3><ul>${pros.map(p=>`<li>${p}</li>`).join("") || "<li>Sin pros registrados</li>"}</ul></div>
    <div class="contras"><h3>✗ Contras</h3><ul>${contras.map(c=>`<li>${c}</li>`).join("") || "<li>Sin contras registrados</li>"}</ul></div>
  </div>

  ${prop.notes ? `<div class="notes"><div class="notes-t">📝 Notas</div>${prop.notes}</div>` : ""}

  ${restPhotos.length > 0 ? `
    <div class="sec">Galería de fotos (${restPhotos.length + 1})</div>
    <div class="gallery">${restPhotos.map(src => `<img src="${src}" alt="">`).join("")}</div>
  ` : ""}

  <div class="footer">
    <div class="footer-t">${prop.url ? prop.url : ""}</div>
    <div class="footer-t">Generado el ${new Date().toLocaleDateString("es-ES")} · CasaFinder</div>
  </div>
  <div style="page-break-before:always;break-before:page;padding-top:14px">${calcBlock || ""}</div>

  </body></html>`);
  w.close();
  iframe.onload = function() {
    setTimeout(function() {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(function() { document.body.removeChild(iframe); }, 1000);
    }, 800);
  };
}


// ── PropertyModal ─────────────────────────────────────────────────────────────
function PropertyModal({ prop, onSave, onClose }) {
  const blank = {
    title: "", url: "", address: "", zone: "", price: 0, sizeUtil: 0, sizeConstruida: 0,
    rooms: 0, bathrooms: 0, anoConstruccion: 0,
    trastero: false, terraza: false, numTerrazas: 0, garaje: false,
    piscina: false, aireCond: false, ascensor: false, jardin: false, amueblado: false, lavadero: false,
    soleria: "", certEnergetico: "", consumoEnergetico: 0, emisionesEnergetico: 0,
    estadoBanos: "", estadoCocina: "", cocinaPositivos: [], cocinaNegativos: [], tipoAire: "",
    visitada: false, fechaVisita: "", personaVisita: "", otrosPros: "", otrosContras: "", descartada: false,
    vistas: [], tipoInmueble: "", planta: "", orientacion: "",
    distanciaKm: 0, comunidad: 0, ibi: 0, vrc: 0, inmobiliaria: "", notes: "",
    enviadaLaure: false, photos: [],
  };
  const cleanVal = (v) => v === undefined ? null : v;
  const cleanProp = prop ? Object.fromEntries(Object.entries({ ...blank, ...prop, photos: prop.photos || [] }).map(([k,v]) => [k, v === undefined ? blank[k] : v])) : blank;
  const [form, setForm] = useState(prop ? cleanProp : blank);
  const [urlInput, setUrlInput] = useState(prop?.url || "");
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(prop ? "form" : "paste");

  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const n = (k, v) => setForm(f => ({ ...f, [k]: v === "" ? 0 : Number(v) }));

  const doExtract = async () => {
    setLoading(true);
    const d = await extractFromText(pastedText, urlInput);
    setForm(f => ({ ...f, ...d, url: urlInput || f.url, photos: f.photos }));
    setLoading(false); setTab("form");
  };

  const numField = (lbl, key, unit = "") => (
    <div>
      <label className="label">{lbl}{unit && <span style={{ color: "var(--inkFaint)", fontWeight: 400 }}> ({unit})</span>}</label>
      <input type="number" min="0"
        value={form[key] === 0 ? "" : (form[key] ?? "")}
        placeholder="0"
        onChange={e => n(key, e.target.value)}
        onBlur={e => { if (e.target.value === "") n(key, 0); }}
        onFocus={e => { if (Number(e.target.value) === 0) e.target.select(); }} />
    </div>
  );
  const txtField = (lbl, key, ph = "") => (
    <div><label className="label">{lbl}</label>
      <input type="text" value={form[key] || ""} onChange={e => s(key, e.target.value)} placeholder={ph} /></div>
  );
  const row2 = (ch) => <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{ch}</div>;
  const toggleVista = (v) => {
    const vistas = form.vistas || [];
    s("vistas", vistas.includes(v) ? vistas.filter(x => x !== v) : [...vistas, v]);
  };
  const antiguedad = form.anoConstruccion > 1900 ? CURRENT_YEAR - form.anoConstruccion : null;

  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 17 }}>{prop ? "Editar propiedad" : "Nueva propiedad"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--inkDim)", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "16px 22px 22px" }}>
          {!prop && (
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <button className={`tab-btn${tab === "paste" ? " active" : ""}`} onClick={() => setTab("paste")}>📋 Pegar texto</button>
              <button className={`tab-btn${tab === "form" ? " active" : ""}`} onClick={() => setTab("form")}>✏ Manual</button>
            </div>
          )}
          {tab === "paste" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div><label className="label">URL (opcional)</label>
                <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://idealista.com/..." /></div>
              <div><label className="label">Texto del anuncio</label>
                <textarea value={pastedText} onChange={e => setPastedText(e.target.value)}
                  placeholder="Abre el anuncio → Ctrl+A → Ctrl+C → pega aquí"
                  style={{ minHeight: 160, resize: "vertical", fontSize: 12, lineHeight: 1.5 }} /></div>
              <button className="btn btn-dark" onClick={doExtract} disabled={loading || (!pastedText.trim() && !urlInput.trim())} style={{ opacity: loading ? 0.6 : 1 }}>
                {loading ? "Extrayendo…" : "✨ Extraer con IA"}
              </button>
            </div>
          )}
          {tab === "form" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {form.error && <div style={{ background: "var(--redBg)", border: "1px solid #fccfcf", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "var(--red)", marginBottom: 12 }}>⚠ {form.error}</div>}

              {txtField("Título", "title", "Ático en San Pedro de Alcántara…")}

              <div className="sec">Localización</div>
              <div>
                <label className="label">Municipio / zona</label>
                <select value={form.zone || ""} onChange={e => {
                  const z = e.target.value; s("zone", z);
                  if (ZONE_DISTANCES[z] != null) s("distanciaKm", ZONE_DISTANCES[z]);
                }}>
                  <option value="">—</option>
                  {ZONES.map(z => <option key={z}>{z}</option>)}
                </select>
                {form.zone && ZONE_DISTANCES[form.zone] && (
                  <div style={{ fontSize: 11, color: "var(--inkDim)", marginTop: 3 }}>≈ {ZONE_DISTANCES[form.zone]} km al trabajo (estimado)</div>
                )}
              </div>
              <div style={{ marginTop: 8 }}>{txtField("Dirección", "address", "C/ …")}</div>

              <div className="sec">Identificación</div>
              {row2(<>
                <div><label className="label">Tipo</label>
                  <select value={form.tipoInmueble || ""} onChange={e => s("tipoInmueble", e.target.value)}>
                    <option value="">—</option>
                    {["Piso","Adosado","Dúplex","Ático","Ático-dúplex"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="label">Planta</label>
                  <select value={form.planta || ""} onChange={e => s("planta", e.target.value)}>
                    <option value="">—</option>
                    {["Bajo","1ª","2ª","3ª","4ª","5ª","Ático"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </>)}

              <div className="sec">Distribución</div>
              {row2(<>
                {numField("Habitaciones", "rooms")}
                {numField("Baños", "bathrooms")}
              </>)}


              <div className="sec">Superficie</div>
              {row2(<>
                <div>
                  <label className="label">M² útiles</label>
                  <input type="number" min="0"
                    value={form.sizeUtil === 0 ? "" : (form.sizeUtil ?? "")}
                    placeholder="0"
                    onChange={e => { const v = Number(e.target.value) || 0; setForm(f => ({ ...f, sizeUtil: v, sizeConstruida: v > 0 ? Math.round(v * 1.2) : f.sizeConstruida })); }}
                    onFocus={e => { if (Number(e.target.value) === 0) e.target.select(); }}/>
                </div>
                <div>
                  <label className="label">M² construidos</label>
                  <input type="number" min="0"
                    value={form.sizeConstruida === 0 ? "" : (form.sizeConstruida ?? "")}
                    placeholder="0"
                    onChange={e => { const v = Number(e.target.value) || 0; setForm(f => ({ ...f, sizeConstruida: v, sizeUtil: v > 0 ? Math.round(v * 0.8) : f.sizeUtil })); }}
                    onFocus={e => { if (Number(e.target.value) === 0) e.target.select(); }}/>
                </div>
              </>)}

              <div className="sec">Económico</div>
              {row2(<>
                {numField("Precio", "price", "€")}
                {numField("Comunidad", "comunidad", "€/mes")}
                {numField("IBI", "ibi", "€/año")}
                {numField("Dist. trabajo", "distanciaKm", "km")}
              </>)}

              <div className="sec">Valor de Referencia Catastral (VRC)</div>
              {row2(<>
                {numField("VRC", "vrc", "€")}
                <div>
                  <label className="label">Base imponible ITP</label>
                  <input type="text" readOnly
                    value={(() => { const b=Math.max(form.price||0,form.vrc||0); return b>0?Number(b).toLocaleString("es-ES")+" €":"—"; })()}
                    style={{ background:"var(--dim)", color:form.vrc>form.price?"var(--red)":"var(--inkDim)", fontWeight:form.vrc>form.price?600:400 }}/>
                </div>
              </>)}
              {(form.price>0) && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, background:"var(--dim)", borderRadius:8, padding:"12px 14px", border:"1px solid var(--border)", marginTop:8 }}>
                  <div>
                    <div style={{ fontSize:10, color:"var(--inkFaint)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:3 }}>ITP s/ precio venta (7%)</div>
                    <div style={{ fontSize:16, fontWeight:600 }}>{Number(Math.round((form.price||0)*0.07)).toLocaleString("es-ES")} €</div>
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:form.vrc>form.price?"var(--red)":"var(--inkFaint)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:3 }}>
                      ITP real a pagar (7%){form.vrc>form.price?" ⚠":""}
                    </div>
                    <div style={{ fontSize:16, fontWeight:600, color:form.vrc>form.price?"var(--red)":"var(--ink)" }}>
                      {Number(Math.round(Math.max(form.price||0,form.vrc||0)*0.07)).toLocaleString("es-ES")} €
                    </div>
                    {form.vrc>form.price && <div style={{ fontSize:11, color:"var(--red)", marginTop:2 }}>+{Number(Math.round((form.vrc-form.price)*0.07)).toLocaleString("es-ES")} € extra por VRC</div>}
                  </div>
                </div>
              )}

              <div className="sec">Orientación</div>
              <select value={form.orientacion || ""} onChange={e => s("orientacion", e.target.value)}>
                <option value="">—</option>
                {["Norte","Noreste","Este","Sureste","Sur","Suroeste","Oeste","Noroeste","Norte-Sur","Este-Oeste"].map(t => <option key={t}>{t}</option>)}
              </select>

              <div className="sec">Características</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[["trastero","📦 Trastero"],["garaje","🚗 Garaje"],["piscina","🏊 Piscina"],["aireCond","❄️ A/C"],["ascensor","🛗 Ascensor"],["jardin","🌳 Jardín"],["amueblado","🛋 Amueblado"],["lavadero","🧺 Lavadero"]].map(([k,lbl]) => (
                  <Toggle key={k} val={form[k]} onChange={v => s(k, v)} label={lbl} />
                ))}
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Toggle val={form.terraza} onChange={v => s("terraza", v)} label="🌿 Terraza" />
                {form.terraza && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--inkDim)" }}>Número:</span>
                    <input type="number" min="1" value={form.numTerrazas || 1} onChange={e => n("numTerrazas", e.target.value)} style={{ width: 60 }} />
                  </div>
                )}
              </div>

              <div className="sec">Estado de los baños</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {BANOS_CATS.map(c => (
                  <div key={c.val} className={`toggle${form.estadoBanos === c.val ? " on" : ""}`}
                    onClick={() => s("estadoBanos", form.estadoBanos === c.val ? "" : c.val)} title={c.desc}>
                    <div className="toggle-dot">{form.estadoBanos === c.val ? "✓" : ""}</div>
                    {c.icon} {c.label}
                  </div>
                ))}
              </div>
              {form.estadoBanos && <div style={{ fontSize: 11, color: "var(--inkDim)", marginTop: 4, marginBottom: 4, fontStyle: "italic" }}>{BANOS_CATS.find(c => c.val === form.estadoBanos)?.desc}</div>}

              <div className="sec">Estado de la cocina</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {COCINA_CATS.map(c => (
                  <div key={c.val} className={`toggle${form.estadoCocina === c.val ? " on" : ""}`}
                    onClick={() => s("estadoCocina", form.estadoCocina === c.val ? "" : c.val)} title={c.desc}>
                    <div className="toggle-dot">{form.estadoCocina === c.val ? "✓" : ""}</div>
                    {c.icon} {c.label}
                  </div>
                ))}
              </div>
              {form.estadoCocina && <div style={{ fontSize: 11, color: "var(--inkDim)", marginBottom: 8, fontStyle: "italic" }}>{COCINA_CATS.find(c => c.val === form.estadoCocina)?.desc}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="label" style={{ color: "var(--green)" }}>✅ Positivos</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {COCINA_POSITIVOS.map(p => {
                      const sel = (form.cocinaPositivos || []).includes(p.val);
                      return (
                        <div key={p.val} className={`toggle${sel ? " on" : ""}`}
                          onClick={() => { const a = form.cocinaPositivos||[]; s("cocinaPositivos", sel ? a.filter(x=>x!==p.val) : [...a,p.val]); }}
                          style={{ fontSize: 11 }}>
                          <div className="toggle-dot">{sel ? "✓" : ""}</div>{p.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="label" style={{ color: "var(--red)" }}>🔴 Negativos</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {COCINA_NEGATIVOS.map(p => {
                      const sel = (form.cocinaNegativos || []).includes(p.val);
                      return (
                        <div key={p.val} className={`toggle${sel ? " on" : ""}`}
                          onClick={() => { const a = form.cocinaNegativos||[]; s("cocinaNegativos", sel ? a.filter(x=>x!==p.val) : [...a,p.val]); }}
                          style={{ fontSize: 11, ...(sel ? { background:"#fef2f2", borderColor:"#fccfcf", color:"var(--red)" } : {}) }}>
                          <div className="toggle-dot" style={sel ? { borderColor:"var(--red)" } : {}}>{sel ? "✓" : ""}</div>{p.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="sec">Tipo de aire acondicionado</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {AIRE_CATS.map(c => (
                  <div key={c.val} className={`toggle${form.tipoAire === c.val ? " on" : ""}`}
                    onClick={() => s("tipoAire", form.tipoAire === c.val ? "" : c.val)} title={c.desc}>
                    <div className="toggle-dot">{form.tipoAire === c.val ? "✓" : ""}</div>
                    {c.icon} {c.label}
                  </div>
                ))}
              </div>
              {form.tipoAire && <div style={{ fontSize: 11, color: "var(--inkDim)", marginTop: 4, fontStyle: "italic" }}>{AIRE_CATS.find(c => c.val === form.tipoAire)?.desc}</div>}

              <div className="sec">Año de construcción</div>
              {row2(<>
                {numField("Año de construcción", "anoConstruccion")}
                <div>
                  <label className="label">Antigüedad</label>
                  <input type="text" readOnly value={antiguedad != null ? antiguedad + " años" : "—"} style={{ background: "var(--dim)", color: "var(--inkDim)" }} />
                </div>
              </>)}

              <div className="sec">Otros pros y contras</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="label" style={{ color: "var(--green)" }}>✅ Otros pros</label>
                  <textarea value={form.otrosPros || ""} onChange={e => s("otrosPros", e.target.value)}
                    placeholder="Características positivas que no aparecen en el listado…"
                    style={{ minHeight: 60, resize: "vertical", fontSize: 12 }} />
                </div>
                <div>
                  <label className="label" style={{ color: "var(--red)" }}>🔴 Otros contras</label>
                  <textarea value={form.otrosContras || ""} onChange={e => s("otrosContras", e.target.value)}
                    placeholder="Características negativas que no aparecen en el listado…"
                    style={{ minHeight: 60, resize: "vertical", fontSize: 12 }} />
                </div>
              </div>

              <div className="sec">Vistas</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["Campo de golf","Mar","Montaña","Interior urbanización","Jardín","Piscina","Calle","Sin vistas"].map(v => (
                  <Toggle key={v} val={(form.vistas || []).includes(v)} onChange={() => toggleVista(v)} label={v} />
                ))}
              </div>

              <div className="sec">Solería</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["Mármol","Tarima flotante","Gres"].map(v => (
                  <div key={v} className={`toggle${form.soleria === v ? " on" : ""}`} onClick={() => s("soleria", form.soleria === v ? "" : v)}>
                    <div className="toggle-dot">{form.soleria === v ? "✓" : ""}</div>{v}
                  </div>
                ))}
              </div>

              <div className="sec">Certificado energético</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, padding: (!form.certEnergetico || ["No indicado","En trámite"].includes(form.certEnergetico)) ? "10px" : "0", border: (!form.certEnergetico || ["No indicado","En trámite"].includes(form.certEnergetico)) ? "2.5px solid var(--red)" : "none", borderRadius: (!form.certEnergetico || ["No indicado","En trámite"].includes(form.certEnergetico)) ? "8px" : "0", background: (!form.certEnergetico || ["No indicado","En trámite"].includes(form.certEnergetico)) ? "#fef2f2" : "transparent" }}>
                {(!form.certEnergetico || ["No indicado","En trámite"].includes(form.certEnergetico)) && <span style={{ fontSize: 12, color: "var(--red)", fontWeight: 500, marginBottom: 8, display: "block", width: "100%" }}>⚠ Sin certificado energético indicado</span>}
                {["Sí","En trámite","No indicado"].map(v => (
                  <Toggle key={v} val={form.certEnergetico === v} onChange={() => s("certEnergetico", form.certEnergetico === v ? "" : v)} label={v} />
                ))}
              </div>
              {form.certEnergetico && !["En trámite","No indicado",""].includes(form.certEnergetico) && CERT_DESC[form.certEnergetico] && (
                <div style={{ fontSize: 11, color: CERT_COLORS[form.certEnergetico], background: CERT_COLORS[form.certEnergetico] + "11", border: `1px solid ${CERT_COLORS[form.certEnergetico]}33`, borderRadius: 6, padding: "8px 11px", marginTop: 4, lineHeight: 1.5 }}>
                  <strong>Calificación {form.certEnergetico}:</strong> {CERT_DESC[form.certEnergetico]}
                </div>
              )}
              {form.certEnergetico === "Sí" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 14px", background: "var(--dim)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  {[["consumoEnergetico","Consumo energético","kWh/m²"],["emisionesEnergetico","Emisiones CO₂","kg CO₂/m²"]].map(([key, lbl, unit]) => (
                    <div key={key}>
                      <label className="label">{lbl} <span style={{ color: "var(--inkFaint)", fontWeight: 400 }}>({unit})</span></label>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
                        {["A","B","C","D","E","F","G"].map(letra => {
                          const col = CERT_COLORS[letra];
                          const sel = form[key] === letra;
                          return (
                            <div key={letra} onClick={() => s(key, sel ? "" : letra)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 6, border: `1.5px solid ${sel ? col : "var(--border)"}`, cursor: "pointer", background: sel ? col + "22" : "var(--surface)", color: sel ? col : "var(--inkMid)", fontWeight: sel ? 700 : 400, fontSize: 13, transition: "all 0.15s", userSelect: "none" }}>
                              <div style={{ width: 12, height: 12, borderRadius: "50%", border: `1.5px solid ${sel ? col : "var(--borderMid)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: col }}>
                                {sel ? "✓" : ""}
                              </div>
                              <strong style={{ color: col }}>{letra}</strong>
                            </div>
                          );
                        })}
                      </div>
                      <input type="number" min="0" value={typeof form[key] === "number" ? form[key] : 0}
                        onChange={e => n(key, e.target.value)}
                        onFocus={e => { if (Number(e.target.value) === 0) e.target.select(); }}
                        placeholder="Valor numérico"/>
                    </div>
                  ))}
                </div>
              )}

              <div className="sec">Comercialización</div>
              {txtField("Inmobiliaria", "inmobiliaria", "Nombre de la agencia…")}
              <div style={{ marginTop: 8 }}>{txtField("URL del anuncio", "url", "https://idealista.com/…")}</div>

              <div className="sec">Estado</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Toggle val={form.visitada} onChange={v => s("visitada", v)} label="🏠 Visitada" />
              </div>
              {form.visitada && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                  <div>
                    <label className="label">Fecha de visita</label>
                    <input type="date" value={form.fechaVisita || ""} onChange={e => s("fechaVisita", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Persona que la enseñó</label>
                    <input type="text" value={form.personaVisita || ""} onChange={e => s("personaVisita", e.target.value)} placeholder="Nombre del agente…" />
                  </div>
                </div>
              )}

              <div className="sec">Notas</div>
              <textarea value={form.notes} onChange={e => s("notes", e.target.value)} placeholder="Observaciones, pros, contras…" style={{ minHeight: 70, resize: "vertical" }} />

              <div className="sec">Fotos</div>
              <PhotoUploader photos={form.photos} onChange={v => s("photos", v)} />

              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button className="btn btn-dark" onClick={() => onSave(form)} style={{ flex: 1 }}>Guardar propiedad</button>
                <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CriteriaModal ─────────────────────────────────────────────────────────────
function CriteriaModal({ criteria, onChange, onClose }) {
  const [loc, setLoc] = useState(criteria.map(c => ({ ...c })));
  const set = (i, k, v) => setLoc(p => p.map((c, j) => j === i ? { ...c, [k]: v } : c));
  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 17 }}>Criterios de idoneidad</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--inkDim)", fontSize: 20 }}>×</button>
        </div>
        <div style={{ padding: "16px 22px 22px" }}>
          <p style={{ fontSize: 12, color: "var(--inkDim)", marginBottom: 14, lineHeight: 1.5 }}>Peso 0 = ignorar · 10 = decisivo. Ajusta según tu prioridad real.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {loc.map((c, i) => (
              <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "11px 13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: c.type !== "boolean" && c.type !== "orientacion" && c.type !== "planta" && c.type !== "vistas" && c.weight > 0 ? 8 : 0 }}>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{c.label}</span>
                  <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {[0,1,2,3,4,5,6,7,8,9,10].map(w => (
                      <button key={w} className={`w-btn${c.weight === w ? " active" : ""}`} onClick={() => set(i, "weight", w)}>{w}</button>
                    ))}
                  </div>
                </div>
                {c.type === "range" && c.weight > 0 && (
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: "var(--inkDim)" }}>Mejor:</span>
                      <input type="number" value={c.min} onChange={e => set(i, "min", Number(e.target.value))} style={{ width: 90 }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: "var(--inkDim)" }}>Peor:</span>
                      <input type="number" value={c.max} onChange={e => set(i, "max", Number(e.target.value))} style={{ width: 90 }} />
                    </div>
                    <span style={{ fontSize: 11, color: "var(--inkFaint)" }}>{c.unit}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button className="btn btn-dark" onClick={() => { onChange(loc); onClose(); }} style={{ width: "100%", marginTop: 14 }}>Aplicar</button>
        </div>
      </div>
    </div>
  );
}

// ── CompareModal ──────────────────────────────────────────────────────────────
function CompareModal({ props, criteria, rankMap, onClose }) {
  const [selected, setSelected] = useState([]);
  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : s.length < 3 ? [...s, id] : s);
  const comparing = props.filter(p => selected.includes(p.id));
  const scores = comparing.map(p => calcScore(p, criteria));

  // Per-criterion score for each prop
  const criterionScore = (prop, criterionId) => {
    const c = criteria.find(c => c.id === criterionId);
    if (!c || !c.weight) return 0;
    const v = prop[criterionId];
    let s = 0;
    if (c.type === "boolean") s = v ? 1 : 0;
    else if (c.type === "range") {
      if (v == null) s = 0;
      else if (c.min < c.max) s = v <= c.min ? 1 : v >= c.max ? 0 : 1 - (v - c.min) / (c.max - c.min);
      else s = v >= c.min ? 1 : v <= c.max ? 0 : (v - c.max) / (c.min - c.max);
    } else if (c.type === "orientacion") s = v && ORIENTACION_SCORE[v] != null ? ORIENTACION_SCORE[v] : 0;
    else if (c.type === "planta") { const r = PLANTA_ORDER[v]; s = r != null ? r / 6 : 0; }
    else if (c.type === "vistas") { const vs = prop.vistas || []; s = vs.length === 0 ? 0 : Math.max(...vs.map(vi => VISTAS_SCORE[vi] ?? 0)); }
    else if (c.type === "soleria") s = v && SOLERIA_SCORE[v] != null ? SOLERIA_SCORE[v] : 0;
    return Math.round(s * c.weight * 10) / 10; // weighted score
  };

  const rows = [
    { label: "Puntuación total", get: (p, i) => scores[i].pts + " / 100", compare: "higher" },
    { label: "Precio", get: p => p.price ? Number(p.price).toLocaleString("es-ES") + " €" : "—", compare: "lower", num: p => p.price, criterionId: "price" },
    { label: "M² útiles", get: p => p.sizeUtil ? p.sizeUtil + " m²" : "—", compare: "higher", num: p => p.sizeUtil, criterionId: "sizeUtil" },
    { label: "M² construidos", get: p => p.sizeConstruida ? p.sizeConstruida + " m²" : "—", compare: "higher", num: p => p.sizeConstruida },
    { label: "€/m²", get: p => (p.sizeUtil || p.sizeConstruida) && p.price ? Math.round(p.price / (p.sizeUtil || p.sizeConstruida)).toLocaleString("es-ES") + " €" : "—", compare: "lower", num: p => (p.sizeUtil || p.sizeConstruida) && p.price ? Math.round(p.price / (p.sizeUtil || p.sizeConstruida)) : null, criterionId: "precioM2" },
    { label: "Habitaciones", get: p => p.rooms || "—", compare: "higher", num: p => p.rooms },
    { label: "Baños", get: p => p.bathrooms || "—", compare: "higher", num: p => p.bathrooms },
    { label: "Planta", get: p => p.planta || "—", compare: "custom", num: p => PLANTA_ORDER[p.planta] ?? -1, criterionId: "planta" },
    { label: "Orientación", get: p => p.orientacion || "—", compare: "custom", num: p => ORIENTACION_SCORE[p.orientacion] ?? -1, criterionId: "orientacion" },
    { label: "Comunidad", get: p => p.comunidad ? Number(p.comunidad).toLocaleString("es-ES") + " €/mes" : "—", compare: "lower", num: p => p.comunidad || 9999, criterionId: "comunidad" },
    { label: "IBI", get: p => p.ibi ? Number(p.ibi).toLocaleString("es-ES") + " €/año" : "—", compare: "lower", num: p => p.ibi || 9999, criterionId: "ibi" },
    { label: "VRC", get: p => p.vrc>0 ? Number(p.vrc).toLocaleString("es-ES")+" €"+(p.vrc>p.price?" ⚠":"") : "—", compare: "none" },
    { label: "ITP real (7%)", get: p => p.price>0 ? Number(Math.round(Math.max(p.price,p.vrc||0)*0.07)).toLocaleString("es-ES")+" €" : "—", compare: "lower", num: p => p.price>0 ? Math.round(Math.max(p.price,p.vrc||0)*0.07) : 9999 },
    { label: "Dist. trabajo", get: p => p.distanciaKm ? p.distanciaKm + " km" : "—", compare: "lower", num: p => p.distanciaKm || 9999, criterionId: "distanciaKm" },
    { label: "Trastero", get: p => p.trastero ? "✓ Sí" : "✗ No", compare: "boolean", bool: p => p.trastero, criterionId: "trastero" },
    { label: "Garaje", get: p => p.garaje ? "✓ Sí" : "✗ No", compare: "boolean", bool: p => p.garaje, criterionId: "garaje" },
    { label: "Terraza", get: p => p.terraza ? `✓ Sí${p.numTerrazas > 1 ? " ×"+p.numTerrazas : ""}` : "✗ No", compare: "boolean", bool: p => p.terraza, criterionId: "terraza" },
    { label: "Piscina", get: p => p.piscina ? "✓ Sí" : "✗ No", compare: "boolean", bool: p => p.piscina, criterionId: "piscina" },
    { label: "Ascensor", get: p => p.ascensor ? "✓ Sí" : "✗ No", compare: "boolean", bool: p => p.ascensor, criterionId: "ascensor" },
    { label: "A/C", get: p => p.aireCond ? "✓ Sí" : "✗ No", compare: "boolean", bool: p => p.aireCond, criterionId: "aireCond" },
    { label: "Jardín", get: p => p.jardin ? "✓ Sí" : "✗ No", compare: "boolean", bool: p => p.jardin, criterionId: "jardin" },
    { label: "Lavadero", get: p => p.lavadero ? "✓ Sí" : "✗ No", compare: "boolean", bool: p => p.lavadero, criterionId: "lavadero" },
    { label: "Estado baños", get: p => { const c=BANOS_CATS.find(x=>x.val===p.estadoBanos); return c?c.icon+" "+c.label:"—"; }, compare: "custom", num: p => BANOS_SCORE[p.estadoBanos]??-1, criterionId: "estadoBanos" },
    { label: "Estado cocina", get: p => { const c=COCINA_CATS.find(x=>x.val===p.estadoCocina); return c?c.icon+" "+c.label:"—"; }, compare: "custom", num: p => COCINA_SCORE_MAP[p.estadoCocina]??-1, criterionId: "estadoCocina" },
    { label: "Tipo A/C", get: p => { const c=AIRE_CATS.find(x=>x.val===p.tipoAire); return c?c.icon+" "+c.label:"—"; }, compare: "custom", num: p => AIRE_SCORE_MAP[p.tipoAire]??-1, criterionId: "tipoAire" },
    { label: "Vistas", get: p => (p.vistas || []).join(", ") || "—", compare: "none", criterionId: "vistas" },
    { label: "Solería", get: p => p.soleria || "—", compare: "custom", num: p => SOLERIA_SCORE[p.soleria] ?? -1, criterionId: "soleria" },
    { label: "Cert. energético", get: p => p.certEnergetico || "—", compare: "none" },
    { label: "Año construcción", get: p => p.anoConstruccion > 1900 ? p.anoConstruccion : "—", compare: "higher", num: p => p.anoConstruccion > 1900 ? p.anoConstruccion : 0 },
    { label: "Antigüedad", get: p => p.anoConstruccion > 1900 ? (CURRENT_YEAR - p.anoConstruccion) + " años" : "—", compare: "lower", num: p => p.anoConstruccion > 1900 ? CURRENT_YEAR - p.anoConstruccion : 9999 },
    { label: "Zona", get: p => p.zone || "—", compare: "none" },
    { label: "Inmobiliaria", get: p => p.inmobiliaria || "—", compare: "none" },
  ];

  const isBest = (row, pidx) => {
    if (comparing.length < 2) return false;
    if (row.compare === "boolean") {
      const vals = comparing.map(row.bool);
      return row.bool(comparing[pidx]) && vals.filter(Boolean).length < comparing.length;
    }
    if (row.compare === "none") return false;
    const nums = comparing.map(p => row.num ? row.num(p) : null).filter(n => n != null && n !== -1 && n !== 9999);
    if (nums.length < 2) return false;
    const myVal = row.num ? row.num(comparing[pidx]) : null;
    if (myVal == null || myVal === -1 || myVal === 9999) return false;
    const best = row.compare === "lower" ? Math.min(...nums) : Math.max(...nums);
    return myVal === best && nums.filter(n => n === best).length < comparing.length;
  };

  const winner = comparing.length >= 2 ? comparing.reduce((a, b, i) => scores[i].pts > scores[comparing.indexOf(a)].pts ? b : a) : null;
  const winnerScore = winner ? scores[comparing.indexOf(winner)] : null;
  const winnerReasons = winnerScore ? winnerScore.bd.filter(b => b.weight > 0 && b.s >= 0.75).sort((a,b) => b.s*b.weight - a.s*a.weight).slice(0,3).map(b => b.label) : [];

  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 860 }}>
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 17 }}>Comparar propiedades</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--inkDim)", fontSize: 20 }}>×</button>
        </div>
        <div style={{ padding: "16px 22px 22px" }}>
          <p style={{ fontSize: 12, color: "var(--inkDim)", marginBottom: 12 }}>Selecciona hasta 3 propiedades para comparar. Las celdas verdes indican el mejor valor en cada categoría.</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {[...props].sort((a,b) => (rankMap[a.id]||99) - (rankMap[b.id]||99)).map(p => (
              <div key={p.id} className={`toggle${selected.includes(p.id) ? " on" : ""}`}
                onClick={() => toggle(p.id)}
                style={{ opacity: !selected.includes(p.id) && selected.length >= 3 ? 0.4 : 1, maxWidth: 280 }}>
                <div className="toggle-dot">{selected.includes(p.id) ? "✓" : ""}</div>
                <span style={{ fontWeight: 700, marginRight: 4, color: "var(--inkDim)", flexShrink: 0 }}>#{rankMap[p.id]}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title || "Sin título"}</span>
                <span style={{ marginLeft: 4, fontSize: 11, color: scoreColor(calcScore(p, criteria).pts), fontWeight: 600, flexShrink: 0 }}>{calcScore(p, criteria).pts}pts</span>
              </div>
            ))}
          </div>

          {comparing.length >= 2 && (
            <>
              {winner && (
                <div style={{ background: "var(--dim)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                  <span className="tag tag-win" style={{ marginRight: 8 }}>🏆 Ganadora</span>
                  <strong>{winner.title}</strong>
                  {winnerReasons.length > 0 && (
                    <span style={{ fontSize: 12, color: "var(--inkDim)", marginLeft: 8 }}>
                      Destaca en: {winnerReasons.join(", ")}
                    </span>
                  )}
                </div>
              )}

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 130, padding: "8px 10px", textAlign: "left", fontSize: 10, color: "var(--inkFaint)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--dim)", borderBottom: "1px solid var(--border)" }}>Criterio</th>
                      {comparing.map((p, i) => (
                        <th key={p.id} style={{ padding: "8px 10px", textAlign: "left", background: p === winner ? "#111" : "var(--dim)", color: p === winner ? "white" : "var(--ink)", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 12 }}>
                          {p === winner && "🏆 "}#{rankMap[p.id]} · {p.title || "Sin título"}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "7px 10px", fontSize: 11, color: "var(--inkFaint)", textTransform: "uppercase", letterSpacing: "0.04em", background: "var(--dim)", fontWeight: 500 }}>{row.label}</td>
                        {comparing.map((p, pi) => {
                          const best = isBest(row, pi);
                          const cScore = row.criterionId ? criterionScore(p, row.criterionId) : null;
                          return (
                            <td key={p.id} style={{ padding: "7px 10px", background: best ? "var(--greenBg)" : "white", color: best ? "var(--green)" : "var(--ink)", fontWeight: best ? 600 : 400 }}>
                              <div>{row.get(p, pi)}</div>
                              {cScore !== null && <div style={{ fontSize: 10, color: best ? "var(--green)" : "var(--inkFaint)", marginTop: 1 }}>({cScore} pts)</div>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr style={{ borderTop: "2px solid var(--border)", background: "var(--dim)" }}>
                      <td style={{ padding: "9px 10px", fontSize: 11, fontWeight: 700, color: "var(--inkMid)", textTransform: "uppercase", letterSpacing: "0.04em" }}>TOTAL</td>
                      {comparing.map((p, pi) => {
                        const total = scores[pi].pts;
                        const isWinner = p === winner;
                        return (
                          <td key={p.id} style={{ padding: "9px 10px", fontWeight: 700, fontSize: 15, fontFamily: "Outfit,sans-serif", color: isWinner ? "var(--green)" : scoreColor(total) }}>
                            {total} / 100 {isWinner ? "🏆" : ""}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {comparing.length < 2 && (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--inkFaint)", fontSize: 13 }}>
              Selecciona al menos 2 propiedades para comparar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── DetailModal ───────────────────────────────────────────────────────────────
function DetailModal({ prop, scored, rank, onClose, onEdit, onDelete }) {
  const { pts, bd } = scored;
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const photos = prop.photos || [];
  const m2 = prop.sizeUtil || prop.sizeConstruida || 0;
  const ratio = m2 && prop.price ? Math.round(prop.price / m2).toLocaleString("es-ES") + " €/m²" : "—";
  const antiguedad = prop.anoConstruccion > 1900 ? CURRENT_YEAR - prop.anoConstruccion : null;

  const Cell = ({ label, val }) => {
    if (!val && val !== 0) return null;
    if (val === 0) return null;
    return (
      <div className="dcell">
        <div className="dcell-l">{label}</div>
        <div className="dcell-v">{val}</div>
      </div>
    );
  };

  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 640 }}>
        <Carousel photos={photos} onLightbox={src => setLightboxSrc(src)} height={220} />

        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 5, marginBottom: 7, flexWrap: "wrap" }}>
                {prop.visitada && <span className="tag tag-green">🏠 Visitada{prop.fechaVisita ? " · " + new Date(prop.fechaVisita).toLocaleDateString("es-ES") : ""}</span>}
              {prop.tipoInmueble && <span className="tag tag-blue">{prop.tipoInmueble}</span>}
                {prop.planta && <span className="tag">{prop.planta}</span>}
                {prop.zone && <span className="tag">{prop.zone}</span>}
              </div>
              <h2 style={{ fontSize: 18, lineHeight: 1.3, marginBottom: 3 }}>
                {prop.sold && <span style={{ display: "inline-block", background: "#fef2f2", color: "var(--red)", border: "1.5px solid #fccfcf", borderRadius: 4, fontSize: 11, fontWeight: 700, padding: "1px 7px", letterSpacing: "0.08em", marginRight: 8, verticalAlign: "middle" }}>SOLD</span>}
                {prop.descartada && <span style={{ display: "inline-block", background: "#fdf6e3", color: "#8a5c00", border: "1.5px solid #e8d598", borderRadius: 4, fontSize: 11, fontWeight: 700, padding: "1px 7px", letterSpacing: "0.08em", marginRight: 8, verticalAlign: "middle" }}>DESCARTADA</span>}
                {prop.title}
              </h2>
              {prop.address && <div style={{ fontSize: 12, color: "var(--inkDim)" }}>{prop.address}</div>}
            </div>
            <ScoreRing pts={pts} size={58} rank={rank} />
          </div>
        </div>

        <div style={{ padding: "16px 22px 20px" }}>
          {/* Price */}
          <div style={{ background: "var(--dim)", borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "Outfit,sans-serif", letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {prop.price ? Number(prop.price).toLocaleString("es-ES") + " €" : "—"}
                </div>
                <div style={{ fontSize: 13, color: "var(--inkMid)", marginTop: 4, fontWeight: 500 }}>{ratio}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "Outfit,sans-serif", color: comunidadColor(prop.comunidad), lineHeight: 1 }}>
                  {prop.comunidad > 0 ? prop.comunidad + " €" : "?"}
                </div>
                <div style={{ fontSize: 10, color: "var(--inkFaint)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>comunidad/mes</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {prop.sizeUtil > 0 && <div style={{ textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 600 }}>{prop.sizeUtil}</div><div style={{ fontSize: 10, color: "var(--inkDim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>m² útiles</div></div>}
              {prop.sizeConstruida > 0 && <div style={{ textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 600 }}>{prop.sizeConstruida}</div><div style={{ fontSize: 10, color: "var(--inkDim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>m² const.</div></div>}
              {prop.rooms > 0 && <div style={{ textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 600 }}>{prop.rooms}</div><div style={{ fontSize: 10, color: "var(--inkDim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>hab.</div></div>}
              {prop.bathrooms > 0 && <div style={{ textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 600 }}>{prop.bathrooms}</div><div style={{ fontSize: 10, color: "var(--inkDim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>baños</div></div>}
            </div>
          </div>

          {/* Data grid */}
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--inkFaint)", marginBottom: 8 }}>Datos</div>
          <div className="dgrid" style={{ marginBottom: 14 }}>
            <Cell label="Orientación" val={prop.orientacion} />
            <Cell label="Dist. trabajo" val={prop.distanciaKm > 0 ? prop.distanciaKm + " km" : null} />

            <Cell label="IBI" val={prop.ibi > 0 ? Number(prop.ibi).toLocaleString("es-ES") + " €/año" : null} />
            {prop.vrc > 0 && <>
              <div className="dcell">
                <div className="dcell-l">VRC</div>
                <div className="dcell-v" style={{ color:prop.vrc>prop.price?"var(--red)":"var(--ink)" }}>{Number(prop.vrc).toLocaleString("es-ES")} €{prop.vrc>prop.price?" ⚠":""}</div>
              </div>
              <div className="dcell">
                <div className="dcell-l">ITP s/ precio (7%)</div>
                <div className="dcell-v">{Number(Math.round(prop.price*0.07)).toLocaleString("es-ES")} €</div>
              </div>
              <div className="dcell" style={{ background:prop.vrc>prop.price?"#fef2f2":"inherit" }}>
                <div className="dcell-l" style={{ color:prop.vrc>prop.price?"var(--red)":"var(--inkFaint)" }}>ITP real a pagar (7%)</div>
                <div className="dcell-v" style={{ color:prop.vrc>prop.price?"var(--red)":"var(--ink)", fontWeight:600 }}>
                  {Number(Math.round(Math.max(prop.price,prop.vrc)*0.07)).toLocaleString("es-ES")} €
                  {prop.vrc>prop.price && <span style={{ fontSize:11, display:"block", fontWeight:400 }}>+{Number(Math.round((prop.vrc-prop.price)*0.07)).toLocaleString("es-ES")} € extra</span>}
                </div>
              </div>
            </>}
            <Cell label="Año construcción" val={prop.anoConstruccion > 1900 ? prop.anoConstruccion : null} />
            <Cell label="Antigüedad" val={antiguedad != null ? antiguedad + " años" : null} />
            {prop.certEnergetico ? (
              <>
                <div className="dcell" style={{ gridColumn: "1 / -1" }}>
                  <div className="dcell-l">Cert. energético</div>
                  <div className="dcell-v" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontWeight: 700, color: CERT_COLORS[prop.certEnergetico] || "var(--ink)", fontSize: 15 }}>{prop.certEnergetico}</span>
                    {CERT_DESC[prop.certEnergetico] && (
                      <span style={{ fontSize: 11, color: "var(--inkDim)", fontWeight: 400, lineHeight: 1.4 }}>{CERT_DESC[prop.certEnergetico]}</span>
                    )}
                  </div>
                </div>
              </>
            ) : null}
            {(!prop.certEnergetico || ["No indicado","En trámite"].includes(prop.certEnergetico)) && (
              <div className="dcell" style={{ borderLeft: "3px solid var(--red)", background: "#fef2f2" }}>
                <div className="dcell-l" style={{ color: "var(--red)" }}>Cert. energético</div>
                <div className="dcell-v" style={{ color: "var(--red)", fontWeight: 600 }}>⚠ {prop.certEnergetico || "No indicado"}</div>
              </div>
            )}
            {prop.consumoEnergetico ? (
              <div className="dcell">
                <div className="dcell-l">Consumo energético</div>
                <div className="dcell-v" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {typeof prop.consumoEnergetico === "string" && CERT_COLORS[prop.consumoEnergetico] ? (
                    <span style={{ fontWeight: 700, color: CERT_COLORS[prop.consumoEnergetico], fontSize: 15 }}>{prop.consumoEnergetico}</span>
                  ) : prop.consumoEnergetico + " kWh/m²"}
                </div>
              </div>
            ) : null}
            {prop.emisionesEnergetico ? (
              <div className="dcell">
                <div className="dcell-l">Emisiones CO₂</div>
                <div className="dcell-v" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {typeof prop.emisionesEnergetico === "string" && CERT_COLORS[prop.emisionesEnergetico] ? (
                    <span style={{ fontWeight: 700, color: CERT_COLORS[prop.emisionesEnergetico], fontSize: 15 }}>{prop.emisionesEnergetico}</span>
                  ) : prop.emisionesEnergetico + " kg CO₂/m²"}
                </div>
              </div>
            ) : null}
            <Cell label="Inmobiliaria" val={prop.inmobiliaria} />
            {prop.visitada && <>
              <div className="dcell">
                <div className="dcell-l">Visita</div>
                <div className="dcell-v" style={{ color: "var(--green)", fontWeight: 600 }}>✓ Visitada</div>
              </div>
              {prop.fechaVisita && <Cell label="Fecha visita" val={new Date(prop.fechaVisita).toLocaleDateString("es-ES")} />}
              {prop.personaVisita && <Cell label="Enseñada por" val={prop.personaVisita} />}
            </>}
          </div>

          {/* Tags */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
            {[["trastero","📦 Trastero"],["garaje","🚗 Garaje"],["piscina","🏊 Piscina"],["aireCond","❄️ A/C"],["ascensor","🛗 Ascensor"],["jardin","🌳 Jardín"],["amueblado","🛋 Amueblado"],["lavadero","🧺 Lavadero"]].map(([k,lbl]) => prop[k] ? <span key={k} className="tag tag-green">{lbl}</span> : null)}
            {prop.soleria && <span className="tag tag-amber">🪨 {prop.soleria}</span>}
            {prop.terraza && <span className="tag tag-green">🌿 Terraza{prop.numTerrazas > 1 ? ` ×${prop.numTerrazas}` : ""}</span>}
            {(prop.vistas || []).map(v => <span key={v} className="tag tag-blue">👁 {v}</span>)}
            {prop.estadoBanos && (() => { const c=BANOS_CATS.find(x=>x.val===prop.estadoBanos); return c?<span className="tag tag-amber">{c.icon} Baños: {c.label}</span>:null; })()}
            {prop.estadoCocina && (() => { const c=COCINA_CATS.find(x=>x.val===prop.estadoCocina); return c?<span className="tag tag-amber">{c.icon} Cocina: {c.label}</span>:null; })()}
            {prop.tipoAire && (() => { const c=AIRE_CATS.find(x=>x.val===prop.tipoAire); return c?<span className="tag">{c.icon} A/C: {c.label}</span>:null; })()}
            {(prop.cocinaPositivos||[]).map(v => { const p=COCINA_POSITIVOS.find(x=>x.val===v); return p?<span key={v} className="tag tag-green">✅ {p.label}</span>:null; })}
            {(prop.cocinaNegativos||[]).map(v => { const p=COCINA_NEGATIVOS.find(x=>x.val===v); return p?<span key={v} className="tag" style={{background:"#fef2f2",borderColor:"#fccfcf",color:"var(--red)"}}>🔴 {p.label}</span>:null; })}
            {prop.otrosPros && <span className="tag tag-green" style={{maxWidth:"100%",whiteSpace:"normal"}}>✅ {prop.otrosPros}</span>}
            {prop.otrosContras && <span className="tag" style={{background:"#fef2f2",borderColor:"#fccfcf",color:"var(--red)",maxWidth:"100%",whiteSpace:"normal"}}>🔴 {prop.otrosContras}</span>}
          </div>



          {/* Notes */}
          {prop.notes && (
            <div style={{ background: "var(--amberBg)", border: "1px solid #e8d598", borderRadius: 8, padding: "10px 13px", fontSize: 13, color: "var(--inkMid)", lineHeight: 1.6, marginBottom: 14 }}>
              {prop.notes}
            </div>
          )}

          {/* Breakdown */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--inkFaint)", marginBottom: 10 }}>Índice de idoneidad — desglose</div>
            <BreakdownBar bd={bd} />
          </div>

          {/* Link */}
          {prop.url && (
            <a href={prop.url} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 14, color: "var(--blue)", fontSize: 13, textDecoration: "none", fontWeight: 500, background: "var(--blueBg)", border: "1px solid #93b4e8", borderRadius: 8, padding: "8px 0" }}>
              🔗 Ver anuncio original ↗
            </a>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 7 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onEdit(prop)} style={{ flex: 1 }}>✏ Editar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => printPDF(prop, pts, rank)}>🖨 PDF</button>
            <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm("¿Eliminar?")) { onDelete(prop.id); onClose(); } }}>🗑</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
      {lightboxSrc && <Lightbox src={lightboxSrc} photos={photos} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [props, setProps] = useState([]);
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showCrit, setShowCrit] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [detail, setDetail] = useState(null);
  const [sort, setSort] = useState("score");
  const [filter, setFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");

  useEffect(() => {
    const cleanUndefined = (obj) => {
      const out = {};
      Object.entries(obj).forEach(([k, v]) => {
        if (v === undefined) return;
        if (Array.isArray(v)) out[k] = v.filter(x => x !== undefined);
        else if (v !== null && typeof v === "object") out[k] = cleanUndefined(v);
        else out[k] = v;
      });
      return out;
    };

    const u1 = onSnapshot(collection(db, "properties"), snap => {
      setProps(snap.docs.map(d => cleanUndefined({ id: d.id, ...d.data() })));
      setLoaded(true);
    });
    const u2 = onSnapshot(doc(db, "config", "criteria"), snap => {
      if (snap.exists()) setCriteria(snap.data().list);
    });
    return () => { u1(); u2(); };
  }, []);

  const saveProperty = async (form) => {
    const id = editing ? editing.id : String(Date.now());
    const p = {
      ...form,
      price: Number(form.price) || 0,
      rooms: Number(form.rooms) || 0,
      bathrooms: Number(form.bathrooms) || 0,
      sizeUtil: Number(form.sizeUtil) || 0,
      sizeConstruida: Number(form.sizeConstruida) || 0,
      distanciaKm: Number(form.distanciaKm) || 0,
      comunidad: Number(form.comunidad) || 0,
      ibi: Number(form.ibi) || 0,
      vrc: Number(form.vrc) || 0,
      numTerrazas: Number(form.numTerrazas) || 0,
      anoConstruccion: Number(form.anoConstruccion) || 0,
      consumoEnergetico: form.consumoEnergetico || "",
      emisionesEnergetico: form.emisionesEnergetico || "",
      estadoBanos: form.estadoBanos || "",
      estadoCocina: form.estadoCocina || "",
      tipoAire: form.tipoAire || "",
      cocinaPositivos: form.cocinaPositivos || [],
      cocinaNegativos: form.cocinaNegativos || [],
      soleria: form.soleria || "",
      vistas: form.vistas || [],
      certEnergetico: form.certEnergetico || "",
      inmobiliaria: form.inmobiliaria || "",
      orientacion: form.orientacion || "",
      tipoInmueble: form.tipoInmueble || "",
      planta: form.planta || "",
      zone: form.zone || "",
      address: form.address || "",
      title: form.title || "",
      url: form.url || "",
      notes: form.notes || "",
      trastero: !!form.trastero,
      garaje: !!form.garaje,
      terraza: !!form.terraza,
      piscina: !!form.piscina,
      aireCond: !!form.aireCond,
      ascensor: !!form.ascensor,
      jardin: !!form.jardin,
      amueblado: !!form.amueblado,
      lavadero: !!form.lavadero,
      enviadaLaure: !!form.enviadaLaure,
      sold: !!form.sold,
      descartada: !!form.descartada,
      visitada: !!form.visitada,
      otrosPros: form.otrosPros || "",
      otrosContras: form.otrosContras || "",
      fechaVisita: form.fechaVisita || "",
      personaVisita: form.personaVisita || "",
      photos: form.photos || [],
    };
    delete p.id;
    delete p.error;
    // Remove ALL undefined values recursively — Firebase rejects them
    const clean = (obj) => {
      const out = {};
      Object.entries(obj).forEach(([k, v]) => {
        if (v === undefined) return;
        if (Array.isArray(v)) out[k] = v.filter(x => x !== undefined);
        else if (v !== null && typeof v === "object") out[k] = clean(v);
        else out[k] = v;
      });
      return out;
    };
    // JSON round-trip is the only 100% reliable way to strip undefined
    const cleanP = JSON.parse(JSON.stringify(clean(p)));
    try {
      await setDoc(doc(db, "properties", id), cleanP);
      setShowAdd(false); setEditing(null);
    } catch(err) {
      alert("Error al guardar: " + err.message);
      console.error("Firebase save error:", err, cleanP);
    }
  };

  const deleteProperty = async (id) => { await deleteDoc(doc(db, "properties", id)); };
  const saveCriteria = async (nc) => { await setDoc(doc(db, "config", "criteria"), { list: nc }); setCriteria(nc); };
  const toggleDescartada = async (id) => {
    const prop = props.find(p => p.id === id); if (!prop) return;
    const updated = { ...prop, descartada: !prop.descartada }; delete updated.id;
    const clean = (obj) => { const out = {}; Object.entries(obj).forEach(([k,v]) => { if(v===undefined)return; if(Array.isArray(v))out[k]=v.filter(x=>x!==undefined); else out[k]=v; }); return out; };
    await setDoc(doc(db, "properties", id), JSON.parse(JSON.stringify(clean(updated))));
  };

  const toggleSold = async (id) => {
    const prop = props.find(p => p.id === id); if (!prop) return;
    const updated = { ...prop, sold: !prop.sold }; delete updated.id;
    await setDoc(doc(db, "properties", id), updated);
  };

  const toggleLaure = async (id) => {
    const prop = props.find(p => p.id === id); if (!prop) return;
    const updated = { ...prop, enviadaLaure: !prop.enviadaLaure }; delete updated.id;
    await setDoc(doc(db, "properties", id), updated);
    setDetail(d => d && d.id === id ? { ...d, enviadaLaure: !d.enviadaLaure } : d);
  };
  const startEdit = (p) => { setEditing(p); setShowAdd(true); setDetail(null); };

  const scored = props.map(p => ({ ...p, ...calcScore(p, criteria) }));
  const sortedAll = [...scored].sort((a, b) => b.pts - a.pts);
  const rankMap = Object.fromEntries(sortedAll.map((p, i) => [p.id, i + 1]));

  const getRatio = (p) => {
    const m2 = p.sizeUtil || p.sizeConstruida || 0;
    return m2 && p.price ? Math.round(p.price / m2) : 999999;
  };

  const visible = scored
    .filter(p => !filter || [p.title, p.zone, p.address].join(" ").toLowerCase().includes(filter.toLowerCase()))
    .filter(p => !zoneFilter || p.zone === zoneFilter)
    .sort((a, b) => {
      if (sort === "score") return b.pts - a.pts;
      if (sort === "price") return (a.price || 0) - (b.price || 0);
      if (sort === "size") return (b.sizeUtil || b.sizeConstruida || 0) - (a.sizeUtil || a.sizeConstruida || 0);
      if (sort === "ratio") return getRatio(a) - getRatio(b);
      return 0;
    });

  const best = Math.max(0, ...scored.map(s => s.pts));
  const avgPrice = props.length ? Math.round(props.reduce((a, b) => a + (b.price || 0), 0) / props.length) : 0;

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--inkDim)", fontFamily: "Outfit,sans-serif" }}>
      <div className="pulse" style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>Conectando</div>
    </div>
  );

  return (
    <>
      <style>{css}</style>

      <div className="header no-print">
        <h1 style={{ fontSize: 15, fontWeight: 600, color: "white", letterSpacing: "0.02em" }}>CASA<span style={{ color: "#555", fontWeight: 300 }}>FINDER</span></h1>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginRight: "auto", marginLeft: 6 }}>
          <span className="live-dot" />
          <span style={{ fontSize: 10, color: "#444", letterSpacing: "0.06em" }}>LIVE</span>
        </div>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar…"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "white", padding: "6px 11px", fontSize: 12, width: 130, outline: "none" }} />
        <select value={sort} onChange={e => setSort(e.target.value)}
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "white", padding: "6px 9px", fontSize: 12, outline: "none" }}>
          <option value="score">Ranking</option>
          <option value="price">Precio ↑</option>
          <option value="size">Más grandes</option>
          <option value="ratio">Mejor €/m²</option>
        </select>
        <select value={zoneFilter} onChange={e => setZoneFilter(e.target.value)}
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "white", padding: "6px 9px", fontSize: 12, outline: "none", maxWidth: 140 }}>
          <option value="">Todas las zonas</option>
          {[...new Set(props.map(p => p.zone).filter(Boolean))].sort().map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowCompare(true)}
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
          ⚖ Comparar
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowCrit(true)}
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
          ⚙ Criterios
        </button>
        <button className="btn btn-sm" onClick={() => { setEditing(null); setShowAdd(true); }}
          style={{ background: "white", color: "var(--ink)", fontWeight: 600 }}>
          + Añadir
        </button>
      </div>

      <div className="stat-bar no-print">
        {[
          ["Propiedades", props.length],
          ["Mejor puntuación", best > 0 ? best + " / 100" : "—"],
          ["Precio medio", avgPrice ? Number(avgPrice).toLocaleString("es-ES") + " €" : "—"],

        ].map(([l, v]) => (
          <div key={l} className="stat-item">
            <div style={{ fontSize: 10, color: "var(--inkFaint)", letterSpacing: "0.07em", textTransform: "uppercase" }}>{l}</div>
            <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "Outfit,sans-serif", marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "18px 22px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(276px, 1fr))", gap: 12 }}>
        {visible.map((p, i) => {
          const rank = rankMap[p.id];
          const photos = p.photos || [];
          const m2 = p.sizeUtil || p.sizeConstruida || 0;
          const ratio = m2 && p.price ? Math.round(p.price / m2).toLocaleString("es-ES") + " €/m²" : "";
          return (
            <div key={p.id} className="prop-card card-enter" style={{ animationDelay: `${i * 0.04}s`, opacity: p.sold || p.descartada ? 0.7 : 1 }} onClick={() => setDetail(p)}>
              <div className="rank-num">#{rank}</div>
              {p.sold && <div className="sold-overlay"><div className="sold-x"/></div>}
              {p.descartada && !p.sold && <div className="descartada-overlay"><div className="descartada-label">Descartada</div></div>}
              {photos.length > 0 && (
                <div onClick={e => e.stopPropagation()}>
                  <Carousel photos={photos} height={110} radius="10px 10px 0 0" />
                </div>
              )}
              <div style={{ padding: "12px 13px 11px" }}>
                <div style={{ display: "flex", gap: 9, marginBottom: 9 }}>
                  <ScoreRing pts={p.pts} size={46} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.title}</div>
                    <div style={{ color: "var(--inkDim)", fontSize: 11, marginTop: 2 }}>{p.zone || p.address}</div>
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "Outfit,sans-serif", letterSpacing: "-0.01em", lineHeight: 1 }}>
                      {p.price ? Number(p.price).toLocaleString("es-ES") + " €" : "—"}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "Outfit,sans-serif", color: comunidadColor(p.comunidad), lineHeight: 1 }}>
                        {p.comunidad > 0 ? p.comunidad + " €" : "?"}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--inkFaint)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 1 }}>comunidad</div>
                    </div>
                  </div>
                  {p.price > 0 && (() => {
                    const base = Math.max(p.price, p.vrc || 0);
                    const itp = Math.round(base * 0.07);
                    const usaVrc = p.vrc > p.price;
                    return (
                      <div style={{ marginTop: 6, borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: usaVrc ? "var(--red)" : "var(--green)" }}>
                          ITP: {Number(itp).toLocaleString("es-ES")} €
                        </div>
                        <div style={{ fontSize: 10, color: usaVrc ? "var(--red)" : "var(--green)", marginTop: 1 }}>
                          s/ {usaVrc ? "VRC" : "precio venta"}: {Number(base).toLocaleString("es-ES")} €
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{ fontSize: 11, color: "var(--inkMid)", marginTop: 3 }}>
                    {ratio}{ratio && m2 ? " · " : ""}{m2 ? m2 + " m²" : ""}{m2 && p.rooms ? " · " : ""}{p.rooms ? p.rooms + " hab." : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                  {(!p.certEnergetico || ["No indicado","En trámite"].includes(p.certEnergetico)) && <span className="tag" title="Sin certificado energético" style={{ background:"#fef2f2", borderColor:"var(--red)", borderWidth:2, color:"var(--red)", fontWeight:600 }}>⚠ Sin cert.</span>}
                  {p.tipoInmueble && <span className="tag tag-blue" title={p.tipoInmueble}>{p.tipoInmueble}</span>}
                  {p.planta && <span className="tag" title={"Planta: " + p.planta}>{p.planta}</span>}
                  {[
                    ["trastero","📦","Trastero"],
                    ["garaje","🚗","Garaje"],
                    ["terraza","🌿","Terraza"],
                    ["piscina","🏊","Piscina"],
                    ["aireCond","❄️","Aire acondicionado"],
                    ["ascensor","🛗","Ascensor"],
                    ["lavadero","🧺","Lavadero"]
                  ].map(([k,e,lbl]) => p[k] ? <span key={k} className="tag tag-green" title={lbl}>{e}</span> : null)}
                  {p.estadoBanos && (() => { const c=BANOS_CATS.find(x=>x.val===p.estadoBanos); return c?<span className="tag tag-amber" title={"Baños: "+c.label+" — "+c.desc}>{c.icon}</span>:null; })()}
                  {p.estadoCocina && (() => { const c=COCINA_CATS.find(x=>x.val===p.estadoCocina); return c?<span className="tag tag-amber" title={"Cocina: "+c.label+" — "+c.desc}>🍳{c.icon}</span>:null; })()}
                  {p.tipoAire && (() => { const c=AIRE_CATS.find(x=>x.val===p.tipoAire); return c?<span className="tag" title={"A/C: "+c.label+" — "+c.desc}>{c.icon}</span>:null; })()}
                  {p.soleria && <span className="tag tag-amber" title={"Solería: "+p.soleria}>🪨</span>}
                  {p.orientacion && <span className="tag" title={"Orientación: "+p.orientacion}>🧭</span>}
                  {(p.vistas||[]).length>0 && <span className="tag tag-blue" title={"Vistas: "+(p.vistas||[]).join(", ")}>👁</span>}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: p.visitada ? "var(--green)" : "var(--inkFaint)", fontWeight: 500 }}>
                    {p.visitada ? "🏠 Visitada" + (p.fechaVisita ? " · " + new Date(p.fechaVisita).toLocaleDateString("es-ES") : "") : "Sin visitar"}
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className={`sold-btn ${p.sold ? "issold" : "unsold"}`}
                      onClick={e => { e.stopPropagation(); toggleSold(p.id); }}>
                      {p.sold ? "✕ SOLD" : "SOLD"}
                    </button>
                    <button className={`desc-btn ${p.descartada ? "isdesc" : "nodesc"}`}
                      onClick={e => { e.stopPropagation(); toggleDescartada(p.id); }}>
                      {p.descartada ? "✕ DESC." : "DESC."}
                    </button>
                    <button className="print-ico btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); printPDF(p, p.pts, rank); }}
                      style={{ padding: "3px 8px", fontSize: 12 }}>🖨</button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 2, height: 3, marginTop: 9 }}>
                  {p.bd.filter(b => b.weight > 0).map(b => (
                    <div key={b.id} title={b.label + ": " + Math.round(b.s * 100) + "%"}
                      style={{ flex: b.weight, borderRadius: 1, background: scoreColor(Math.round(b.s * 100)), opacity: 0.45 }} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "80px 0", color: "var(--inkFaint)" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>□</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Sin propiedades</div>
            <div style={{ fontSize: 12 }}>Pulsa "+ Añadir" para comenzar</div>
          </div>
        )}
      </div>

      {showAdd && <PropertyModal prop={editing} onSave={saveProperty} onClose={() => { setShowAdd(false); setEditing(null); }} />}
      {showCrit && <CriteriaModal criteria={criteria} onChange={saveCriteria} onClose={() => setShowCrit(false)} />}
      {showCompare && <CompareModal props={props} criteria={criteria} rankMap={rankMap} onClose={() => setShowCompare(false)} />}
      {detail && <DetailModal prop={detail} scored={calcScore(detail, criteria)} rank={rankMap[detail.id]} onClose={() => setDetail(null)} onEdit={startEdit} onDelete={deleteProperty} />}
    </>
  );
}
