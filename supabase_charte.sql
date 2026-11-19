-- Charte graphique Hympyr : tables Supabase
-- A executer une fois dans Supabase > SQL Editor (projet quentindebrie-code's Project).

create table if not exists public.charte_membres (
  email text primary key,
  nom text,
  role text not null default 'lecteur',
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);
comment on table public.charte_membres is 'Membres autorises de la charte graphique Hympyr (e-mail du compte Supabase Authentication).';

create table if not exists public.charte_tickets (
  id bigint generated always as identity primary key,
  cree_le timestamptz not null default now(),
  auteur_email text not null default (auth.jwt() ->> 'email'),
  type text not null check (type in ('question','erreur','suggestion')),
  sujet text not null check (char_length(sujet) between 3 and 140),
  message text not null check (char_length(message) between 5 and 4000),
  page text,
  marque text,
  statut text not null default 'ouvert'
);
comment on table public.charte_tickets is 'Tickets envoyes depuis la charte graphique.';

create table if not exists public.charte_progression (
  email text primary key default (auth.jwt() ->> 'email'),
  sections jsonb not null default '[]'::jsonb,
  quiz_meilleur int not null default 0,
  maj_le timestamptz not null default now()
);
comment on table public.charte_progression is 'Progression de lecture et meilleur score au quiz, par membre.';

create or replace function public.charte_est_membre()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.charte_membres m
    where lower(m.email) = lower(auth.jwt() ->> 'email') and m.actif
  );
$$;
revoke all on function public.charte_est_membre() from public, anon;
grant execute on function public.charte_est_membre() to authenticated;

alter table public.charte_membres enable row level security;
alter table public.charte_tickets enable row level security;
alter table public.charte_progression enable row level security;

create policy charte_membres_soi on public.charte_membres for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

create policy charte_tickets_insert on public.charte_tickets for insert to authenticated
  with check (public.charte_est_membre() and lower(auteur_email) = lower(auth.jwt() ->> 'email'));
create policy charte_tickets_select on public.charte_tickets for select to authenticated
  using (public.charte_est_membre() and lower(auteur_email) = lower(auth.jwt() ->> 'email'));

create policy charte_prog_select on public.charte_progression for select to authenticated
  using (public.charte_est_membre() and lower(email) = lower(auth.jwt() ->> 'email'));
create policy charte_prog_insert on public.charte_progression for insert to authenticated
  with check (public.charte_est_membre() and lower(email) = lower(auth.jwt() ->> 'email'));
create policy charte_prog_update on public.charte_progression for update to authenticated
  using (public.charte_est_membre() and lower(email) = lower(auth.jwt() ->> 'email'))
  with check (lower(email) = lower(auth.jwt() ->> 'email'));

-- Ajouter ensuite les membres autorises (un par ligne) :
-- insert into public.charte_membres (email, nom) values
--   ('prenom.nom@hympyr.fr', 'Prenom Nom');
