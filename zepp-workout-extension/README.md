# WOD Balance — Zepp OS Workout Extension

Estensione di allenamento nativa per **Amazfit Balance (Zepp OS 3.5 / 4.0)**.

A differenza delle normali mini app, questa estensione gira **direttamente all'interno dell'app di allenamento ufficiale dell'orologio** (es. *Esercizi a corpo libero*, *Forza*, *Corsa*, *Cross-training*):
- Calcola e registra battito continuo, calorie con algoritmo Zepp/Firstbeat, Training Load e PAI.
- Fornisce una schermata HUD dedicata con timer per WOD (EMOM, AMRAP, For Time, Tabata), contatore dei round e avvisi a vibrazione aptica.

---

## ⌚ Schermata dell'Estensione (Display AMOLED 480×480)

1. **HUD Biometrico Superiore:**
   - **♥ BPM:** frequenza cardiaca in tempo reale letta dai sensori dell'orologio.
   - **🔥 KCAL:** calorie attive bruciate durante la sessione.
2. **Badge Modalità & Round:**
   - Visualizza il WOD corrente (es. `EMOM 12'`) e il round in corso (`RND 3/12`).
3. **Timer Gigante Centrale:**
   - Countdown al secondo con font ad altissima leggibilità da distanza.
   - Per EMOM: countdown del minuto residuo con avviso aptico **3-2-1** e vibrazione marcata a fine minuto.
   - Per AMRAP: countdown dal tempo totale (es. 20 minuti).
   - Per Tabata: alternanza 20s lavoro / 10s riposo.
   - Per For Time: cronometro progressivo.
4. **Scheda Esercizio:**
   - Mostra il target o gli esercizi del giro corrente (es. `Min 1: 15 Burpees`, `Giro: 5 Pull-ups + 10 Push-ups...`).
5. **Comandi Rapidi:**
   - Pulsante grande **`+1 ROUND (LAP)`**: tocca per avanzare di giro (con feedback a vibrazione).
   - Pulsante **`MODALITÀ WOD ⟳`**: tocca per cambiare al volo tra EMOM, AMRAP, FOR TIME e TABATA.

---

## 🚀 Come installare sull'Amazfit Balance

### 1. Attiva la Modalità Sviluppatore nell'app Zepp sullo Smartphone
1. Apri l'app **Zepp** sul tuo smartphone.
2. Vai su **Profilo** $\to$ **Impostazioni** $\to$ **Informazioni**.
3. Tocca **7 volte consecutive** sull'icona o sulla voce Zepp finché non compare il messaggio *"Modalità sviluppatore attivata"*.
4. Torna indietro in **Profilo**: troverai ora la nuova voce **"Modalità sviluppatore"**.
5. Entra in Modalità sviluppatore e tocca **"Bridge Mode"** (o "Modalità Bridge / Scansiona codice").

### 2. Genera il QR Code di Installazione dal Computer
Nel terminale del tuo computer, entra nella cartella dell'estensione e avvia il comando:
```bash
cd zepp-workout-extension
npm run preview
```
Verrà generato un QR Code nel terminale.

### 3. Installa al Polso
1. Dalla schermata Bridge Mode dell'app Zepp, inquadra il QR Code del terminale con la fotocamera del telefono.
2. L'app Zepp scaricherà il pacchetto `.zab` e lo invierà via Bluetooth direttamente all'Amazfit Balance.

---

## 🏋️‍♂️ Come usarla durante l'allenamento
1. Sull'orologio avvia una qualsiasi attività sportiva nativa (es. **Esercizi a corpo libero** o **Forza**).
2. Scorri tra le pagine dell'allenamento verso destra/sinistra: apparirà la schermata **WOD Balance**.
3. Tocca il pulsante **`+1 ROUND (LAP)`** ogni volta che finisci un giro. L'orologio registrerà i lap e al termine salverà la sessione ufficiale su Zepp e Strava!
