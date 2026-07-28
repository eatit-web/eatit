export default async function handler(req, res) {
    // Intestazioni CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    try {
        const userIngredients = req.body && req.body.ingredients ? req.body.ingredients : "frigo generico";
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error("Chiave API mancante (GEMINI_API_KEY)");
        }

        const prompt = `Sei uno chef professionista di cucina creativa e svuota-frigo. Genera esattamente 3 ricette originali e appetitose in lingua italiana basate su questi ingredienti: "${userIngredients}". 
        Rispondi ESCLUSIVAMENTE in formato JSON valido, strutturato con una chiave principale "recipes" che contiene un array di 3 oggetti. Ciascun oggetto deve avere esattamente queste chiavi: "title" (stringa), "time" (stringa, es. '15 min'), "difficulty" (stringa, es. 'Facile'), e "instructions" (stringa con i passaggi dettagliati). Non aggiungere altro testo fuori dal JSON.`;

        // Chiamata diretta all'API di Gemini senza librerie esterne
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!response.ok) {
            const errData = await response.text();
            throw new Error(`Errore Server Gemini: ${errData}`);
        }

        const data = await response.json();
        const rawContent = data.candidates[0].content.parts[0].text;
        const parsedData = JSON.parse(rawContent);
        
        // Estrazione array ricette
        let recipesArray = [];
        if (Array.isArray(parsedData)) {
            recipesArray = parsedData;
        } else if (parsedData.recipes && Array.isArray(parsedData.recipes)) {
            recipesArray = parsedData.recipes;
        } else {
            const foundKey = Object.keys(parsedData).find(k => Array.isArray(parsedData[k]));
            recipesArray = foundKey ? parsedData[foundKey] : [];
        }

        return res.status(200).json({ recipes: recipesArray });

    } catch (error) {
        console.error("Errore critico con Gemini:", error);
        return res.status(500).json({ 
            error: "Errore interno durante la generazione delle ricette.",
            details: error.message 
        });
    }
}
