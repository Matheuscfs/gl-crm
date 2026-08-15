-- Foto de perfil do paciente (avatar) — exibida na ficha, na agenda e na lista.

alter table public.patients add column if not exists photo_url text;
