export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  
  // 1. Check if the origin is allowed
  const isAllowedOrigin = origin.endsWith(".netlify.app") || origin.startsWith("http://localhost");
  const corsOrigin = isAllowedOrigin ? origin : "https://forbidden.local";

  // Handle CORS preflight
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 2. Block unapproved origins
  if (!isAllowedOrigin) {
    return res.status(403).json({ error: { message: "Forbidden: Access Denied" } });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method Not Allowed" } });
  }

  try {
    const { prompt } = req.body;
    
    // Call Google Gemini API directly using the dynamic "gemini-flash" alias
    // This will always route to the latest stable Flash model automatically.
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await geminiResponse.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}
