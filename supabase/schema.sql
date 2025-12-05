-- KanbanPro MVP Schema (PostgreSQL - Supabase)

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists boards_workspace_id_idx on public.boards(workspace_id);

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  position int not null,
  created_at timestamptz not null default now()
);
create index if not exists lists_board_id_idx on public.lists(board_id);
create index if not exists lists_position_idx on public.lists(position);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  list_id uuid not null references public.lists(id) on delete cascade,
  title text not null,
  description text,
  position int not null,
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cards_board_id_idx on public.cards(board_id);
create index if not exists cards_list_id_idx on public.cards(list_id);
create index if not exists cards_position_idx on public.cards(position);

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  color text not null default '#3b82f6'
);
create index if not exists labels_board_id_idx on public.labels(board_id);

create table if not exists public.card_labels (
  card_id uuid not null references public.cards(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (card_id, label_id)
);

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  title text not null
);
create index if not exists checklists_card_id_idx on public.checklists(card_id);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position int not null default 100
);
create index if not exists checklist_items_checklist_id_idx on public.checklist_items(checklist_id);

create table if not exists public.card_history (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  actor_id uuid,
  action text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists card_history_card_id_idx on public.card_history(card_id);

-- Attachments
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  filename text not null,
  path text not null,
  created_at timestamptz not null default now()
);
create index if not exists attachments_card_id_idx on public.attachments(card_id);

-- RLS
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.boards enable row level security;
alter table public.lists enable row level security;
alter table public.cards enable row level security;
alter table public.labels enable row level security;
alter table public.card_labels enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.card_history enable row level security;
alter table public.attachments enable row level security;

-- Helpers
create or replace function public.is_member_of_workspace(w_id uuid)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.workspace_members wm
    where wm.workspace_id = w_id and wm.user_id = auth.uid()
  );
$$;

-- Policies: workspaces
create policy if not exists "workspace_select_members_only"
on public.workspaces
for select using (is_member_of_workspace(id));

create policy if not exists "workspace_insert_auth_user"
on public.workspaces
for insert to authenticated
with check (true);

create policy if not exists "workspace_update_admin_only"
on public.workspaces
for update using (exists (select 1 from public.workspace_members wm where wm.workspace_id = id and wm.user_id = auth.uid() and wm.role = 'admin'));

create policy if not exists "workspace_delete_admin_only"
on public.workspaces
for delete using (exists (select 1 from public.workspace_members wm where wm.workspace_id = id and wm.user_id = auth.uid() and wm.role = 'admin'));

-- After creating a workspace, auto add creator as admin
create or replace function public.handle_workspace_insert()
returns trigger language plpgsql as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, auth.uid(), 'admin')
  on conflict do nothing;
  return new;
end
$$;
drop trigger if exists trg_workspace_insert on public.workspaces;
create trigger trg_workspace_insert after insert on public.workspaces
for each row execute function public.handle_workspace_insert();

-- Boards policies
create policy if not exists "boards_select_members_only"
on public.boards
for select using (is_member_of_workspace(workspace_id));

create policy if not exists "boards_insert_members_only"
on public.boards
for insert to authenticated
with check (is_member_of_workspace(workspace_id));

create policy if not exists "boards_update_members_only"
on public.boards
for update using (is_member_of_workspace(workspace_id));

create policy if not exists "boards_delete_admin_only"
on public.boards
for delete using (exists (select 1 from public.workspace_members wm where wm.workspace_id = workspace_id and wm.user_id = auth.uid() and wm.role = 'admin'));

-- Lists policies
create policy if not exists "lists_select_members_only"
on public.lists
for select using (exists (select 1 from public.boards b where b.id = board_id and is_member_of_workspace(b.workspace_id)));
create policy if not exists "lists_crud_members_only"
on public.lists
for all to authenticated
using (exists (select 1 from public.boards b where b.id = board_id and is_member_of_workspace(b.workspace_id)))
with check (exists (select 1 from public.boards b where b.id = board_id and is_member_of_workspace(b.workspace_id)));

-- Cards policies
create policy if not exists "cards_select_members_only"
on public.cards
for select using (exists (select 1 from public.boards b where b.id = board_id and is_member_of_workspace(b.workspace_id)));
create policy if not exists "cards_crud_members_only"
on public.cards
for all to authenticated
using (exists (select 1 from public.boards b where b.id = board_id and is_member_of_workspace(b.workspace_id)))
with check (exists (select 1 from public.boards b where b.id = board_id and is_member_of_workspace(b.workspace_id)));

-- Labels and mapping
create policy if not exists "labels_select_members_only"
on public.labels
for select using (exists (select 1 from public.boards b where b.id = board_id and is_member_of_workspace(b.workspace_id)));
create policy if not exists "labels_crud_members_only"
on public.labels
for all to authenticated
using (exists (select 1 from public.boards b where b.id = board_id and is_member_of_workspace(b.workspace_id)))
with check (exists (select 1 from public.boards b where b.id = board_id and is_member_of_workspace(b.workspace_id)));

create policy if not exists "card_labels_crud_members_only"
on public.card_labels
for all to authenticated
using (exists (
  select 1 from public.cards c
  where c.id = card_id
    and exists (select 1 from public.boards b where b.id = c.board_id and is_member_of_workspace(b.workspace_id))
))
with check (exists (
  select 1 from public.cards c
  where c.id = card_id
    and exists (select 1 from public.boards b where b.id = c.board_id and is_member_of_workspace(b.workspace_id))
));

-- Checklists
create policy if not exists "checklists_crud_members_only"
on public.checklists
for all to authenticated
using (exists (select 1 from public.cards c join public.boards b on b.id = c.board_id where c.id = card_id and is_member_of_workspace(b.workspace_id)))
with check (exists (select 1 from public.cards c join public.boards b on b.id = c.board_id where c.id = card_id and is_member_of_workspace(b.workspace_id)));

create policy if not exists "checklist_items_crud_members_only"
on public.checklist_items
for all to authenticated
using (exists (select 1 from public.checklists cl join public.cards c on c.id = cl.card_id join public.boards b on b.id = c.board_id where cl.id = checklist_id and is_member_of_workspace(b.workspace_id)))
with check (exists (select 1 from public.checklists cl join public.cards c on c.id = cl.card_id join public.boards b on b.id = c.board_id where cl.id = checklist_id and is_member_of_workspace(b.workspace_id)));

-- History
create policy if not exists "card_history_select_members_only"
on public.card_history
for select using (exists (select 1 from public.cards c join public.boards b on b.id = c.board_id where c.id = card_id and is_member_of_workspace(b.workspace_id)));

create policy if not exists "attachments_crud_members_only"
on public.attachments
for all to authenticated
using (exists (select 1 from public.cards c join public.boards b on b.id = c.board_id where c.id = card_id and is_member_of_workspace(b.workspace_id)))
with check (exists (select 1 from public.cards c join public.boards b on b.id = c.board_id where c.id = card_id and is_member_of_workspace(b.workspace_id)));

-- Realtime
alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.cards;
alter publication supabase_realtime add table public.card_labels;
alter publication supabase_realtime add table public.checklist_items;
alter publication supabase_realtime add table public.card_history;
alter publication supabase_realtime add table public.attachments;


