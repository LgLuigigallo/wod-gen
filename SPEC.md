# WOD → Balance — Specifica completa per l'agente di sviluppo

Versione 1 · 17-11-2026

## 0. Come usare questo file

1. Crea una cartella vuota del progetto in Antigravity.
2. Salva questo file nella root come `SPEC.md`.
3. Incolla all'agente il prompt della sezione 19.
4. Quando l'agente ha finito, esegui la checklist della sezione 16 e le verifiche sul telefono della sezione 18.

Le sezioni 8, 9, 10 e 12 sono contratti precisi: l'agente deve rispettarle alla lettera. Il resto è guida di prodotto e design.

---

## 1. Obiettivo e contesto

L'utente fa CrossFit e allenamenti ibridi. Il coach pubblica il WOD del giorno in un'app di palestra. L'utente ha uno **Amazfit Balance originale** (non Balance 2, non Balance 3) con app **Zepp** su **Android**.

L'app da costruire fa questo:

1. L'utente carica uno o più **screenshot** del WOD (dal selettore file oppure con "Condividi" dall'app di palestra).
2. L'app li manda a un modello AI con visione (Gemini oppure OpenAI/Codex, con chiave API dell'utente).
3. Il modello restituisce un **piano per l'orologio**: quali attività avviare, in quale modalità, quando premere lap, cosa leggere dopo in Zepp.
4. L'app mostra il piano in modo chiaro e leggibile in palestra.

**Cosa l'app NON fa.** Non invia nulla all'orologio. Non esiste un'API pubblica di Zepp per spedire allenamenti da app di terze parti. Non promettere mai l'invio automatico, né in interfaccia né nei testi. L'app è un traduttore: da screenshot a istruzioni operative.

**Contesto d'uso.** Telefono in palestra, una mano, mani sudate, luce forte, poco tempo. Tutto deve essere leggibile a colpo d'occhio e con bersagli grandi.

**Lingua.** Interfaccia e output AI in italiano.

---

## 2. Vincoli reali di Amazfit Balance / Zepp

Questa sezione guida il prompt di sistema (sezione 9). Ogni punto ha uno stato.

| # | Fatto | Stato |
|---|-------|-------|
| 1 | Zepp non offre un'API pubblica per inviare allenamenti da app di terze parti. | Verificato (fonti: documentazione di integrazioni di terze parti) |
| 2 | Il sync automatico di allenamenti strutturati da Intervals.icu, TrainingPeaks e Runna verso Zepp è annunciato per T-Rex 3 Pro e Balance 2. Il Balance originale non risulta in lista. | Verificato; lista ufficiale in Zepp → Workout → My Training Plan |
| 3 | Anche dove funziona, il sync riguarda corsa e ciclismo (nuoto via Terra). Forza ed ellittica non arrivano sull'orologio. | Verificato (forum Intervals.icu, articolo Runna) |
| 4 | Un'attività dell'orologio = una modalità sport. Una modalità multisport per il Balance non è stata trovata. | Non trovata: trattare come non disponibile |
| 5 | Modalità Forza: riconosce 25 esercizi e conta ripetizioni, serie e recuperi. | Verificato (scheda prodotto Amazfit) |
| 6 | Template di allenamento creabili nell'app Zepp e sincronizzati sull'orologio. | Verificato; ricchezza dell'editor non verificata |
| 7 | Lap manuale col tasto basso, con dettagli registrati per ogni lap. | Documentato nel manuale di altri Amazfit (GTR 4). **Non verificato sul Balance originale.** |
| 8 | Allenamento a intervalli dall'orologio: Allenamento → Allenamento a intervalli, con modifica di lavoro, riposo, numero di giri. | Documentato per Balance, solo "per alcune modalità". Non verificato per quali. |
| 9 | Calorie per singolo esercizio dentro un'attività mista. | Assunto NON disponibile. Kcal per attività: sì. Kcal per lap: non verificato. |
| 10 | Il passo ha senso solo sui lap di corsa. Sui lap di forza/trasporti la distanza GPS va ignorata. | Logica di prodotto |
| 11 | L'utente ha usato finora la modalità "Esercizi a corpo libero" per tutto (60 min), perdendo passo e dettaglio. | Dato dell'utente |

**Mappa delle modalità che l'app può nominare** (nomi come nel menu italiano dell'orologio; l'utente li può correggere nelle impostazioni):

- `Esercizi a corpo libero`
- `Forza`
- `Corsa all'aperto`
- `Corsa su tapis`

Non inventare altre modalità. Se serve altro, il modello lo scrive in `assunzioni` o `limiti`.

