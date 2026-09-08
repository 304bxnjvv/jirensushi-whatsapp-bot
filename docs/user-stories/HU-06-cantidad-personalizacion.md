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
- El bot pregunta `¿Quieres modificar ingredientes?` y muestra botones `Sí` y `No`.
- Si el cliente elige `Sí`, escribe todas sus modificaciones libremente en un mensaje.
- El bot interpreta solicitudes como quitar, reemplazar o agregar y muestra un resumen estructurado.
- Ninguna modificación queda confirmada solo por haber sido interpretada; el cliente debe aprobar el resumen.
- Después del resumen de cada unidad, muestra `Confirmar unidad`, `Modificar` y `Cancelar unidad`.
- `Modificar` permite corregir las elecciones o modificaciones de la unidad actual antes de confirmarla.
- La cancelación afecta solamente a la unidad actual; no elimina otras unidades ya configuradas del mismo producto.
- Si alguna modificación no se entiende con seguridad, el bot no aplica ningún cambio parcial.
- Ante interpretación incompleta o ambigua, pide al cliente escribir nuevamente todas las modificaciones de esa unidad.
- Los productos con grupos obligatorios deben completar esas elecciones.
- Para cada unidad, el bot solicita primero todas las elecciones obligatorias y después las modificaciones.
- El orden general es: cantidad → elecciones obligatorias → modificaciones → confirmación de la unidad.
- Cuando la cantidad es mayor que uno, cada unidad se personaliza por separado.
- El bot identifica claramente el avance, por ejemplo `Unidad 1 de 3`.
- Una personalización no se copia automáticamente a las otras unidades.
- Desde la segunda unidad, el bot ofrece `Igual a la anterior`.
- Esa acción copia las elecciones obligatorias y modificaciones de la unidad inmediatamente anterior.
- La composición de las tablas es fija: no se puede cambiar un corte por otro.
- Solo se permiten elecciones de tabla mostradas explícitamente en TEC-03.
- El producto se agrega al carrito únicamente después de completar cantidad, elecciones y personalización.
- Después de agregar, el bot vuelve a la lista general de categorías de HU-04.

## Pendiente de definición

- Confirmación previa a agregar al carrito.
- Corrección o cancelación durante la personalización.
- Precios y reglas de agregados y reemplazos.
- Casos de uso y criterios de aceptación finales.

## Fuera de alcance

- Modificar productos que ya están en el carrito; corresponde a HU-07.
- Cambiar la composición fija de una tabla.
- Gestionar stock por sucursal.
