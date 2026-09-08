# HU-04 — Navegar la carta por categorías

**Área:** Backend  
**Componente:** WhatsApp bot  
**Estado:** Refinada; lista para desarrollo

## Historia

Como cliente que está armando un pedido,
quiero ver la carta organizada por categorías y abrir solamente la sección que me interesa,
para encontrar productos sin recibir toda la carta en un único mensaje.

## Flujo aprobado

```text
Mostrar categorías → elegir categoría → desplegar productos de esa categoría
```

Después de agregar un producto mediante las historias posteriores, el bot vuelve a mostrar la lista general de categorías.

## Mensaje al abrir la carta

```text
¿Qué te gustaría pedir? Elige una categoría:
```

Después del mensaje, el bot muestra la lista de categorías.

## Categorías y orden

1. Appetizers
2. Cortes individuales
3. Rolls sin arroz
4. Rolls premium con arroz
5. Tablas vegetarianas
6. Tablas calientes
7. Tablas frías
8. Tablas mixtas

## Reglas aprobadas

- El bot muestra primero las ocho categorías, no todos los productos juntos.
- Al seleccionar una categoría, despliega solamente sus productos.
- Cada producto desplegado muestra inmediatamente su nombre y precio.
- La lista de categorías contiene las ocho categorías en una sola página.
- Los productos se muestran en páginas de hasta ocho productos.
- Cuando corresponda, la lista reserva filas para `Anterior` y `Siguiente`, respetando el máximo de diez filas de WhatsApp.
- Si una página necesita `Volver a categorías`, `Anterior` y `Siguiente`, muestra como máximo siete productos para no superar diez filas.
- Cambiar de página no modifica el carrito ni selecciona un producto.
- Cada página de productos incluye una opción visible `Volver a categorías`.
- El bot también vuelve a la lista general cuando el cliente escribe términos claros como `volver` o `menú`.
- Volver a categorías no modifica el carrito.
- Categorías y productos conservan el orden definido en TEC-03.
- El cliente puede seleccionar mediante controles de WhatsApp o escribir libremente.
- Si el cliente escribe directamente el nombre de un producto reconocido, el bot puede abrir ese producto sin obligarlo a navegar categorías.
- La comparación por texto ignora mayúsculas, minúsculas y tildes.
- El bot tolera errores menores solamente cuando existe una única coincidencia clara.
- Si la coincidencia es ambigua, no selecciona categoría ni producto.
- Si no existe una coincidencia clara, pregunta nuevamente qué desea ver y vuelve a mostrar la lista general de categorías.

## Mensaje cuando no reconoce una opción

```text
No encontré esa opción en nuestra carta. ¿Qué categoría deseas ver?
```

Después del mensaje, el bot muestra nuevamente la lista general de categorías.
- Tras agregar un producto, se vuelve a la lista general de categorías.
- Los tragos no aparecen en el MVP.
- La fuente de datos es el JSON definido en [TEC-03](../technical/TEC-03-estructurar-carta-comida.md).

## Casos de uso

### Caso 1 — Abrir carta

**Dado** que el cliente llega al paso de carta  
**Cuando** el bot inicia HU-04  
**Entonces** envía el mensaje aprobado y muestra ocho categorías en el orden definido.

### Caso 2 — Abrir categoría

**Dado** que la lista de categorías está visible  
**Cuando** el cliente selecciona `Rolls sin arroz`  
**Entonces** muestra la primera página de esa categoría con nombre y precio de cada producto.

### Caso 3 — Navegar páginas

**Dado** que una categoría no cabe en una página  
**Cuando** el cliente usa `Siguiente` o `Anterior`  
**Entonces** muestra la página correspondiente sin alterar carrito ni seleccionar productos.

### Caso 4 — Volver a categorías

**Dado** que el cliente está viendo productos  
**Cuando** selecciona `Volver a categorías` o escribe `volver` o `menú`  
**Entonces** muestra nuevamente las ocho categorías sin alterar el carrito.

### Caso 5 — Escribir producto directamente

**Dado** que el cliente escribe el nombre de un producto existente  
**Cuando** existe una coincidencia única  
**Entonces** abre ese producto mediante HU-05 sin exigir navegación previa.

### Caso 6 — Error menor

**Dado** que el cliente escribe `abo furai`  
**Cuando** existe una única coincidencia clara con `Avo Furay`  
**Entonces** abre ese producto.

### Caso 7 — Opción no reconocida

**Dado** que no existe una coincidencia clara  
**Cuando** el bot procesa el texto  
**Entonces** envía el mensaje aprobado y vuelve a mostrar las categorías.

## Criterios de aceptación

- Mensaje inicial coincide con el texto aprobado.
- Lista contiene exactamente ocho categorías y respeta su orden.
- Una categoría muestra solamente sus propios productos.
- Cada fila de producto muestra nombre y precio.
- Productos respetan orden del JSON de TEC-03.
- Ninguna lista supera diez filas.
- Paginación conserva categoría y carrito.
- Volver conserva carrito y muestra categorías.
- Botón/lista y texto libre conducen al mismo producto.
- Error menor solo se acepta con coincidencia única.
- Coincidencia ambigua o inexistente nunca selecciona un producto.
- Los tragos no aparecen.
- Seleccionar producto deriva una sola vez hacia HU-05.

## Fuera de alcance

- Mostrar el detalle completo de un producto; corresponde a HU-05.
- Elegir cantidad o personalizar; corresponde a HU-06.
- Administrar el carrito; corresponde a HU-07.
- Gestionar disponibilidad o stock por sucursal.