**Codex.** "Codex" non ha un'API separata per questo uso: si usano modelli OpenAI (inclusi quelli "codex") con una **chiave API OpenAI**. Un login ChatGPT/Codex CLI senza chiave API non può essere usato da una web-app. Scrivilo nell'aiuto delle impostazioni.

---

## 3. Scelte tecniche

- **PWA** statica: HTML + CSS + JavaScript vanilla (ES modules ammessi). Nessun framework, nessuna dipendenza npm a runtime, nessun backend.
- **Nessun build step obbligatorio.** Deve funzionare servita da qualsiasi hosting statico HTTPS (GitHub Pages, Netlify, Cloudflare Pages).
- **Installabile su Android** da Chrome ("Installa app") e **destinazione di "Condividi"** per le immagini (sezione 12).
- **Offline per l'interfaccia** (service worker con cache dell'app shell). L'analisi AI richiede rete.
- Le chiamate AI partono **direttamente dal browser** verso i provider. Nessun server intermedio. Se il CORS dovesse bloccare un provider, l'utente può mettere un proprio proxy nel campo "Base URL" (sezione 8).
- Fuori scope v1: APK nativo. Se in futuro serve, valutare Capacitor o TWA (Bubblewrap).

---

## 4. Funzioni (MoSCoW)

