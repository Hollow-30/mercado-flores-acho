drop policy products_read on public.products;
create policy products_read_published on public.products for select to anon, authenticated using (published);
create policy products_read_own_drafts on public.products for select to authenticated
  using (stall_id in (select m.stall_id from public.stall_members m where m.user_id = (select auth.uid())));
