import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection, doc, onSnapshot, setDoc, deleteDoc, getDoc
} from "firebase/firestore";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400&family=Outfit:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #f7f4ef;
    --bg2: #efeae1;
    --surface: #ffffff;
    --surfaceDim: #f2ede5;
    --border: #e0d9ce;
    --borderDark: #c8bfb0;
    --accent: #c0392b;
    --accentDark: #962d22;
    --ink: #1a1410;
    --inkMid: #5a5048;
    --inkDim: #9a8f82;
    --inkFaint: #c8bfb0;
    --gold: #b8860b;
    --goldSoft: #fdf8ee;
    --green: #2d6a4f;
    --greenSoft: #eaf4ef;
    --shadow: 0 2px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05);
    --shadowHover: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
    --radius: 14px;
  }

  body {
    background: var(--bg);
    color: var(--ink);
    font-family: 'Outfit', sans-serif;
    min-height: 100vh;
  }

  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
    opacity: 0.025;
    pointer-events: none;
    z-index: 9999;
  }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

  input, textarea, select {
    font-family: 'Outfit', sans-serif;
    background: var(--surfaceDim);
    border: 1.5px solid var(--border);
    border-radius: 8px;
    color: var(--ink);
    padding: 9px 13px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
    width: 100%;
  }
  input:focus, textarea:focus, select:focus { border-color: var(--accent); }
  button { cursor: pointer; font-family: 'Outfit', sans-serif; }

  .card-enter { animation: cardIn 0.4s cubic-bezier(0.22,1,0.36,1) both; }
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(18px) scale(0.97); }
    to   { opacity: 1; transform: none; }
  }

  .pulse { animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }

  .modal-bg {
    position: fixed; inset: 0;
    background: rgba(26,20,16,0.55);
    backdrop-filter: blur(6px);
    z-index: 100;
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    animation: fadeIn 0.2s ease both;
  }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }

  .modal-box {
    background: var(--surface);
    border-radius: 18px;
    width: 100%; max-width: 560px;
    max-height: 92vh; overflow-y: auto;
    padding: 32px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.18);
    animation: slideUp 0.3s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes slideUp { from { transform: translateY(24px); opacity:0; } to { transform:none; opacity:1; } }

  .btn-primary {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 9px;
    padding: 11px 22px;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.02em;
    transition: background 0.2s, transform 0.1s;
  }
  .btn-primary:hover { background: var(--accentDark); }
  .btn-primary:active { transform: scale(0.97); }

  .btn-secondary {
    background: var(--surfaceDim);
    color: var(--inkMid);
    border: 1.5px solid var(--border);
    border-radius: 9px;
    padding: 10px 18px;
    font-size: 14px;
    transition: border-color 0.2s, background 0.2s;
  }
  .btn-secondary:hover { border-color: var(--borderDark); background: var(--bg2); }

  .tag {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--surfaceDim);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 3px 10px;
    font-size: 12px;
    color: var(--inkMid);
    font-weight: 500;
  }
  .tag.yes { background: var(--greenSoft); border-color: #a8d5be; color: var(--green); }
  .tag.no  { background: #fef2f2; border-color: #fccfcf; color: #c0392b99; text-decoration: line-through; opacity:0.7; }

  label { font-size: 12px; color: var(--inkDim); font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; display: block; margin-bottom: 5px; }

  .score-chip {
    display: inline-flex; align-items: center; justify-content: center;
    width: 52px; height: 52px; border-radius: 50%;
    font-size: 16px; font-weight: 700;
    border: 2.5px solid currentColor;
    flex-shrink: 0;
  }

  .header-stripe {
    background: var(--ink);
    padding: 0 28px;
    height: 58px;
    display: flex; align-items: center; gap: 16px;
    position: sticky; top: 0; z-index: 20;
  }

  .stat-pill {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 16px;
    min-width: 110px;
  }

  .prop-card {
    background: var(--surface);
    border-radius: var(--radius);
    border: 1.5px solid var(--border);
    padding: 20px;
    cursor: pointer;
    transition: box-shadow 0.22s, transform 0.22s, border-color 0.22s;
    box-shadow: var(--shadow);
    position: relative;
    overflow: hidden;
  }
  .prop-card:hover {
    box-shadow: var(--shadowHover);
    transform: translateY(-3px);
    border-color: var(--borderDark);
  }
  .prop-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent), var(--gold));
    opacity: 0;
    transition: opacity 0.22s;
  }
  .prop-card:hover::before { opacity: 1; }

  .laure-btn {
    display: inline-flex; align-items: center; gap: 6px;
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 12px; font-weight: 600;
    border: 1.5px solid;
    cursor: pointer;
    transition: all 0.18s;
    letter-spacing: 0.02em;
    background: none;
  }
  .laure-btn.sent { background: #eaf0fb; border-color: #93b4e8; color: #2c5faa; }
  .laure-btn.unsent { background: var(--surfaceDim); border-color: var(--border); color: var(--inkDim); }

  .toggle-bool {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 13px;
    border-radius: 8px;
    border: 1.5px solid var(--border);
    cursor: pointer;
    font-size: 13px; font-weight: 500;
    transition: all 0.18s;
    user-select: none;
    background: var(--surfaceDim);
    color: var(--inkMid);
  }
  .toggle-bool.on { background: var(--greenSoft); border-color: #a8d5be; color: var(--green); }

  .weight-btn {
    width: 30px; height: 30px;
    border-radius: 6px; border: 1.5px solid var(--border);
    background: var(--surfaceDim);
    color: var(--inkMid);
    font-size: 13px; font-weight: 600;
    transition: all 0.15s;
  }
  .weight-btn.active { background: var(--accent); border-color: var(--accent); color: white; }

  .live-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: #4caf7d;
    display: inline-block;
    animation: livePulse 2s ease-in-out infinite;
  }
  @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
`;

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_CRITERIA = [
  { id: "price",       label: "Precio",           weight: 5, type: "lower_better",  target: 350000, unit: "€" },
  { id: "size",        label: "Metros cuadrados",  weight: 4, type: "higher_better", target: 90,     unit: "m²" },
  { id: "trastero",    label: "Trastero",          weight: 3, type: "boolean" },
  { id: "garaje",      label: "Garaje",            weight: 4, type: "boolean" },
  { id: "terraza",     label: "Terraza / jardín",  weight: 3, type: "boolean" },
  { id: "distanciaKm", label: "Distancia trabajo", weight: 5, type: "lower_better",  target: 10,     unit: "km" },
];

// ─── Score ────────────────────────────────────────────────────────────────────
function scoreColor(pts) {
  return pts >= 75 ? "var(--green)" : pts >= 48 ? "var(--gold)" : "var(--accent)";
}
function score(prop, criteria) {
  let total = 0, max = 0;
  const bd = [];
  criteria.forEach(c => {
    if (!c.weight) return;
    const v = prop[c.id];
    let s = 0;
    if (c.type === "boolean") s = v ? 1 : 0;
    else if (c.type === "lower_better") s = v == null ? 0.5 : v <= c.target ? 1 : Math.max(0, 1 - (v - c.target) / c.target);
    else s = v == null ? 0.5 : v >= c.target ? 1 : Math.max(0, v / c.target);
    total += s * c.weight; max += c.weight;
    bd.push({ ...c, s, v });
  });
  return { pts: max ? Math.round((total / max) * 100) : 0, bd };
}

// ─── AI extraction ────────────────────────────────────────────────────────────
async function extractUrl(url) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1000,
      messages: [{ role: "user", content: `URL de portal inmobiliario: ${url}\n\nExtrae los datos y devuelve SOLO JSON válido sin markdown:\n{"title":"","address":"","zone":"","price":null,"size":null,"rooms":null,"bathrooms":null,"trastero":false,"garaje":false,"terraza":false,"distanciaKm":null,"comunidad":null,"notes":"","error":null}` }],
    }),
  });
  const d = await res.json();
  const t = d.content?.map(b => b.text || "").join("") || "";
  try { return JSON.parse(t.replace(/```json|```/g, "").trim()); }
  catch { return { error: "No se pudo extraer", title: "", address: "", zone: "", price: null, size: null, rooms: null, bathrooms: null, trastero: false, garaje: false, terraza: false, distanciaKm: null, comunidad: null, notes: "" }; }
}

// ─── ScoreChip ────────────────────────────────────────────────────────────────
function ScoreChip({ pts, size = 52 }) {
  const c = scoreColor(pts);
  return (
    <div className="score-chip" style={{ color: c, width: size, height: size, fontSize: size * 0.3 }}>
      {pts}
    </div>
  );
}

// ─── BreakdownBar ─────────────────────────────────────────────────────────────
function BreakdownBar({ bd }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {bd.filter(b => b.weight > 0).map(b => (
        <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--inkDim)", width: 148, flexShrink: 0 }}>{b.label}</span>
          <div style={{ flex: 1, height: 5, background: "var(--bg2)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${b.s * 100}%`, background: scoreColor(Math.round(b.s * 100)), borderRadius: 99, transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)" }} />
          </div>
          <span style={{ fontSize: 11, color: "var(--inkDim)", width: 34, textAlign: "right" }}>{Math.round(b.s * 100)}%</span>
          <span style={{ fontSize: 10, color: "var(--inkFaint)", width: 16 }}>×{b.weight}</span>
        </div>
      ))}
    </div>
  );
}

