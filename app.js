// WOD → Balance — app.js
// Logica applicativa, provider AI, validazione e rendering sicuro.

(function (global) {
  'use strict';

  // --- COSTANTI E CONFIGURAZIONE PREDEFINITA ---
  const DEFAULT_SYSTEM_PROMPT = `Sei un traduttore di allenamenti per Amazfit Balance (versione originale). Ricevi uno o più screenshot del WOD del giorno (CrossFit, allenamenti ibridi) e alcune opzioni dell'utente. Devi produrre un piano pratico per usare l'orologio, restituito come JSON.

REGOLE DI LETTURA
1. Leggi tutto lo screenshot: titolo, formato, riscaldamento, blocchi di forza, WOD, note del coach. Non inventare esercizi, serie, distanze o carichi che non vedi.
2. Se qualcosa è ambiguo o contraddittorio (per esempio il titolo dice For Time ma il corpo descrive un AMRAP), segui il corpo del testo e scrivi la tua ipotesi in "assunzioni".
3. Riporta i carichi come scritti. Se l'utente chiede "converti lb in kg", converti con 1 lb = 0,4536 kg arrotondando a 0,5 kg e scrivi l'ipotesi in "assunzioni". Una scrittura come "2x50/35" indica due manubri, valori maschile/femminile.
4. Rispondi in italiano, frasi brevi, verbi all'imperativo per le azioni.

VINCOLI DELL'OROLOGIO
5. Un'attività dell'orologio è una sola modalità sport. Non esiste il cambio sport durante la sessione. Se il WOD richiede modalità diverse, proponi attività separate, nell'ordine di esecuzione.
6. Usa solo le modalità elencate nelle opzioni ("Nomi modalità dell'orologio"). Non inventarne altre.
7. Mappatura: riscaldamento a corpo libero → modalità corpo libero (obbligatoria: false). Blocchi di forza con serie e ripetizioni → modalità Forza. WOD che contiene corsa → modalità corsa all'aperto oppure su tapis, secondo l'opzione, con lap manuali. WOD senza corsa → Forza se prevalgono bilanciere o manubri, altrimenti corpo libero. Defaticamento → corpo libero, obbligatoria: false.
8. Il lap manuale si fa col tasto basso dell'orologio. Raggruppa le stazioni consecutive senza corsa in un solo lap. Ogni tratto di corsa ha il suo lap. Il lap si preme a fine del segmento.
9. Formati: AMRAP → schema dei lap per un giro, i giri li conta l'utente. For Time → un lap per segmento principale. EMOM o "ogni X minuti" → se possibile usa l'Allenamento a intervalli dell'orologio (lavoro, riposo, numero di giri) e dillo in "note"; in alternativa un lap a ogni intervallo. Non dire che l'Allenamento a intervalli è sicuramente disponibile: scrivi "se disponibile per la modalità".
10. Opzione rest: "come da screenshot" → aggiungi un lap di riposo dove il testo lo prevede. "nessun rest (sincro col compagno)" → nessun lap di riposo; spiega in "note" che il recupero avviene mentre lavora il compagno.
11. Per AMRAP e intervalli con stazioni da fermo indica sempre in "preparazione": auto-lap spento, auto-pausa spenta.

LIMITI DA DIRE CON ONESTÀ
12. Le calorie non sono disponibili per singolo esercizio: solo per attività. Per lap non garantite. Il passo vale solo sui lap di corsa; sui lap di forza e trasporti ignora la distanza GPS. Scrivilo in "lettura_dati" e "limiti".
13. Non promettere invio all'orologio, sincronizzazioni o funzioni che non conosci. Se non sei sicuro che un esercizio sia riconosciuto dalla modalità Forza, dillo nelle note ("se non è riconosciuto, conta le serie a mano").

FORMATO DI USCITA
14. Rispondi SOLO con un oggetto JSON valido, senza markdown, senza testo prima o dopo. Schema:
{
  "titolo": string,
  "formato": "AMRAP" | "For Time" | "EMOM" | "Misto" | "Altro",
  "durata_totale_min": number | null,
  "riepilogo": string,
  "assunzioni": [string],
  "attivita": [
    {
      "nome": string,
      "modalita_orologio": string,
      "tipo_modalita": "corpo_libero" | "forza" | "corsa" | "altro",
      "obbligatoria": boolean,
      "preparazione": [string],
      "esercizi": [string],
      "schema_lap": [string],
      "lap_per_giro": number | null,
      "note": [string]
    }
  ],
  "lettura_dati": [string],
  "limiti": [string]
}
15. "schema_lap" è l'elenco ordinato delle pressioni del tasto lap per un giro. Se l'attività non usa lap, array vuoto e "lap_per_giro" null.`;

  const DEFAULT_MODE_NAMES = [
    'Esercizi a corpo libero',
    'Forza',
    'Corsa all\'aperto',
    'Corsa su tapis'
  ];

  const DEFAULT_MODELS = {
    'gemini': 'gemini-3.5-flash-lite',
    'openai-responses': 'gpt-4o-mini',
    'openai-chat': 'gpt-4o-mini',
    'compat-chat': ''
  };

  const DEFAULT_SUGGESTIONS = {
    'gemini': [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-3-flash',
      'gemini-3.8-flash-lite',
      'gemini-2.0-flash'
    ],
    'openai-responses': [
      'gpt-4o-mini',
      'gpt-4o',
      'o3-mini',
      'gpt-5-codex',
      'gpt-5-mini'
    ],
    'openai-chat': [
      'gpt-4o-mini',
      'gpt-4o',
      'o3-mini',
      'gpt-5-mini'
    ],
    'compat-chat': []
  };

  const DEFAULT_BASE_URLS = {
    'openai': 'https://api.openai.com/v1',
    'compat': ''
  };

  // --- FUNZIONI PURE E TESTABILI (Sezione 16.2) ---

  /**
   * Costruisce il messaggio utente standardizzato (Sezione 8.2).
   */
  function buildUserMessage(options) {
    const corsaLabel = options && options.corsa === 'tapis' ? 'su tapis' : 'all\'aperto';
    const restLabel = options && options.rest === 'sincro' ? 'nessun rest (sincro col compagno)' : 'come da screenshot';
    const carichiLabel = options && options.carichi === 'converti' ? 'converti lb in kg' : 'come scritti';
    
    let modes = DEFAULT_MODE_NAMES;
    if (options && Array.isArray(options.modeNames) && options.modeNames.length > 0) {
      modes = options.modeNames;
    }
    const modeListStr = modes.join(', ');

    const noteText = options && options.note && options.note.trim() ? options.note.trim() : 'nessuna';
    const shotsCount = (options && typeof options.shotsCount === 'number') ? options.shotsCount : 1;

    return `Opzioni utente:
- Corsa: ${corsaLabel}
- Rest: ${restLabel}
- Carichi: ${carichiLabel}
- Nomi modalità dell'orologio: ${modeListStr}
- Note: ${noteText}
Allegati: ${shotsCount} screenshot. Produci il JSON richiesto.`;
  }

  /**
   * Costruisce la richiesta HTTP per il provider specificato (Sezioni 8.3, 8.4, 8.5).
   * La chiave API non viene mai inserita nell'URL per Gemini.
   */
  function buildRequest(provider, config) {
    const {
      apiKey,
      model,
      baseUrl,
      systemPrompt,
      userMessage,
      imagesBase64 = [],
      skipResponseFormat = false
    } = config;

    const sysPrompt = (systemPrompt && systemPrompt.trim()) ? systemPrompt.trim() : DEFAULT_SYSTEM_PROMPT;

    if (provider === 'gemini') {
      const cleanModel = (model || DEFAULT_MODELS.gemini).replace(/^models\//, '');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent`;
      const headers = {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey || ''
      };

      const parts = [{ text: userMessage }];
      for (const b64 of imagesBase64) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: b64
          }
        });
      }

      const genConfig = {
        responseMimeType: 'application/json',
        temperature: 0.2
      };
      if (cleanModel.startsWith('gemini-3')) {
        genConfig.thinkingConfig = {
          thinkingLevel: 'low'
        };
      }

      const bodyObj = {
        systemInstruction: {
          parts: [{ text: sysPrompt }]
        },
        contents: [{
          role: 'user',
          parts: parts
        }],
        generationConfig: genConfig
      };

      return {
        url,
        method: 'POST',
        headers,
        body: JSON.stringify(bodyObj)
      };
    }

    if (provider === 'openai-responses') {
      const base = (baseUrl || DEFAULT_BASE_URLS.openai).replace(/\/+$/, '');
      const url = `${base}/responses`;
      const headers = {
        'Authorization': `Bearer ${apiKey || ''}`,
        'Content-Type': 'application/json'
      };

      const content = [{ type: 'input_text', text: userMessage }];
      for (const b64 of imagesBase64) {
        content.push({
          type: 'input_image',
          image_url: `data:image/jpeg;base64,${b64}`
        });
      }

      const bodyObj = {
        model: model || DEFAULT_MODELS['openai-responses'],
        instructions: sysPrompt,
        input: [{
          role: 'user',
          content: content
        }],
        text: { format: { type: 'json_object' } }
      };

      return {
        url,
        method: 'POST',
        headers,
        body: JSON.stringify(bodyObj)
      };
    }

    if (provider === 'openai-chat' || provider === 'compat-chat') {
      const defaultBase = provider === 'compat-chat' ? '' : DEFAULT_BASE_URLS.openai;
      const base = (baseUrl || defaultBase).replace(/\/+$/, '');
      const url = `${base}/chat/completions`;
      const headers = {
        'Authorization': `Bearer ${apiKey || ''}`,
        'Content-Type': 'application/json'
      };

      const userContent = [{ type: 'text', text: userMessage }];
      for (const b64 of imagesBase64) {
        userContent.push({
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${b64}` }
        });
      }

      const bodyObj = {
        model: model || DEFAULT_MODELS[provider] || 'gpt-5-mini',
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: userContent }
        ]
      };

      if (!skipResponseFormat) {
        bodyObj.response_format = { type: 'json_object' };
      }

      return {
        url,
        method: 'POST',
        headers,
        body: JSON.stringify(bodyObj)
      };
    }

    throw new Error(`Provider non riconosciuto: ${provider}`);
  }

  /**
   * Estrae il testo grezzo della risposta dal payload restituito dal provider.
   */
  function extractText(provider, responseData) {
    if (!responseData) {
      throw new Error('Risposta vuota ricevuta dal provider.');
    }

    if (provider === 'gemini') {
      if (!responseData.candidates || responseData.candidates.length === 0) {
        const reason = responseData.promptFeedback && responseData.promptFeedback.blockReason;
        if (reason) {
          throw new Error(`Il provider ha bloccato la richiesta: ${reason}`);
        }
        throw new Error('Nessun candidato generato nella risposta di Gemini.');
      }
      const candidate = responseData.candidates[0];
      if (!candidate.content || !Array.isArray(candidate.content.parts)) {
        throw new Error('Struttura dei contenuti non valida nella risposta di Gemini.');
      }
      return candidate.content.parts.map(p => p.text || '').join('');
    }

    if (provider === 'openai-responses') {
      if (responseData.output && Array.isArray(responseData.output)) {
        const texts = [];
        for (const item of responseData.output) {
          if (item && item.type === 'message' && Array.isArray(item.content)) {
            for (const c of item.content) {
              if (c && c.type === 'output_text' && typeof c.text === 'string') {
                texts.push(c.text);
              }
            }
          }
        }
        if (texts.length > 0) {
          return texts.join('');
        }
      }
      // Se non trovato in output, verifica eventuale messaggio di errore
      if (responseData.error) {
        throw new Error(responseData.error.message || 'Errore restituito da OpenAI Responses.');
      }
      throw new Error('Nessun testo output_text trovato nella risposta di OpenAI Responses.');
    }

    if (provider === 'openai-chat' || provider === 'compat-chat') {
      if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
        const content = responseData.choices[0].message.content;
        if (typeof content === 'string') {
          return content;
        }
      }
      if (responseData.error) {
        throw new Error(responseData.error.message || 'Errore restituito dal provider chat.');
      }
      throw new Error('Nessun contenuto di messaggio trovato nella risposta chat.');
    }

    throw new Error(`Provider sconosciuto per estrazione testo: ${provider}`);
  }

  /**
   * Estrae e parsa l'oggetto JSON dalla stringa restituita dal modello (Sezione 8.6).
   */
  function parseModelJson(rawText) {
    if (typeof rawText !== 'string') {
      throw new Error('Il testo del modello non è una stringa.');
    }

    let text = rawText.trim();

    // Rimuove eventuali recinti di codice markdown (es. ```json ... ``` o ``` ... ```)
    text = text.replace(/^```(?:json)?\s*\n?/i, '');
    text = text.replace(/\n?```\s*$/i, '');

    // Cerca la sottostringa compresa tra la prima { e l'ultima }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('Nessun blocco JSON trovato nella risposta del modello.');
    }

    const jsonSub = text.substring(firstBrace, lastBrace + 1);
    return JSON.parse(jsonSub);
  }

  /**
   * Valida e normalizza l'oggetto della scheda contro lo schema della Sezione 10.
   */
  function validatePlan(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('I dati della scheda devono essere un oggetto valido.');
    }

    const allowedFormats = ['AMRAP', 'For Time', 'EMOM', 'Misto', 'Altro'];
    let formato = 'Altro';
    if (typeof data.formato === 'string') {
      const match = allowedFormats.find(f => f.toLowerCase() === data.formato.trim().toLowerCase());
      formato = match || 'Altro';
    }

    let durata = null;
    if (typeof data.durata_totale_min === 'number' && !isNaN(data.durata_totale_min)) {
      durata = data.durata_totale_min;
    } else if (typeof data.durata_totale_min === 'string') {
      const parsed = parseInt(data.durata_totale_min, 10);
      if (!isNaN(parsed)) durata = parsed;
    }

    const titolo = typeof data.titolo === 'string' ? data.titolo.trim() : 'Allenamento';
    const riepilogo = typeof data.riepilogo === 'string' ? data.riepilogo.trim() : '';

    const assunzioni = Array.isArray(data.assunzioni)
      ? data.assunzioni.map(String).map(s => s.trim()).filter(Boolean)
      : [];

    if (!Array.isArray(data.attivita) || data.attivita.length === 0) {
      throw new Error('La scheda deve contenere almeno un\'attività (campo "attivita" mancante o vuoto).');
    }

    const allowedTipos = ['corpo_libero', 'forza', 'corsa'];
    const attivita = data.attivita.map((a, idx) => {
      if (!a || typeof a !== 'object') {
        throw new Error(`Attività all'indice ${idx} non valida.`);
      }

      const nome = typeof a.nome === 'string' && a.nome.trim() ? a.nome.trim() : `Attività ${idx + 1}`;
      const modalita_orologio = typeof a.modalita_orologio === 'string' && a.modalita_orologio.trim()
        ? a.modalita_orologio.trim()
        : 'Esercizi a corpo libero';

      let tipo_modalita = 'altro';
      if (typeof a.tipo_modalita === 'string') {
        const cleanTipo = a.tipo_modalita.trim().toLowerCase();
        if (allowedTipos.includes(cleanTipo)) {
          tipo_modalita = cleanTipo;
        }
      }

      const obbligatoria = a.obbligatoria !== false;

      const preparazione = Array.isArray(a.preparazione)
        ? a.preparazione.map(String).map(s => s.trim()).filter(Boolean)
        : [];

      const esercizi = Array.isArray(a.esercizi)
        ? a.esercizi.map(String).map(s => s.trim()).filter(Boolean)
        : [];

      const schema_lap = Array.isArray(a.schema_lap)
        ? a.schema_lap.map(String).map(s => s.trim()).filter(Boolean)
        : [];

      let lap_per_giro = null;
      if (typeof a.lap_per_giro === 'number' && !isNaN(a.lap_per_giro)) {
        lap_per_giro = a.lap_per_giro;
      } else if (typeof a.lap_per_giro === 'string') {
        const p = parseInt(a.lap_per_giro, 10);
        if (!isNaN(p)) lap_per_giro = p;
      }

      const note = Array.isArray(a.note)
        ? a.note.map(String).map(s => s.trim()).filter(Boolean)
        : [];

      return {
        nome,
        modalita_orologio,
        tipo_modalita,
        obbligatoria,
        preparazione,
        esercizi,
        schema_lap,
        lap_per_giro,
        note
      };
    });

    const lettura_dati = Array.isArray(data.lettura_dati)
      ? data.lettura_dati.map(String).map(s => s.trim()).filter(Boolean)
      : [];

    const limiti = Array.isArray(data.limiti)
      ? data.limiti.map(String).map(s => s.trim()).filter(Boolean)
      : [];

    return {
      titolo,
      formato,
      durata_totale_min: durata,
      riepilogo,
      assunzioni,
      attivita,
      lettura_dati,
      limiti
    };
  }

  /**
   * Converte la scheda validata in un formato testuale leggibile e copiabile (Sezione 11).
   */
  function planToText(plan) {
    const lines = [];

    let header = plan.titolo;
    if (plan.formato) {
      header += ` — ${plan.formato}`;
    }
    if (plan.durata_totale_min) {
      header += ` (${plan.durata_totale_min} min)`;
    }
    lines.push(header);
    lines.push('='.repeat(Math.min(header.length, 40)));

    if (plan.riepilogo) {
      lines.push('');
      lines.push(plan.riepilogo);
    }

    if (plan.assunzioni && plan.assunzioni.length > 0) {
      lines.push('');
      lines.push('ASSUNZIONI:');
      for (const ass of plan.assunzioni) {
        lines.push(`• ${ass}`);
      }
    }

    if (plan.attivita && plan.attivita.length > 0) {
      lines.push('');
      lines.push('ATTIVITÀ PER L\'OROLOGIO:');

      plan.attivita.forEach((act, idx) => {
        lines.push('');
        let actTitle = `${idx + 1}. ${act.nome} (${act.modalita_orologio})`;
        if (!act.obbligatoria) {
          actTitle += ' [Opzionale]';
        }
        lines.push(actTitle);

        if (act.preparazione && act.preparazione.length > 0) {
          lines.push('  Prima di avviare:');
          for (const prep of act.preparazione) {
            lines.push(`  - [ ] ${prep}`);
          }
        }

        if (act.esercizi && act.esercizi.length > 0) {
          lines.push('  Esercizi:');
          for (const es of act.esercizi) {
            lines.push(`  • ${es}`);
          }
        }

        if (act.schema_lap && act.schema_lap.length > 0) {
          if (act.lap_per_giro) {
            lines.push(`  Lap (${act.lap_per_giro} lap per giro):`);
          } else {
            lines.push('  Lap:');
          }
          act.schema_lap.forEach((lap, lapIdx) => {
            lines.push(`  ${lapIdx + 1}. ${lap}`);
          });
          if (plan.formato === 'AMRAP') {
            lines.push('  ↳ Poi ricomincia dal lap 1');
          }
        }

        if (act.note && act.note.length > 0) {
          lines.push('  Note:');
          for (const n of act.note) {
            lines.push(`  - ${n}`);
          }
        }
      });
    }

    if (plan.lettura_dati && plan.lettura_dati.length > 0) {
      lines.push('');
      lines.push('LETTURA DATI IN ZEPP:');
      for (const ld of plan.lettura_dati) {
        lines.push(`• ${ld}`);
      }
    }

    if (plan.limiti && plan.limiti.length > 0) {
      lines.push('');
      lines.push('LIMITI DA SAPERE:');
      for (const lim of plan.limiti) {
        lines.push(`• ${lim}`);
      }
    }

    return lines.join('\n');
  }

  // --- STORAGE E GESTIONE PREFERENZE (Sezione 7) ---

  const STORAGE = {
    get(key, isSession = false) {
      try {
        const store = isSession ? window.sessionStorage : window.localStorage;
        return store ? store.getItem(key) : null;
      } catch (e) {
        return null;
      }
    },
    set(key, val, isSession = false) {
      try {
        const store = isSession ? window.sessionStorage : window.localStorage;
        if (store) store.setItem(key, val);
      } catch (e) {
        // Fallimento silenzioso
      }
    },
    remove(key, isSession = false) {
      try {
        const store = isSession ? window.sessionStorage : window.localStorage;
        if (store) store.removeItem(key);
      } catch (e) {
        // Fallimento silenzioso
      }
    }
  };

  function loadSettings() {
    const rememberKey = STORAGE.get('wb.rememberKey') !== 'false';
    const provider = STORAGE.get('wb.provider') || 'gemini';

    // Recupera chiavi
    let keys = { gemini: '', openai: '', compat: '' };
    const rawKeys = rememberKey
      ? (STORAGE.get('wb.keys') || STORAGE.get('wb.keys', true))
      : (STORAGE.get('wb.keys', true) || STORAGE.get('wb.keys'));
    if (rawKeys) {
      try {
        keys = Object.assign(keys, JSON.parse(rawKeys));
      } catch (e) {}
    }

    let storedGemini = STORAGE.get('wb.model.gemini');
    if (!storedGemini || storedGemini === 'gemini-flash-latest' || storedGemini === 'gemini-3.8-flash' || storedGemini.includes('2.5') || storedGemini.includes('1.5')) {
      storedGemini = DEFAULT_MODELS.gemini;
      STORAGE.set('wb.model.gemini', DEFAULT_MODELS.gemini);
      STORAGE.set('wb.model.gemini', DEFAULT_MODELS.gemini, true);
    }
    let storedOpenAiResp = STORAGE.get('wb.model.openai-responses');
    if (!storedOpenAiResp || storedOpenAiResp === 'gpt-5-mini') {
      storedOpenAiResp = DEFAULT_MODELS['openai-responses'];
      STORAGE.set('wb.model.openai-responses', DEFAULT_MODELS['openai-responses']);
      STORAGE.set('wb.model.openai-responses', DEFAULT_MODELS['openai-responses'], true);
    }
    let storedOpenAiChat = STORAGE.get('wb.model.openai-chat');
    if (!storedOpenAiChat || storedOpenAiChat === 'gpt-5-mini') {
      storedOpenAiChat = DEFAULT_MODELS['openai-chat'];
      STORAGE.set('wb.model.openai-chat', DEFAULT_MODELS['openai-chat']);
      STORAGE.set('wb.model.openai-chat', DEFAULT_MODELS['openai-chat'], true);
    }

    const models = {
      'gemini': storedGemini,
      'openai-responses': storedOpenAiResp,
      'openai-chat': storedOpenAiChat,
      'compat-chat': STORAGE.get('wb.model.compat-chat') || DEFAULT_MODELS['compat-chat']
    };

    const baseUrls = {
      'openai': STORAGE.get('wb.baseUrl.openai') || DEFAULT_BASE_URLS.openai,
      'compat': STORAGE.get('wb.baseUrl.compat') || DEFAULT_BASE_URLS.compat
    };

    const systemPrompt = STORAGE.get('wb.systemPrompt') || '';

    let prefs = { corsa: 'aperto', rest: 'screenshot', carichi: 'scritti' };
    const rawPrefs = STORAGE.get('wb.prefs');
    if (rawPrefs) {
      try {
        prefs = Object.assign(prefs, JSON.parse(rawPrefs));
      } catch (e) {}
    }

    let modeNames = DEFAULT_MODE_NAMES.slice();
    const rawModeNames = STORAGE.get('wb.modeNames');
    if (rawModeNames) {
      try {
        const parsed = JSON.parse(rawModeNames);
        if (Array.isArray(parsed) && parsed.length === 4) {
          modeNames = parsed;
        }
      } catch (e) {}
    }

    return {
      rememberKey,
      provider,
      keys,
      models,
      baseUrls,
      systemPrompt,
      prefs,
      modeNames
    };
  }

  function saveSettings(settings) {
    STORAGE.set('wb.rememberKey', settings.rememberKey ? 'true' : 'false');
    STORAGE.set('wb.provider', settings.provider);

    // Gestione persistenza chiave
    const keysJson = JSON.stringify(settings.keys || {});
    if (settings.rememberKey) {
      STORAGE.set('wb.keys', keysJson, false);
      STORAGE.remove('wb.keys', true);
    } else {
      STORAGE.set('wb.keys', keysJson, true);
      STORAGE.remove('wb.keys', false);
    }

    // Salva modelli
    for (const [p, m] of Object.entries(settings.models || {})) {
      STORAGE.set(`wb.model.${p}`, m);
    }

    // Salva baseUrl
    if (settings.baseUrls) {
      STORAGE.set('wb.baseUrl.openai', settings.baseUrls.openai || DEFAULT_BASE_URLS.openai);
      STORAGE.set('wb.baseUrl.compat', settings.baseUrls.compat || '');
    }

    // Salva system prompt
    STORAGE.set('wb.systemPrompt', settings.systemPrompt || '');

    // Salva preferenze
    STORAGE.set('wb.prefs', JSON.stringify(settings.prefs || {}));

    // Salva nomi modalità
    STORAGE.set('wb.modeNames', JSON.stringify(settings.modeNames || DEFAULT_MODE_NAMES));
  }

  function loadHistory() {
    try {
      const raw = STORAGE.get('wb.history');
      if (raw) {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      }
    } catch (e) {}
    return [];
  }

  function saveHistoryItem(plan) {
    try {
      const hist = loadHistory();
      const item = {
        id: 'plan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        ts: Date.now(),
        titolo: plan.titolo,
        formato: plan.formato,
        riepilogo: plan.riepilogo,
        json: plan
      };
      // Inserisce in testa e mantiene al massimo 10 elementi
      hist.unshift(item);
      const capped = hist.slice(0, 10);
      STORAGE.set('wb.history', JSON.stringify(capped));
      return capped;
    } catch (e) {
      return [];
    }
  }

  function clearHistory() {
    STORAGE.remove('wb.history');
  }

  // --- COMPRESSIONE IMMAGINI (Sezione 8.1) ---

  async function processImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Impossibile leggere il file immagine.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Formato immagine non valido o corrotto.'));
        img.onload = async () => {
          try {
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;

            // Scala se il lato lungo supera 2048px (non ridurre se <= 2048)
            const MAX_DIM = 2048;
            if (width > MAX_DIM || height > MAX_DIM) {
              if (width > height) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              } else {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Esporta JPEG qualità 0.85 per massima leggibilità del testo e upload rapido
            let blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));

            // Se supera 3 MB, riprova con qualità 0.75
            if (blob && blob.size > 3 * 1024 * 1024) {
              blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.75));
            }

            if (!blob) {
              throw new Error('Errore nella conversione del canvas in JPEG.');
            }

            // Converti in base64 pulito (senza prefisso data:)
            const b64Reader = new FileReader();
            b64Reader.onloadend = () => {
              const dataUrl = b64Reader.result;
              const base64 = dataUrl.split(',')[1];
              resolve({
                file,
                name: file.name || 'screenshot.jpg',
                base64,
                previewUrl: URL.createObjectURL(blob),
                sizeBytes: blob.size
              });
            };
            b64Reader.readAsDataURL(blob);
          } catch (err) {
            reject(err);
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // --- LOGICA DELL'INTERFACCIA UTENTE (BROWSER ONLY) ---

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    let settings = loadSettings();
    let currentShots = []; // Array di { file, name, base64, previewUrl, sizeBytes }
    let currentPlan = null;
    let abortController = null;
    let gymState = { active: false, currentActivityIndex: 0, wakeLockSentinel: null };

    // Elementi DOM
    const el = {
      // Intestazione & Impostazioni
      btnOpenSettings: document.getElementById('btn-open-settings'),
      settingsModal: document.getElementById('settings-modal'),
      btnCloseSettings: document.getElementById('btn-close-settings'),
      btnCloseSettingsBottom: document.getElementById('btn-close-settings-bottom'),

      // Settings Fields
      selectProvider: document.getElementById('set-provider'),
      inputApiKey: document.getElementById('set-api-key'),
      btnToggleApiKey: document.getElementById('btn-toggle-api-key'),
      selectModelPicker: document.getElementById('set-model-picker'),
      inputModel: document.getElementById('set-model'),
      btnFetchModels: document.getElementById('btn-fetch-models'),
      groupBaseUrl: document.getElementById('group-base-url'),
      inputBaseUrl: document.getElementById('set-base-url'),
      chkRememberKey: document.getElementById('set-remember-key'),
      inputMode0: document.getElementById('set-mode-0'),
      inputMode1: document.getElementById('set-mode-1'),
      inputMode2: document.getElementById('set-mode-2'),
      inputMode3: document.getElementById('set-mode-3'),
      textareaSystemPrompt: document.getElementById('set-system-prompt'),
      btnResetPrompt: document.getElementById('btn-reset-prompt'),
      btnTestConnection: document.getElementById('btn-test-connection'),
      boxTestStatus: document.getElementById('test-status-box'),
      btnForceUpdate: document.getElementById('btn-force-update'),

      // Home Screen
      screenHome: document.getElementById('screen-home'),
      dropZone: document.getElementById('drop-zone'),
      fileInput: document.getElementById('file-input'),
      btnSelectFiles: document.getElementById('btn-select-files'),
      thumbsList: document.getElementById('thumbs-list'),
      homeModelSelect: document.getElementById('home-model-select'),
      radioCorsaAperto: document.getElementById('opt-corsa-aperto'),
      radioCorsaTapis: document.getElementById('opt-corsa-tapis'),
      radioRestScreenshot: document.getElementById('opt-rest-screenshot'),
      radioRestSincro: document.getElementById('opt-rest-sincro'),
      radioCarichiScritti: document.getElementById('opt-carichi-scritti'),
      radioCarichiConverti: document.getElementById('opt-carichi-converti'),
      inputNotes: document.getElementById('input-notes'),
      btnGenerate: document.getElementById('btn-generate'),
      btnGenerateHelp: document.getElementById('btn-generate-help'),
      historySection: document.getElementById('history-section'),
      historyList: document.getElementById('history-list'),
      btnExportHistory: document.getElementById('btn-export-history'),
      btnClearHistory: document.getElementById('btn-clear-history'),

      // Loading Screen
      screenLoading: document.getElementById('screen-loading'),
      loadingStatusText: document.getElementById('loading-status-text'),
      btnCancelGeneration: document.getElementById('btn-cancel-generation'),

      // Result Screen
      screenResult: document.getElementById('screen-result'),
      resultPlanContainer: document.getElementById('result-plan-container'),
      btnCopyPlan: document.getElementById('btn-copy-plan'),
      btnSharePlan: document.getElementById('btn-share-plan'),
      btnNewWod: document.getElementById('btn-new-wod'),
      btnRegenerateWithNote: document.getElementById('btn-regenerate-note'),
      btnToggleGymMode: document.getElementById('btn-toggle-gym-mode'),

      // Gym View Overlay
      gymOverlay: document.getElementById('gym-overlay'),
      gymTotalHeader: document.getElementById('gym-total-header'),
      gymActivityContainer: document.getElementById('gym-activity-container'),
      btnGymPrev: document.getElementById('btn-gym-prev'),
      btnGymNext: document.getElementById('btn-gym-next'),
      btnGymClose: document.getElementById('btn-gym-close'),

      // Error Box / Toast
      errorBox: document.getElementById('error-box'),
      errorMessage: document.getElementById('error-message'),
      errorDetailToggle: document.getElementById('error-detail-toggle'),
      errorDetailText: document.getElementById('error-detail-text'),
      btnErrorClose: document.getElementById('btn-error-close'),
      toast: document.getElementById('toast')
    };

    // Notifica toast
    let toastTimeout = null;
    function showToast(msg) {
      if (!el.toast) return;
      el.toast.textContent = msg;
      el.toast.classList.add('visible');
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        el.toast.classList.remove('visible');
      }, 2500);
    }

    // Gestione errori
    function showError(friendlyMsg, detailText = '') {
      if (!el.errorBox) return;
      el.errorMessage.textContent = friendlyMsg;
      if (detailText) {
        el.errorDetailText.textContent = detailText;
        el.errorDetailToggle.style.display = 'block';
        el.errorDetailToggle.open = false;
      } else {
        el.errorDetailToggle.style.display = 'none';
        el.errorDetailText.textContent = '';
      }
      el.errorBox.style.display = 'block';
      el.errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideError() {
      if (el.errorBox) {
        el.errorBox.style.display = 'none';
      }
    }

    if (el.btnErrorClose) {
      el.btnErrorClose.addEventListener('click', hideError);
    }

    // Inizializza form impostazioni
    function populateSettingsUI() {
      settings = loadSettings();
      el.selectProvider.value = settings.provider;
      updateProviderFields();

      el.chkRememberKey.checked = settings.rememberKey;
      el.textareaSystemPrompt.value = settings.systemPrompt || '';

      el.inputMode0.value = settings.modeNames[0] || DEFAULT_MODE_NAMES[0];
      el.inputMode1.value = settings.modeNames[1] || DEFAULT_MODE_NAMES[1];
      el.inputMode2.value = settings.modeNames[2] || DEFAULT_MODE_NAMES[2];
      el.inputMode3.value = settings.modeNames[3] || DEFAULT_MODE_NAMES[3];

      // Preferenze home
      if (settings.prefs.corsa === 'tapis') el.radioCorsaTapis.checked = true;
      else el.radioCorsaAperto.checked = true;

      if (settings.prefs.rest === 'sincro') el.radioRestSincro.checked = true;
      else el.radioRestScreenshot.checked = true;

      if (settings.prefs.carichi === 'converti') el.radioCarichiConverti.checked = true;
      else el.radioCarichiScritti.checked = true;
    }

    function updateProviderFields(fetchedModels = null) {
      const prov = el.selectProvider.value;
      const keyGroup = (prov === 'gemini') ? 'gemini' : (prov === 'compat-chat' ? 'compat' : 'openai');
      el.inputApiKey.value = settings.keys[keyGroup] || '';

      const currentModel = settings.models[prov] || DEFAULT_MODELS[prov] || '';
      el.inputModel.value = currentModel;

      // Popola il menu a tendina selectModelPicker
      const modelsToShow = (Array.isArray(fetchedModels) && fetchedModels.length > 0)
        ? fetchedModels
        : (DEFAULT_SUGGESTIONS[prov] || []);
      populateModelPicker(modelsToShow, currentModel);

      if (prov === 'openai-responses' || prov === 'openai-chat') {
        el.groupBaseUrl.style.display = 'block';
        el.inputBaseUrl.value = settings.baseUrls.openai || DEFAULT_BASE_URLS.openai;
      } else if (prov === 'compat-chat') {
        el.groupBaseUrl.style.display = 'block';
        el.inputBaseUrl.value = settings.baseUrls.compat || '';
      } else {
        el.groupBaseUrl.style.display = 'none';
      }

      syncHomeModelSelect();
      updateGenerateButtonState();
    }

    function syncHomeModelSelect() {
      if (!el.homeModelSelect) return;
      const prov = settings.provider;
      const curModel = settings.models[prov] || DEFAULT_MODELS[prov] || '';
      const suggestions = DEFAULT_SUGGESTIONS[prov] || [curModel];

      el.homeModelSelect.replaceChildren();

      let matched = false;
      for (const m of suggestions) {
        const opt = document.createElement('option');
        opt.value = m;
        let label = m;
        if (m === 'gemini-3.5-flash-lite') label = 'Gemini 3.5 Flash Lite (Ultra-veloce, consigliato)';
        else if (m === 'gemini-3.5-flash') label = 'Gemini 3.5 Flash (Rapido)';
        else if (m === 'gemini-3.8-flash') label = 'Gemini 3.8 Flash (Ragionamento)';
        else if (m === 'gemini-3-flash') label = 'Gemini 3 Flash';
        else if (m === 'gemini-3.8-flash-lite') label = 'Gemini 3.8 Flash Lite';
        else if (m === 'gemini-2.0-flash') label = 'Gemini 2.0 Flash';
        else if (m === 'gpt-4o-mini') label = 'OpenAI GPT-4o Mini (Consigliato)';
        opt.textContent = label;
        if (m === curModel) {
          opt.selected = true;
          matched = true;
        }
        el.homeModelSelect.appendChild(opt);
      }

      if (!matched && curModel) {
        const customOpt = document.createElement('option');
        customOpt.value = curModel;
        customOpt.textContent = curModel;
        customOpt.selected = true;
        el.homeModelSelect.appendChild(customOpt);
      }
    }

    if (el.homeModelSelect) {
      el.homeModelSelect.addEventListener('change', () => {
        const selected = el.homeModelSelect.value;
        settings.models[settings.provider] = selected;
        STORAGE.set(`wb.model.${settings.provider}`, selected);
        if (el.inputModel) el.inputModel.value = selected;
        if (el.selectModelPicker) el.selectModelPicker.value = selected;
        showToast(`Modello attivo: ${selected}`);
      });
    }

    function populateModelPicker(modelsList, activeModel) {
      if (!el.selectModelPicker) return;
      el.selectModelPicker.replaceChildren();

      let matched = false;
      for (const m of modelsList) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === activeModel) {
          opt.selected = true;
          matched = true;
        }
        el.selectModelPicker.appendChild(opt);
      }

      const customOpt = document.createElement('option');
      customOpt.value = '__custom__';
      customOpt.textContent = 'Altro (digita sotto)…';
      if (!matched && activeModel) {
        customOpt.selected = true;
      }
      el.selectModelPicker.appendChild(customOpt);
    }

    function saveSettingsFromUI() {
      const prov = el.selectProvider.value;
      const keyGroup = (prov === 'gemini') ? 'gemini' : (prov === 'compat-chat' ? 'compat' : 'openai');
      settings.provider = prov;
      settings.rememberKey = el.chkRememberKey.checked;
      settings.keys[keyGroup] = el.inputApiKey.value.trim();
      settings.models[prov] = el.inputModel.value.trim() || DEFAULT_MODELS[prov];

      if (prov === 'compat-chat') {
        settings.baseUrls.compat = el.inputBaseUrl.value.trim();
      } else if (prov === 'openai-responses' || prov === 'openai-chat') {
        settings.baseUrls.openai = el.inputBaseUrl.value.trim();
      }

      settings.systemPrompt = el.textareaSystemPrompt.value;
      settings.modeNames = [
        el.inputMode0.value.trim() || DEFAULT_MODE_NAMES[0],
        el.inputMode1.value.trim() || DEFAULT_MODE_NAMES[1],
        el.inputMode2.value.trim() || DEFAULT_MODE_NAMES[2],
        el.inputMode3.value.trim() || DEFAULT_MODE_NAMES[3]
      ];

      saveSettings(settings);
      syncHomeModelSelect();
      updateGenerateButtonState();
    }

    // Apertura e chiusura modale impostazioni
    el.btnOpenSettings.addEventListener('click', () => {
      populateSettingsUI();
      el.boxTestStatus.textContent = '';
      el.boxTestStatus.className = 'status-box';
      el.settingsModal.classList.add('open');
      el.settingsModal.setAttribute('aria-hidden', 'false');
      el.settingsModal.style.display = 'block';
      document.body.style.overflow = 'hidden';
      el.settingsModal.scrollTop = 0;
    });

    function closeSettingsModal() {
      saveSettingsFromUI();
      el.settingsModal.classList.remove('open');
      el.settingsModal.setAttribute('aria-hidden', 'true');
      el.settingsModal.style.display = 'none';
      document.body.style.overflow = '';
      syncHomeModelSelect();
    }

    el.btnCloseSettings.addEventListener('click', closeSettingsModal);
    if (el.btnCloseSettingsBottom) {
      el.btnCloseSettingsBottom.addEventListener('click', closeSettingsModal);
    }

    el.selectProvider.addEventListener('change', () => {
      saveSettingsFromUI();
      updateProviderFields();
    });

    el.inputApiKey.addEventListener('input', () => {
      saveSettingsFromUI();
    });

    if (el.selectModelPicker) {
      el.selectModelPicker.addEventListener('change', () => {
        const val = el.selectModelPicker.value;
        if (val !== '__custom__') {
          el.inputModel.value = val;
          saveSettingsFromUI();
        } else {
          el.inputModel.focus();
        }
      });
    }

    el.inputModel.addEventListener('input', () => {
      const val = el.inputModel.value.trim();
      if (el.selectModelPicker) {
        let found = false;
        for (const opt of el.selectModelPicker.options) {
          if (opt.value === val) {
            opt.selected = true;
            found = true;
            break;
          }
        }
        if (!found) {
          el.selectModelPicker.value = '__custom__';
        }
      }
      saveSettingsFromUI();
    });

    el.inputBaseUrl.addEventListener('input', () => {
      saveSettingsFromUI();
    });

    el.btnToggleApiKey.addEventListener('click', () => {
      if (el.inputApiKey.type === 'password') {
        el.inputApiKey.type = 'text';
        el.btnToggleApiKey.textContent = 'Nascondi';
      } else {
        el.inputApiKey.type = 'password';
        el.btnToggleApiKey.textContent = 'Mostra';
      }
    });

    el.btnResetPrompt.addEventListener('click', () => {
      if (confirm('Ripristinare il prompt di sistema al valore predefinito?')) {
        el.textareaSystemPrompt.value = '';
        saveSettingsFromUI();
        showToast('Prompt di sistema ripristinato');
      }
    });

    // Test Connessione
    el.btnTestConnection.addEventListener('click', async () => {
      saveSettingsFromUI();
      const prov = settings.provider;
      const keyGroup = (prov === 'gemini') ? 'gemini' : (prov === 'compat-chat' ? 'compat' : 'openai');
      const apiKey = settings.keys[keyGroup];

      if (!apiKey) {
        el.boxTestStatus.textContent = 'Manca la chiave API per questo provider.';
        el.boxTestStatus.className = 'status-box error';
        return;
      }

      el.boxTestStatus.textContent = 'Verifica connessione in corso…';
      el.boxTestStatus.className = 'status-box loading';

      try {
        const models = await fetchModelsList(prov, apiKey, settings);
        el.boxTestStatus.textContent = `Connessione riuscita! Trovati ${models.length} modelli.`;
        el.boxTestStatus.className = 'status-box success';
      } catch (err) {
        el.boxTestStatus.textContent = `Test fallito: ${err.message}`;
        el.boxTestStatus.className = 'status-box error';
      }
    });

    // Carica Elenco Modelli
    el.btnFetchModels.addEventListener('click', async () => {
      saveSettingsFromUI();
      const prov = settings.provider;
      const keyGroup = (prov === 'gemini') ? 'gemini' : (prov === 'compat-chat' ? 'compat' : 'openai');
      const apiKey = settings.keys[keyGroup];

      if (!apiKey) {
        alert('Inserisci prima la chiave API per caricare i modelli.');
        return;
      }

      el.btnFetchModels.disabled = true;
      el.btnFetchModels.textContent = 'Caricamento…';

      try {
        const models = await fetchModelsList(prov, apiKey, settings);
        if (models.length > 0) {
          updateProviderFields(models);
          if (!models.includes(el.inputModel.value)) {
            const preferred = models.find(m => m.includes('3.8-flash') || m.includes('3.5-flash') || m.includes('flash')) || models[0];
            el.inputModel.value = preferred;
            if (el.selectModelPicker) el.selectModelPicker.value = preferred;
            saveSettingsFromUI();
          }
          showToast(`${models.length} modelli caricati dal provider`);
        } else {
          showToast('Nessun modello trovato');
        }
      } catch (err) {
        showError('Impossibile recuperare i modelli', err.message);
      } finally {
        el.btnFetchModels.disabled = false;
        el.btnFetchModels.textContent = 'Carica modelli';
      }
    });

    async function fetchModelsList(provider, apiKey, currentSettings) {
      if (provider === 'gemini') {
        const url = 'https://generativelanguage.googleapis.com/v1beta/models';
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          }
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!data.models || !Array.isArray(data.models)) return [];
        return data.models
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''))
          .filter(m => !m.includes('embedding') && !m.includes('aqa') && !m.includes('imagen') && !m.includes('text-bison') && !m.includes('chat-bison'))
          .sort();
      } else {
        const defaultBase = provider === 'compat-chat' ? '' : DEFAULT_BASE_URLS.openai;
        const base = (provider === 'compat-chat' ? currentSettings.baseUrls.compat : currentSettings.baseUrls.openai) || defaultBase;
        if (!base) {
          throw new Error('Base URL mancante.');
        }
        const url = `${base.replace(/\/+$/, '')}/models`;
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!data.data || !Array.isArray(data.data)) return [];
        return data.data.map(d => d.id).sort();
      }
    }

    // Gestione Preferenze Home
    function savePrefsFromHome() {
      settings.prefs.corsa = el.radioCorsaTapis.checked ? 'tapis' : 'aperto';
      settings.prefs.rest = el.radioRestSincro.checked ? 'sincro' : 'screenshot';
      settings.prefs.carichi = el.radioCarichiConverti.checked ? 'converti' : 'scritti';
      saveSettings(settings);
    }

    [
      el.radioCorsaAperto, el.radioCorsaTapis,
      el.radioRestScreenshot, el.radioRestSincro,
      el.radioCarichiScritti, el.radioCarichiConverti
    ].forEach(radio => {
      radio.addEventListener('change', savePrefsFromHome);
    });

    // Gestione Screenshot Upload
    el.btnSelectFiles.addEventListener('click', () => {
      el.fileInput.click();
    });

    el.fileInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        await addFiles(Array.from(e.target.files));
        el.fileInput.value = '';
      }
    });

    // Drag and Drop
    el.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.dropZone.classList.add('drag-over');
    });

    el.dropZone.addEventListener('dragleave', () => {
      el.dropZone.classList.remove('drag-over');
    });

    el.dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      el.dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        await addFiles(Array.from(e.dataTransfer.files));
      }
    });

    // Incolla immagine dagli appunti
    window.addEventListener('paste', async (e) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        const imageFiles = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          await addFiles(imageFiles);
        }
      }
    });

    async function addFiles(files) {
      hideError();
      const imagesOnly = files.filter(f => f.type.startsWith('image/'));
      if (imagesOnly.length === 0) {
        showError('Non riesco a leggere questa immagine. Prova con uno screenshot in JPG o PNG.');
        return;
      }

      if (currentShots.length + imagesOnly.length > 4) {
        showError('Puoi caricare al massimo 4 screenshot per volta.');
      }

      const availableSlots = 4 - currentShots.length;
      const toProcess = imagesOnly.slice(0, availableSlots);

      for (const f of toProcess) {
        try {
          const processed = await processImageFile(f);
          currentShots.push(processed);
        } catch (err) {
          showError('Non riesco a leggere questa immagine. Prova con uno screenshot in JPG o PNG.', err.message);
        }
      }

      renderThumbnails();
      updateGenerateButtonState();
    }

    function removeShot(index) {
      if (currentShots[index]) {
        if (currentShots[index].previewUrl) {
          URL.revokeObjectURL(currentShots[index].previewUrl);
        }
        currentShots.splice(index, 1);
        renderThumbnails();
        updateGenerateButtonState();
      }
    }

    function renderThumbnails() {
      el.thumbsList.replaceChildren();
      currentShots.forEach((shot, idx) => {
        const item = document.createElement('div');
        item.className = 'thumb-item';

        const img = document.createElement('img');
        img.src = shot.previewUrl;
        img.alt = `Screenshot ${idx + 1}`;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'thumb-remove-btn';
        removeBtn.textContent = '×';
        removeBtn.setAttribute('aria-label', `Rimuovi screenshot ${idx + 1}`);
        removeBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          removeShot(idx);
        });

        item.appendChild(img);
        item.appendChild(removeBtn);
        el.thumbsList.appendChild(item);
      });
    }

    // Stato Pulsante Genera Scheda
    function updateGenerateButtonState() {
      const prov = settings.provider;
      const keyGroup = (prov === 'gemini') ? 'gemini' : (prov === 'compat-chat' ? 'compat' : 'openai');
      const hasKey = Boolean(settings.keys[keyGroup] && settings.keys[keyGroup].trim());
      const hasImages = currentShots.length > 0;

      if (!hasImages) {
        el.btnGenerate.disabled = true;
        el.btnGenerateHelp.textContent = 'Carica almeno uno screenshot';
      } else if (!hasKey) {
        el.btnGenerate.disabled = true;
        el.btnGenerateHelp.textContent = 'Manca la chiave API (apri Impostazioni)';
      } else {
        el.btnGenerate.disabled = false;
        el.btnGenerateHelp.textContent = '';
      }
    }

    // Cronologia (Sezione 4)
    function renderHistoryList() {
      const hist = loadHistory();
      if (!hist || hist.length === 0) {
        el.historySection.style.display = 'none';
        return;
      }
      el.historySection.style.display = 'block';
      el.historyList.replaceChildren();

      hist.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'history-item';

        const info = document.createElement('div');
        info.className = 'history-info';

        const title = document.createElement('div');
        title.className = 'history-title';
        title.textContent = item.titolo || 'WOD';

        const meta = document.createElement('div');
        meta.className = 'history-meta';
        const d = new Date(item.ts);
        const dateStr = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        meta.textContent = `${item.formato || 'Misto'} • ${dateStr}`;

        info.appendChild(title);
        info.appendChild(meta);

        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'btn-secondary btn-small';
        openBtn.textContent = 'Apri';
        openBtn.addEventListener('click', () => {
          showResultScreen(item.json);
        });

        card.appendChild(info);
        card.appendChild(openBtn);
        el.historyList.appendChild(card);
      });
    }

    if (el.btnExportHistory) {
      el.btnExportHistory.addEventListener('click', () => {
        const hist = loadHistory();
        const blob = new Blob([JSON.stringify(hist, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `wod-history-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }

    if (el.btnClearHistory) {
      el.btnClearHistory.addEventListener('click', () => {
        if (confirm('Vuoi cancellare la cronologia delle schede recenti?')) {
          clearHistory();
          renderHistoryList();
          showToast('Cronologia cancellata');
        }
      });
    }

    // Gestione Schermate
    function showScreen(screenName) {
      el.screenHome.style.display = screenName === 'home' ? 'block' : 'none';
      el.screenLoading.style.display = screenName === 'loading' ? 'block' : 'none';
      el.screenResult.style.display = screenName === 'result' ? 'block' : 'none';
      window.scrollTo(0, 0);
    }

    let userCancelled = false;
    let loadingTimerInterval = null;
    let startTime = 0;

    // Annulla generazione
    el.btnCancelGeneration.addEventListener('click', () => {
      userCancelled = true;
      if (loadingTimerInterval) {
        clearInterval(loadingTimerInterval);
        loadingTimerInterval = null;
      }
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      showScreen('home');
      hideError();
      showToast('Analisi annullata');
    });

    // FLUSSO GENERAZIONE SCHEDA
    el.btnGenerate.addEventListener('click', async () => {
      hideError();
      userCancelled = false;
      const prov = settings.provider;
      const keyGroup = (prov === 'gemini') ? 'gemini' : (prov === 'compat-chat' ? 'compat' : 'openai');
      const apiKey = settings.keys[keyGroup];

      if (!apiKey) {
        showError('Manca la chiave API. Aprila in Impostazioni.');
        return;
      }

      if (currentShots.length === 0) {
        showError('Carica almeno uno screenshot del WOD.');
        return;
      }

      showScreen('loading');
      startTime = Date.now();
      el.loadingStatusText.textContent = 'Lettura dello screenshot… (0s)';

      if (loadingTimerInterval) clearInterval(loadingTimerInterval);
      loadingTimerInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        if (elapsed < 3) {
          el.loadingStatusText.textContent = `Lettura dello screenshot… (${elapsed}s)`;
        } else {
          el.loadingStatusText.textContent = `Costruzione della scheda per l'orologio… (${elapsed}s)`;
        }
      }, 1000);

      abortController = new AbortController();
      let isTimedOut = false;
      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        if (abortController) {
          abortController.abort('timeout');
        }
      }, 120000); // Timeout 120s

      try {
        const userMsg = buildUserMessage({
          corsa: settings.prefs.corsa,
          rest: settings.prefs.rest,
          carichi: settings.prefs.carichi,
          modeNames: settings.modeNames,
          note: el.inputNotes.value,
          shotsCount: currentShots.length
        });

        const imagesBase64 = currentShots.map(s => s.base64);

        let plan = await executeGeneration(prov, apiKey, userMsg, imagesBase64, abortController.signal, false);
        clearTimeout(timeoutId);
        if (loadingTimerInterval) {
          clearInterval(loadingTimerInterval);
          loadingTimerInterval = null;
        }

        currentPlan = plan;
        saveHistoryItem(plan);
        renderHistoryList();
        showResultScreen(plan);
      } catch (err) {
        clearTimeout(timeoutId);
        if (loadingTimerInterval) {
          clearInterval(loadingTimerInterval);
          loadingTimerInterval = null;
        }
        showScreen('home');

        if (userCancelled) {
          hideError();
          return;
        }

        const elapsedSec = Math.round((Date.now() - startTime) / 1000);
        const currentModel = settings.models[prov] || DEFAULT_MODELS[prov] || 'predefinito';
        const techInfo = `Provider: ${prov}\nModello: ${currentModel}\nTempo trascorso: ${elapsedSec}s\nErrore: ${err.message || err.name || err}`;

        if (isTimedOut || err.name === 'AbortError' || err === 'timeout') {
          showError(
            'Il modello non ha risposto entro il tempo limite (120s). Seleziona "Gemini 3.5 Flash Lite" dalla tendina in Home per una risposta rapida.',
            techInfo
          );
          return;
        }

        const msg = err.message || '';
        if (msg.includes('503') || msg.includes('high demand') || msg.includes('temporarily') || msg.includes('overloaded')) {
          showError(
            'Il modello selezionato è temporaneamente sovraccarico (HTTP 503: High demand). Scegli un modello alternativo dal menu in Impostazioni.',
            techInfo
          );
          return;
        }

        if (msg.includes('401') || msg.includes('403') || msg.includes('API key') || msg.includes('invalid_api_key')) {
          showError('Il provider ha rifiutato la chiave. Controlla chiave e provider in Impostazioni.', techInfo);
        } else if (msg.includes('404') || msg.includes('model_not_found') || msg.includes('not found')) {
          showError('Modello non trovato. Usa Carica modelli e sceglilo dall\'elenco.', techInfo);
        } else if (msg.includes('429') || msg.includes('quota') || msg.includes('rate_limit') || msg.includes('insufficient_quota')) {
          showError('Troppe richieste o credito finito. Riprova tra poco o controlla il piano del provider.', techInfo);
        } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
          showError('Richiesta non riuscita. Controlla la connessione. Se usi un provider personalizzato, controlla Base URL e CORS.', techInfo);
        } else if (msg.includes('bloccato la richiesta')) {
          showError(msg, techInfo);
        } else {
          showError(msg || 'Errore durante la generazione della scheda.', techInfo);
        }
      } finally {
        abortController = null;
      }
    });

    async function executeGeneration(prov, apiKey, userMsg, imagesBase64, signal, isRetry = false, overrideModel = null) {
      let model = overrideModel || settings.models[prov] || DEFAULT_MODELS[prov];

      // Auto-migrazione attiva se il modello salvato è deprecato o non responsive
      if (prov === 'gemini' && (!model || model === 'gemini-flash-latest' || model === 'gemini-3.8-flash' || model.includes('2.5') || model.includes('1.5'))) {
        model = 'gemini-3.5-flash-lite';
        settings.models['gemini'] = 'gemini-3.5-flash-lite';
        STORAGE.set('wb.model.gemini', 'gemini-3.5-flash-lite');
        if (el.inputModel) el.inputModel.value = 'gemini-3.5-flash-lite';
        syncHomeModelSelect();
      }

      const baseUrl = prov === 'compat-chat' ? settings.baseUrls.compat : settings.baseUrls.openai;

      const reqSpec = buildRequest(prov, {
        apiKey,
        model,
        baseUrl,
        systemPrompt: settings.systemPrompt,
        userMessage: userMsg,
        imagesBase64,
        skipResponseFormat: false
      });

      let res;
      try {
        res = await fetch(reqSpec.url, {
          method: reqSpec.method,
          headers: reqSpec.headers,
          body: reqSpec.body,
          signal
        });
      } catch (networkErr) {
        // Se compat-chat fallisce con response_format non supportato, prova una volta senza
        if (prov === 'compat-chat' && !isRetry) {
          const fallbackReq = buildRequest(prov, {
            apiKey,
            model,
            baseUrl,
            systemPrompt: settings.systemPrompt,
            userMessage: userMsg,
            imagesBase64,
            skipResponseFormat: true
          });
          res = await fetch(fallbackReq.url, {
            method: fallbackReq.method,
            headers: fallbackReq.headers,
            body: fallbackReq.body,
            signal
          });
        } else {
          throw networkErr;
        }
      }

      if (!res.ok) {
        let errDetails = `HTTP ${res.status}`;
        try {
          const errData = await res.json();
          if (errData.error && errData.error.message) {
            errDetails += `: ${errData.error.message}`;
          }
        } catch (e) {}

        // Fallback automatico se 503 (sovraccarico temporaneo) su Gemini
        if (res.status === 503 && prov === 'gemini' && !isRetry) {
          const fallbackModel = (model === 'gemini-3.5-flash-lite') ? 'gemini-3.5-flash' : 'gemini-3.5-flash-lite';
          console.warn(`Modello ${model} ha restituito 503 (sovraccarico). Tentativo automatico con ${fallbackModel}...`);
          if (el.loadingStatusText) {
            el.loadingStatusText.textContent = `Modello sovraccarico, provo ${fallbackModel}…`;
          }
          return executeGeneration(prov, apiKey, userMsg, imagesBase64, signal, true, fallbackModel);
        }

        throw new Error(errDetails);
      }

      const resData = await res.json();
      const rawText = extractText(prov, resData);

      let parsedObj;
      try {
        parsedObj = parseModelJson(rawText);
      } catch (parseErr) {
        if (!isRetry) {
          // Un solo tentativo automatico di nuova richiesta se il JSON non è valido (Sezione 8.6)
          const retryUserMsg = `${userMsg}\n\nLa risposta precedente non era JSON valido. Rispondi solo con il JSON.`;
          return executeGeneration(prov, apiKey, retryUserMsg, imagesBase64, signal, true);
        }
        throw new Error(`La risposta non era nel formato atteso. Dettagli: ${rawText}`);
      }

      return validatePlan(parsedObj);
    }

    // RENDERING DELLA SCHEDA (Sezione 11 - zero innerHTML con dati del modello)
    function renderPlanDOM(plan) {
      const container = el.resultPlanContainer;
      container.replaceChildren();

      // 1. Testata (titolo, formato, durata)
      const headerBox = document.createElement('header');
      headerBox.className = 'plan-header';

      const titleEl = document.createElement('h2');
      titleEl.className = 'plan-title';
      titleEl.textContent = plan.titolo;
      headerBox.appendChild(titleEl);

      const badgesRow = document.createElement('div');
      badgesRow.className = 'plan-badges';

      const formatBadge = document.createElement('span');
      formatBadge.className = 'badge badge-format';
      formatBadge.textContent = plan.formato || 'Misto';
      badgesRow.appendChild(formatBadge);

      if (plan.durata_totale_min) {
        const durationBadge = document.createElement('span');
        durationBadge.className = 'badge badge-duration';
        durationBadge.textContent = `${plan.durata_totale_min} min`;
        badgesRow.appendChild(durationBadge);
      }
      headerBox.appendChild(badgesRow);

      // Riepilogo
      if (plan.riepilogo) {
        const summaryEl = document.createElement('p');
        summaryEl.className = 'plan-summary';
        summaryEl.textContent = plan.riepilogo;
        headerBox.appendChild(summaryEl);
      }

      container.appendChild(headerBox);

      // 2. Blocco Assunzioni (subito sotto, se non vuoto)
      if (plan.assunzioni && plan.assunzioni.length > 0) {
        const assCard = document.createElement('section');
        assCard.className = 'card card-assumptions';

        const assTitle = document.createElement('h3');
        assTitle.className = 'card-title';
        assTitle.textContent = 'Assunzioni e note di lettura';
        assCard.appendChild(assTitle);

        const assList = document.createElement('ul');
        assList.className = 'clean-list';
        for (const ass of plan.assunzioni) {
          const li = document.createElement('li');
          li.textContent = ass;
          assList.appendChild(li);
        }
        assCard.appendChild(assList);
        container.appendChild(assCard);
      }

      // 3. Attività per l'orologio
      if (plan.attivita && plan.attivita.length > 0) {
        const actsContainer = document.createElement('div');
        actsContainer.className = 'activities-list';

        plan.attivita.forEach((act, actIdx) => {
          const actSec = document.createElement('section');
          actSec.className = `activity-card mode-${act.tipo_modalita}`;

          // Testata attività
          const actHead = document.createElement('div');
          actHead.className = 'activity-header';

          const actTitle = document.createElement('h3');
          actTitle.className = 'activity-title';
          actTitle.textContent = `${actIdx + 1}. ${act.nome}`;
          actHead.appendChild(actTitle);

          const chipsRow = document.createElement('div');
          chipsRow.className = 'activity-chips';

          const modeChip = document.createElement('span');
          modeChip.className = `mode-chip chip-${act.tipo_modalita}`;
          modeChip.textContent = act.modalita_orologio;
          chipsRow.appendChild(modeChip);

          if (!act.obbligatoria) {
            const optChip = document.createElement('span');
            optChip.className = 'mode-chip chip-optional';
            optChip.textContent = 'Opzionale';
            chipsRow.appendChild(optChip);
          }
          actHead.appendChild(chipsRow);
          actSec.appendChild(actHead);

          // 3.1 Prima di avviare (preparazione)
          if (act.preparazione && act.preparazione.length > 0) {
            const prepBox = document.createElement('div');
            prepBox.className = 'act-subblock prep-block';

            const prepLabel = document.createElement('div');
            prepLabel.className = 'subblock-label';
            prepLabel.textContent = 'Prima di avviare:';
            prepBox.appendChild(prepLabel);

            const prepList = document.createElement('ul');
            prepList.className = 'prep-checklist';
            for (const item of act.preparazione) {
              const li = document.createElement('li');
              const boxSpan = document.createElement('span');
              boxSpan.className = 'prep-box';
              boxSpan.setAttribute('aria-hidden', 'true');
              boxSpan.textContent = '☐';
              const textSpan = document.createElement('span');
              textSpan.textContent = item;
              li.appendChild(boxSpan);
              li.appendChild(textSpan);
              prepList.appendChild(li);
            }
            prepBox.appendChild(prepList);
            actSec.appendChild(prepBox);
          }

          // 3.2 Cosa fai (esercizi)
          if (act.esercizi && act.esercizi.length > 0) {
            const exBox = document.createElement('div');
            exBox.className = 'act-subblock ex-block';

            const exLabel = document.createElement('div');
            exLabel.className = 'subblock-label';
            exLabel.textContent = 'Cosa fai:';
            exBox.appendChild(exLabel);

            const exList = document.createElement('ul');
            exList.className = 'clean-list';
            for (const ex of act.esercizi) {
              const li = document.createElement('li');
              li.textContent = ex;
              exList.appendChild(li);
            }
            exBox.appendChild(exList);
            actSec.appendChild(exBox);
          }

          // 3.3 Lap (schema_lap - sequenza grandi righe numerate)
          if (act.schema_lap && act.schema_lap.length > 0) {
            const lapBox = document.createElement('div');
            lapBox.className = 'act-subblock lap-block';

            const lapHead = document.createElement('div');
            lapHead.className = 'lap-block-header';
            const lapLabel = document.createElement('span');
            lapLabel.className = 'subblock-label';
            lapLabel.textContent = 'Lap dell\'orologio';
            lapHead.appendChild(lapLabel);

            if (act.lap_per_giro) {
              const lapsBadge = document.createElement('span');
              lapsBadge.className = 'lap-count-badge';
              lapsBadge.textContent = `${act.lap_per_giro} lap per giro`;
              lapHead.appendChild(lapsBadge);
            }
            lapBox.appendChild(lapHead);

            const lapList = document.createElement('div');
            lapList.className = 'lap-list';
            act.schema_lap.forEach((lap, lapIndex) => {
              const lapRow = document.createElement('div');
              lapRow.className = 'lap-row';

              const numEl = document.createElement('span');
              numEl.className = 'lap-num';
              numEl.textContent = String(lapIndex + 1);

              const textEl = document.createElement('span');
              textEl.className = 'lap-text';
              textEl.textContent = lap;

              lapRow.appendChild(numEl);
              lapRow.appendChild(textEl);
              lapList.appendChild(lapRow);
            });
            lapBox.appendChild(lapList);

            if (plan.formato === 'AMRAP') {
              const amrapFooter = document.createElement('div');
              amrapFooter.className = 'amrap-repeat-note';
              amrapFooter.textContent = '↳ Poi ricomincia dal lap 1';
              lapBox.appendChild(amrapFooter);
            }

            actSec.appendChild(lapBox);
          }

          // 3.4 Note attività
          if (act.note && act.note.length > 0) {
            const noteBox = document.createElement('div');
            noteBox.className = 'act-subblock note-block';

            const noteList = document.createElement('ul');
            noteList.className = 'note-list';
            for (const n of act.note) {
              const li = document.createElement('li');
              li.textContent = n;
              noteList.appendChild(li);
            }
            noteBox.appendChild(noteList);
            actSec.appendChild(noteBox);
          }

          actsContainer.appendChild(actSec);
        });

        container.appendChild(actsContainer);
      }

      // 4. Lettura dati in Zepp
      if (plan.lettura_dati && plan.lettura_dati.length > 0) {
        const zeppCard = document.createElement('section');
        zeppCard.className = 'card card-zepp';

        const zeppTitle = document.createElement('h3');
        zeppTitle.className = 'card-title';
        zeppTitle.textContent = 'Lettura dati in Zepp';
        zeppCard.appendChild(zeppTitle);

        const zeppList = document.createElement('ul');
        zeppList.className = 'clean-list';
        for (const item of plan.lettura_dati) {
          const li = document.createElement('li');
          li.textContent = item;
          zeppList.appendChild(li);
        }
        zeppCard.appendChild(zeppList);
        container.appendChild(zeppCard);
      }

      // 5. Limiti
      if (plan.limiti && plan.limiti.length > 0) {
        const limCard = document.createElement('section');
        limCard.className = 'card card-limits';

        const limTitle = document.createElement('h3');
        limTitle.className = 'card-title';
        limTitle.textContent = 'Limiti da sapere';
        limCard.appendChild(limTitle);

        const limList = document.createElement('ul');
        limList.className = 'clean-list';
        for (const item of plan.limiti) {
          const li = document.createElement('li');
          li.textContent = item;
          limList.appendChild(li);
        }
        limCard.appendChild(limList);
        container.appendChild(limCard);
      }
    }

    function showResultScreen(plan) {
      currentPlan = plan;
      renderPlanDOM(plan);
      showScreen('result');
    }

    // Azioni Risultato
    el.btnCopyPlan.addEventListener('click', async () => {
      if (!currentPlan) return;
      const text = planToText(currentPlan);
      try {
        await navigator.clipboard.writeText(text);
        showToast('Scheda copiata negli appunti');
      } catch (err) {
        showError('Impossibile copiare il testo.', err.message);
      }
    });

    el.btnSharePlan.addEventListener('click', async () => {
      if (!currentPlan) return;
      const text = planToText(currentPlan);
      if (navigator.share) {
        try {
          await navigator.share({
            title: `WOD → Balance: ${currentPlan.titolo}`,
            text: text
          });
        } catch (err) {
          if (err.name !== 'AbortError') {
            showToast('Condivisione annullata');
          }
        }
      } else {
        // Fallback copia
        try {
          await navigator.clipboard.writeText(text);
          showToast('Scheda copiata (condivisione non supportata dal browser)');
        } catch (err) {
          showError('Impossibile condividere.', err.message);
        }
      }
    });

    el.btnNewWod.addEventListener('click', () => {
      currentShots = [];
      renderThumbnails();
      updateGenerateButtonState();
      el.inputNotes.value = '';
      showScreen('home');
    });

    el.btnRegenerateWithNote.addEventListener('click', () => {
      showScreen('home');
      el.inputNotes.focus();
      el.inputNotes.scrollIntoView({ behavior: 'smooth' });
    });

    // --- VISTA PALESTRA (COULD FEATURE) ---
    async function activateGymMode() {
      if (!currentPlan || !currentPlan.attivita || currentPlan.attivita.length === 0) return;
      gymState.active = true;
      gymState.currentActivityIndex = 0;

      // Wake lock se supportato
      if ('wakeLock' in navigator) {
        try {
          gymState.wakeLockSentinel = await navigator.wakeLock.request('screen');
        } catch (err) {
          // Fallimento silenzioso
        }
      }

      renderGymActivity();
      el.gymOverlay.classList.add('visible');
    }

    function exitGymMode() {
      gymState.active = false;
      if (gymState.wakeLockSentinel) {
        try {
          gymState.wakeLockSentinel.release();
        } catch (e) {}
        gymState.wakeLockSentinel = null;
      }
      el.gymOverlay.classList.remove('visible');
    }

    function renderGymActivity() {
      const act = currentPlan.attivita[gymState.currentActivityIndex];
      const total = currentPlan.attivita.length;

      el.gymTotalHeader.textContent = `Attività ${gymState.currentActivityIndex + 1} di ${total}`;
      el.btnGymPrev.disabled = gymState.currentActivityIndex === 0;
      el.btnGymNext.disabled = gymState.currentActivityIndex === total - 1;

      const container = el.gymActivityContainer;
      container.replaceChildren();

      const actTitle = document.createElement('h2');
      actTitle.className = 'gym-act-title';
      actTitle.textContent = act.nome;
      container.appendChild(actTitle);

      const modeChip = document.createElement('div');
      modeChip.className = `mode-chip chip-${act.tipo_modalita} gym-mode-chip`;
      modeChip.textContent = `Modalità: ${act.modalita_orologio}`;
      container.appendChild(modeChip);

      // Lap in formato extra grande
      if (act.schema_lap && act.schema_lap.length > 0) {
        const lapTitle = document.createElement('div');
        lapTitle.className = 'gym-lap-header';
        lapTitle.textContent = act.lap_per_giro ? `Sequenza Lap (${act.lap_per_giro} per giro):` : 'Sequenza Lap:';
        container.appendChild(lapTitle);

        const lapList = document.createElement('div');
        lapList.className = 'gym-lap-list';
        act.schema_lap.forEach((lap, idx) => {
          const row = document.createElement('div');
          row.className = 'gym-lap-row';

          const num = document.createElement('span');
          num.className = 'gym-lap-num';
          num.textContent = String(idx + 1);

          const desc = document.createElement('span');
          desc.className = 'gym-lap-desc';
          desc.textContent = lap;

          row.appendChild(num);
          row.appendChild(desc);
          lapList.appendChild(row);
        });
        container.appendChild(lapList);

        if (currentPlan.formato === 'AMRAP') {
          const rep = document.createElement('div');
          rep.className = 'gym-amrap-repeat';
          rep.textContent = '↳ Poi ricomincia dal Lap 1';
          container.appendChild(rep);
        }
      } else if (act.esercizi && act.esercizi.length > 0) {
        const exTitle = document.createElement('div');
        exTitle.className = 'gym-lap-header';
        exTitle.textContent = 'Esercizi:';
        container.appendChild(exTitle);

        const exList = document.createElement('ul');
        exList.className = 'gym-ex-list';
        act.esercizi.forEach((ex) => {
          const li = document.createElement('li');
          li.textContent = ex;
          exList.appendChild(li);
        });
        container.appendChild(exList);
      }
    }

    el.btnToggleGymMode.addEventListener('click', activateGymMode);
    el.btnGymClose.addEventListener('click', exitGymMode);
    el.btnGymPrev.addEventListener('click', () => {
      if (gymState.currentActivityIndex > 0) {
        gymState.currentActivityIndex--;
        renderGymActivity();
      }
    });
    el.btnGymNext.addEventListener('click', () => {
      if (gymState.currentActivityIndex < currentPlan.attivita.length - 1) {
        gymState.currentActivityIndex++;
        renderGymActivity();
      }
    });

    if (el.btnForceUpdate) {
      el.btnForceUpdate.addEventListener('click', async () => {
        el.btnForceUpdate.disabled = true;
        el.btnForceUpdate.textContent = 'Aggiornamento…';
        try {
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const r of registrations) {
              await r.unregister();
            }
          }
          if ('caches' in window) {
            const keys = await caches.keys();
            for (const k of keys) {
              await caches.delete(k);
            }
          }
        } catch (e) {}
        window.location.href = window.location.origin + window.location.pathname + '?nocache=' + Date.now();
      });
    }

    // --- SERVICE WORKER & WEB SHARE TARGET (Sezione 12) ---
    async function initPWA() {
      if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
        try {
          const reg = await navigator.serviceWorker.register('sw.js?v=3.3');
          await reg.update();
        } catch (e) {
          // Fallimento silenzioso
        }

        let isRefreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!isRefreshing) {
            isRefreshing = true;
            window.location.reload();
          }
        });
      }

      // Verifica ricezione da Web Share Target
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('shared') && 'caches' in window) {
        try {
          const cache = await caches.open('shared-shots');
          const keys = await cache.keys();
          const sharedFiles = [];

          for (const req of keys) {
            const res = await cache.match(req);
            if (res) {
              const blob = await res.blob();
              let name = 'shared-shot.jpg';
              const nameHdr = res.headers.get('X-Name');
              if (nameHdr) {
                try { name = decodeURIComponent(nameHdr); } catch (e) {}
              }
              const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
              sharedFiles.push(file);
            }
          }

          // Svuota cache
          for (const req of keys) {
            await cache.delete(req);
          }

          // Pulisce l'URL
          window.history.replaceState(null, '', window.location.pathname);

          if (sharedFiles.length > 0) {
            await addFiles(sharedFiles);
            showToast(`${sharedFiles.length} screenshot ricevuti da Condividi`);

            // Se manca la chiave API, apri le impostazioni con un avviso
            const prov = settings.provider;
            const keyGroup = (prov === 'gemini') ? 'gemini' : (prov === 'compat-chat' ? 'compat' : 'openai');
            if (!settings.keys[keyGroup]) {
              el.btnOpenSettings.click();
              showError('Manca la chiave API. Inseriscila prima di analizzare lo screenshot.');
            }
          }
        } catch (err) {
          console.error('Errore lettura shared-shots:', err);
        }
      }
    }

    // Inizializzazione pagina
    populateSettingsUI();
    renderHistoryList();
    updateGenerateButtonState();
    initPWA();
  }

  // --- ESPORTAZIONE MODULO / TEST (NODE.JS & BROWSER) ---
  const publicApi = {
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_MODE_NAMES,
    DEFAULT_MODELS,
    DEFAULT_BASE_URLS,
    buildUserMessage,
    buildRequest,
    extractText,
    parseModelJson,
    validatePlan,
    planToText
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = publicApi;
  }
  if (typeof global !== 'undefined') {
    global.WODBalance = publicApi;
  }

})(typeof window !== 'undefined' ? window : globalThis);
