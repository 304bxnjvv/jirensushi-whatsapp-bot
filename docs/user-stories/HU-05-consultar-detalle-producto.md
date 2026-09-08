# HU-05 — Consultar producto, precio e ingredientes

**Área:** Backend  
**Componente:** WhatsApp bot  
**Estado:** Refinada; lista para desarrollo

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

## Formato aprobado

```text
Avo Furay — $11.900

Ingredientes: queso crema, palmito, pimentón y salmón furay.
Preparación: envuelto en palta.
```

Cuando corresponda, el bot agrega líneas para:

- `Piezas`: cantidad mostrada en la carta.
- `Incluye`: componentes de una tabla.
- `Opciones obligatorias`: elecciones necesarias antes de agregar.

Los campos vacíos no se muestran.

## Casos de uso

### Caso 1 — Ver roll

**Dado** que el cliente selecciona `Avo Furay`  
**Cuando** el bot consulta TEC-03  
**Entonces** muestra nombre, precio, ingredientes y preparación.

### Caso 2 — Ver producto con piezas

**Dado** que el cliente selecciona `Gyozas Salteadas`  
**Cuando** la carta declara diez piezas  
**Entonces** muestra también `Piezas: 10`.

### Caso 3 — Ver tabla

**Dado** que el cliente selecciona una tabla  
**Cuando** el bot presenta su detalle  
**Entonces** muestra precio, total de piezas y cada componente incluido.

### Caso 4 — Ver producto con elección obligatoria

**Dado** que el cliente selecciona un corte individual  
**Cuando** el producto requiere proteína  
**Entonces** informa esa elección y sus alternativas antes de continuar.

### Caso 5 — Continuar

**Dado** que el detalle está visible  
**Cuando** el cliente selecciona `Elegir cantidad`  
**Entonces** deriva una sola vez a HU-06 sin agregar todavía el producto.

### Caso 6 — Volver

**Dado** que el detalle está visible  
**Cuando** el cliente selecciona `Volver a categorías`  
**Entonces** vuelve a HU-04 sin modificar el carrito.

## Criterios de aceptación

- Nombre y precio siempre se muestran.
- Precio se formatea como pesos chilenos.
- Se muestran todos los detalles disponibles en TEC-03.
- No se muestran etiquetas vacías.
- No se inventan piezas, ingredientes, preparación ni opciones.
- Productos con elecciones obligatorias muestran todas sus alternativas.
- Tablas muestran composición fija completa.
- Detalle termina con las dos acciones aprobadas.
- Consultar detalle nunca agrega automáticamente al carrito.
- Volver conserva el carrito.
- Continuar deriva a HU-06.

## Fuera de alcance

- Elegir cantidad.
- Quitar, reemplazar o agregar ingredientes.
- Agregar al carrito.
- Consultar o prometer disponibilidad por sucursal.
