-- Esempio: crea una sessione di test con token noto, come farebbe il flusso
-- n8n "creazione sessione" a monte. Da eseguire manualmente nel SQL editor
-- di Supabase per testare la webapp in locale.

insert into sessions (token, first_name, last_name, email, company, hubspot_contact_id)
values ('test-token-12345', 'Mario', 'Rossi', 'mario.rossi@aziendaesempio.it', 'Azienda Esempio Srl', 'hs-contact-000001')
on conflict (token) do nothing;
