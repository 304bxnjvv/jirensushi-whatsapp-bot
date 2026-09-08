# HU-06 — Elegir cantidad y personalizar producto

**Área:** Backend  
**Componente:** WhatsApp bot  
**Estado:** En refinamiento; bloqueada por precios de agregados y reemplazos

## Historia

Como cliente que revisó un producto,
quiero elegir cuántos comprar y personalizar sus ingredientes,
para agregar al carrito exactamente lo que necesito.

## Reglas aprobadas

- HU-06 comienza después de seleccionar `Elegir cantidad` en HU-05.
- El bot pregunta la cantidad antes de agregar el producto.
- Para cantidad muestra botones `1`, `2` y `3`.
- El cliente también puede escribir otra cantidad en texto libre.
- El bot no impone una cantidad máxima por producto.
- La sucursal conserva la posibilidad de rechazar el pedido desde el panel si no puede preparar la cantidad solicitada.
- Una cantidad válida es únicamente un número entero mayor que cero.
- `0`, números negativos, decimales y textos sin una cantidad identificable son inválidos.
- Ante una cantidad inválida, el bot no avanza ni modifica el carrito y vuelve a solicitarla.
- El cliente puede quitar, reemplazar y agregar ingredientes.
- Los productos con grupos obligatorios deben completar esas elecciones.
- La composición de las tablas es fija: no se puede cambiar un corte por otro.
- Solo se permiten elecciones de tabla mostradas explícitamente en TEC-03.
- El producto se agrega al carrito únicamente después de completar cantidad, elecciones y personalización.
- Después de agregar, el bot vuelve a la lista general de categorías de HU-04.

## Pendiente de definición

- Orden entre elecciones obligatorias y personalización.
- Forma conversacional de quitar, reemplazar y agregar ingredientes.
- Confirmación previa a agregar al carrito.
- Corrección o cancelación durante la personalización.
- Precios y reglas de agregados y reemplazos.
- Casos de uso y criterios de aceptación finales.

## Fuera de alcance

- Modificar productos que ya están en el carrito; corresponde a HU-07.
- Cambiar la composición fija de una tabla.
- Gestionar stock por sucursal.
