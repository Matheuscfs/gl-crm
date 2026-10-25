-- 0028 · Ajustes do Security Advisor (achados de uma checagem no estilo splinter sobre 0001–0027).
--
--   • function_search_path_mutable: o gatilho que bloqueia a exclusão do prontuário não fixava o
--     search_path — um objeto com o mesmo nome em outro schema poderia ser usado no lugar.
--   • security definer executável por anon: a função de auditoria roda como dona da tabela e, como
--     toda função nova, nascia com EXECUTE para PUBLIC. Gatilho não precisa desse privilégio para
--     disparar (ele só é conferido ao criar o gatilho), então ninguém mais pode chamá-la direto.
--
-- Pode rodar mais de uma vez.

alter function public.bloquear_exclusao_prontuario() set search_path = public;

revoke execute on function public.registrar_auditoria() from public, anon, authenticated;
revoke execute on function public.bloquear_exclusao_prontuario() from public, anon, authenticated;
