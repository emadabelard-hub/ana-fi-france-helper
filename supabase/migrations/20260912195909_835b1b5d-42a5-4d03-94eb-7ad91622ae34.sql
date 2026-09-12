-- 1) Jeton interne du worker, stocké chiffré dans Vault (valeur aléatoire, jamais écrite en clair)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'btp_analysis_worker_token') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'btp_analysis_worker_token', 'Jeton interne du worker btp-analysis-job');
  end if;
end $$;

-- 2) Lecture du jeton : réservée au serveur (service_role)
create or replace function public.get_analysis_worker_token()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'btp_analysis_worker_token' limit 1;
$$;

revoke all on function public.get_analysis_worker_token() from public;
revoke all on function public.get_analysis_worker_token() from anon;
revoke all on function public.get_analysis_worker_token() from authenticated;
grant execute on function public.get_analysis_worker_token() to service_role;

-- 3) Récupération des jobs bloqués : running depuis plus de 3 minutes -> queued, attempts +1
create or replace function public.requeue_stale_analysis_jobs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.btp_analysis_jobs
     set status = 'queued',
         attempts = attempts + 1,
         updated_at = now()
   where status = 'running'
     and updated_at < now() - interval '3 minutes';
  get diagnostics affected = row_count;
  return affected;
end $$;

revoke all on function public.requeue_stale_analysis_jobs() from public;
revoke all on function public.requeue_stale_analysis_jobs() from anon;
revoke all on function public.requeue_stale_analysis_jobs() from authenticated;
grant execute on function public.requeue_stale_analysis_jobs() to service_role;

-- 4) Index partiel pour le balayage serveur des jobs actifs
create index if not exists btp_analysis_jobs_active_idx
  on public.btp_analysis_jobs (status, updated_at)
  where status in ('queued', 'running');