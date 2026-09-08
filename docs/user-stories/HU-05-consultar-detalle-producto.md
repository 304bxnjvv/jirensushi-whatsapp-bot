# HU-05 — Consultar producto, precio e ingredientes

**Área:** Backend  
**Componente:** WhatsApp bot  
**Estado:** En refinamiento; no lista para desarrollo

## Historia

Como cliente que seleccionó un producto,
quiero revisar su nombre, ingredientes y precio,
para decidir si deseo agregarlo al pedido.

## Reglas aprobadas

- HU-05 puede iniciarse desde una lista de HU-04 o desde un nombre escrito libremente y reconocido.
- El bot muestra nombre, ingredientes y precio del producto seleccionado.
- El producto no se agrega automáticamente al carrito.
- Después del detalle, el flujo continúa hacia HU-06 para elegir cantidad y personalización.
- Los datos provienen únicamente del JSON definido en TEC-03.

## Pendiente de definición

- Mostrar cantidad de piezas cuando aparece en la carta.
- Mostrar preparación, envoltura, salsas y toppings.
- Mostrar elecciones obligatorias del producto.
- Texto y formato del detalle.
- Acción para volver sin agregar.
- Casos de uso y criterios de aceptación finales.

## Fuera de alcance

- Elegir cantidad.
- Quitar, reemplazar o agregar ingredientes.
- Agregar al carrito.
- Consultar o prometer disponibilidad por sucursal.
