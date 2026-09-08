alter table public.personnel
  add column if not exists is_field_technician boolean not null default false;

update public.personnel
set is_field_technician = lower(trim(display_name)) in (
  lower('Fabricio Moura Ribeiro'),
  lower('Felipe Joseph Nobrega'),
  lower('Joel Felipe da Silva Gomes'),
  lower('Jefferson Luis da Silva'),
  lower('Logan Mendes Mota'),
  lower('Luan Henrique Fernandes'),
  lower('Lucas Trindade Pereira'),
  lower('Murilo do Valle Teixeira'),
  lower('Paulo Cesar de Oliveira'),
  lower('Rafael Cardoso de Oliveira'),
  lower('Richard Andrade'),
  lower('Rodrigo Vieira Barreto'),
  lower('Wendel de Souza Silva')
),
updated_at = now();

create index if not exists personnel_field_technician_active_idx
  on public.personnel (is_field_technician, active, lower(display_name));

comment on column public.personnel.is_field_technician is
'Identifica colaboradores que devem aparecer no seletor oficial de equipe executante de campo.';
