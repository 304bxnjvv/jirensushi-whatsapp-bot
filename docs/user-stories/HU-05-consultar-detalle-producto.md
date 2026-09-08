# HU-05 — Consultar producto, precio e ingredientes

**Área:** Backend  
**Componente:** WhatsApp bot  
**Estado:** En refinamiento; no lista para desarrollo

## Historia

Como cliente que seleccionó un producto,
quiero revisar toda la información disponible en la carta,
para decidir si deseo agregarlo al pedido.

## Reglas aprobadas

- HU-05 puede iniciarse desde una lista de HU-04 o desde un nombre escrito libremente y reconocido.
- El bot muestra nombre, precio e ingredientes del producto seleccionado.
- Muestra la cantidad de piezas solamente cuando aparece en la carta.
- Muestra envoltura, preparación, salsas, toppings, flameado, furay y demás información disponible.
- Si el producto tiene elecciones obligatorias, informa cuáles son antes de continuar.
- No inventa cantidad, ingrediente ni preparación cuando TEC-03 no contiene ese dato.
- El producto no se agrega automáticamente al carrito.
- Después del detalle, el flujo continúa hacia HU-06 para elegir cantidad y personalización.
- Si el cliente decide no continuar, vuelve a la lista general de categorías de HU-04.
- Volver desde el detalle no modifica el carrito.
- Después del detalle muestra exactamente dos acciones: `Elegir cantidad` y `Volver a categorías`.
- `Elegir cantidad` deriva a HU-06 sin agregar todavía el producto.
- Los datos provienen únicamente del JSON definido en TEC-03.

## Pendiente de definición

- Texto y formato del detalle.
- Casos de uso y criterios de aceptación finales.

## Fuera de alcance

- Elegir cantidad.
- Quitar, reemplazar o agregar ingredientes.
- Agregar al carrito.
- Consultar o prometer disponibilidad por sucursal.
