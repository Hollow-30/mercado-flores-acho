# Trabajo pendiente: Mercado de Flores de Acho

El proyecto es un prototipo académico: los puestos y productos son de demostración, los pagos son simulados y no hay servicio de reparto integrado. La portada y el acceso de comerciantes se han mejorado; el carrito se conserva durante la misma sesión del navegador. No se ha validado el flujo completo contra una base de datos conectada.

## 1. Detalle de pedidos para comerciantes — prioridad alta

- [ ] Permitir que cada comerciante consulte los productos, cantidades, precios y subtotal de sus propios pedidos.
- [ ] Mantener la protección por puesto en la base de datos; no exponer pedidos ni datos personales de otros comerciantes.
- [ ] Probar con dos cuentas de puestos distintos y comprobar que cada una solo ve sus pedidos.

Referencias: [rutas de la API](./lib/routes.js), [panel del comerciante](./public/market.js) y [migraciones](./supabase/migrations/).

## 2. Reservas de stock y cancelación — prioridad alta

- [ ] Definir con los comerciantes cuánto dura una reserva y qué ocurre con pagos en revisión al vencer.
- [ ] Implementar vencimiento y cancelación con operaciones atómicas que restituyan el stock una sola vez.
- [ ] Informar el plazo y el estado al comprador y al comerciante.
- [ ] Probar pedidos simultáneos, reintentos, cancelaciones repetidas y pagos concurrentes con el vencimiento.
- [ ] Configurar y verificar una tarea programada para liberar reservas incluso cuando nadie visite la web.

## 3. Compra y seguimiento — prioridad alta

- [ ] Comparar precio y stock actuales antes de confirmar; solicitar aceptación explícita si cambian.
- [ ] Diseñar recuperación segura de pedidos y contemplar varios pedidos por cliente. Actualmente el código se conserva en la sesión y puede copiarse; perderlo impide la consulta.
- [ ] Informar cuando un producto guardado deje de estar disponible y permitir corregir el carrito.
- [ ] Probar recarga, pérdida de conexión, reintento de confirmación y cambios de cantidad sin perder datos escritos.

## 4. Coordinación de recojo y entrega — prioridad media

- [ ] Mostrar cobertura y tarifas antes del carrito; definir horarios, plazos y disponibilidad reales.
- [ ] Permitir elegir fecha y franja, validando horarios y fechas disponibles en el servidor.
- [ ] Incorporar cancelaciones, incidencias y sustituciones con estados y mensajes claros.
- [ ] Probar distritos sin cobertura, fechas no disponibles y cambios de modalidad.

## 5. Fotos y catálogo — prioridad media

- [ ] Permitir al comerciante subir y actualizar fotos propias con validación de tipo, tamaño y permisos.
- [ ] Guardar la asociación de imagen por producto; los nombres y fotos actuales son datos de demostración.
- [ ] Añadir información útil como cantidad, tamaño, colores y variaciones.
- [ ] Probar productos sin foto, carga fallida y acceso entre puestos; sustituir imágenes generadas por fotos reales autorizadas.

## 6. Carrito de varios puestos — decisión de producto

- [ ] Definir con comerciantes cómo se coordinarán pagos, inventario, recojos y envíos entre puestos.
- [ ] Si se aprueba, dividir el carrito en pedidos independientes, mostrando subtotales, tarifas y códigos de seguimiento por puesto antes de confirmar.
- [ ] Probar fallos parciales y reintentos sin crear pedidos duplicados. Hasta entonces el carrito admite un solo puesto.

## 7. Operación real — posterior al prototipo

- [ ] Seleccionar y configurar proveedores de pago y delivery; acordar costos, cobertura y responsabilidades.
- [ ] Implementar confirmaciones seguras del proveedor, notificaciones, conciliación y gestión de incidencias.
- [ ] Diseñar registro, recuperación de contraseña y soporte para comerciantes, sin abrir acceso a puestos ajenos.
- [ ] Mantener visibles las etiquetas de simulación hasta verificar integralmente los servicios reales.

## Verificación antes de publicar

- [ ] Ejecutar `npm test` y `npm run build`, además de pruebas de integración y seguridad con una base de datos de prueba.
- [ ] Probar el recorrido completo comprador → pedido → pago → comerciante → entrega y sus casos de error.
- [ ] Revisar pantalla táctil, teclado y lector de pantalla en teléfonos y escritorio, incluyendo 320 px de ancho.
- [ ] Revisar migraciones, permisos y políticas de Supabase antes de aplicarlas; preparar recuperación y despliegue.
