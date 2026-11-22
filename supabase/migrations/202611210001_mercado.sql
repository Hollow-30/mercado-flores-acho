create table public.stalls (
  id integer generated always as identity primary key,
  name text not null unique,
  location text not null
);

create table public.stall_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stall_id integer not null references public.stalls(id)
);

create table public.products (
  id integer generated always as identity primary key,
  stall_id integer not null references public.stalls(id),
  name text not null check (char_length(name) between 2 and 100),
  category text not null check (category in ('Rosas', 'Girasoles', 'Arreglos', 'Coronas')),
  unit text not null check (char_length(unit) between 2 and 50),
  description text not null check (char_length(description) <= 500),
  price_cents integer not null check (price_cents between 100 and 1000000),
  stock integer not null check (stock between 0 and 100000),
  published boolean not null default true
);
create index products_stall_id_idx on public.products (stall_id);

create table public.delivery_areas (
  district text primary key,
  fee_cents integer not null check (fee_cents > 0)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  access_token uuid not null unique default gen_random_uuid(),
  stall_id integer not null references public.stalls(id),
  customer_name text not null,
  phone text not null,
  mode text not null check (mode in ('pickup','delivery')),
  district text references public.delivery_areas(district),
  address text,
  subtotal_cents bigint not null,
  delivery_cents integer not null,
  status text not null default 'pending_payment',
  created_at timestamptz not null default now()
);
create index orders_stall_id_idx on public.orders (stall_id);

create table public.order_items (
  order_id uuid not null references public.orders(id),
  product_id integer not null references public.products(id),
  item_name text not null,
  unit_price_cents integer not null,
  quantity integer not null check (quantity > 0),
  primary key(order_id, product_id)
);

create table public.payments (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id),
  reference text not null unique,
  amount_cents bigint not null,
  status text not null default 'review',
  reason text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
create index payments_order_id_idx on public.payments (order_id, id desc);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id),
  status text not null,
  created_at timestamptz not null default now()
);
create index order_events_order_id_idx on public.order_events (order_id, id);

alter table public.stalls enable row level security;
alter table public.stall_members enable row level security;
alter table public.products enable row level security;
alter table public.delivery_areas enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_events enable row level security;

revoke all on table public.stalls, public.stall_members, public.products, public.delivery_areas, public.orders, public.order_items, public.payments, public.order_events from anon, authenticated;
grant select on public.stalls, public.products, public.delivery_areas to anon, authenticated;
grant select on public.stall_members, public.orders, public.payments to authenticated;
grant insert, update on public.products to authenticated;

create policy stalls_read on public.stalls for select using (true);
create policy delivery_read on public.delivery_areas for select using (true);
create policy members_read_own on public.stall_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy products_read on public.products for select
  using (published or stall_id in (select m.stall_id from public.stall_members m where m.user_id = (select auth.uid())));
create policy products_insert_own on public.products for insert to authenticated
  with check (stall_id in (select m.stall_id from public.stall_members m where m.user_id = (select auth.uid())));
create policy products_update_own on public.products for update to authenticated
  using (stall_id in (select m.stall_id from public.stall_members m where m.user_id = (select auth.uid())))
  with check (stall_id in (select m.stall_id from public.stall_members m where m.user_id = (select auth.uid())));
create policy orders_read_own_stall on public.orders for select to authenticated
  using (stall_id in (select m.stall_id from public.stall_members m where m.user_id = (select auth.uid())));
create policy payments_read_own_stall on public.payments for select to authenticated
  using (order_id in (select o.id from public.orders o));

