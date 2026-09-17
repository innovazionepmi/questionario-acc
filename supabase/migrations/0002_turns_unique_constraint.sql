-- Corregge una race condition reale: due richieste concorrenti sulla stessa
-- sessione (es. apertura del link duplicata, scanner email che pre-visita il
-- link) potevano generare due volte il turno di apertura, perché non
-- esisteva alcun vincolo di unicità su (session_id, turn_number).
--
-- Rimuove eventuali duplicati già presenti (tiene solo il più vecchio),
-- poi aggiunge il vincolo che rende impossibile la duplicazione da qui in poi.
-- Il codice applicativo (lib/session/repository.ts, appendTurn) è già stato
-- aggiornato per gestire correttamente il conflitto invece di sollevare un errore.

delete from turns a
using turns b
where a.session_id = b.session_id
  and a.turn_number = b.turn_number
  and a.created_at > b.created_at;

alter table turns
  add constraint turns_session_turn_number_unique unique (session_id, turn_number);
