export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    const { ingredients } = req.body;

    if (!ingredients) {
        return res.status(400).json({ error: 'Nessun ingrediente fornito' });
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'Sei uno chef esperto di cucina svuota-frigo. Restituisci esattamente 3 ricette basate sugli ingredienti forniti dall\'utente. Fornisci la risposta in formato JSON con una chiave "recipes" che contiene un array di 3 oggetti. Ogni oggetto deve avere: title, time, difficulty, description.'
                    },
                    {
                        role: 'user',
                        content: `Ecco gli ingredienti disponibili: ${ingredients}`
                    }
                ],
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        
        if (!data.choices || !data.choices[0]) {
            throw new Error('Risposta non valida da OpenAI');
        }

        const recipes = JSON.parse(data.choices[0].message.content);

        return res.status(200).json(recipes);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Errore durante la generazione delle ricette' });
    }
}
