-- Captação e cobrança: origem do paciente ("como conheceu a clínica")
-- e chave PIX da clínica (cobrança por WhatsApp + PIX copia e cola).

alter table public.patients add column if not exists origem text;
alter table public.clinic_settings add column if not exists pix_key text;
