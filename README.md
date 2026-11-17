# WOD → Balance

> Traduttore di allenamenti da screenshot del WOD a istruzioni pratiche per **Amazfit Balance (originale)** con app **Zepp** su **Android**.

---

## 1. Che cos'è l'app

L'app risolve il problema tipico di chi si allena a CrossFit / ibrido con un Amazfit Balance:
1. Carichi uno o più screenshot del WOD (o li condividi direttamente dall'app di palestra).
2. L'AI analizza il WOD e produce una scheda operativa per l'orologio:
   - Quale modalità sport avviare per ciascuna fase (Esercizi a corpo libero, Forza, Corsa all'aperto, Corsa su tapis).
   - Cosa fare prima di avviare (spegnere auto-lap e auto-pausa).
   - Sequenza ordinata e numerata di pressione del tasto Lap (tasto fisico inferiore).
   - Come interpretare i dati registrati su Zepp e quali limiti considerare (distanza GPS da ignorare nelle stazioni di forza, calorie complessive vs per esercizio).

> **Cosa l'app NON fa:** Non invia nulla all'orologio né all'app Zepp. Non esistono API pubbliche di Zepp per inviare allenamenti da app terze. L'app è uno strumento di supporto visivo e operativo per l'atleta.

---

## 2. Architettura Tecnica

- **PWA statica:** HTML5 semantico, CSS moderno con variabili e contrasto AA, JavaScript Vanilla (ES modules).
- **Nessuna dipendenza runtime e nessun backend:** Funziona su qualsiasi hosting statico HTTPS o in locale.
- **Installabile su Android:** PWA con manifest e Web Share Target (`POST /share-target`) per ricevere immagini con "Condividi".
- **Offline:** Service worker con cache shell (`wb-v1`). L'interfaccia si apre sempre anche in assenza di connessione.
- **Sicurezza:** Chiavi API salvate esclusivamente in locale (`localStorage` o `sessionStorage`), CSP restrittivo, nessun `innerHTML` con dati provenienti dal modello AI.

---

## 3. Deploy e Installazione su Android (Sezione 17)

### Hosting consigliato (scegline uno)

- **GitHub Pages:**
  1. Crea un repository GitHub con i file del progetto.
  2. Vai su **Settings** → **Pages**.
  3. Imposta la sorgente su `Deploy from a branch` → `main` / `root`.
- **Netlify:**
  1. Accedi a [Netlify Drop](https://app.netlify.com/drop).
  2. Trascina la cartella del progetto: il sito sarà online in HTTPS in pochi secondi.
- **Cloudflare Pages:**
  1. Collega il repository o fai l'upload diretto della cartella.

### Installazione sul telefono Android

1. Apri l'indirizzo HTTPS su **Google Chrome** su Android.
2. Tocca il menu ⋮ (tre puntini in alto a destra) e seleziona **Installa app** (oppure *Aggiungi a schermata Home*).
3. Apri l'app appena installata dalla schermata principale.
4. Tocca **⚙️ Impostazioni**:
   - Scegli il tuo provider (Google Gemini, OpenAI Responses, OpenAI Chat, o Compatibile).
   - Incolla la tua chiave API.
   - Tocca **Test connessione** o **Carica modelli** per verificare il funzionamento.
5. **Prova sul campo:**
   - Apri l'app del tuo box / palestra con il WOD del giorno.
   - Fai uno screenshot.
   - Dalla galleria o dal selettore di condivisione tocca **Condividi** → **WOD Balance**.
   - L'app si apre con lo screenshot già caricato: tocca **Genera scheda**.

### Utilizzo senza hosting (modalità ridotta)

È possibile aprire `index.html` direttamente con Chrome su Android da un file manager locale.
- Funzionano: selettore file, analisi AI, cronologia e copia testo.
- Non funzionano: installazione come PWA e ricezione da "Condividi" (richiedono protocollo HTTPS e Service Worker).

### Aggiornamenti

Ad ogni modifica del codice o rilascio, incrementare la costante `CACHE_NAME` in `sw.js` (es. `wb-v2`, `wb-v3`) per aggiornare la cache dell'app shell sui dispositivi degli utenti.

---

## 4. Punti NON verificati (da controllare sul telefono e sull'orologio) (Sezione 18)

I seguenti punti non sono stati dati per certi durante lo sviluppo e vanno verificati dall'utente:

1. **Lap manuale con tasto basso:** Verificare se sul Balance originale il tasto inferiore fisico registra effettivamente i lap manuali nelle modalità *Corsa all'aperto* e *Corsa su tapis*, e se l'app Zepp mostra i dettagli separati per ciascun lap.
2. **Kcal per lap in Zepp:** Verificare se Zepp mostra le calorie per singolo lap o solo per l'attività complessiva. Se non compaiono, la voce è indicata nei limiti da sapere.
3. **Riconoscimento esercizi Forza:** Verificare se la modalità Forza del Balance riconosce lo *step up con bilanciere*. In caso contrario, l'app suggerisce il conteggio manuale delle serie.
4. **Allenamento a intervalli integrato nell'orologio:** Verificare sul Balance se il menu *Allenamento → Allenamento a intervalli* è disponibile per le modalità Forza e Corsa con parametri modificabili (lavoro, recupero, numero giri).
5. **Template personalizzati Zepp:** Verificare quali modalità accettano template personalizzati creati dall'app Zepp.
6. **Nomi italiani esatti delle modalità:** Verificare i nomi testuali esatti nel menu del proprio orologio (modificabili nelle Impostazioni dell'app).
7. **CORS per chiamate dirette dal browser:** Verificare se il browser del telefono effettua chiamate dirette senza blocchi CORS a Gemini o OpenAI. In caso di restrizioni aziendali o CORS, è presente il campo *Base URL* per inserire un proxy dedicato.
8. **Web Share Target con immagini:** Verificare che dopo l'installazione su Android, la voce "WOD Balance" compaia nel menu Condividi di sistema e carichi correttamente le immagini.
9. **Validità nomi modelli:** Verificare i nomi dei modelli con il pulsante *Carica modelli* nelle Impostazioni.

---

## 5. Test Automatici (Offline)

È inclusa una suite di test completa conforme alla sezione 16.2 di `SPEC.md`, eseguibile senza connessione di rete:

```bash
node test/test-suite.js
```

Controlli verificati:
- Correttezza dei payload per Gemini, OpenAI Responses e Chat Completions.
- Chiave API inviata nell'header e mai nell'URL per Gemini.
- Estrazione testo corretta da ciascun formato e gestione blocchi sicurezza.
- Parsing e pulizia del JSON (compresi recinti markdown e testo rumoroso).
- Validazione e normalizzazione dello schema (3 attività, 4 lap per AMRAP, fallback tipi).
- Generazione testo formattato con i lap numerati e modalità.
- Verifica statica sull'assenza assoluta di `innerHTML` con dati del modello.
