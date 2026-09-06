export default async function handler(req, res) {
    // 1. Security Check: Allow Netlify, Localhost (for testing), and Sandbox origins
    const origin = req.headers.origin || "*"; // Fallback to * if no origin header is present
    
    const isAllowedOrigin = 
        origin === "*" || 
        origin.endsWith('netlify.app') || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        origin.includes('googleusercontent'); // Allows standard IDE sandboxes

    if (!isAllowedOrigin) {
        return res.status(403).json({ 
            error: { message: "Unauthorized: Requests must originate from a trusted domain." } 
        });
    }

    // 2. Handle CORS dynamically for the allowed origin
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Respond successfully to CORS preflight checks
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'No code provided.' });
    }

    // Extract the requested model from the frontend, if provided
    const { model } = req.body;

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Ensure this is set in your Vercel Environment Variables
    
    // Dynamic Model Selection:
    // 1. Uses what the frontend requests. 
    // 2. Falls back to a Vercel Environment Variable (GEMINI_MODEL) if set.
    // 3. Defaults to 'gemini-3.6-flash' if neither is provided.
    const selectedModel = model || process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${GEMINI_API_KEY}`;

    const systemInstruction = `You are a strict compiler that translates Cambridge International AS & A Level (9618) / IGCSE (0478) Pseudocode into executable JavaScript.
Your task is to translate the pseudocode into equivalent asynchronous JavaScript logic.

RULES FOR TRANSLATION:
1. OUTPUT: Translate 'OUTPUT "x is ", x' to '__output("x is ", x);'. 
2. INPUT: Translate 'INPUT varName' to 'varName = await __input(); __updateVar("varName", varName);'.
   - Attempt to parse inputs as numbers if logically appropriate, otherwise keep as string.
3. VARIABLES: Declare ALL variables using 'let'. After EVERY declaration AND assignment, you MUST call '__updateVar("varName", varName);'.
4. LOOPS (CRITICAL): Inside EVERY loop structure (FOR, WHILE, REPEAT), the very first line inside the loop MUST be 'await __delay(10);'.
5. FOR LOOPS: 'FOR x <- 1 TO 5' becomes 'for(let x = 1; x <= 5; x++) { __updateVar("x", x); await __delay(10); ... }'.
6. REPEAT LOOPS: 'REPEAT ... UNTIL x = 5' becomes 'do { await __delay(10); ... } while(x !== 5);'
7. NO WRAPPER: Return ONLY the raw JavaScript logic. Do NOT wrap it in a function.

You MUST return a JSON object with this schema:
{
    "status": "success" | "error",
    "js_code": "The raw translated JavaScript logic (if status is success)",
    "error": { 
        "line": 1, // Integer line number of syntax error
        "message": "Clear, concise explanation of error for a student"
    }
}`;

    const payload = {
        system_instruction: {
            parts: [{ text: systemInstruction }]
        },
        contents: [{
            role: "user",
            parts: [{ text: `Translate this pseudocode to JS:\n\n${code}` }]
        }],
        generationConfig: {
            // Forcing JSON mode ensures the LLM will never wrap output in markdown ```json blocks
            response_mime_type: "application/json" 
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Gemini API Error:", data);
            return res.status(500).json({ status: "error", error: { message: "Failed to communicate with AI compiler." } });
        }

        const jsonText = data.candidates[0].content.parts[0].text;
        
        // Because we forced JSON mode, we can safely parse directly
        const parsedResult = JSON.parse(jsonText);
        
        return res.status(200).json(parsedResult);

    } catch (error) {
        console.error('Compiler proxy error:', error);
        return res.status(500).json({ 
            status: "error", 
            error: { message: `Server error: ${error.message}` } 
        });
    }
}
