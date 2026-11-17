// WOD → Balance — Test Suite (Sezione 16.2)
// Esecuzione offline con Node.js, senza alcuna dipendenza da rete.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Carica il modulo dell'applicazione
const app = require('../app.js');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Errore: ${err.message}`);
    testsFailed++;
  }
}

console.log('--- Esecuzione Test Automatici WOD → Balance (Sezione 16.2) ---\n');

// 1. buildRequest produce corpi conformi e chiave non nell'URL per Gemini
runTest('1.1 buildRequest per Gemini: chiave nell\'header e NON nell\'URL', () => {
  const req = app.buildRequest('gemini', {
    apiKey: 'AIzaSyFakeKey123',
    model: 'gemini-flash-latest',
    userMessage: 'Test user message',
    imagesBase64: ['base64image1']
  });

  assert.strictEqual(req.method, 'POST');
  assert.ok(!req.url.includes('AIzaSyFakeKey123'), 'La chiave API non deve essere nell\'URL');
  assert.ok(!req.url.includes('key='), 'L\'URL non deve contenere parametri key=');
  assert.strictEqual(req.headers['x-goog-api-key'], 'AIzaSyFakeKey123', 'La chiave deve essere nell\'header x-goog-api-key');

  const body = JSON.parse(req.body);
  assert.ok(body.systemInstruction?.parts?.[0]?.text, 'systemInstruction presente');
  assert.strictEqual(body.contents[0].parts[0].text, 'Test user message');
  assert.strictEqual(body.contents[0].parts[1].inlineData.data, 'base64image1');
  assert.strictEqual(body.generationConfig.responseMimeType, 'application/json');
  assert.strictEqual(body.generationConfig.temperature, 0.2);
});

runTest('1.2 buildRequest per OpenAI Responses: formato responses e nessuna temperature', () => {
  const req = app.buildRequest('openai-responses', {
    apiKey: 'sk-fake-openai',
    model: 'gpt-5-mini',
    baseUrl: 'https://api.openai.com/v1',
    userMessage: 'Test user message',
    imagesBase64: ['base64image1']
  });

  assert.strictEqual(req.method, 'POST');
  assert.strictEqual(req.url, 'https://api.openai.com/v1/responses');
  assert.strictEqual(req.headers['Authorization'], 'Bearer sk-fake-openai');

  const body = JSON.parse(req.body);
  assert.strictEqual(body.model, 'gpt-5-mini');
  assert.ok(body.instructions, 'instructions presente');
  assert.strictEqual(body.input[0].content[0].type, 'input_text');
  assert.strictEqual(body.input[0].content[1].type, 'input_image');
  assert.strictEqual(body.input[0].content[1].image_url, 'data:image/jpeg;base64,base64image1');
  assert.deepStrictEqual(body.text, { format: { type: 'json_object' } });
  assert.strictEqual(body.temperature, undefined, 'Responses non deve inviare temperature');
});

runTest('1.3 buildRequest per OpenAI Chat: endpoint chat/completions, response_format, no temp/max_tokens', () => {
  const req = app.buildRequest('openai-chat', {
    apiKey: 'sk-fake-openai',
    model: 'gpt-5-mini',
    baseUrl: 'https://api.openai.com/v1',
    userMessage: 'Test user message',
    imagesBase64: ['base64image1']
  });

  assert.strictEqual(req.method, 'POST');
  assert.strictEqual(req.url, 'https://api.openai.com/v1/chat/completions');
  assert.strictEqual(req.headers['Authorization'], 'Bearer sk-fake-openai');

  const body = JSON.parse(req.body);
  assert.strictEqual(body.model, 'gpt-5-mini');
  assert.strictEqual(body.messages[0].role, 'system');
  assert.strictEqual(body.messages[1].role, 'user');
  assert.strictEqual(body.messages[1].content[0].text, 'Test user message');
  assert.strictEqual(body.messages[1].content[1].image_url.url, 'data:image/jpeg;base64,base64image1');
  assert.deepStrictEqual(body.response_format, { type: 'json_object' });
  assert.strictEqual(body.temperature, undefined, 'Chat completions non deve inviare temperature');
  assert.strictEqual(body.max_tokens, undefined, 'Chat completions non deve inviare max_tokens');
});

// 2. extractText estrae il testo da risposte simulate dei tre formati
runTest('2.1 extractText per Gemini: unisce i parts del primo candidate', () => {
  const mockGemini = {
    candidates: [{
      content: {
        parts: [
          { text: '{"titolo": ' },
          { text: '"Test Gemini"}' }
        ]
      }
    }]
  };
  const text = app.extractText('gemini', mockGemini);
  assert.strictEqual(text, '{"titolo": "Test Gemini"}');
});

runTest('2.2 extractText per Gemini: rileva blocco promptFeedback.blockReason', () => {
  const mockGeminiBlocked = {
    candidates: [],
    promptFeedback: { blockReason: 'SAFETY' }
  };
  assert.throws(() => {
    app.extractText('gemini', mockGeminiBlocked);
  }, /SAFETY/);
});

runTest('2.3 extractText per OpenAI Responses: scorre output[], estrae solo output_text', () => {
  const mockResponses = {
    output: [
      { type: 'reasoning', content: [{ type: 'thought', text: 'Pensiero interno' }] },
      {
        type: 'message',
        content: [
          { type: 'output_text', text: '{"titolo": ' },
          { type: 'output_text', text: '"Test Responses"}' }
        ]
      }
    ]
  };
  const text = app.extractText('openai-responses', mockResponses);
  assert.strictEqual(text, '{"titolo": "Test Responses"}');
});

runTest('2.4 extractText per OpenAI Chat: estrae choices[0].message.content', () => {
  const mockChat = {
    choices: [{
      message: {
        content: '{"titolo": "Test Chat"}'
      }
    }]
  };
  const text = app.extractText('openai-chat', mockChat);
  assert.strictEqual(text, '{"titolo": "Test Chat"}');
});

// 3. parseModelJson accetta JSON puro, markdown fences, testo prima/dopo, rifiuta senza graffe
runTest('3.1 parseModelJson con JSON puro', () => {
  const raw = '{"titolo": "WOD Puro", "formato": "AMRAP"}';
  const parsed = app.parseModelJson(raw);
  assert.strictEqual(parsed.titolo, 'WOD Puro');
});

runTest('3.2 parseModelJson con recinto di codice ```json ... ```', () => {
  const raw = '```json\n{"titolo": "WOD Markdown", "formato": "For Time"}\n```';
  const parsed = app.parseModelJson(raw);
  assert.strictEqual(parsed.titolo, 'WOD Markdown');
});

runTest('3.3 parseModelJson con recinto di codice ``` ... ``` senza lang', () => {
  const raw = '```\n{"titolo": "WOD Senza Lang", "formato": "EMOM"}\n```';
  const parsed = app.parseModelJson(raw);
  assert.strictEqual(parsed.titolo, 'WOD Senza Lang');
});

runTest('3.4 parseModelJson con testo di introduzione e conclusione', () => {
  const raw = 'Ecco la scheda che ho analizzato per te:\n\n{"titolo": "WOD Circondato", "formato": "Misto"}\n\nSpero sia utile!';
  const parsed = app.parseModelJson(raw);
  assert.strictEqual(parsed.titolo, 'WOD Circondato');
});

runTest('3.5 parseModelJson rifiuta testo privo di graffe', () => {
  const raw = 'Non ho trovato alcun esercizio nella foto.';
  assert.throws(() => {
    app.parseModelJson(raw);
  }, /Nessun blocco JSON/);
});

// 4. validatePlan accetta l'esempio della sezione 10, rifiuta attivita vuoto, normalizza campi
runTest('4.1 validatePlan accetta l\'esempio della Sezione 10', () => {
  const expectedJsonPath = path.join(__dirname, 'expected', 'wod-2026-11-16.json');
  const expectedRaw = fs.readFileSync(expectedJsonPath, 'utf8');
  const sampleData = JSON.parse(expectedRaw);

  const plan = app.validatePlan(sampleData);
  assert.strictEqual(plan.titolo, 'Functional Hero X');
  assert.strictEqual(plan.formato, 'AMRAP');
  assert.strictEqual(plan.durata_totale_min, 20);
  assert.strictEqual(plan.attivita.length, 3);
  assert.strictEqual(plan.attivita[2].schema_lap.length, 4);
  assert.strictEqual(plan.attivita[2].lap_per_giro, 4);
  assert.strictEqual(plan.attivita[2].tipo_modalita, 'corsa');
});

runTest('4.2 validatePlan rifiuta attivita vuoto o assente', () => {
  assert.throws(() => {
    app.validatePlan({ titolo: 'Senza attività', attivita: [] });
  }, /almeno un'attività/);

  assert.throws(() => {
    app.validatePlan({ titolo: 'Senza campo attivita' });
  }, /almeno un'attività/);
});

runTest('4.3 validatePlan normalizza campi mancanti o tipi non consentiti', () => {
  const minimalData = {
    titolo: 'Minimal',
    attivita: [{
      nome: 'Unica',
      tipo_modalita: 'nuoto_non_previsto' // fuori elenco -> deve diventare 'altro'
    }]
  };
  const plan = app.validatePlan(minimalData);
  assert.strictEqual(plan.formato, 'Altro');
  assert.strictEqual(plan.durata_totale_min, null);
  assert.deepStrictEqual(plan.assunzioni, []);
  assert.deepStrictEqual(plan.lettura_dati, []);
  assert.deepStrictEqual(plan.limiti, []);
  assert.strictEqual(plan.attivita[0].tipo_modalita, 'altro');
  assert.strictEqual(plan.attivita[0].obbligatoria, true);
  assert.deepStrictEqual(plan.attivita[0].preparazione, []);
  assert.deepStrictEqual(plan.attivita[0].esercizi, []);
  assert.deepStrictEqual(plan.attivita[0].schema_lap, []);
});

// 5. planToText dell'esempio contiene i 4 lap numerati e la riga della modalità di ogni attività
runTest('5.1 planToText contiene i 4 lap numerati e la riga modalità per ogni attività', () => {
  const expectedJsonPath = path.join(__dirname, 'expected', 'wod-2026-11-16.json');
  const sampleData = JSON.parse(fs.readFileSync(expectedJsonPath, 'utf8'));
  const plan = app.validatePlan(sampleData);
  const text = app.planToText(plan);

  // Verifica presenza modalità
  assert.ok(text.includes('Esercizi a corpo libero'), 'Deve contenere la modalità Corpo libero');
  assert.ok(text.includes('Forza'), 'Deve contenere la modalità Forza');
  assert.ok(text.includes('Corsa all\'aperto'), 'Deve contenere la modalità Corsa all\'aperto');

  // Verifica presenza dei 4 lap numerati
  assert.ok(text.includes('1. Corsa 500 m'), 'Deve contenere il Lap 1 numerato');
  assert.ok(text.includes('2. 15 Front Squat'), 'Deve contenere il Lap 2 numerato');
  assert.ok(text.includes('3. Corsa 500 m'), 'Deve contenere il Lap 3 numerato');
  assert.ok(text.includes('4. 15 Deadlift'), 'Deve contenere il Lap 4 numerato');
  assert.ok(text.includes('Poi ricomincia dal lap 1'), 'AMRAP deve indicare di ricominciare dal lap 1');
});

// 6. Nessun uso di innerHTML con dati del modello
runTest('6.1 Nessun uso di innerHTML in app.js', () => {
  const appJsPath = path.join(__dirname, '..', 'app.js');
  const appJsContent = fs.readFileSync(appJsPath, 'utf8');

  // Cerca qualsiasi occorrenza di innerHTML
  const match = appJsContent.match(/\.innerHTML\b/);
  assert.strictEqual(match, null, 'app.js non deve utilizzare innerHTML in nessuna parte del codice!');
});

// 7. Esportazione WOD per estensione Zepp OS
runTest('7.1 convertPlanToZeppWod genera il payload corretto per Amazfit Balance', () => {
  const plan = {
    titolo: 'EMOM 16 Minuti',
    formato: 'EMOM',
    durata_totale_min: 16,
    attivita: [
      {
        nome: 'EMOM Principale',
        esercizi: ['Min 1: 15 Burpees', 'Min 2: 20 Kettlebell Swings', 'Min 3: 15 Box Jumps', 'Min 4: Rest']
      }
    ]
  };

  const zeppWod = app.convertPlanToZeppWod(plan);
  assert.strictEqual(zeppWod.id, 'EMOM');
  assert.strictEqual(zeppWod.type, 'countdown_interval');
  assert.strictEqual(zeppWod.totalRounds, 16);
  assert.strictEqual(zeppWod.totalDurationSec, 960);
  assert.strictEqual(zeppWod.intervalSec, 60);
  assert.strictEqual(zeppWod.exercises.length, 4);
  assert.strictEqual(zeppWod.exercises[0], 'Min 1: 15 Burpees');
});

console.log(`\n========================================`);
console.log(`Risultato Test: ${testsPassed} passati, ${testsFailed} falliti.`);
console.log(`========================================\n`);

if (testsFailed > 0) {
  process.exit(1);
}
