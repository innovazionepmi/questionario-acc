-- Bug critico: il vincolo CHECK su coverage_state.objective_id era rimasto
-- fissato a 1-16 dalla migrazione iniziale. Da quando è stato introdotto il
-- 17° obiettivo (preferenza di contatto), OGNI estrazione di copertura prova
-- a scrivere objective_id=17 e viene respinta dal database, causando un
-- errore non gestito su ogni turno della conversazione, non solo al
-- completamento.

alter table coverage_state drop constraint if exists coverage_state_objective_id_check;

alter table coverage_state
  add constraint coverage_state_objective_id_check check (objective_id between 1 and 17);