**Must**
- Carica 1–4 screenshot dal selettore file; anteprima con rimozione singola.
- Riduzione e compressione delle immagini prima dell'invio (sezione 8.1).
- Opzioni per generazione: corsa (all'aperto / su tapis), rest (come da screenshot / nessuno, sincro col compagno), carichi (come scritti / converti lb in kg), note libere.
- Provider AI selezionabile: Gemini, OpenAI Responses, OpenAI Chat Completions, compatibile OpenAI (Base URL personalizzato).
- Impostazioni: chiave API, modello, Base URL, prompt di sistema modificabile con ripristino.
- Generazione scheda → JSON validato → rendering (sezione 11).
- Copia scheda come testo e condividi (Web Share API).
- Gestione errori chiara (sezione 13).
- Installabile + riceve immagini da "Condividi" (sezione 12).

**Should**
- Cronologia ultime 10 schede (solo JSON, senza immagini).
- Pulsante "Carica elenco modelli" per ogni provider, per non dipendere da nomi modello che cambiano.
- Pulsante "Test connessione".
- Opzione "Ricorda la chiave su questo dispositivo" (se spenta, solo sessione).
- Preferenze di generazione ricordate.
- Un solo tentativo automatico di nuova richiesta se il JSON non è valido.

**Could**
- Vista "Palestra": un'attività alla volta a schermo intero, numeri grandi, tasto avanti/indietro, schermo sempre acceso (Wake Lock API, con try/catch).
- Esportazione cronologia in JSON.

**Won't (v1)**
- Account, sincronizzazione cloud, invio a Zepp, analisi dei dati dopo l'allenamento, API Zepp non ufficiali.

---

## 5. Schermate e flussi

### 5.1 Home ("Nuovo WOD")
- Intestazione con nome app e pulsante Impostazioni.
- Area screenshot: pulsante grande "Scegli screenshot" (input file `accept="image/*" multiple`). Miniature con "×".
- Opzioni (controlli segmentati a due scelte, bersagli ≥ 48 px):
  - Corsa: `All'aperto` | `Su tapis`
  - Rest: `Come da screenshot` | `Nessuno (sincro col compagno)`
  - Carichi: `Come scritti` | `lb → kg`
- Campo "Note per l'AI" (opzionale, una riga che si espande).
- Pulsante primario fisso in basso: "Genera scheda". Disabilitato senza immagini o senza chiave; il motivo è scritto accanto, non solo grigio.
- Sotto: "Schede recenti" (se esistono).

### 5.2 In attesa
- Stato di caricamento con testo che dice cosa succede ("Lettura dello screenshot…", poi "Costruzione della scheda…"). Pulsante "Annulla" (AbortController).

### 5.3 Risultato
- Titolo del WOD e formato in testata.
- Riepilogo in una frase.
- Blocco **Assunzioni** subito sotto, ben visibile se non vuoto (l'utente deve poter correggere: "il titolo dice For Time ma il corpo è AMRAP").
- Una sezione per ogni attività dell'orologio, nell'ordine di esecuzione (sezione 11).
- **Lettura dati in Zepp** e **Limiti** in fondo.
- Barra azioni: "Copia scheda", "Condividi", "Nuovo WOD".
- Pulsante "Rigenera con una nota" che torna alla Home con le immagini ancora caricate e il campo note attivo.

### 5.4 Impostazioni (pannello a schermo intero)
Campi nella sezione 7. Testi di aiuto brevi sotto ogni campo.

### 5.5 Arrivo da "Condividi"
- All'apertura con `?shared=N`, l'app legge le immagini dalla cache (sezione 12), le mette nell'area screenshot e mostra la Home. Se la chiave manca, apre prima le Impostazioni con un messaggio.

---

## 6. Design

**Soggetto:** strumento operativo da palestra, usato tra una serie e l'altra. Deve sembrare un cartellone da box (lavagna del coach), non un'app di benessere.

**Direzione**
- Scuro di default, tema chiaro automatico con `prefers-color-scheme`. Contrasto almeno AA ovunque, verificare anche in tema chiaro.
- Una sola cosa memorabile: la **sequenza dei lap** come righe grandi numerate (qui la numerazione è informazione vera: è un ordine di pressione del tasto).
- Il resto resta sobrio. Niente gradienti decorativi, niente ombre sotto ogni elemento, niente raggio di curvatura uguale ovunque.

**Palette (tema scuro)**

| Ruolo | Nome | Hex |
|-------|------|-----|
| Sfondo | Lavagna | `#12161A` |
| Superficie | Cemento | `#1C2228` |
| Testo | Gesso | `#EDEBE4` |
| Azione e lap | Segnale | `#FFC21A` |
| Modalità Corpo libero | Menta | `#6FD3C0` |
| Modalità Forza | Viola | `#9B8CFF` |
| Modalità Corsa | Cielo | `#4DA3FF` |
| Errore | Rosso | `#FF5C5C` |

Tema chiaro: sfondo `#F3F5F6`, superficie `#FFFFFF`, testo `#12161A`, accento `#9A6700` (ambra scura per contrasto). Ricalcolare i colori modalità per il contrasto su bianco.

La **modalità sport** si codifica con colore **e** testo **e** una barra verticale a sinistra della sezione: mai solo colore.

**Tipografia**
- Stack di sistema (`system-ui, "Segoe UI", Roboto, sans-serif`): l'app deve funzionare offline senza font esterni.
- Cifre tabulari (`font-variant-numeric: tabular-nums`).
- Corpo 17 px, interlinea 1,45, righe sotto 60 caratteri.
- Numeri dei lap: 28–32 px, peso 700. Titoli di sezione: 20–22 px, peso 650.
- Evitare titoli in maiuscolo con spaziatura larga, etichette sopra ogni blocco, frecce `→` aggiunte ai pulsanti.

**Interazione e accessibilità**
- Bersagli tocco ≥ 48×48 px. Focus visibile da tastiera. `prefers-reduced-motion` rispettato.
- Movimento solo come risposta a un'azione (apertura pannello, conferma copia). Nessuna animazione d'ingresso sulle sezioni.
- Larghezza massima del contenuto 640 px, centrato su schermi larghi; padding laterale 16 px; nessuno scroll orizzontale.

**Testi dell'interfaccia** (frasi brevi, verbi diretti, sentence case)
- Pulsanti: "Scegli screenshot", "Genera scheda", "Copia scheda", "Condividi", "Nuovo WOD", "Impostazioni", "Carica modelli", "Test connessione", "Ripristina prompt".
- Errori: dicono cosa è successo e come risolvere, senza scuse (esempi nella sezione 13).
- Stato vuoto della Home: "Carica lo screenshot del WOD del giorno. Ti dico quali attività avviare sull'orologio e quando premere lap."

---

## 7. Impostazioni e storage

Tutto in `localStorage`, con ogni accesso in `try/catch` (l'app deve funzionare anche se lo storage è vuoto o bloccato).

| Chiave | Contenuto | Default |
|--------|-----------|---------|
| `wb.provider` | `gemini` \| `openai-responses` \| `openai-chat` \| `compat-chat` | `gemini` |
| `wb.keys` | oggetto `{gemini, openai, compat}` con le chiavi | vuoto |
| `wb.rememberKey` | booleano; se falso la chiave sta in `sessionStorage` | `true` |
| `wb.model.<provider>` | stringa modello per provider | vedi sotto |
| `wb.baseUrl.openai` | stringa | `https://api.openai.com/v1` |
| `wb.baseUrl.compat` | stringa | vuoto |
| `wb.systemPrompt` | stringa; se vuota si usa il predefinito | vuoto |
| `wb.prefs` | `{corsa, rest, carichi}` | `{aperto, screenshot, scritti}` |
| `wb.modeNames` | i 4 nomi di modalità, modificabili | quelli della sezione 2 |
| `wb.history` | array max 10 di `{id, ts, titolo, json}` | `[]` |

**Modelli di partenza** (campo testo libero con `datalist`; i nomi cambiano spesso, per questo esiste "Carica modelli"):
- Gemini: `gemini-flash-latest` (alias che punta all'ultimo Flash). Alternativa nota: `gemini-2.5-flash`.
- OpenAI: `gpt-5-mini`. Per modelli Codex: `gpt-5-codex` (solo con API **Responses**).

Il campo modello non deve mai essere un menu chiuso.

**Pannello impostazioni:** provider, chiave (campo password con mostra/nascondi), modello + "Carica modelli", Base URL (visibile solo per OpenAI e compatibile), interruttore "Ricorda la chiave su questo dispositivo", editor del prompt di sistema con "Ripristina prompt", editor dei nomi modalità, "Test connessione", testo di aiuto su Codex (sezione 2) e sulla sicurezza della chiave (sezione 14).

---

## 8. Integrazione AI (contratto)

Tutte le chiamate usano `fetch` con `AbortController` e timeout di 90 s. Nessuna libreria SDK.

### 8.1 Preparazione immagini
- Leggere il file in `Image`/`createImageBitmap`, ridurre al lato lungo **massimo 2048 px** (gli screenshot da telefono sono già circa 2048: non ridurre sotto, il testo deve restare leggibile).
- Esportare **JPEG qualità 0,9** con `canvas.toBlob`, poi base64 (senza prefisso `data:`).
- Massimo 4 immagini. Se una pesa più di 4 MB dopo la compressione, riprovare con qualità 0,8.

### 8.2 Messaggio utente (identico per tutti i provider)
```text
Opzioni utente:
- Corsa: {all'aperto | su tapis}
- Rest: {come da screenshot | nessun rest (sincro col compagno)}
- Carichi: {come scritti | converti lb in kg}
- Nomi modalità dell'orologio: {elenco dei 4 nomi correnti}
- Note: {testo libero oppure "nessuna"}
Allegati: {n} screenshot. Produci il JSON richiesto.
```

### 8.3 Gemini
- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Header: `Content-Type: application/json`, `x-goog-api-key: {chiave}` (non mettere la chiave nell'URL).
- Corpo:
```json
{
  "systemInstruction": { "parts": [{ "text": "<SYSTEM_PROMPT>" }] },
  "contents": [{
    "role": "user",
    "parts": [
      { "text": "<MESSAGGIO_UTENTE>" },
      { "inlineData": { "mimeType": "image/jpeg", "data": "<BASE64>" } }
    ]
  }],
  "generationConfig": { "responseMimeType": "application/json", "temperature": 0.2 }
}
```
- Risposta: unire i `text` di `candidates[0].content.parts`. Se `candidates` è vuoto, leggere `promptFeedback.blockReason` e mostrarlo.
- Elenco modelli: `GET https://generativelanguage.googleapis.com/v1beta/models` (stesso header). Tenere solo quelli con `generateContent` in `supportedGenerationMethods`; togliere il prefisso `models/`.

### 8.4 OpenAI — Responses (consigliata per modelli Codex)
- Endpoint: `POST {baseUrl}/responses`
- Header: `Authorization: Bearer {chiave}`, `Content-Type: application/json`.
- Corpo (non inviare `temperature`: alcuni modelli di ragionamento lo rifiutano):
```json
{
  "model": "<MODELLO>",
  "instructions": "<SYSTEM_PROMPT>",
  "input": [{
    "role": "user",
    "content": [
      { "type": "input_text", "text": "<MESSAGGIO_UTENTE>" },
      { "type": "input_image", "image_url": "data:image/jpeg;base64,<BASE64>" }
    ]
  }],
  "text": { "format": { "type": "json_object" } }
}
```
- Risposta: percorrere `output[]`, prendere gli elementi `type === "message"`, e di ognuno i `content[]` con `type === "output_text"`; unire i `text`. Non contare sul campo comodo `output_text` (esiste solo negli SDK).

### 8.5 OpenAI — Chat Completions (e "compatibile")
- Endpoint: `POST {baseUrl}/chat/completions`
- Header: come sopra.
- Corpo (nessun `max_tokens`, nessuna `temperature`):
```json
{
  "model": "<MODELLO>",
  "messages": [
    { "role": "system", "content": "<SYSTEM_PROMPT>" },
    { "role": "user", "content": [
      { "type": "text", "text": "<MESSAGGIO_UTENTE>" },
      { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,<BASE64>" } }
    ]}
  ],
  "response_format": { "type": "json_object" }
}
```
- Risposta: `choices[0].message.content`.
- La modalità `json_object` richiede che la parola "JSON" compaia nei messaggi: il prompt di sistema (sezione 9) la contiene.
- Per il provider "compatibile" la `Base URL` è obbligatoria; se il servizio non supporta `response_format`, ritentare una volta senza.
- Elenco modelli: `GET {baseUrl}/models` → `data[].id`, ordinato alfabeticamente.

### 8.6 Estrazione e validazione del JSON
1. Prendere il testo grezzo della risposta.
2. Togliere eventuali recinti di codice markdown (la riga di apertura con tre apici inversi, con o senza la parola json, e quella di chiusura).
3. Prendere la sottostringa dal primo `{` all'ultimo `}`.
4. `JSON.parse`. Se fallisce: **un** nuovo tentativo con in coda al messaggio utente "La risposta precedente non era JSON valido. Rispondi solo con il JSON." Se fallisce ancora: errore con testo grezzo espandibile.
5. Validare con una funzione scritta a mano (nessuna libreria) contro lo schema della sezione 10. Campi mancanti non fatali (array → `[]`, stringhe → `""`); `attivita` vuoto o assente è un errore.

---

## 9. Prompt di sistema predefinito

Salvarlo come costante e come valore di ripristino. L'utente lo può modificare nelle impostazioni.

```text
Sei un traduttore di allenamenti per Amazfit Balance (versione originale). Ricevi uno o più screenshot del WOD del giorno (CrossFit, allenamenti ibridi) e alcune opzioni dell'utente. Devi produrre un piano pratico per usare l'orologio, restituito come JSON.

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
15. "schema_lap" è l'elenco ordinato delle pressioni del tasto lap per un giro. Se l'attività non usa lap, array vuoto e "lap_per_giro" null.
```

---

## 10. Schema di output e validazione

Tipi, come nel prompt. Regole di validazione:
- `attivita` obbligatorio, almeno 1 elemento.
- `tipo_modalita` fuori dall'elenco → `altro`.
- `schema_lap` e `esercizi`: array di stringhe; qualsiasi elemento non stringa va convertito con `String()`.
- Tutto ciò che il modello restituisce è **testo non fidato**: mai `innerHTML`.

**Esempio di output atteso** (WOD del 16-11-2026, opzioni: corsa all'aperto, nessun rest, carichi come scritti):

```json
{
  "titolo": "Functional Hero X",
  "formato": "AMRAP",
  "durata_totale_min": 20,
  "riepilogo": "Riscaldamento, step up a carico crescente, poi 20 minuti AMRAP con corsa e stazioni di forza.",
  "assunzioni": [
    "Il titolo dice For Time ma il WOD descrive un 20 min AMRAP: seguo l'AMRAP.",
    "Carichi 2x50/35 riportati come scritti: due manubri, valori maschile/femminile.",
    "Nessun rest: recuperi mentre lavora il compagno."
  ],
  "attivita": [
    {
      "nome": "Riscaldamento: Barbell Prep",
      "modalita_orologio": "Esercizi a corpo libero",
      "tipo_modalita": "corpo_libero",
      "obbligatoria": false,
      "preparazione": [],
      "esercizi": [
        "3 giri:",
        "5 Roll and Reach",
        "10 Deadbug",
        "10 Dynamic Squat Stretch",
        "5 World's Greatest Stretch (L/R)",
        "5 Back Squat a vuoto, tempo 3:1:2:1"
      ],
      "schema_lap": [],
      "lap_per_giro": null,
      "note": ["Opzionale: puoi saltare la registrazione del riscaldamento."]
    },
    {
      "nome": "Forza: Back Rack Box Step Up",
      "modalita_orologio": "Forza",
      "tipo_modalita": "forza",
      "obbligatoria": true,
      "preparazione": [],
      "esercizi": [
        "Ogni 3 minuti, 3 serie",
        "Serie 1: 8 per gamba",
        "Serie 2: 6 per gamba",
        "Serie 3: 4 per gamba",
        "Carico libero, crescente"
      ],
      "schema_lap": [],
      "lap_per_giro": null,
      "note": [
        "Se lo step up non è riconosciuto dall'orologio, conta le serie a mano.",
        "Il timer da 3 minuti segui quello della palestra."
      ]
    },
    {
      "nome": "WOD: 20 min AMRAP",
      "modalita_orologio": "Corsa all'aperto",
      "tipo_modalita": "corsa",
      "obbligatoria": true,
      "preparazione": [
        "Auto-lap: spento.",
        "Auto-pausa: spenta.",
        "Avvia al via del coach.",
        "Lap manuale col tasto basso."
      ],
      "esercizi": [
        "500 m corsa",
        "15 DB Front Squat (2x50/35)",
        "50 m Farmers Carry (2x50/35)",
        "500 m corsa",
        "15 DB Deadlift (2x50/35)",
        "20 m Sled Push con box"
      ],
      "schema_lap": [
        "Corsa 500 m: premi lap a fine corsa.",
        "15 Front Squat + 50 m Farmers Carry: premi lap a fine Farmers.",
        "Corsa 500 m: premi lap a fine corsa.",
        "15 Deadlift + 20 m Sled Push: premi lap a fine Sled, poi ricomincia."
      ],
      "lap_per_giro": 4,
      "note": [
        "Conta i giri a mano.",
        "Nessun lap di riposo: recuperi mentre lavora il compagno."
      ]
    }
  ],
  "lettura_dati": [
    "Lap di corsa: passo e frequenza cardiaca.",
    "Lap di forza: tempo e frequenza cardiaca. Ignora la distanza GPS.",
    "Totale attività: calorie e frequenza cardiaca dei 20 minuti."
  ],
  "limiti": [
    "Calorie per singolo esercizio non disponibili.",
    "Calorie per lap non garantite: da verificare in Zepp."
  ]
}
```

---

## 11. Rendering della scheda

Ordine: testata (titolo, formato, durata) → riepilogo → assunzioni → attività → lettura dati → limiti → barra azioni.

**Ogni attività** è una sezione con barra verticale del colore della modalità e, in testa:
- nome dell'attività;
- chip con `modalita_orologio` (testo + colore);
- se `obbligatoria` è falso, etichetta "Opzionale".

Dentro la sezione, nell'ordine:
1. **Prima di avviare** (`preparazione`), se non vuota: righe con casella ☐ **solo grafica**, senza stato salvato.
2. **Cosa fai** (`esercizi`): lista semplice.
3. **Lap** (`schema_lap`), se non vuota: righe **numerate e grandi** (numero 28–32 px in accento "Segnale", testo a fianco). Sopra, "N lap per giro" se `lap_per_giro` esiste. Dopo l'ultima riga: "Poi ricomincia dal lap 1" **solo se** il formato è AMRAP.
4. **Note** (`note`).

**Testo copiabile** ("Copia scheda"): stesso ordine, testo semplice, per ogni attività `Nome (Modalità)` poi righe con trattino, lap numerati `1.`, `2.`…

Tutto con `textContent`. Nessun `innerHTML` con dati del modello.

---

## 12. Condivisione da Android (Web Share Target)

Obiettivo: dall'app di palestra, "Condividi" → "WOD Balance", e l'app si apre con le immagini già caricate.

Requisiti: PWA **installata da Chrome su Android**, servita in **HTTPS**. Non funziona aprendo il file `index.html` in locale.

### 12.1 `manifest.webmanifest`
```json
{
  "name": "WOD → Balance",
  "short_name": "WOD Balance",
  "lang": "it",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#12161A",
  "theme_color": "#12161A",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "share_target": {
    "action": "./share-target",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "files": [{ "name": "shots", "accept": ["image/*"] }]
    }
  }
}
```

### 12.2 `sw.js`
- Evento `install`: precache dell'app shell (`./`, `index.html`, `manifest.webmanifest`, icone). `skipWaiting()`.
- Evento `activate`: elimina le cache vecchie. `clients.claim()`.
- Evento `fetch`:
  - Se `POST` e il percorso termina con `/share-target`: leggere `await request.formData()`, prendere `getAll('shots')`, **svuotare** la cache `shared-shots`, salvare ogni file con `cache.put(<URL assoluto basato su registration.scope>/shot-<i>, new Response(file, { headers: { 'Content-Type': file.type, 'X-Name': file.name } }))`, poi rispondere con `Response.redirect(new URL('./?shared=' + n, self.registration.scope).href, 303)`.
  - Se `GET` stessa origine: cache first, poi rete.
  - **Mai** mettere in cache le chiamate verso i provider AI (origini diverse): lasciarle passare.
- Versione della cache in una costante (`wb-v1`), da incrementare a ogni rilascio.

### 12.3 Lato pagina
- Registrare il service worker solo se `'serviceWorker' in navigator` e il protocollo è HTTPS o localhost.
- All'avvio, se `location.search` contiene `shared=`: aprire la cache `shared-shots`, leggere le risposte, creare `File` con `new File([blob], nome, { type })`, **svuotare** la cache, poi `history.replaceState(null, '', location.pathname)`.
- Se il file `index.html` è aperto in locale (senza service worker), l'app funziona comunque con il selettore file.

---

## 13. Errori (testi in italiano, azionabili)

| Caso | Messaggio |
|------|-----------|
| Nessuna chiave | "Manca la chiave API. Aprila in Impostazioni." (pulsante diretto) |
| 401 / 403 | "Il provider ha rifiutato la chiave. Controlla chiave e provider in Impostazioni." |
| 404 sul modello | "Modello non trovato. Usa Carica modelli e sceglilo dall'elenco." |
| 429 | "Troppe richieste o credito finito. Riprova tra poco o controlla il piano del provider." |
| Rete / CORS | "Richiesta non riuscita. Controlla la connessione. Se usi un provider personalizzato, controlla Base URL e CORS." |
| Timeout | "Il modello non ha risposto in 90 secondi. Riprova." |
| Risposta bloccata (Gemini `blockReason`) | "Il provider ha bloccato la richiesta: {motivo}." |
| JSON non valido dopo il retry | "La risposta non era nel formato atteso." + testo grezzo espandibile + "Riprova" |
| Immagine non leggibile | "Non riesco a leggere questa immagine. Prova con uno screenshot in JPG o PNG." |

Il messaggio d'errore del provider (`error.message`) va sempre mostrato in un dettaglio espandibile, per il debug.

---

## 14. Sicurezza e privacy

- La chiave API resta **solo sul dispositivo** (`localStorage`/`sessionStorage`) e viaggia solo verso il provider scelto. Nessuna analitica, nessun server proprio.
- Testo di aiuto nelle impostazioni: "La chiave è salvata su questo telefono. Usa una chiave con limite di spesa e non condividere il telefono sbloccato."
- Gli screenshot vanno al provider scelto e non sono salvati dall'app. La cronologia contiene solo il JSON risultante.
- Content Security Policy consigliata nel `<meta>`: `default-src 'self'; img-src 'self' blob: data:; connect-src 'self' https://generativelanguage.googleapis.com https://api.openai.com https:; style-src 'self' 'unsafe-inline'; script-src 'self'`. Il `https:` in `connect-src` serve per Base URL personalizzati: se l'agente preferisce, lo renda configurabile.
- Nessun `eval`, nessun `innerHTML` con dati esterni.

---

## 15. Struttura dei file

```text
/
├─ index.html
├─ app.js              (logica, provider, rendering)
├─ styles.css
├─ sw.js
├─ manifest.webmanifest
├─ icon-192.png
├─ icon-512.png
├─ icon-512-maskable.png
├─ README.md           (deploy e installazione, sezione 17)
└─ test/
   ├─ fixtures/wod-2026-11-16.txt     (testo dello screenshot di esempio, sezione 16)
   └─ expected/wod-2026-11-16.json    (output atteso, sezione 10)
```

Le icone devono avere un segno semplice e riconoscibile (per esempio un cronometro con il tasto lap in accento "Segnale" su fondo "Lavagna"). L'icona maskable deve tenere il disegno dentro il 60% centrale.

Separare in `app.js` funzioni pure e testabili: `buildUserMessage`, `buildRequest(provider, …)`, `extractText(provider, response)`, `parseModelJson`, `validatePlan`, `planToText`. Così si possono testare con `fetch` simulato, senza rete.

---

## 16. Test e criteri di accettazione

### 16.1 Fixture di prova
Testo dello screenshot di esempio (WOD del 16-11-2026, app di palestra italiana):

```text
functional hero x
For Time

WARMUP
Barbell Prep
3 Sets
- 5 Roll and Reach
- 10 Deadbug
- 10 Dynamic Squat Stretch
- 5 Worlds Greatest Stretch (L/R)
- 5 Tempo "Perfect" Empty Barbell Back Squat (3:1:2:1)

Back Rack Step Up for load:
every 3'
8 Back Rack Box Step Up (each leg)
6 Back Rack Box Step Up (each leg)
4 Back Rack Box Step Up (each leg)

WOD
Mixed Extensive Intervals
20 min AMRAP
500m Run
15 DB Front Squats (2x50/35)
50m Farmers Carry (2x50/35)
500m run
15 DB Deadlifts (2x50/35)
20 mt Sled Push with box
-rest 1 min b/t sets with active walk-
```

Con opzioni "corsa all'aperto / nessun rest (sincro col compagno) / carichi come scritti", l'output deve **combaciare nella sostanza** con l'esempio della sezione 10: 3 attività, WOD in modalità corsa, **4 lap per giro**, nessun lap di riposo, assunzione sul titolo For Time contro AMRAP.

### 16.2 Test automatici (senza rete)
1. `buildRequest` produce per ciascun provider un corpo conforme alle sezioni 8.3, 8.4, 8.5 (confronto con snapshot), con la chiave nell'header e **non** nell'URL per Gemini.
2. `extractText` estrae il testo da risposte simulate dei tre formati, incluso Responses con più elementi in `output[]`.
3. `parseModelJson` accetta JSON puro, JSON dentro un recinto di codice markdown, JSON con testo prima e dopo; rifiuta testo senza graffe.
4. `validatePlan` accetta l'esempio della sezione 10, rifiuta `attivita` vuoto, normalizza campi mancanti.
5. `planToText` dell'esempio contiene i 4 lap numerati e la riga della modalità di ogni attività.
6. Nessun uso di `innerHTML` con dati del modello (cercare nel codice).

### 16.3 Checklist manuale
- [ ] Carico 1 screenshot dal selettore, vedo la miniatura, la tolgo, la ricarico.
- [ ] Con chiave Gemini valida e modello `gemini-flash-latest`, "Genera scheda" restituisce una scheda coerente con la fixture.
- [ ] Stessa cosa con OpenAI Responses (`gpt-5-codex` o `gpt-5-mini`) e con Chat Completions.
- [ ] "Carica modelli" popola l'elenco per entrambi i provider.
- [ ] "Test connessione" dà esito chiaro sia con chiave giusta sia sbagliata.
- [ ] "Copia scheda" e "Condividi" funzionano.
- [ ] Le preferenze e la chiave restano dopo la chiusura dell'app.
- [ ] Tema scuro e chiaro leggibili. Nessuno scroll orizzontale a 360 px di larghezza.
- [ ] Dopo l'installazione, dall'app di palestra "Condividi" → "WOD Balance" apre l'app con lo screenshot già caricato.
- [ ] Senza rete l'interfaccia si apre; "Genera scheda" mostra l'errore di rete corretto.

---

## 17. Deploy e installazione su Android

`README.md` del progetto deve contenere questi passi:

**Hosting (scegline uno)**
- GitHub Pages: pubblica il contenuto della root del repository.
- Netlify: trascina la cartella del progetto su Netlify Drop.
- Cloudflare Pages: collega il repository o carica la cartella.

**Installazione sul telefono**
1. Apri l'indirizzo HTTPS con **Chrome** su Android.
2. Menu ⋮ → **Installa app** (o "Aggiungi a schermata Home" se Chrome propone questa voce).
3. Apri l'app, vai in Impostazioni, scegli il provider e incolla la chiave API.
4. Prova: dall'app di palestra apri il WOD, fai screenshot, poi **Condividi** → WOD Balance.

**Senza hosting (modalità ridotta):** aprire `index.html` da un file manager con Chrome. Funziona il selettore file e l'analisi AI, ma non l'installazione né "Condividi".

**Aggiornamenti:** a ogni modifica incrementare la versione della cache nel service worker.

---

## 18. Punti NON verificati (da controllare sul telefono e sull'orologio)

L'agente deve elencarli nel `README.md` e non presentarli come certezze.

1. Il lap manuale col tasto basso funziona nel **Balance originale** nelle modalità Corsa all'aperto e Corsa su tapis, e registra i dettagli per lap visibili in Zepp.
2. Zepp mostra **kcal per lap**. Se no, la riga di `lettura_dati` va corretta nel prompt.
3. La modalità Forza riconosce lo **step up con bilanciere**. Altrimenti conteggio manuale.
4. L'**Allenamento a intervalli** dell'orologio è disponibile per Forza e Corsa, con lavoro/riposo/giri modificabili.
5. L'editor dei **template** Zepp consente voci personalizzate, e quali modalità lo accettano.
6. Il **nome italiano esatto** di ogni modalità nel menu dell'orologio (campo modificabile nelle impostazioni).
7. Le chiamate **dirette dal browser** (CORS) funzionano per Gemini, OpenAI Responses e Chat Completions con le chiavi dell'utente.
8. Il **Web Share Target** con immagini funziona sul telefono dell'utente dopo l'installazione.
9. I **nomi modello** di partenza sono ancora validi: usare "Carica modelli" e correggere i valori predefiniti.

---

## 19. Prompt da incollare nell'agente

```text
Leggi SPEC.md nella root del progetto e costruisci l'app "WOD → Balance" esattamente come descritta: una PWA statica in HTML, CSS e JavaScript vanilla, senza dipendenze a runtime e senza backend.

Priorità:
1. Rispetta alla lettera i contratti delle sezioni 8 (chiamate ai provider), 9 (prompt di sistema), 10 (schema JSON) e 12 (Web Share Target).
2. Implementa tutte le funzioni Must e Should della sezione 4; le Could solo se resta tempo.
3. Segui il design della sezione 6 (palette, tipografia, bersagli ≥ 48 px, nessun innerHTML con dati del modello).
4. Scrivi i test della sezione 16.2 con fetch simulato (nessuna rete) ed eseguili. Mostrami l'esito.
5. Crea icone PNG semplici (192, 512, 512 maskable) e il README.md della sezione 17, includendo l'elenco dei punti non verificati della sezione 18.

Non inventare funzioni dell'orologio o di Zepp: l'app non invia nulla all'orologio. Se una scelta non è coperta dalla specifica, scegli la più semplice e annotala nel README.
```
