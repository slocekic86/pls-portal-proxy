export default async function handler(req, res) {
    // 1. Security Check: Only allow requests from Netlify domains
    const origin = req.headers.origin;
    
    // If there is no origin, or if it doesn't end with netlify.app, block it.
    if (!origin || !origin.endsWith('netlify.app')) {
        return res.status(403).json({ 
            error: { message: "Unauthorized: Requests must originate from a trusted Netlify domain." } 
        });
    }

    // 2. Handle CORS dynamically for the verified Netlify origin
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', origin); // Uses the specific netlify app URL instead of '*'
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Respond successfully to CORS preflight checks
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Ensure you have this environment variable saved in your Vercel Dashboard!
        const apiKey = process.env.GEMINI_API_KEY; 
        
        // Default model for the REST API
        const model = "gemini-3.6-flash"; 
        
        let payload = req.body;

        // 3. Compatibility check: 
        // If the request comes from the 'PLS Staff Portal', it only has a { prompt: "..." }.
        // We must reformat it to match the standard Gemini REST structure.
        if (payload.prompt && !payload.contents) {
            payload = {
                contents: [{
                    role: "user",
                    parts: [{ text: payload.prompt }]
                }]
            };
        }
        
        // (If the request comes from the Exam Generator, it already has payload.contents and is ready to go!)

        // 4. Forward the standard payload directly to Google's REST API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // 5. Send the response back to your frontend
        const data = await response.json();
        res.status(response.status).json(data);

    } catch (error) {
        console.error("Vercel Proxy Error:", error);
        res.status(500).json({ error: { message: error.message || "Internal Server Error" } });
    }
}
