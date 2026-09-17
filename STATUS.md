# Stato del progetto — Questionario Assistito (Acceleratore Adozione AI)

Ultimo aggiornamento: 2026-09-17.

## Cosa è stato costruito

Scaffold completo secondo il piano approvato (vedi `C:\Users\Emilio\.claude\plans\jolly-jingling-nest.md`):

- Motore di copertura deterministico — `lib/engine/objectives.ts`, `lib/engine/coverage.ts` (soglia 75%, guardrail 18 turni). 11 test Vitest, tutti verdi.
- Motore conversazionale — `lib/engine/extraction.ts` (estrazione JSON, sonnet), `lib/engine/nextQuestion.ts` (prossima domanda + chiusura forzata, sonnet), `lib/engine/synthesis.ts` (recap + brief interno, opus).
- Backend — `app/api/session/[token]/route.ts`, `app/api/session/[token]/turn/route.ts`, macchina a stati in `lib/session/access.ts` + `lib/session/state.ts`, webhook in `lib/n8n/webhook.ts`.
- UI — `app/q/[token]/page.tsx`, chat in `components/chat/`, recap in `components/recap/`, schermate stato sessione in `components/session/`. Design system Navy/Gold/Ivory + Lora/Poppins.
- Schema Supabase — `supabase/migrations/0001_init.sql` (RLS deny-by-default, service role only), `supabase/seed_example.sql`.

## Cosa è stato verificato

- Typecheck, lint, build di produzione: puliti.
- Test Vitest: 11/11 passano (formula soglia 75%, guardrail 18 turni, casi limite).
- **Walkthrough end-to-end reale in locale**, completato fino al recap finale, con Supabase e Anthropic reali:
  - Adattività confermata: nessuna domanda ridondante, obiettivi accorpati naturalmente quando l'utente anticipa informazioni.
  - Estrazione di copertura verificata direttamente su `coverage_state`: calibrata correttamente (es. ruolo menzionato solo implicitamente → `parziale`, non falso `coperto`).
  - Completamento naturale raggiunto in 8 turni utente (dentro la fascia 8-10 min promessa dalla landing, ben sotto il guardrail di 18).
  - Recap cliente: tono a specchio, zero punteggi/diagnosi, come richiesto.
  - Brief interno: qualità alta, evidenze testuali puntuali, obiettivi non coperti segnalati con la domanda di follow-up per Emilio, nessun punteggio inventato.
  - CTA di prenotazione: URL HubSpot Meetings con prefill corretto (`firstName`, `lastName`, `email`, `company`).
  - Webhook di completamento verso n8n: al momento del test era ancora placeholder — **ora risolto, vedi sotto**.

## ⚠️ Scoperta importante sull'istanza n8n (2026-09-17)

I workflow creati/aggiornati tramite le API/MCP tools (come quelli che costruisco io) **non registravano il webhook** sull'istanza n8n di Emilio (`n8n.srv976702.hstgr.cloud`), nonostante l'API riportasse `active: true`. Chiamate HTTP reali (curl) restituivano `404 not registered`, mentre le simulazioni interne (`execute_workflow`) funzionavano — per questo il problema è rimasto nascosto finché non ho testato con richieste HTTP genuine dall'esterno.

Tentativi che NON hanno risolto: publish/unpublish via API, toggle manuale nell'editor, riavvio completo del servizio n8n.

**Fix che ha funzionato**: duplicare il workflow dall'editor n8n (⋯ → Duplicate) e attivare la copia. La duplicazione passa dal percorso di creazione standard dell'UI (nuovo ID, nuovo webhook ID) e il webhook risulta correttamente registrato. Verificato con una chiamata HTTP reale end-to-end che ha creato un contatto HubSpot vero.

**Implicazione per il lavoro futuro**: qualsiasi nuovo workflow o modifica strutturale creata via API su questa istanza andrà probabilmente duplicata via UI prima di potersi fidare che il webhook funzioni in produzione. Da tenere a mente per il flusso "creazione sessione" quando verrà completato.

## Flusso n8n di completamento — costruito e live (2026-09-17)

Workflow attivo: **"ACC — Completamento Questionario - AI Adoption Accelerator"** (id `k5mHG8sw9AdCumSl`) — è la copia duplicata funzionante. L'originale (id `gyC7QIDNErT3Kjjt`, creato via API) è stato archiviato perché non registrava il webhook.

URL webhook di produzione attuale: `https://n8n.srv976702.hstgr.cloud/webhook/efad101d-480a-4663-9d9d-c4f45da02ba9` — già aggiornato in `.env.local`.

- Webhook (POST, nessuna auth, risponde subito — non blocca la webapp) → normalizza il payload → tre azioni in parallelo:
  1. Aggiorna `hs_lead_status` a `ACC-QUESTIONARIO-COMPLETATO` sul contatto (upsert by email).
  2. Formatta il brief interno e crea un Task HubSpot associato al contatto (visibile sulla scheda, con tutto il contenuto del brief).
  3. Notifica Emilio su Telegram (gruppo "EmilioZuccaAssistant") con un riepilogo.
