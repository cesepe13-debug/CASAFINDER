export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text, url } = req.body || {};
  if (!text && !url) return res.status(400).json({ error: "Se requiere texto o URL" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key no configurada" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Eres un asistente que extrae datos de anuncios inmobiliarios españoles.\n\nTexto del anuncio:\n${text || ""}\n\nURL: ${url || "no proporcionada"}\n\nDevuelve SOLO JSON válido sin markdown:\n{"title":"","address":"","zone":"","price":null,"size":null,"rooms":null,"bathrooms":null,"trastero":false,"garaje":false,"terraza":false,"distanciaKm":null,"comunidad":null,"notes":"","error":null}\n\nReglas: price/size solo números, trastero/garaje/terraza true solo si se mencionan explícitamente, notes resumen breve, null si no aparece.`
        }],
      }),
    });

    const data = await response.json();
    const textResponse = data.content?.map(b => b.text || "").join("") || "";

    try {
      const parsed = JSON.parse(textResponse.replace(/```json|```/g, "").trim());
      return res.status(200).json(parsed);
    } catch {
      return res.status(200).json({ error: "No se pudo parsear", title: "", address: "", zone: "", price: null, size: null, rooms: null, bathrooms: null, trastero: false, garaje: false, terraza: false, distanciaKm: null, comunidad: null, notes: "" });
    }
  } catch (err) {
    return res.status(500).json({ error: "Error: " + err.message });
  }
}
