-- Delivery notes
create table if not exists notas_entrega (
  id serial primary key,
  numero text unique not null, -- NE-001, NE-002...
  fecha date not null default current_date,
  cliente text not null,
  atencion text, -- note/message to client
  estado text not null default 'abierta', -- abierta, aprobada, cerrada
  aprobado_por text, -- admin name
  aprobado_at timestamptz,
  scan_url text, -- uploaded signed scan
  cerrada_at timestamptz,
  created_by text,
  created_at timestamptz default now()
);

-- Delivery note items
create table if not exists notas_entrega_items (
  id serial primary key,
  nota_id int references notas_entrega(id) on delete cascade,
  marca text,
  descripcion text not null,
  color text,
  talla text,
  cantidad int not null default 1,
  sort_order int default 0
);

-- Admin signature storage (one per user)
create table if not exists admin_firmas (
  id serial primary key,
  nombre text unique not null,
  firma_base64 text not null, -- PNG base64 of signature
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-increment sequence for nota numbers
create sequence if not exists notas_entrega_seq start 1;

alter table notas_entrega enable row level security;
alter table notas_entrega_items enable row level security;
alter table admin_firmas enable row level security;
create policy "service_role_all" on notas_entrega for all using (true);
create policy "service_role_all" on notas_entrega_items for all using (true);
create policy "service_role_all" on admin_firmas for all using (true);