create function public.create_order(
  p_request_id uuid, p_name text, p_phone text, p_mode text, p_district text, p_address text, p_items jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_stall integer;
  v_item record;
  v_count integer := 0;
  v_subtotal bigint := 0;
  v_fee integer := 0;
begin
  if p_request_id is null then raise exception 'Identificador de solicitud inválido'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_order from public.orders where request_id = p_request_id;
  if found then
    return jsonb_build_object('id',v_order.id,'token',v_order.access_token,'total_cents',v_order.subtotal_cents+v_order.delivery_cents);
  end if;
  if p_name is null or char_length(trim(p_name)) not between 2 and 100 or p_phone is null or p_phone !~ '^[0-9+][0-9 -]{6,17}$'
    or p_mode is null or p_mode not in ('pickup','delivery') then raise exception 'Datos de contacto o modalidad inválidos'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Carrito inválido'; end if;
  if jsonb_array_length(p_items) not between 1 and 12 then raise exception 'Carrito inválido'; end if;
  if p_mode = 'delivery' then
    select fee_cents into v_fee from public.delivery_areas where district = p_district;
    if not found or p_address is null or char_length(trim(p_address)) not between 5 and 200 then raise exception 'Dirección o cobertura inválida'; end if;
  end if;
  for v_item in
    select p.id, p.stall_id, p.stock, p.published, p.price_cents, i.quantity
    from jsonb_to_recordset(p_items) i(product_id integer, quantity integer)
    join public.products p on p.id = i.product_id
    order by p.id for update of p
  loop
    if not v_item.published or v_item.quantity is null or v_item.quantity not between 1 and 999 or v_item.quantity > v_item.stock then
      raise exception 'Stock insuficiente o cantidad inválida';
    end if;
    if v_stall is not null and v_stall <> v_item.stall_id then raise exception 'Solo se admite un puesto por pedido'; end if;
    v_stall := v_item.stall_id;
    v_count := v_count + 1;
    v_subtotal := v_subtotal + v_item.price_cents * v_item.quantity;
  end loop;
  if v_count <> jsonb_array_length(p_items) then raise exception 'Producto no disponible'; end if;
  insert into public.orders (request_id, stall_id, customer_name, phone, mode, district, address, subtotal_cents, delivery_cents)
    values (p_request_id, v_stall, trim(p_name), trim(p_phone), p_mode,
      case when p_mode = 'delivery' then p_district end, case when p_mode = 'delivery' then trim(p_address) end, v_subtotal, v_fee)
    returning * into v_order;
  insert into public.order_items (order_id, product_id, item_name, unit_price_cents, quantity)
    select v_order.id, p.id, p.name, p.price_cents, i.quantity
    from jsonb_to_recordset(p_items) i(product_id integer, quantity integer)
    join public.products p on p.id = i.product_id;
  update public.products p set stock = p.stock - i.quantity
    from jsonb_to_recordset(p_items) i(product_id integer, quantity integer)
    where p.id = i.product_id;
  insert into public.order_events(order_id,status) values(v_order.id,v_order.status);
  return jsonb_build_object('id',v_order.id,'token',v_order.access_token,'total_cents',v_subtotal+v_fee);
end;
$$;

create function public.track_order(p_token uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',o.id,'mode',o.mode,'status',o.status,'stall',s.name,'location',s.location,
    'total_cents',o.subtotal_cents+o.delivery_cents,'delivery_cents',o.delivery_cents,
    'items',(select jsonb_agg(jsonb_build_object('name',i.item_name,'quantity',i.quantity,'price_cents',i.unit_price_cents)) from public.order_items i where i.order_id=o.id),
    'payment',(select jsonb_build_object('status',p.status,'reference',case when p.status='approved' then p.reference end,'reason',p.reason,'date',p.reviewed_at,'amount_cents',p.amount_cents) from public.payments p where p.order_id=o.id order by p.id desc limit 1),
    'events',(select jsonb_agg(jsonb_build_object('status',e.status,'date',e.created_at) order by e.id) from public.order_events e where e.order_id=o.id)
  )
  from public.orders o join public.stalls s on s.id=o.stall_id where o.access_token=p_token;
$$;

create function public.submit_payment(p_token uuid, p_reference text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where access_token=p_token for update;
  if not found or v_order.status <> 'pending_payment' then raise exception 'Pedido no disponible para pago'; end if;
  if p_reference is null or upper(trim(p_reference)) !~ '^[A-Z0-9-]{6,32}$' then raise exception 'Referencia inválida'; end if;
  if exists(select 1 from public.payments where order_id=v_order.id and status='review') then raise exception 'Ya hay un pago por verificar'; end if;
  insert into public.payments(order_id,reference,amount_cents) values(v_order.id,upper(trim(p_reference)),v_order.subtotal_cents+v_order.delivery_cents);
exception when unique_violation then raise exception 'Referencia ya utilizada';
end;
$$;

create function public.review_payment(p_order uuid, p_payment bigint, p_approve boolean, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id=p_order and stall_id in
    (select m.stall_id from public.stall_members m where m.user_id=auth.uid()) for update;
  if not found then raise exception 'Acceso denegado'; end if;
  if v_order.status <> 'pending_payment' or p_approve is null then raise exception 'El pedido ya fue procesado'; end if;
  if not p_approve and (p_reason is null or char_length(trim(p_reason)) not between 3 and 200) then raise exception 'Indica el motivo de rechazo'; end if;
  update public.payments set status=case when p_approve then 'approved' else 'rejected' end,
    reason=case when not p_approve then trim(p_reason) end, reviewed_at=now(), reviewed_by=auth.uid()
  where id=p_payment and order_id=p_order and status='review';
  if not found then raise exception 'Pago no disponible para revisión'; end if;
  if p_approve then
    update public.orders set status='paid' where id=p_order;
    insert into public.order_events(order_id,status) values(p_order,'paid');
  end if;
end;
$$;

create function public.advance_order(p_order uuid, p_status text, p_pickup_code text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_next text;
begin
  select * into v_order from public.orders where id=p_order and stall_id in
    (select m.stall_id from public.stall_members m where m.user_id=auth.uid()) for update;
  if not found then raise exception 'Acceso denegado'; end if;
  v_next := case v_order.status when 'paid' then 'preparing' when 'preparing' then 'ready'
    when 'ready' then case v_order.mode when 'pickup' then 'picked_up' else 'out_for_delivery' end
    when 'out_for_delivery' then 'delivered' end;
  if v_next is null or p_status is distinct from v_next then raise exception 'Cambio de estado no permitido'; end if;
  if p_status='picked_up' and lower(trim(p_pickup_code)) is distinct from left(v_order.access_token::text,8) then raise exception 'Código de recojo inválido'; end if;
  update public.orders set status=p_status where id=p_order;
  insert into public.order_events(order_id,status) values(p_order,p_status);
end;
$$;

revoke execute on function public.create_order(uuid,text,text,text,text,text,jsonb), public.track_order(uuid), public.submit_payment(uuid,text), public.review_payment(uuid,bigint,boolean,text), public.advance_order(uuid,text,text) from public, anon, authenticated;
grant execute on function public.create_order(uuid,text,text,text,text,text,jsonb), public.track_order(uuid), public.submit_payment(uuid,text) to anon, authenticated;
grant execute on function public.review_payment(uuid,bigint,boolean,text), public.advance_order(uuid,text,text) to authenticated;

insert into public.stalls(name,location) values
  ('Casa Rosa','Pasillo A · Puesto 12'),
  ('Flores del Rímac','Pasillo B · Puesto 25'),
  ('Jardín de Acho','Pasillo C · Puesto 36');
insert into public.delivery_areas values ('Rímac',800),('Cercado de Lima',1000),('San Martín de Porres',1200);
insert into public.products(stall_id,name,category,unit,description,price_cents,stock)
select s.id,v.name,v.category,v.unit,v.description,v.price_cents,v.stock from (values
  ('Casa Rosa','Rosas carmesí','Rosas','Docena','Rosas frescas de tonos intensos para obsequios y eventos.',3500,24),
  ('Flores del Rímac','Girasoles del valle','Girasoles','Ramo de 6','Girasoles grandes seleccionados para cada ramo.',2800,18),
  ('Jardín de Acho','Ramo jardín de temporada','Arreglos','Ramo','Flores de estación en una composición de tonos suaves.',5400,14),
  ('Casa Rosa','Rosas rosadas','Rosas','Docena','Tallos de rosas en tonos rosados, listos para armar arreglos.',3200,20),
  ('Flores del Rímac','Corona de homenaje','Coronas','Unidad','Corona floral de tonos blancos para homenajes.',10500,8),
  ('Jardín de Acho','Arreglo silvestre','Arreglos','Unidad','Arreglo de flores variadas y follaje verde.',6800,12)
) v(stall,name,category,unit,description,price_cents,stock) join public.stalls s on s.name=v.stall;