// ─── PropertyModal ────────────────────────────────────────────────────────────
function PropertyModal({ prop, onSave, onClose }) {
  const blank = { title: "", url: "", address: "", zone: "", price: "", size: "", rooms: "", bathrooms: "", trastero: false, garaje: false, terraza: false, distanciaKm: "", comunidad: "", notes: "", enviadaLaure: false };
  const [form, setForm] = useState(prop ? { ...prop } : blank);
  const [urlInput, setUrlInput] = useState(prop?.url || "");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(prop ? "form" : "url");

  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const n = (k, v) => setForm(f => ({ ...f, [k]: v === "" ? "" : Number(v) }));

  const doExtract = async () => {
    if (!urlInput.trim()) return;
    setLoading(true);
    const d = await extractUrl(urlInput.trim());
    setForm(f => ({ ...f, ...d, url: urlInput.trim() }));
    setLoading(false);
    setStep("form");
  };

  const row2 = (children) => <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{children}</div>;
  const field = (lbl, key, ph, type = "text") => (
    <div>
      <label>{lbl}</label>
      <input type={type} value={form[key] ?? ""} onChange={e => type === "number" ? n(key, e.target.value) : s(key, e.target.value)} placeholder={ph} />
    </div>
  );

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "Playfair Display", fontSize: 24, fontWeight: 700 }}>{prop ? "Editar propiedad" : "Nueva propiedad"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--inkDim)", fontSize: 22 }}>×</button>
        </div>

        {step === "url" && !prop && (
          <div style={{ marginBottom: 20 }}>
            <label>URL del portal</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://idealista.com/..." onKeyDown={e => e.key === "Enter" && doExtract()} style={{ flex: 1 }} />
              <button className="btn-primary" onClick={doExtract} disabled={loading} style={{ flexShrink: 0, opacity: loading ? 0.6 : 1 }}>
                {loading ? "…" : "Extraer"}
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--inkDim)", marginTop: 8 }}>La IA intentará leer los datos del anuncio.</p>
            <button onClick={() => setStep("form")} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, marginTop: 6, padding: 0, textDecoration: "underline", cursor: "pointer" }}>
              Rellenar manualmente →
            </button>
          </div>
        )}

        {step === "form" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {form.error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fccfcf", borderRadius: 8, padding: "10px 13px", fontSize: 12, color: "var(--accent)" }}>
                ⚠ {form.error} — revisa los datos abajo.
              </div>
            )}
            {field("Título", "title", "Ático en San Pedro…")}
            {row2(<>
              {field("Precio (€)", "price", "320000", "number")}
              {field("Tamaño (m²)", "size", "90", "number")}
              {field("Habitaciones", "rooms", "3", "number")}
              {field("Baños", "bathrooms", "2", "number")}
              {field("Dist. trabajo (km)", "distanciaKm", "8", "number")}
              {field("Comunidad (€/mes)", "comunidad", "120", "number")}
            </>)}
            {field("Dirección", "address", "C/ ...")}
            {field("Zona / municipio", "zone", "Marbella, San Pedro…")}

            <div>
              <label>Características</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[["trastero", "📦 Trastero"], ["garaje", "🚗 Garaje"], ["terraza", "🌿 Terraza"]].map(([k, lbl]) => (
                  <div key={k} className={`toggle-bool${form[k] ? " on" : ""}`} onClick={() => s(k, !form[k])}>
                    {form[k] ? "✓" : "○"} {lbl}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label>Enviada a Laure</label>
              <div className={`toggle-bool${form.enviadaLaure ? " on" : ""}`} style={{ display: "inline-flex" }} onClick={() => s("enviadaLaure", !form.enviadaLaure)}>
                {form.enviadaLaure ? "✓ Enviada a Laure para investigar" : "○ Pendiente de enviar a Laure"}
              </div>
            </div>

            <div>
              <label>Notas</label>
              <textarea value={form.notes} onChange={e => s("notes", e.target.value)} placeholder="Observaciones…" style={{ minHeight: 72, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button className="btn-primary" onClick={() => onSave(form)} style={{ flex: 1 }}>Guardar</button>
              <button className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CriteriaModal ────────────────────────────────────────────────────────────
function CriteriaModal({ criteria, onChange, onClose }) {
  const [loc, setLoc] = useState(criteria.map(c => ({ ...c })));
  const set = (i, k, v) => setLoc(p => p.map((c, j) => j === i ? { ...c, [k]: v } : c));

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ fontFamily: "Playfair Display", fontSize: 24, fontWeight: 700 }}>Mis criterios</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--inkDim)", fontSize: 22 }}>×</button>
        </div>
        <p style={{ fontSize: 13, color: "var(--inkDim)", marginBottom: 22 }}>Peso 0 = ignorar · 5 = muy importante.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {loc.map((c, i) => (
            <div key={c.id} style={{ background: "var(--surfaceDim)", borderRadius: 10, padding: "14px 16px", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: c.type !== "boolean" ? 10 : 0 }}>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{c.label}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {[0,1,2,3,4,5].map(w => (
                    <button key={w} className={`weight-btn${c.weight === w ? " active" : ""}`} onClick={() => set(i, "weight", w)}>{w}</button>
                  ))}
                </div>
              </div>
              {c.type !== "boolean" && c.weight > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--inkDim)" }}>Objetivo:</span>
                  <input type="number" value={c.target} onChange={e => set(i, "target", Number(e.target.value))} style={{ width: 110 }} />
                  <span style={{ fontSize: 12, color: "var(--inkDim)" }}>{c.unit}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={() => { onChange(loc); onClose(); }} style={{ width: "100%", marginTop: 20 }}>
          Aplicar criterios
        </button>
      </div>
    </div>
  );
}

// ─── DetailModal ──────────────────────────────────────────────────────────────
function DetailModal({ prop, scored, onClose, onEdit, onDelete, onToggleLaure }) {
  const { pts, bd } = scored;
  const c = scoreColor(pts);

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 600 }}>
        <div style={{ background: "var(--bg2)", borderRadius: 12, padding: "20px 22px", marginBottom: 22, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: c, opacity: 0.06 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <h2 style={{ fontFamily: "Playfair Display", fontSize: 22, fontWeight: 700, lineHeight: 1.25, marginBottom: 4 }}>{prop.title}</h2>
              <p style={{ color: "var(--inkDim)", fontSize: 13 }}>{prop.address}{prop.zone ? ` · ${prop.zone}` : ""}</p>
            </div>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <ScoreChip pts={pts} size={60} />
              <div style={{ fontSize: 10, color: "var(--inkDim)", marginTop: 4 }}>IDONEIDAD</div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 20 }}>
            <div>
              <div style={{ fontFamily: "Playfair Display", fontSize: 26, fontWeight: 700, color: "var(--accent)" }}>{prop.price?.toLocaleString("es-ES")} €</div>
              {prop.size && <div style={{ fontSize: 12, color: "var(--inkDim)" }}>{prop.price && prop.size ? Math.round(prop.price / prop.size).toLocaleString("es-ES") + " €/m²" : ""}</div>}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              {prop.size && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 600 }}>{prop.size}</div><div style={{ fontSize: 11, color: "var(--inkDim)" }}>m²</div></div>}
              {prop.rooms && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 600 }}>{prop.rooms}</div><div style={{ fontSize: 11, color: "var(--inkDim)" }}>hab.</div></div>}
              {prop.bathrooms && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 600 }}>{prop.bathrooms}</div><div style={{ fontSize: 11, color: "var(--inkDim)" }}>baños</div></div>}
              {prop.distanciaKm != null && <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 600 }}>{prop.distanciaKm}</div><div style={{ fontSize: 11, color: "var(--inkDim)" }}>km trab.</div></div>}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {[["trastero","📦 Trastero"],["garaje","🚗 Garaje"],["terraza","🌿 Terraza"]].map(([k,lbl]) => (
            <span key={k} className={`tag ${prop[k] ? "yes" : "no"}`}>{lbl}</span>
          ))}
          {prop.comunidad && <span className="tag">🏢 {prop.comunidad} €/mes</span>}
          <button className={`laure-btn ${prop.enviadaLaure ? "sent" : "unsent"}`} onClick={() => onToggleLaure(prop.id)}>
            {prop.enviadaLaure ? "✉ Enviada a Laure" : "✉ Enviar a Laure"}
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "var(--inkDim)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Desglose por criterios</div>
          <BreakdownBar bd={bd} />
        </div>

        {prop.notes && (
          <div style={{ background: "var(--goldSoft)", border: "1px solid #e8d598", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "var(--inkMid)", lineHeight: 1.6, marginBottom: 20 }}>
            {prop.notes}
          </div>
        )}

        {prop.url && (
          <a href={prop.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 18, color: "var(--accent)", fontSize: 13, textDecoration: "none", fontWeight: 500 }}>
            Ver anuncio original ↗
          </a>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-secondary" onClick={() => onEdit(prop)} style={{ flex: 1 }}>✏ Editar</button>
          <button onClick={() => { if (window.confirm("¿Eliminar esta propiedad?")) { onDelete(prop.id); onClose(); } }}
            style={{ background: "#fef2f2", color: "var(--accent)", border: "1.5px solid #fccfcf", borderRadius: 9, padding: "10px 18px", fontSize: 14 }}>
            🗑
          </button>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [props, setProps] = useState([]);
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showCrit, setShowCrit] = useState(false);
  const [detail, setDetail] = useState(null);
  const [sort, setSort] = useState("score");
  const [filter, setFilter] = useState("");

  // ── Firebase real-time listeners ──
  useEffect(() => {
    // Properties listener
    const unsubProps = onSnapshot(collection(db, "properties"), snapshot => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setProps(data);
      setLoaded(true);
    });

    // Criteria listener
    const unsubCrit = onSnapshot(doc(db, "config", "criteria"), snap => {
      if (snap.exists()) setCriteria(snap.data().list);
    });

    return () => { unsubProps(); unsubCrit(); };
  }, []);

  const saveProperty = async (form) => {
    const id = editing ? editing.id : String(Date.now());
    const p = {
      ...form,
      price: Number(form.price) || 0,
      size: Number(form.size) || 0,
      rooms: Number(form.rooms) || 0,
      bathrooms: Number(form.bathrooms) || 0,
      distanciaKm: form.distanciaKm !== "" && form.distanciaKm != null ? Number(form.distanciaKm) : null,
      comunidad: form.comunidad !== "" && form.comunidad != null ? Number(form.comunidad) : null,
    };
    delete p.id;
    await setDoc(doc(db, "properties", id), p);
    setShowAdd(false); setEditing(null);
  };

  const deleteProperty = async (id) => {
    await deleteDoc(doc(db, "properties", id));
  };

  const saveCriteria = async (newCrit) => {
    await setDoc(doc(db, "config", "criteria"), { list: newCrit });
    setCriteria(newCrit);
  };

  const toggleLaure = async (id) => {
    const prop = props.find(p => p.id === id);
    if (!prop) return;
    const updated = { ...prop, enviadaLaure: !prop.enviadaLaure };
    delete updated.id;
    await setDoc(doc(db, "properties", id), updated);
    setDetail(d => d && d.id === id ? { ...d, enviadaLaure: !d.enviadaLaure } : d);
  };

  const startEdit = (p) => { setEditing(p); setShowAdd(true); setDetail(null); };

  const scored = props.map(p => ({ ...p, ...score(p, criteria) }));
  const visible = scored
    .filter(p => !filter || [p.title, p.zone, p.address].join(" ").toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => sort === "score" ? b.pts - a.pts : sort === "price" ? (a.price || 0) - (b.price || 0) : (b.size || 0) - (a.size || 0));

  const best = Math.max(0, ...scored.map(s => s.pts));
  const avgPrice = props.length ? Math.round(props.reduce((a, b) => a + (b.price || 0), 0) / props.length) : 0;

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--inkDim)", fontFamily: "Outfit, sans-serif" }}>
      <div className="pulse">Conectando con Firebase…</div>
    </div>
  );

  return (
    <>
      <style>{css}</style>

      <div className="header-stripe">
        <div style={{ fontFamily: "Playfair Display", fontSize: 22, fontWeight: 700, color: "white" }}>
          Casa<em style={{ color: "#e8a89e", fontStyle: "italic" }}>Finder</em>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span className="live-dot" />
          <span style={{ fontSize: 11, color: "#ffffff55" }}>en vivo</span>
        </div>
        <div style={{ flex: 1 }} />
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar…"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "white", padding: "7px 13px", fontSize: 13, width: 150, outline: "none" }} />
        <select value={sort} onChange={e => setSort(e.target.value)}
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "white", padding: "7px 10px", fontSize: 13, outline: "none" }}>
          <option value="score">Por idoneidad</option>
          <option value="price">Por precio</option>
          <option value="size">Por tamaño</option>
        </select>
        <button onClick={() => setShowCrit(true)} className="btn-secondary"
          style={{ fontSize: 13, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.8)" }}>
          ⚙ Criterios
        </button>
        <button onClick={() => { setEditing(null); setShowAdd(true); }} className="btn-primary">+ Añadir</button>
      </div>

      <div style={{ padding: "16px 28px", display: "flex", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
        {[
          ["Propiedades", props.length],
          ["Mejor puntuación", best + " / 100"],
          ["Precio medio", avgPrice ? avgPrice.toLocaleString("es-ES") + " €" : "—"],
          ["Enviadas a Laure", props.filter(p => p.enviadaLaure).length + " de " + props.length],
        ].map(([lbl, val]) => (
          <div key={lbl} className="stat-pill">
            <div style={{ fontSize: 11, color: "var(--inkDim)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 3 }}>{lbl}</div>
            <div style={{ fontFamily: "Playfair Display", fontSize: 20, fontWeight: 500 }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "24px 28px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
        {visible.map((p, i) => {
          const isBest = p.pts === best && best > 0;
          return (
            <div key={p.id} className="prop-card card-enter"
              style={{ animationDelay: `${i * 0.05}s`, borderColor: isBest ? "#c0392b33" : undefined }}
              onClick={() => setDetail(p)}>

              {isBest && (
                <div style={{ position: "absolute", top: 14, right: 14, background: "var(--accent)", color: "white", borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>★ TOP</div>
              )}

              <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginBottom: 14 }}>
                <ScoreChip pts={p.pts} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Playfair Display", fontWeight: 600, fontSize: 15, lineHeight: 1.25, marginBottom: 3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.title}</div>
                  <div style={{ color: "var(--inkDim)", fontSize: 12 }}>{p.zone || p.address}</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 13 }}>
                <div>
                  <div style={{ fontFamily: "Playfair Display", fontSize: 22, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>{p.price?.toLocaleString("es-ES")} €</div>
                  <div style={{ fontSize: 12, color: "var(--inkDim)", marginTop: 2 }}>
                    {p.size ? p.size + " m²" : ""}{p.size && p.rooms ? " · " : ""}{p.rooms ? p.rooms + " hab." : ""}
                  </div>
                </div>
                {p.distanciaKm != null && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{p.distanciaKm} km</div>
                    <div style={{ fontSize: 11, color: "var(--inkDim)" }}>al trabajo</div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                {[["trastero","📦"],["garaje","🚗"],["terraza","🌿"]].map(([k,e]) =>
                  p[k] ? <span key={k} className="tag yes">{e}</span> : null
                )}
              </div>

              <div style={{ marginBottom: 10 }} onClick={e => { e.stopPropagation(); toggleLaure(p.id); }}>
                <button className={`laure-btn ${p.enviadaLaure ? "sent" : "unsent"}`} style={{ fontSize: 11 }}>
                  {p.enviadaLaure ? "✉ Enviada a Laure" : "✉ Pendiente · enviar a Laure"}
                </button>
              </div>

              <div style={{ display: "flex", gap: 3, height: 4 }}>
                {p.bd.filter(b => b.weight > 0).map(b => (
                  <div key={b.id} title={b.label + ": " + Math.round(b.s * 100) + "%"}
                    style={{ flex: b.weight, borderRadius: 2, background: scoreColor(Math.round(b.s * 100)), opacity: 0.65 }} />
                ))}
              </div>
            </div>
          );
        })}

        {visible.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "72px 0", color: "var(--inkDim)" }}>
            <div style={{ fontFamily: "Playfair Display", fontSize: 48, marginBottom: 12 }}>🏠</div>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Sin propiedades todavía</div>
            <div style={{ fontSize: 13 }}>Pulsa "+ Añadir" para empezar.</div>
          </div>
        )}
      </div>

      {showAdd && <PropertyModal prop={editing} onSave={saveProperty} onClose={() => { setShowAdd(false); setEditing(null); }} />}
      {showCrit && <CriteriaModal criteria={criteria} onChange={saveCriteria} onClose={() => setShowCrit(false)} />}
      {detail && <DetailModal prop={detail} scored={score(detail, criteria)} onClose={() => setDetail(null)} onEdit={startEdit} onDelete={deleteProperty} onToggleLaure={toggleLaure} />}
    </>
  );
}
