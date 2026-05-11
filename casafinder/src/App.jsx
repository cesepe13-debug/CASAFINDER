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
];

const ZONES = ["Málaga capital","Torremolinos","Benalmádena","Fuengirola","Mijas","Mijas Costa","Marbella","Las Chapas","Elviria","Nueva Andalucía","Puerto Banús","San Pedro de Alcántara","Guadalmina","Cancelada","Estepona","Selwo","Manilva","Sabinillas","Casares","Ojén","Istán","Benahavís"];

const SOLERIA_SCORE = { "Mármol": 1, "Tarima flotante": 0.7, "Gres": 0.4 };
const CERT_COLORS = { "A": "#1a5c3a", "B": "#2d8a4e", "C": "#e07b00", "D": "#e06000", "E": "#cc4400", "F": "#b83200", "G": "#991b1b" };

// ── Scoring ───────────────────────────────────────────────────────────────────
function scoreColor(pts) {
  return pts >= 75 ? "#1a5c3a" : pts >= 48 ? "#8a5c00" : "#991b1b";
}

function calcScore(prop, criteria) {
  let total = 0, max = 0;
  const bd = [];
  criteria.forEach(c => {
    if (!c.weight) return;
    const v = prop[c.id];
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
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap');
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
  body { background:var(--bg); color:var(--ink); font-family:'Inter',sans-serif; min-height:100vh; font-size:14px; }
  ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:var(--bg)} ::-webkit-scrollbar-thumb{background:var(--borderMid);border-radius:2px}
  input,textarea,select{font-family:'Inter',sans-serif;background:var(--dim);border:1px solid var(--border);border-radius:6px;color:var(--ink);padding:8px 11px;font-size:13px;outline:none;transition:border-color 0.15s,box-shadow 0.15s;width:100%}
  input:focus,textarea:focus,select:focus{border-color:var(--ink);box-shadow:0 0 0 2px rgba(0,0,0,0.06)}
  button{cursor:pointer;font-family:'Inter',sans-serif}
  h1,h2,h3{font-family:'Space Grotesk',sans-serif}
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
  .tag{display:inline-flex;align-items:center;gap:3px;background:var(--dim);border:1px solid var(--border);border-radius:4px;padding:2px 7px;font-size:11px;color:var(--inkMid);font-weight:500;white-space:nowrap}
  .tag-green{background:var(--greenBg);border-color:#a8d5be;color:var(--green)}
  .tag-blue{background:var(--blueBg);border-color:#93b4e8;color:var(--blue)}
  .tag-amber{background:var(--amberBg);border-color:#e8d598;color:var(--amber)}
  .tag-win{background:#111;color:white;border-color:#111}
  .prop-card{background:var(--surface);border-radius:10px;border:1px solid var(--border);cursor:pointer;transition:box-shadow 0.2s,border-color 0.2s;box-shadow:var(--sh);position:relative;overflow:hidden}
  .prop-card:hover{box-shadow:var(--shMd);border-color:var(--borderMid)}
  .rank-num{position:absolute;top:10px;left:10px;width:22px;height:22px;border-radius:50%;background:var(--ink);color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:1;font-family:'Space Grotesk',sans-serif}
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
        <span style={{ fontSize: size*0.26, fontWeight: 700, color: col, fontFamily: "Space Grotesk,sans-serif", lineHeight: 1 }}>{pts}</span>
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
  const w = window.open("", "_blank");
  const m2 = prop.sizeUtil || prop.sizeConstruida || 0;
  const ratio = m2 && prop.price ? Math.round(prop.price / m2).toLocaleString("es-ES") + " €/m²" : "—";
  const tags = [["trastero","Trastero"],["garaje","Garaje"],["terraza","Terraza"],["piscina","Piscina"],["aireCond","A/C"],["ascensor","Ascensor"],["jardin","Jardín"],["amueblado","Amueblado"]].filter(([k]) => prop[k]).map(([,l]) => l);
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${prop.title||"Propiedad"}</title>
  <style>body{font-family:Arial,sans-serif;margin:32px;color:#111;font-size:13px;line-height:1.5}h1{font-size:20px;margin-bottom:4px}
  .sub{color:#666;font-size:12px;margin-bottom:20px}.score-box{float:right;text-align:center;border:2px solid #111;border-radius:8px;padding:8px 14px}
  .score-n{font-size:32px;font-weight:700;line-height:1}.score-l{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em}
  .price{font-size:28px;font-weight:700;margin:0 0 4px}.ratio{font-size:13px;color:#555;margin-bottom:20px}
  .grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #ddd;border-radius:6px;overflow:hidden;margin-bottom:16px}
  .cell{padding:8px 12px;border-bottom:1px solid #eee;border-right:1px solid #eee;font-size:12px}.cell:nth-child(even){border-right:none}
  .cl{color:#aaa;font-size:10px;text-transform:uppercase;letter-spacing:0.05em}.cv{font-weight:500;margin-top:2px}
  .tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px}.tag{border:1px solid #ddd;border-radius:3px;padding:2px 7px;font-size:11px}
  .notes{background:#fdf6e3;border:1px solid #e8d598;border-radius:6px;padding:10px 14px;font-size:12px;color:#555}</style></head><body>
  <div class="score-box"><div class="score-n">${pts}</div><div class="score-l">Idoneidad</div><div style="font-size:12px;color:#888">Ranking #${rank}</div></div>
  <h1>${prop.title||"Sin título"}</h1>
  <div class="sub">${[prop.address,prop.zone].filter(Boolean).join(" · ")}</div>
  <div class="price">${prop.price?Number(prop.price).toLocaleString("es-ES")+" €":"—"}</div>
  <div class="ratio">${ratio}${prop.sizeUtil?" · "+prop.sizeUtil+" m² útiles":""}${prop.sizeConstruida?" · "+prop.sizeConstruida+" m² construidos":""}</div>
  <div class="grid">
    ${[["Tipo",prop.tipoInmueble],["Planta",prop.planta],["Habitaciones",prop.rooms||null],["Baños",prop.bathrooms||null],
      ["Orientación",prop.orientacion],["Dist. trabajo",prop.distanciaKm?prop.distanciaKm+" km":null],
      ["Comunidad",prop.comunidad?Number(prop.comunidad).toLocaleString("es-ES")+" €/mes":null],
      ["IBI",prop.ibi?Number(prop.ibi).toLocaleString("es-ES")+" €/año":null],
      ["Año construc.",prop.anoConstruccion||null],["Antigüedad",prop.anoConstruccion?CURRENT_YEAR-prop.anoConstruccion+" años":null],
      ["Cert. energético",prop.certEnergetico],["Consumo",prop.consumoEnergetico?prop.consumoEnergetico+" kWh/m²":null],
      ["Emisiones",prop.emisionesEnergetico?prop.emisionesEnergetico+" kg CO₂/m²":null],
      ["Inmobiliaria",prop.inmobiliaria]
    ].filter(([,v])=>v).map(([l,v])=>`<div class="cell"><div class="cl">${l}</div><div class="cv">${v}</div></div>`).join("")}
  </div>
  ${tags.length?`<div class="tags">${tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>`:""}
  ${prop.vistas&&prop.vistas.length?`<p style="font-size:12px;color:#555;margin-bottom:14px">Vistas: ${prop.vistas.join(", ")}</p>`:""}
  ${prop.notes?`<div class="notes">${prop.notes}</div>`:""}
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

// ── PropertyModal ─────────────────────────────────────────────────────────────
function PropertyModal({ prop, onSave, onClose }) {
  const blank = {
    title: "", url: "", address: "", zone: "", price: 0, sizeUtil: 0, sizeConstruida: 0,
    rooms: 0, bathrooms: 0, anoConstruccion: 0,
    trastero: false, terraza: false, numTerrazas: 0, garaje: false,
    piscina: false, aireCond: false, ascensor: false, jardin: false, amueblado: false, lavadero: false,
    soleria: "", certEnergetico: "", consumoEnergetico: 0, emisionesEnergetico: 0,
    vistas: [], tipoInmueble: "", planta: "", orientacion: "",
    distanciaKm: 0, comunidad: 0, ibi: 0, inmobiliaria: "", notes: "",
    enviadaLaure: false, photos: [],
  };
  const [form, setForm] = useState(prop ? { ...blank, ...prop, photos: prop.photos || [] } : blank);
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
      <input type="number" min="0" value={form[key] ?? 0}
        onChange={e => n(key, e.target.value)}
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
                  <input type="number" min="0" value={form.sizeUtil ?? 0}
                    onChange={e => { const v = Number(e.target.value) || 0; setForm(f => ({ ...f, sizeUtil: v, sizeConstruida: v > 0 ? Math.round(v * 1.2) : f.sizeConstruida })); }}
                    onFocus={e => { if (Number(e.target.value) === 0) e.target.select(); }}/>
                </div>
                <div>
                  <label className="label">M² construidos</label>
                  <input type="number" min="0" value={form.sizeConstruida ?? 0}
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

              <div className="sec">Orientación</div>
              <select value={form.orientacion || ""} onChange={e => s("orientacion", e.target.value)}>
                <option value="">—</option>
                {["Norte","Noreste","Este","Sureste","Sur","Suroeste","Oeste","Noroeste","Norte-Sur","Este-Oeste"].map(t => <option key={t}>{t}</option>)}
              </select>

              <div className="sec">Características</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[["trastero","📦 Trastero"],["garaje","🚗 Garaje"],["piscina","🏊 Piscina"],["aireCond","❄️ A/C"],["ascensor","🛗 Ascensor"],["jardin","🌳 Jardín"],["amueblado","🛋 Amueblado"],["lavadero","🫧 Lavadero"]].map(([k,lbl]) => (
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

              <div className="sec">Año de construcción</div>
              {row2(<>
                {numField("Año de construcción", "anoConstruccion")}
                <div>
                  <label className="label">Antigüedad</label>
                  <input type="text" readOnly value={antiguedad != null ? antiguedad + " años" : "—"} style={{ background: "var(--dim)", color: "var(--inkDim)" }} />
                </div>
              </>)}

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
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {["Sí","En trámite","No indicado"].map(v => (
                  <Toggle key={v} val={form.certEnergetico === v} onChange={() => s("certEnergetico", form.certEnergetico === v ? "" : v)} label={v} />
                ))}
              </div>
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
              <Toggle val={form.enviadaLaure} onChange={v => s("enviadaLaure", v)} label="✉ Enviada a Laure" />

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

  const rows = [
    { label: "Puntuación", get: (p, i) => scores[i].pts + " / 100", compare: "higher" },
    { label: "Precio", get: p => p.price ? Number(p.price).toLocaleString("es-ES") + " €" : "—", compare: "lower", num: p => p.price },
    { label: "M² útiles", get: p => p.sizeUtil ? p.sizeUtil + " m²" : "—", compare: "higher", num: p => p.sizeUtil },
    { label: "M² construidos", get: p => p.sizeConstruida ? p.sizeConstruida + " m²" : "—", compare: "higher", num: p => p.sizeConstruida },
    { label: "€/m²", get: p => (p.sizeUtil || p.sizeConstruida) && p.price ? Math.round(p.price / (p.sizeUtil || p.sizeConstruida)).toLocaleString("es-ES") + " €" : "—", compare: "lower", num: p => (p.sizeUtil || p.sizeConstruida) && p.price ? Math.round(p.price / (p.sizeUtil || p.sizeConstruida)) : null },
    { label: "Habitaciones", get: p => p.rooms || "—", compare: "higher", num: p => p.rooms },
    { label: "Baños", get: p => p.bathrooms || "—", compare: "higher", num: p => p.bathrooms },
    { label: "Planta", get: p => p.planta || "—", compare: "custom", num: p => PLANTA_ORDER[p.planta] ?? -1 },
    { label: "Orientación", get: p => p.orientacion || "—", compare: "custom", num: p => ORIENTACION_SCORE[p.orientacion] ?? -1 },
    { label: "Comunidad", get: p => p.comunidad ? Number(p.comunidad).toLocaleString("es-ES") + " €/mes" : "—", compare: "lower", num: p => p.comunidad || 9999 },
    { label: "IBI", get: p => p.ibi ? Number(p.ibi).toLocaleString("es-ES") + " €/año" : "—", compare: "lower", num: p => p.ibi || 9999 },
    { label: "Dist. trabajo", get: p => p.distanciaKm ? p.distanciaKm + " km" : "—", compare: "lower", num: p => p.distanciaKm || 9999 },
    { label: "Trastero", get: p => p.trastero ? "✓ Sí" : "✗ No", compare: "boolean", bool: p => p.trastero },
    { label: "Garaje", get: p => p.garaje ? "✓ Sí" : "✗ No", compare: "boolean", bool: p => p.garaje },
    { label: "Terraza", get: p => p.terraza ? `✓ Sí${p.numTerrazas > 1 ? " ×"+p.numTerrazas : ""}` : "✗ No", compare: "boolean", bool: p => p.terraza },
    { label: "Piscina", get: p => p.piscina ? "✓ Sí" : "✗ No", compare: "boolean", bool: p => p.piscina },
    { label: "Ascensor", get: p => p.ascensor ? "✓ Sí" : "✗ No", compare: "boolean", bool: p => p.ascensor },
    { label: "A/C", get: p => p.aireCond ? "✓ Sí" : "✗ No", compare: "boolean", bool: p => p.aireCond },
    { label: "Jardín", get: p => p.jardin ? "✓ Sí" : "✗ No", compare: "boolean", bool: p => p.jardin },
    { label: "Vistas", get: p => (p.vistas || []).join(", ") || "—", compare: "none" },
    { label: "Cert. energético", get: p => p.certEnergetico || "—", compare: "none" },
    { label: "Año construcción", get: p => p.anoConstruccion > 1900 ? p.anoConstruccion : "—", compare: "higher", num: p => p.anoConstruccion > 1900 ? p.anoConstruccion : 0 },
    { label: "Antigüedad", get: p => p.anoConstruccion > 1900 ? (CURRENT_YEAR - p.anoConstruccion) + " años" : "—", compare: "lower", num: p => p.anoConstruccion > 1900 ? CURRENT_YEAR - p.anoConstruccion : 9999 },
    { label: "Zona", get: p => p.zone || "—", compare: "none" },
    { label: "Lavadero", get: p => p.lavadero ? "✓ Sí" : "✗ No", compare: "boolean", bool: p => p.lavadero },
    { label: "Solería", get: p => p.soleria || "—", compare: "custom", num: p => SOLERIA_SCORE[p.soleria] ?? -1 },
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
            {props.map(p => (
              <div key={p.id} className={`toggle${selected.includes(p.id) ? " on" : ""}`}
                onClick={() => toggle(p.id)}
                style={{ opacity: !selected.includes(p.id) && selected.length >= 3 ? 0.4 : 1, maxWidth: 260 }}>
                <div className="toggle-dot">{selected.includes(p.id) ? "✓" : ""}</div>
                <span style={{ fontWeight: 700, marginRight: 4, color: "var(--inkDim)", flexShrink: 0 }}>#{rankMap[p.id]}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title || "Sin título"}</span>
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
                      <th style={{ width: 130, padding: "8px 10px", textAlign: "left", fontSize: 10, color: "var(--inkFaint)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--dim)", borderBottom: "1px solid var(--border)" }}></th>
                      {comparing.map((p, i) => (
                        <th key={p.id} style={{ padding: "8px 10px", textAlign: "left", background: p === winner ? "#111" : "var(--dim)", color: p === winner ? "white" : "var(--ink)", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 12 }}>
                          {p === winner && "🏆 "}{p.title || "Sin título"}
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
                          return (
                            <td key={p.id} style={{ padding: "7px 10px", background: best ? "var(--greenBg)" : "white", color: best ? "var(--green)" : "var(--ink)", fontWeight: best ? 600 : 400 }}>
                              {row.get(p, pi)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
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
function DetailModal({ prop, scored, rank, onClose, onEdit, onDelete, onToggleLaure }) {
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
                {prop.tipoInmueble && <span className="tag tag-blue">{prop.tipoInmueble}</span>}
                {prop.planta && <span className="tag">{prop.planta}</span>}
                {prop.zone && <span className="tag">{prop.zone}</span>}
              </div>
              <h2 style={{ fontSize: 18, lineHeight: 1.3, marginBottom: 3 }}>{prop.title}</h2>
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
                <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "Space Grotesk,sans-serif", letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {prop.price ? Number(prop.price).toLocaleString("es-ES") + " €" : "—"}
                </div>
                <div style={{ fontSize: 13, color: "var(--inkMid)", marginTop: 4, fontWeight: 500 }}>{ratio}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "Space Grotesk,sans-serif", color: comunidadColor(prop.comunidad), lineHeight: 1 }}>
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
            <Cell label="Año construcción" val={prop.anoConstruccion > 1900 ? prop.anoConstruccion : null} />
            <Cell label="Antigüedad" val={antiguedad != null ? antiguedad + " años" : null} />
            {prop.certEnergetico ? (
              <div className="dcell">
                <div className="dcell-l">Cert. energético</div>
                <div className="dcell-v">{prop.certEnergetico}</div>
              </div>
            ) : null}
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
          </div>

          {/* Tags */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
            {[["trastero","📦 Trastero"],["garaje","🚗 Garaje"],["piscina","🏊 Piscina"],["aireCond","❄️ A/C"],["ascensor","🛗 Ascensor"],["jardin","🌳 Jardín"],["amueblado","🛋 Amueblado"],["lavadero","🫧 Lavadero"]].map(([k,lbl]) => prop[k] ? <span key={k} className="tag tag-green">{lbl}</span> : null)}
            {prop.soleria && <span className="tag tag-amber">◻ {prop.soleria}</span>}
            {prop.terraza && <span className="tag tag-green">🌿 Terraza{prop.numTerrazas > 1 ? ` ×${prop.numTerrazas}` : ""}</span>}
            {(prop.vistas || []).map(v => <span key={v} className="tag tag-blue">👁 {v}</span>)}
          </div>

          {/* Laure */}
          <div style={{ marginBottom: 14 }}>
            <Toggle val={prop.enviadaLaure} onChange={() => onToggleLaure(prop.id)} label={prop.enviadaLaure ? "✉ Enviada a Laure" : "✉ Pendiente de enviar a Laure"} />
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

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "properties"), snap => {
      setProps(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
      price: Number(form.price) || 0, rooms: Number(form.rooms) || 0, bathrooms: Number(form.bathrooms) || 0,
      sizeUtil: Number(form.sizeUtil) || 0, sizeConstruida: Number(form.sizeConstruida) || 0,
      distanciaKm: Number(form.distanciaKm) || 0, comunidad: Number(form.comunidad) || 0,
      ibi: Number(form.ibi) || 0, numTerrazas: Number(form.numTerrazas) || 0,
      anoConstruccion: Number(form.anoConstruccion) || 0,
      consumoEnergetico: form.consumoEnergetico || "",
      emisionesEnergetico: form.emisionesEnergetico || "",
      photos: form.photos || [],
    };
    delete p.id;
    await setDoc(doc(db, "properties", id), p);
    setShowAdd(false); setEditing(null);
  };

  const deleteProperty = async (id) => { await deleteDoc(doc(db, "properties", id)); };
  const saveCriteria = async (nc) => { await setDoc(doc(db, "config", "criteria"), { list: nc }); setCriteria(nc); };
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

  const visible = scored
    .filter(p => !filter || [p.title, p.zone, p.address].join(" ").toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => sort === "score" ? b.pts - a.pts : sort === "price" ? (a.price || 0) - (b.price || 0) : (b.sizeUtil || 0) - (a.sizeUtil || 0));

  const best = Math.max(0, ...scored.map(s => s.pts));
  const avgPrice = props.length ? Math.round(props.reduce((a, b) => a + (b.price || 0), 0) / props.length) : 0;

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--inkDim)", fontFamily: "Inter,sans-serif" }}>
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
          <option value="price">Precio</option>
          <option value="size">Tamaño</option>
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
          ["Enviadas a Laure", props.filter(p => p.enviadaLaure).length + " / " + props.length],
        ].map(([l, v]) => (
          <div key={l} className="stat-item">
            <div style={{ fontSize: 10, color: "var(--inkFaint)", letterSpacing: "0.07em", textTransform: "uppercase" }}>{l}</div>
            <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "Space Grotesk,sans-serif", marginTop: 2 }}>{v}</div>
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
            <div key={p.id} className="prop-card card-enter" style={{ animationDelay: `${i * 0.04}s` }} onClick={() => setDetail(p)}>
              <div className="rank-num">#{rank}</div>
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
                    <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "Space Grotesk,sans-serif", letterSpacing: "-0.01em", lineHeight: 1 }}>
                      {p.price ? Number(p.price).toLocaleString("es-ES") + " €" : "—"}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "Space Grotesk,sans-serif", color: comunidadColor(p.comunidad), lineHeight: 1 }}>
                        {p.comunidad > 0 ? p.comunidad + " €" : "?"}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--inkFaint)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 1 }}>comunidad</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--inkMid)", marginTop: 3 }}>
                    {ratio}{ratio && m2 ? " · " : ""}{m2 ? m2 + " m²" : ""}{m2 && p.rooms ? " · " : ""}{p.rooms ? p.rooms + " hab." : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                  {p.tipoInmueble && <span className="tag tag-blue">{p.tipoInmueble}</span>}
                  {p.planta && <span className="tag">{p.planta}</span>}
                  {[["trastero","📦"],["garaje","🚗"],["terraza","🌿"],["piscina","🏊"],["aireCond","❄️"],["ascensor","🛗"],["lavadero","🫧"]].map(([k,e]) => p[k] ? <span key={k} className="tag tag-green">{e}</span> : null)}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: p.enviadaLaure ? "var(--green)" : "var(--inkFaint)", fontWeight: 500, cursor: "pointer" }}
                    onClick={e => { e.stopPropagation(); toggleLaure(p.id); }}>
                    {p.enviadaLaure ? "✉ Enviada a Laure" : "✉ Pendiente Laure"}
                  </span>
                  <button className="print-ico btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); printPDF(p, p.pts, rank); }}
                    style={{ padding: "3px 8px", fontSize: 12 }}>🖨</button>
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
      {detail && <DetailModal prop={detail} scored={calcScore(detail, criteria)} rank={rankMap[detail.id]} onClose={() => setDetail(null)} onEdit={startEdit} onDelete={deleteProperty} onToggleLaure={toggleLaure} />}
    </>
  );
}
