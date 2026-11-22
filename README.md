# Mercado de Flores de Acho

Prototipo académico de catálogo, pedidos, pagos simulados, recojo y entrega a domicilio. El panel de comerciantes administra inventario y pedidos de su propio puesto.

## Arranque

1. Aplica las migraciones de `supabase/migrations` a un proyecto Supabase. Los puestos, productos y distritos de demostración se cargan con la migración inicial.
2. Configura `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` en Vercel. Para desarrollo local configura las mismas variables y usa `vercel dev`.
3. Para habilitar un comerciante, crea su usuario en Supabase Auth e inserta su identificador y el ID de su puesto en `stall_members`. No se incluyen credenciales en el repositorio.
4. Ejecuta `npm ci`, `npm run build`, `npm test` y `npm run security` para verificar el proyecto.

## Entrega

- `test` recibe cambios para revisión. Los PRs se integran en `main` tras verificar el resultado de CI.
- GitHub Actions comprueba el build, las pruebas y los controles de dependencias y de secretos. Vercel consume `main` como rama de producción.
- La simulación utiliza datos ficticios y referencias de transferencia de ejemplo. No hay cobros reales ni conexión con una pasarela.
