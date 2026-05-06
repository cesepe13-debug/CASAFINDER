import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import {
  collection, doc, onSnapshot, setDoc, deleteDoc
} from "firebase/firestore";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400&family=Outfit:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f7f4ef; --bg2: #efeae1; --surface: #ffffff; --surfaceDim: #f2ede5;
    --border: #e0d9ce; --borderDark: #c8bfb0;
    --accent: #c0392b; --accentDark: #962d22; --accentSoft: #fdf0ee;
    --ink: #1a1410; --inkMid: #5a5048; --inkDim: #9a8f82; --inkFaint: #c8bfb0;
    --gold: #b8860b; --goldSoft: #fdf8ee;
    --green: #2d6a4f; --greenSoft: #eaf4ef;
    --blue: #2c5faa; --blueSoft: #eaf0fb;
    --shadow: 0 2px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05);
    --shadowHover: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
    --radius: 14px;
  }
  body { background:var(--bg); color:var(--ink); font-family:'Outfit',sans-serif; min-height:100vh; }
  body::before { content:''; position:fixed; inset:0; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E"); opacity:0.025; pointer-events:none; z-index:9999; }
  ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:var(--bg)} ::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
  input,textarea,select{font-family:'Outfit',sans-serif;background:var(--surfaceDim);border:1.5px solid var(--border);border-radius:8px;color:var(--ink);padding:9px 13px;font-size:14px;outline:none;transition:border-color 0.2s;width:100%}
  input:focus,textarea:focus,select:focus{border-color:var(--accent)}
  button{cursor:pointer;font-family:'Outfit',sans-serif}
  .card-enter{animation:cardIn 0.4s cubic-bezier(0.22,1,0.36,1) both}
  @keyframes cardIn{from{opacity:0;transform:translateY(18px) scale(0.97)}to{opacity:1;transform:none}}
  .pulse{animation:pulse 2s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
  .modal-bg{position:fixed;inset:0;background:rgba(26,20,16,0.55);backdrop-filter:blur(6px);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn 0.2s ease both}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  .modal-box{background:var(--surface);border-radius:18px;width:100%;max-width:580px;max-height:92vh;overflow-y:auto;padding:32px;box-shadow:0 24px 64px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.22,1,0.36,1) both}
  @keyframes slideUp{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
  .btn-primary{background:var(--accent);color:#fff;border:none;border-radius:9px;padding:11px 22px;font-size:14px;font-weight:600;letter-spacing:0.02em;transition:background 0.2s,transform 0.1s}
  .btn-primary:hover{background:var(--accentDark)}
  .btn-primary:active{transform:scale(0.97)}
  .btn-secondary{background:var(--surfaceDim);color:var(--inkMid);border:1.5px solid var(--border);border-radius:9px;padding:10px 18px;font-size:14px;transition:border-color 0.2s,background 0.2s}
  .btn-secondary:hover{border-color:var(--borderDark);background:var(--bg2)}
  .tag{display:inline-flex;align-items:center;gap:4px;background:var(--surfaceDim);border:1px solid var(--border);border-radius:20px;padding:3px 10px;font-size:12px;color:var(--inkMid);font-weight:500}
  .tag.yes{background:var(--greenSoft);border-color:#a8d5be;color:var(--green)}
  .tag.no{background:#fef2f2;border-color:#fccfcf;color:#c0392b99;text-decoration:line-through;opacity:0.7}
  label{font-size:12px;color:var(--inkDim);font-weight:500;letter-spacing:0.06em;text-transform:uppercase;display:block;margin-bottom:5px}
  .score-chip{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;font-weight:700;border:2.5px solid currentColor;flex-shrink:0}
  .header-stripe{background:var(--ink);padding:0 28px;height:58px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:20}
  .stat-pill{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 16px;min-width:110px}
  .prop-card{background:var(--surface);border-radius:var(--radius);border:1.5px solid var(--border);padding:20px;cursor:pointer;transition:box-shadow 0.22s,transform 0.22s,border-color 0.22s;box-shadow:var(--shadow);position:relative;overflow:hidden}
  .prop-card:hover{box-shadow:var(--shadowHover);transform:translateY(-3px);border-color:var(--borderDark)}
  .prop-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--accent),var(--gold));opacity:0;transition:opacity 0.22s}
  .prop-card:hover::before{opacity:1}
  .laure-btn{display:inline-flex;align-items:center;gap:6px;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;border:1.5px solid;cursor:pointer;transition:all 0.18s;background:none}
  .laure-btn.sent{background:var(--blueSoft);border-color:#93b4e8;color:var(--blue)}
  .laure-btn.unsent{background:var(--surfaceDim);border-color:var(--border);color:var(--inkDim)}
  .toggle-bool{display:flex;align-items:center;gap:8px;padding:9px 13px;border-radius:8px;border:1.5px solid var(--border);cursor:pointer;font-size:13px;font-weight:500;transition:all 0.18s;user-select:none;background:var(--surfaceDim);color:var(--inkMid)}
  .toggle-bool.on{background:var(--greenSoft);border-color:#a8d5be;color:var(--green)}
  .weight-btn{width:30px;height:30px;border-radius:6px;border:1.5px solid var(--border);background:var(--surfaceDim);color:var(--inkMid);font-size:13px;font-weight:600;transition:all 0.15s}
  .weight-btn.active{background:var(--accent);border-color:var(--accent);color:white}
  .live-dot{width:7px;height:7px;border-radius:50%;background:#4caf7d;display:inline-block;animation:livePulse 2s ease-in-out infinite}
  @keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.8)}}
  .photo-thumb{width:72px;height:72px;object-fit:cover;border-radius:8px;border:1.5px solid var(--border);cursor:zoom-in;transition:transform 0.15s}
  .photo-thumb:hover{transform:scale(1.05)}
  .drop-zone{border:2px dashed var(--border);border-radius:10px;padding:20px;text-align:center;cursor:pointer;transition:border-color 0.2s,background 0.2s;color:var(--inkDim);font-size:13px}
  .drop-zone:hover,.drop-zone.over{border-color:var(--accent);background:var(--accentSoft);color:var(--accent)}
  .tab-btn{padding:8px 14px;border-radius:8px;border:1.5px solid var(--border);background:var(--surfaceDim);color:var(--inkMid);font-size:13px;font-weight:500;transition:all 0.18s}
  .tab-btn.active{background:var(--ink);border-color:var(--ink);color:white}
  .lightbox{position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:200;display:flex;align-items:center;justify-content:center;cursor:zoom-out}
  .lightbox img{max-width:95vw;max-height:95vh;border-radius:8px;object-fit:contain}
`;

const DEFAULT_CRITERIA = [
  { id:"price",       label:"Precio",           weight:5, type:"lower_better",  target:350000, unit:"€" },
  { id:"size",        label:"Metros cuadrados",  weight:4, type:"higher_better", target:90,     unit:"m²" },
  { id:"trastero",    label:"Trastero",          weight:3, type:"boolean" },
  { id:"garaje",      label:"Garaje",            weight:4, type:"boolean" },
  { id:"terraza",     label:"Terraza / jardín",  weight:3, type:"boolean" },
  { id:"distanciaKm", label:"Distancia trabajo", weight:5, type:"lower_better",  target:10,     unit:"km" },
];

function scoreColor(pts) { return pts>=75?"var(--green)":pts>=48?"var(--gold)":"var(--accent)"; }
function score(prop, criteria) {
  let total=0, max=0; const bd=[];
  criteria.forEach(c => {
    if(!c.weight) return;
    const v=prop[c.id]; let s=0;
    if(c.type==="boolean") s=v?1:0;
    else if(c.type==="lower_better") s=v==null?0.5:v<=c.target?1:Math.max(0,1-(v-c.target)/c.target);
    else s=v==null?0.5:v>=c.target?1:Math.max(0,v/c.target);
    total+=s*c.weight; max+=c.weight; bd.push({...c,s,v});
  });
  return { pts: max?Math.round((total/max)*100):0, bd };
}

function fileToBase64(file) {
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
}

async function extractFromText(text, url) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "REEMPLAZA_CON_TU_CLAVE",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: "Eres un asistente que extrae datos de anuncios inmobiliarios españoles.\n\nTexto del anuncio:\n" + (text || "") + "\n\nURL: " + (url || "no proporcionada") + "\n\nDevuelve SOLO JSON válido sin markdown ni texto adicional:\n{\"title\":\"\",\"address\":\"\",\"zone\":\"\",\"price\":null,\"size\":null,\"rooms\":null,\"bathrooms\":null,\"trastero\":false,\"garaje\":false,\"terraza\":false,\"distanciaKm\":null,\"comunidad\":null,\"notes\":\"\",\"error\":null}\n\nReglas: price/size solo números sin símbolos, trastero/garaje/terraza true solo si se mencionan explícitamente, notes resumen breve, null si no aparece.",
        }],
      }),
    });
    const data = await res.json();
    const textResponse = data.content?.map(b => b.text || "").join("") || "";
    try {
      return JSON.parse(textResponse.replace(/```json|```/g, "").trim());
    } catch {
      return { error: "No se pudo parsear", title: "", address: "", zone: "", price: null, size: null, rooms: null, bathrooms: null, trastero: false, garaje: false, terraza: false, distanciaKm: null, comunidad: null, notes: "" };
    }
  } catch(err) {
    return { error: "Error: " + err.message, title: "", address: "", zone: "", price: null, size: null, rooms: null, bathrooms: null, trastero: false, garaje: false, terraza: false, distanciaKm: null, comunidad: null, notes: "" };
  }
}

function ScoreChip({pts, size=52}) {
  return <div className="score-chip" style={{color:scoreColor(pts),width:size,height:size,fontSize:size*0.3}}>{pts}</div>;
}

function BreakdownBar({bd}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:7}}>
      {bd.filter(b=>b.weight>0).map(b=>(
        <div key={b.id} style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:12,color:"var(--inkDim)",width:148,flexShrink:0}}>{b.label}</span>
          <div style={{flex:1,height:5,background:"var(--bg2)",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${b.s*100}%`,background:scoreColor(Math.round(b.s*100)),borderRadius:99,transition:"width 0.6s cubic-bezier(0.22,1,0.36,1)"}}/>
          </div>
          <span style={{fontSize:11,color:"var(--inkDim)",width:34,textAlign:"right"}}>{Math.round(b.s*100)}%</span>
          <span style={{fontSize:10,color:"var(--inkFaint)",width:16}}>×{b.weight}</span>
        </div>
      ))}
    </div>
  );
}