- Prerequisito completato: aggiunti i 5 valori `ACC-*` alla proprietà `hs_lead_status` su HubSpot (utility one-off eseguita e poi archiviata — nessun valore `SETTER-*` esistente toccato, verificato).
- Modifica al codice della webapp: `email` aggiunta al payload del webhook (`lib/n8n/webhook.ts`, `app/api/session/[token]/turn/route.ts`) — necessaria perché il nodo HubSpot in n8n aggiorna per email, non per ID contatto.
- **Bug reale trovato e corretto durante il primo test**: il primo tentativo incatenava le tre azioni in sequenza invece che in parallelo dal nodo di normalizzazione, perdendo i dati per le azioni successive. Corretto e riverificato.
- **Pulizia da fare in HubSpot**: contatti di test creati durante i vari test — `test-acc-questionario@example-fake.com` (id 248893377190), `diag@example-fake.com` (id 249004222737), `diag-session-3@example-fake.com` (id 249010397010, dal test del flusso "creazione sessione") — con relativi Task associati. Sicuri da eliminare manualmente quando comodo. C'è anche una riga di test nella tabella `sessions` su Supabase (token `a46c978c-adfd-4d54-b6f1-69b4be8dc98c`) — innocua ma eliminabile.

## Flusso n8n "creazione sessione" — costruito e live (2026-09-17)

Workflow attivo: **"ACC — Creazione Sessione - AI Adoption Accelerator"** (id `qHT0B3Xkb7ZqPI7o`).

URL webhook di produzione: `https://n8n.srv976702.hstgr.cloud/webhook/3312db65-d341-4598-900f-ba8bb34b9e31` — comunicato al progetto della landing. CORS preflight (OPTIONS) confermato funzionante out-of-the-box, JSON come formato (nessun cambiamento richiesto alla landing rispetto alla spec originale).

Catena completa, verificata con un'esecuzione reale (webhook → HubSpot → Supabase → email, tutti e quattro i sistemi confermati con dati reali):
1. **Normalizza Dati Form** (Set) — estrae `firstName`, `lastName`, `email`, `company` dal body con fallback.
2. **Genera Token** — nodo **Crypto nativo** (action `generate`, encoding `uuid`), non un Code node: il sandbox JS di questa istanza n8n blocca sia il `crypto` globale sia `require('crypto')` ("Module 'crypto' is disallowed"), scoperto durante il test. Il nodo Crypto nativo bypassa questa restrizione.
3. **Crea Contatto HubSpot** (upsert by email) — imposta `hs_lead_status` a `ACC-QUESTIONARIO-INVIATO`, firstname/lastname/company.
4. **Scrivi Sessione su Supabase** (tabella `sessions`) — token, dati anagrafici, `hubspot_contact_id` collegato.
5. **Invia Email** (SMTP, credenziale "SMTP InnovazionePMI") — da `hello@innovazionepmi.it` (Google Workspace, app password), con il link `https://questionario-acc.innovazionepmi.it/q/{token}`. Accettata da Gmail (`250 2.0.0 OK`) nel test reale.

**Lezione tecnica per nodi Code futuri su questa istanza**: usare sempre i nodi nativi (Crypto, HTTP Request, ecc.) invece del Code node quando serve funzionalità di moduli Node — il sandbox è più restrittivo del solito (blocca esplicitamente `require('crypto')`, probabilmente altri moduli built-in oltre a quelli di rete).

Tutte le espressioni nei nodi a valle referenziano esplicitamente `$('Nome Nodo').item.json.campo` invece di `$json` implicito — lezione appresa dal bug del flusso di completamento (concatenare `.to()` sullo stesso nodo sovrascrive `$json` con l'output del nodo precedente, non fa fan-out).

## Ambiente locale

`.env.local` compilato dall'utente:
- ✅ `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL_TURN`, `ANTHROPIC_MODEL_SYNTHESIS`
- ✅ `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (progetto Supabase creato, migrazione applicata)
- ✅ `HUBSPOT_MEETINGS_URL`
- ✅ `N8N_COMPLETION_WEBHOOK_URL` — ora punta al workflow reale e attivo.

Sessione di test seed: token `test-token-12345` (Mario Rossi, Azienda Esempio Srl). Resettata a `non_iniziata` a fine sessione — pronta per un nuovo giro pulito.

## Cosa manca prima di andare in produzione

Entrambi i flussi n8n sono ora completi e verificati end-to-end con dati reali. Resta:

1. **Landing page**: il form custom (lato loro, confermato "a posto") deve puntare all'URL del webhook "creazione sessione" sopra. Verificare con un test reale una volta che il form è pubblicato. Thank-you page per il tracking conversioni (GTM/Meta Pixel al load della pagina, non al click invio) — da confermare se già fatta.
2. Repo GitHub + branch setup secondo il workflow di CLAUDE.md (main/staging) — il repo locale è ancora su `master`, non committato, nessun remote configurato.
3. Deploy Vercel con le stesse variabili d'ambiente configurate su Project Settings.
4. Dominio custom `questionario-acc.innovazionepmi.it` (DNS su Vercel) — necessario perché il link nell'email punta già a questo dominio.
5. Eventuale ulteriore giro di valutazione qualitativa delle domande da parte dell'utente.
6. Pulizia dei contatti/task di test in HubSpot e della riga di test in Supabase (vedi sopra).

## Comandi git pronti (quando si vorrà committare)

```bash
git branch -M main
git checkout -b staging
git add .
git commit -m "feat: scaffold webapp questionario adattivo"
```
