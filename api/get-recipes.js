export default async function handler(req, res) {
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

        const prompt = `Sei uno chef professionista di cucina creativa. Genera esattamente 3 ricette originali in italiano basate su questi ingredienti: "${userIngredients}".
Rispondi ESCLUSIVAMENTE con un oggetto JSON valido contenente una chiave "recipes" che ha come valore un array di 3 oggetti.
Ogni oggetto deve contenere:
- "title": il nome della ricetta
- "time": tempo di preparazione (es. "20 min")
- "difficulty": difficoltà (es. "Facile")
- "instructions": procedimento passo passo

Non aggiungere altro testo, nessun blocco markdown prima o dopo, solo il JSON puro.`;

        // Modello aggiornato a gemini-2.0-flash
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.trim()}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt }
                        ]
                    }
                ]
            })
        });

        const responseText = await response.text();

        if (!response.ok) {
            console.error("Risposta Errore da Google:", responseText);
            throw new Error(`Errore Server Gemini (${response.status}): ${responseText}`);
        }

        const data = JSON.parse(responseText);
        let rawContent = data.candidates[0].content.parts[0].text;
        
        // Pulizia da eventuali tag markdown ```json
        rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const parsedData = JSON.parse(rawContent);
        
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
        console.error("Dettaglio Errore:", error.message);
        return res.status(500).json({ 
            error: "Errore interno durante la generazione delle ricette.",
            details: error.message 
        });
    }
}
