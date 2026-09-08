# HU-04 — Navegar la carta por categorías

**Área:** Backend  
**Componente:** WhatsApp bot  
**Estado:** En refinamiento; no lista para desarrollo

## Historia

Como cliente que está armando un pedido,
quiero ver la carta organizada por categorías y abrir solamente la sección que me interesa,
para encontrar productos sin recibir toda la carta en un único mensaje.

## Flujo aprobado

```text
Mostrar categorías → elegir categoría → desplegar productos de esa categoría
```

Después de agregar un producto mediante las historias posteriores, el bot vuelve a mostrar la lista general de categorías.

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
- Categorías y productos conservan el orden definido en TEC-03.
- El cliente puede seleccionar mediante controles de WhatsApp o escribir libremente.
- Si el cliente escribe directamente el nombre de un producto reconocido, el bot puede abrir ese producto sin obligarlo a navegar categorías.
- Tras agregar un producto, se vuelve a la lista general de categorías.
- Los tragos no aparecen en el MVP.
- La fuente de datos es el JSON definido en [TEC-03](../technical/TEC-03-estructurar-carta-comida.md).

## Pendiente de definición

- Información mostrada en cada fila de producto.
- Forma de dividir categorías que superen el límite de opciones de WhatsApp.
- Respuesta cuando una categoría o producto no se reconoce.
- Acciones disponibles después de desplegar una categoría.
- Casos de uso y criterios de aceptación finales.

## Fuera de alcance

- Mostrar el detalle completo de un producto; corresponde a HU-05.
- Elegir cantidad o personalizar; corresponde a HU-06.
- Administrar el carrito; corresponde a HU-07.
- Gestionar disponibilidad o stock por sucursal.
