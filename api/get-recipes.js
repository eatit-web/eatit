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

        // Prompt ottimizzato per ricette veloci e svuota-frigo pratiche
        const prompt = `Sei un assistente di cucina veloce e pratico per chi deve svuotare il frigo.
Genera esattamente 3 ricette veloci, semplici e gustose in italiano usando principalmente questi ingredienti: "${userIngredients}".

REGOLE FONDAMENTALI:
1. Le ricette devono essere VELOCI (tempo totale massimo 15-20 minuti) e facilissime da preparare.
2. Evita procedimenti lunghi, cotture al forno complesse o tecniche elaborate.
3. Rispondi ESCLUSIVAMENTE con un oggetto JSON valido contenente una chiave "recipes" che ha come valore un array di 3 oggetti.

Ogni oggetto deve contenere:
- "title": il nome accattivante della ricetta
- "time": tempo di preparazione espresso (es. "10 min", "15 min")
- "difficulty": deve essere "Facile" o "Molto facile"
- "instructions": procedimento passo passo chiaro e sintetico

Non aggiungere altro testo, nessun blocco markdown prima o dopo, solo il JSON puro.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey.trim()}`;
        
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
