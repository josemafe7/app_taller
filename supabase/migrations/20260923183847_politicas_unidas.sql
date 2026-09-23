-- Una sola regla de lectura por tabla (más rápido que dos reglas que se suman).

drop policy "clientes: taller ve" on public.clientes;
drop policy "clientes: mecanico ve los de sus coches" on public.clientes;
create policy "clientes: taller, y el mecanico los de sus coches" on public.clientes for select to authenticated
  using (
    (select privado.es_taller())
    or (
      (select privado.rol()) = 'mecanico'
      and exists (
        select 1 from public.coches c join public.ordenes o on o.coche_id = c.id
        where c.cliente_id = clientes.id and o.mecanico_id = (select privado.persona()) and o.estado <> 'entregado'
      )
    )
  );

drop policy "coches: taller ve" on public.coches;
drop policy "coches: mecanico ve los suyos" on public.coches;
create policy "coches: taller, y el mecanico los suyos" on public.coches for select to authenticated
  using (
    (select privado.es_taller())
    or (
      (select privado.rol()) = 'mecanico'
      and exists (
        select 1 from public.ordenes o
        where o.coche_id = coches.id and o.mecanico_id = (select privado.persona()) and o.estado <> 'entregado'
      )
    )
  );

-- Sobra: ya está el índice de órdenes abiertas por mecánico.
drop index public.ordenes_mecanico_idx;