function PhotoUploader({photos=[], onChange}) {
  const inputRef=useRef(); const [over,setOver]=useState(false);
  const addFiles=async(files)=>{ const n=await Promise.all(Array.from(files).map(fileToBase64)); onChange([...photos,...n]); };
  const remove=(i)=>onChange(photos.filter((_,idx)=>idx!==i));
  return (
    <div>
      <div className={`drop-zone${over?" over":""}`} onClick={()=>inputRef.current.click()}
        onDragOver={e=>{e.preventDefault();setOver(true)}} onDragLeave={()=>setOver(false)}
        onDrop={e=>{e.preventDefault();setOver(false);addFiles(e.dataTransfer.files)}}>
        📷 Pulsa o arrastra capturas de pantalla aquí
        <input ref={inputRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>addFiles(e.target.files)}/>
      </div>
      {photos.length>0 && (
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
          {photos.map((src,i)=>(
            <div key={i} style={{position:"relative"}}>
              <img src={src} className="photo-thumb" alt=""/>
              <button onClick={()=>remove(i)} style={{position:"absolute",top:-6,right:-6,width:20,height:20,borderRadius:"50%",background:"var(--accent)",color:"white",border:"none",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Lightbox({src, onClose}) {
  useEffect(()=>{ const h=e=>e.key==="Escape"&&onClose(); window.addEventListener("keydown",h); return()=>window.removeEventListener("keydown",h); },[]);
  return <div className="lightbox" onClick={onClose}><img src={src} alt=""/></div>;
}

function PropertyModal({prop, onSave, onClose}) {
  const blank={title:"",url:"",address:"",zone:"",price:"",size:"",rooms:"",bathrooms:"",trastero:false,garaje:false,terraza:false,piscina:false,aireCond:false,certEnergetico:"",tipoInmueble:"",planta:"",orientacion:"",distanciaKm:"",comunidad:"",notes:"",enviadaLaure:false,photos:[]};
  const [form,setForm]=useState(prop?{...prop,photos:prop.photos||[]}:blank);
  const [urlInput,setUrlInput]=useState(prop?.url||"");
  const [pastedText,setPastedText]=useState("");
  const [loading,setLoading]=useState(false);
  const [tab,setTab]=useState(prop?"form":"paste");

  const s=(k,v)=>setForm(f=>({...f,[k]:v}));
  const n=(k,v)=>setForm(f=>({...f,[k]:v===""?"":Number(v)}));

  const doExtract=async()=>{
    if(!pastedText.trim()&&!urlInput.trim()) return;
    setLoading(true);
    const d=await extractFromText(pastedText,urlInput);
    setForm(f=>({...f,...d,url:urlInput||f.url,photos:f.photos}));
    setLoading(false); setTab("form");
  };

  const row2=(children)=><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{children}</div>;
  const field=(lbl,key,ph,type="text")=>(
    <div><label>{lbl}</label>
      <input type={type} value={form[key]??""} onChange={e=>type==="number"?n(key,e.target.value):s(key,e.target.value)} placeholder={ph}/>
    </div>
  );

  return (
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{fontFamily:"Playfair Display",fontSize:22,fontWeight:700}}>{prop?"Editar propiedad":"Nueva propiedad"}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--inkDim)",fontSize:22}}>×</button>
        </div>

        {!prop && (
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            <button className={`tab-btn${tab==="paste"?" active":""}`} onClick={()=>setTab("paste")}>📋 Pegar texto</button>
            <button className={`tab-btn${tab==="form"?" active":""}`} onClick={()=>setTab("form")}>✏ Manual</button>
          </div>
        )}

        {tab==="paste" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><label>URL del anuncio (opcional)</label>
              <input value={urlInput} onChange={e=>setUrlInput(e.target.value)} placeholder="https://idealista.com/inmueble/..."/></div>
            <div><label>Texto del anuncio</label>
              <textarea value={pastedText} onChange={e=>setPastedText(e.target.value)}
                placeholder="Abre el anuncio en Idealista o Fotocasa → pulsa Ctrl+A para seleccionar todo → Ctrl+C para copiar → pégalo aquí con Ctrl+V"
                style={{minHeight:180,resize:"vertical",fontSize:13,lineHeight:1.5}}/></div>
            <div style={{background:"var(--goldSoft)",border:"1px solid #e8d598",borderRadius:8,padding:"10px 13px",fontSize:12,color:"var(--inkMid)"}}>
              💡 <strong>Cómo hacerlo en móvil:</strong> mantén pulsado en el texto del anuncio → "Seleccionar todo" → "Copiar" → vuelve aquí y mantén pulsado en el cuadro de texto → "Pegar"
            </div>
            <button className="btn-primary" onClick={doExtract} disabled={loading||(!pastedText.trim()&&!urlInput.trim())} style={{opacity:loading?0.6:1}}>
              {loading?"Extrayendo datos con IA…":"✨ Extraer datos automáticamente"}
            </button>
          </div>
        )}

        {tab==="form" && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {form.error && <div style={{background:"#fef2f2",border:"1px solid #fccfcf",borderRadius:8,padding:"10px 13px",fontSize:12,color:"var(--accent)"}}>⚠ {form.error} — revisa los datos.</div>}
            {field("Título","title","Ático en San Pedro…")}
            {row2(<>
              <div><label>Tipo de inmueble</label>
                <select value={form.tipoInmueble||""} onChange={e=>s("tipoInmueble",e.target.value)}>
                  <option value="">— Selecciona —</option>
                  {["Piso","Adosado","Dúplex","Ático","Ático-dúplex"].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label>Planta</label>
                <select value={form.planta||""} onChange={e=>s("planta",e.target.value)}>
                  <option value="">— Selecciona —</option>
                  {["Bajo","1ª","2ª","3ª","4ª","5ª","Ático"].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {field("Precio (€)","price","320000","number")}
              {field("Tamaño (m²)","size","90","number")}
              {field("Habitaciones","rooms","3","number")}
              {field("Baños","bathrooms","2","number")}
              {field("Dist. trabajo (km)","distanciaKm","8","number")}
              {field("Comunidad (€/mes)","comunidad","120","number")}
            </>)}
            <div><label>Orientación</label>
              <select value={form.orientacion||""} onChange={e=>s("orientacion",e.target.value)}>
                <option value="">— Selecciona —</option>
                {["Norte","Noreste","Este","Sureste","Sur","Suroeste","Oeste","Noroeste","Norte-Sur","Este-Oeste"].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {field("Dirección","address","C/ ...")}
            {field("Zona / municipio","zone","Marbella, San Pedro…")}
            {field("URL del anuncio","url","https://idealista.com/...")}
            <div><label>Características</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[["trastero","📦 Trastero"],["garaje","🚗 Garaje"],["terraza","🌿 Terraza"],["piscina","🏊 Piscina"],["aireCond","❄️ Aire acond."]].map(([k,lbl])=>(
                  <div key={k} className={`toggle-bool${form[k]?" on":""}`} onClick={()=>s(k,!form[k])}>{form[k]?"✓":"○"} {lbl}</div>
                ))}
              </div>
            </div>
            <div><label>Certificado energético</label>
              <div style={{display:"flex",gap:8}}>
                {["","Sí","En trámite"].map(v=>(
                  <div key={v} className={`toggle-bool${form.certEnergetico===v&&v?" on":""}`} onClick={()=>s("certEnergetico",v)} style={{fontSize:13}}>
                    {v||"No especificado"}
                  </div>
                ))}
              </div>
            </div>
            <div><label>Enviada a Laure</label>
              <div className={`toggle-bool${form.enviadaLaure?" on":""}`} style={{display:"inline-flex"}} onClick={()=>s("enviadaLaure",!form.enviadaLaure)}>
                {form.enviadaLaure?"✓ Enviada a Laure":"○ Pendiente de enviar a Laure"}
              </div>
            </div>
            <div><label>Notas</label>
              <textarea value={form.notes} onChange={e=>s("notes",e.target.value)} placeholder="Observaciones…" style={{minHeight:72,resize:"vertical"}}/></div>
            <div><label>Fotos (capturas de pantalla)</label>
              <PhotoUploader photos={form.photos} onChange={v=>s("photos",v)}/></div>
            <div style={{display:"flex",gap:10,marginTop:4}}>
              <button className="btn-primary" onClick={()=>onSave(form)} style={{flex:1}}>Guardar</button>
              <button className="btn-secondary" onClick={onClose} style={{flex:1}}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CriteriaModal({criteria, onChange, onClose}) {
  const [loc,setLoc]=useState(criteria.map(c=>({...c})));
  const set=(i,k,v)=>setLoc(p=>p.map((c,j)=>j===i?{...c,[k]:v}:c));
  return (
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <h2 style={{fontFamily:"Playfair Display",fontSize:24,fontWeight:700}}>Mis criterios</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--inkDim)",fontSize:22}}>×</button>
        </div>
        <p style={{fontSize:13,color:"var(--inkDim)",marginBottom:22}}>Peso 0 = ignorar · 5 = muy importante.</p>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {loc.map((c,i)=>(
            <div key={c.id} style={{background:"var(--surfaceDim)",borderRadius:10,padding:"14px 16px",border:"1px solid var(--border)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:c.type!=="boolean"?10:0}}>
                <span style={{fontWeight:500,fontSize:14}}>{c.label}</span>
                <div style={{display:"flex",gap:4}}>
                  {[0,1,2,3,4,5].map(w=>(
                    <button key={w} className={`weight-btn${c.weight===w?" active":""}`} onClick={()=>set(i,"weight",w)}>{w}</button>
                  ))}
                </div>
              </div>
              {c.type!=="boolean"&&c.weight>0&&(
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:12,color:"var(--inkDim)"}}>Objetivo:</span>
                  <input type="number" value={c.target} onChange={e=>set(i,"target",Number(e.target.value))} style={{width:110}}/>
                  <span style={{fontSize:12,color:"var(--inkDim)"}}>{c.unit}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={()=>{onChange(loc);onClose();}} style={{width:"100%",marginTop:20}}>Aplicar criterios</button>
      </div>
    </div>
  );
}

function DetailModal({prop, scored, onClose, onEdit, onDelete, onToggleLaure}) {
  const {pts,bd}=scored; const c=scoreColor(pts);
  const [lightbox,setLightbox]=useState(null);
  const photos=prop.photos||[];

  return (
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{maxWidth:600}}>
        {photos.length>0 && (
          <img src={photos[0]} alt="" onClick={()=>setLightbox(photos[0])}
            style={{width:"100%",maxHeight:240,objectFit:"cover",borderRadius:12,marginBottom:16,cursor:"zoom-in"}}/>
        )}
        <div style={{background:"var(--bg2)",borderRadius:12,padding:"20px 22px",marginBottom:18,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:c,opacity:0.06}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1,paddingRight:12}}>
              <h2 style={{fontFamily:"Playfair Display",fontSize:22,fontWeight:700,lineHeight:1.25,marginBottom:4}}>{prop.title}</h2>
              <p style={{color:"var(--inkDim)",fontSize:13}}>{prop.address}{prop.zone?` · ${prop.zone}`:""}</p>
            </div>
            <div style={{textAlign:"center",flexShrink:0}}>
              <ScoreChip pts={pts} size={60}/>
              <div style={{fontSize:10,color:"var(--inkDim)",marginTop:4}}>IDONEIDAD</div>
            </div>
          </div>
          <div style={{marginTop:14,display:"flex",gap:20,flexWrap:"wrap"}}>
            <div>
              {(prop.tipoInmueble||prop.planta)&&<div style={{fontSize:12,color:"var(--inkDim)",marginBottom:4}}>{[prop.tipoInmueble,prop.planta].filter(Boolean).join(" · ")}</div>}
              <div style={{fontFamily:"Playfair Display",fontSize:26,fontWeight:700,color:"var(--accent)"}}>{prop.price?.toLocaleString("es-ES")} €</div>
              {prop.size&&prop.price&&<div style={{fontSize:12,color:"var(--inkDim)"}}>{Math.round(prop.price/prop.size).toLocaleString("es-ES")} €/m²</div>}
            </div>
            <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
              {prop.size&&<div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:600}}>{prop.size}</div><div style={{fontSize:11,color:"var(--inkDim)"}}>m²</div></div>}
              {prop.rooms&&<div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:600}}>{prop.rooms}</div><div style={{fontSize:11,color:"var(--inkDim)"}}>hab.</div></div>}
              {prop.bathrooms&&<div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:600}}>{prop.bathrooms}</div><div style={{fontSize:11,color:"var(--inkDim)"}}>baños</div></div>}
              {prop.distanciaKm!=null&&<div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:600}}>{prop.distanciaKm}</div><div style={{fontSize:11,color:"var(--inkDim)"}}>km trab.</div></div>}
            </div>
          </div>
        </div>

        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
          {prop.tipoInmueble&&<span className="tag" style={{background:"var(--blueSoft)",borderColor:"#93b4e8",color:"var(--blue)"}}>{prop.tipoInmueble}</span>}
          {prop.planta&&<span className="tag">🏢 {prop.planta}</span>}
          {prop.orientacion&&<span className="tag">🧭 {prop.orientacion}</span>}
          {[["trastero","📦 Trastero"],["garaje","🚗 Garaje"],["terraza","🌿 Terraza"],["piscina","🏊 Piscina"],["aireCond","❄️ A/C"]].map(([k,lbl])=>(
            <span key={k} className={`tag ${prop[k]?"yes":"no"}`}>{lbl}</span>
          ))}
          {prop.certEnergetico&&<span className="tag" style={{background:"var(--greenSoft)",borderColor:"#a8d5be",color:"var(--green)"}}>⚡ Cert. {prop.certEnergetico}</span>}
          {prop.comunidad&&<span className="tag">🏢 {prop.comunidad} €/mes</span>}
          <button className={`laure-btn ${prop.enviadaLaure?"sent":"unsent"}`} onClick={()=>onToggleLaure(prop.id)}>
            {prop.enviadaLaure?"✉ Enviada a Laure":"✉ Enviar a Laure"}
          </button>
        </div>

        <div style={{marginBottom:18}}>
          <div style={{fontSize:12,color:"var(--inkDim)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Desglose criterios</div>
          <BreakdownBar bd={bd}/>
        </div>

        {prop.notes&&(
          <div style={{background:"var(--goldSoft)",border:"1px solid #e8d598",borderRadius:10,padding:"12px 14px",fontSize:13,color:"var(--inkMid)",lineHeight:1.6,marginBottom:16}}>
            {prop.notes}
          </div>
        )}

        {photos.length>1&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:"var(--inkDim)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Fotos ({photos.length})</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {photos.map((src,i)=>(
                <img key={i} src={src} className="photo-thumb" alt="" onClick={()=>setLightbox(src)}/>
              ))}
            </div>
          </div>
        )}

        {prop.url&&(
          <a href={prop.url} target="_blank" rel="noreferrer"
            style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:16,color:"var(--blue)",fontSize:13,textDecoration:"none",fontWeight:600,background:"var(--blueSoft)",border:"1.5px solid #93b4e8",borderRadius:9,padding:"10px 0"}}>
            🔗 Ver anuncio original en el portal ↗
          </a>
        )}

        <div style={{display:"flex",gap:10}}>
          <button className="btn-secondary" onClick={()=>onEdit(prop)} style={{flex:1}}>✏ Editar</button>
          <button onClick={()=>{if(window.confirm("¿Eliminar?")){{onDelete(prop.id);onClose();}}}}
            style={{background:"#fef2f2",color:"var(--accent)",border:"1.5px solid #fccfcf",borderRadius:9,padding:"10px 18px",fontSize:14}}>🗑</button>
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
      {lightbox&&<Lightbox src={lightbox} onClose={()=>setLightbox(null)}/>}
    </div>
  );
}

export default function App() {
  const [props,setProps]=useState([]);
  const [criteria,setCriteria]=useState(DEFAULT_CRITERIA);
  const [loaded,setLoaded]=useState(false);
  const [showAdd,setShowAdd]=useState(false);
  const [editing,setEditing]=useState(null);
  const [showCrit,setShowCrit]=useState(false);
  const [detail,setDetail]=useState(null);
  const [sort,setSort]=useState("score");
  const [filter,setFilter]=useState("");

  useEffect(()=>{
    const unsubProps=onSnapshot(collection(db,"properties"),snap=>{
      setProps(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoaded(true);
    });
    const unsubCrit=onSnapshot(doc(db,"config","criteria"),snap=>{
      if(snap.exists()) setCriteria(snap.data().list);
    });
    return()=>{unsubProps();unsubCrit();};
  },[]);

  const saveProperty=async(form)=>{
    const id=editing?editing.id:String(Date.now());
    const p={...form,price:Number(form.price)||0,size:Number(form.size)||0,rooms:Number(form.rooms)||0,bathrooms:Number(form.bathrooms)||0,
      distanciaKm:form.distanciaKm!==""&&form.distanciaKm!=null?Number(form.distanciaKm):null,
      comunidad:form.comunidad!==""&&form.comunidad!=null?Number(form.comunidad):null,
      photos:form.photos||[]};
    delete p.id;
    await setDoc(doc(db,"properties",id),p);
    setShowAdd(false); setEditing(null);
  };

  const deleteProperty=async(id)=>{await deleteDoc(doc(db,"properties",id));};

  const saveCriteria=async(newCrit)=>{
    await setDoc(doc(db,"config","criteria"),{list:newCrit}); setCriteria(newCrit);
  };

  const toggleLaure=async(id)=>{
    const prop=props.find(p=>p.id===id); if(!prop) return;
    const updated={...prop,enviadaLaure:!prop.enviadaLaure}; delete updated.id;
    await setDoc(doc(db,"properties",id),updated);
    setDetail(d=>d&&d.id===id?{...d,enviadaLaure:!d.enviadaLaure}:d);
  };

  const startEdit=(p)=>{setEditing(p);setShowAdd(true);setDetail(null);};
  const scored=props.map(p=>({...p,...score(p,criteria)}));
  const visible=scored
    .filter(p=>!filter||[p.title,p.zone,p.address].join(" ").toLowerCase().includes(filter.toLowerCase()))
    .sort((a,b)=>sort==="score"?b.pts-a.pts:sort==="price"?(a.price||0)-(b.price||0):(b.size||0)-(a.size||0));
  const best=Math.max(0,...scored.map(s=>s.pts));
  const avgPrice=props.length?Math.round(props.reduce((a,b)=>a+(b.price||0),0)/props.length):0;

  if(!loaded) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"var(--inkDim)",fontFamily:"Outfit,sans-serif"}}>
      <div className="pulse">Conectando…</div>
    </div>
  );

  return (
    <>
      <style>{css}</style>
      <div className="header-stripe">
        <div style={{fontFamily:"Playfair Display",fontSize:22,fontWeight:700,color:"white"}}>
          Casa<em style={{color:"#e8a89e",fontStyle:"italic"}}>Finder</em>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span className="live-dot"/><span style={{fontSize:11,color:"#ffffff55"}}>en vivo</span>
        </div>
        <div style={{flex:1}}/>
        <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Buscar…"
          style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"white",padding:"7px 13px",fontSize:13,width:150,outline:"none"}}/>
        <select value={sort} onChange={e=>setSort(e.target.value)}
          style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"white",padding:"7px 10px",fontSize:13,outline:"none"}}>
          <option value="score">Por idoneidad</option>
          <option value="price">Por precio</option>
          <option value="size">Por tamaño</option>
        </select>
        <button onClick={()=>setShowCrit(true)} className="btn-secondary"
          style={{fontSize:13,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.18)",color:"rgba(255,255,255,0.8)"}}>⚙ Criterios</button>
        <button onClick={()=>{setEditing(null);setShowAdd(true);}} className="btn-primary">+ Añadir</button>
      </div>

      <div style={{padding:"16px 28px",display:"flex",gap:12,flexWrap:"wrap",borderBottom:"1px solid var(--border)"}}>
        {[["Propiedades",props.length],["Mejor puntuación",best+" / 100"],["Precio medio",avgPrice?avgPrice.toLocaleString("es-ES")+" €":"—"],["Enviadas a Laure",props.filter(p=>p.enviadaLaure).length+" de "+props.length]].map(([lbl,val])=>(
          <div key={lbl} className="stat-pill">
            <div style={{fontSize:11,color:"var(--inkDim)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:3}}>{lbl}</div>
            <div style={{fontFamily:"Playfair Display",fontSize:20,fontWeight:500}}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{padding:"24px 28px",display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(290px, 1fr))",gap:16}}>
        {visible.map((p,i)=>{
          const isBest=p.pts===best&&best>0; const photos=p.photos||[];
          return (
            <div key={p.id} className="prop-card card-enter"
              style={{animationDelay:`${i*0.05}s`,borderColor:isBest?"#c0392b33":undefined}}
              onClick={()=>setDetail(p)}>
              {isBest&&<div style={{position:"absolute",top:14,right:14,background:"var(--accent)",color:"white",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:600}}>★ TOP</div>}

              {photos.length>0&&(
                <img src={photos[0]} alt="" style={{width:"100%",height:120,objectFit:"cover",borderRadius:8,marginBottom:12}}/>
              )}

              <div style={{display:"flex",alignItems:"flex-start",gap:13,marginBottom:12}}>
                <ScoreChip pts={p.pts}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"Playfair Display",fontWeight:600,fontSize:15,lineHeight:1.25,marginBottom:3,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{p.title}</div>
                  <div style={{color:"var(--inkDim)",fontSize:12}}>{p.zone||p.address}</div>
                </div>
              </div>

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:12}}>
                <div>
                  <div style={{fontFamily:"Playfair Display",fontSize:22,fontWeight:700,color:"var(--accent)",lineHeight:1}}>{p.price?.toLocaleString("es-ES")} €</div>
                  <div style={{fontSize:12,color:"var(--inkDim)",marginTop:2}}>{p.size?p.size+" m²":""}{p.size&&p.rooms?" · ":""}{p.rooms?p.rooms+" hab.":""}</div>
                </div>
                {p.distanciaKm!=null&&<div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:600}}>{p.distanciaKm} km</div><div style={{fontSize:11,color:"var(--inkDim)"}}>al trabajo</div></div>}
              </div>

              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                {p.tipoInmueble&&<span className="tag" style={{background:"var(--blueSoft)",borderColor:"#93b4e8",color:"var(--blue)",fontSize:11}}>{p.tipoInmueble}</span>}
                {p.planta&&<span className="tag" style={{fontSize:11}}>{p.planta}</span>}
                {[["trastero","📦"],["garaje","🚗"],["terraza","🌿"],["piscina","🏊"],["aireCond","❄️"]].map(([k,e])=>p[k]?<span key={k} className="tag yes">{e}</span>:null)}
              </div>

              <div style={{marginBottom:10}} onClick={e=>{e.stopPropagation();toggleLaure(p.id);}}>
                <button className={`laure-btn ${p.enviadaLaure?"sent":"unsent"}`} style={{fontSize:11}}>
                  {p.enviadaLaure?"✉ Enviada a Laure":"✉ Pendiente · enviar a Laure"}
                </button>
              </div>

              <div style={{display:"flex",gap:3,height:4}}>
                {p.bd.filter(b=>b.weight>0).map(b=>(
                  <div key={b.id} title={b.label+": "+Math.round(b.s*100)+"%"}
                    style={{flex:b.weight,borderRadius:2,background:scoreColor(Math.round(b.s*100)),opacity:0.65}}/>
                ))}
              </div>
            </div>
          );
        })}
        {visible.length===0&&(
          <div style={{gridColumn:"1/-1",textAlign:"center",padding:"72px 0",color:"var(--inkDim)"}}>
            <div style={{fontFamily:"Playfair Display",fontSize:48,marginBottom:12}}>🏠</div>
            <div style={{fontSize:16,fontWeight:500,marginBottom:6}}>Sin propiedades todavía</div>
            <div style={{fontSize:13}}>Pulsa "+ Añadir" para empezar.</div>
          </div>
        )}
      </div>

      {showAdd&&<PropertyModal prop={editing} onSave={saveProperty} onClose={()=>{setShowAdd(false);setEditing(null);}}/>}
      {showCrit&&<CriteriaModal criteria={criteria} onChange={saveCriteria} onClose={()=>setShowCrit(false)}/>}
      {detail&&<DetailModal prop={detail} scored={score(detail,criteria)} onClose={()=>setDetail(null)} onEdit={startEdit} onDelete={deleteProperty} onToggleLaure={toggleLaure}/>}
    </>
  );
}
