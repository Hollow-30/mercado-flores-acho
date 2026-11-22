revoke select on public.orders from authenticated;
grant select (id, stall_id, customer_name, phone, mode, district, address, subtotal_cents, delivery_cents, status, created_at) on public.orders to authenticated;
