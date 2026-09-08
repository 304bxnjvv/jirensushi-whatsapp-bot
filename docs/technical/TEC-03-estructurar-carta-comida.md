# TEC-03 — Estructurar y cargar la carta de comida

**Área:** Backend  
**Tipo:** Tarea técnica habilitadora  
**Estado:** En refinamiento; no lista para desarrollo

## Objetivo

Convertir la carta oficial entregada en imágenes a datos estructurados que el bot pueda consultar sin inventar productos, ingredientes, cantidades ni precios.

## Reglas aprobadas

- El MVP incluye solamente comida.
- Los tragos quedan excluidos hasta recibir su carta oficial.
- Se usan las siete imágenes entregadas como fuente actual.
- Los nombres, cantidades, ingredientes y precios se registran tal como aparecen en las imágenes.
- Si una imagen no muestra un dato, ese dato queda vacío; no se completa mediante suposición.

## Orden aprobado de categorías

1. Appetizers
2. Cortes individuales
3. Rolls sin arroz
4. Rolls premium con arroz
5. Tablas vegetarianas
6. Tablas calientes
7. Tablas frías
8. Tablas mixtas

## Categoría 1 — Appetizers

Todos los productos tienen precio de **$6.990**.

| Cantidad mostrada | Producto | Precio |
|---:|---|---:|
| 6 | Arrollados Primavera | $6.990 |
| 6 | Arrollados Jamón, Queso | $6.990 |
| 6 | Atún Furay | $6.990 |
| 6 | Salmón Furay | $6.990 |
| 6 | Pollo Teri Furay | $6.990 |
| 6 | Camarón Furay | $6.990 |
| 6 | Nigiri Salmón | $6.990 |
| 6 | Nigiri Camarón | $6.990 |
| 6 | Nigiri Atún | $6.990 |
| 6 | Korokkes de Pollo | $6.990 |
| 6 | Korokkes de Salmón | $6.990 |
| 6 | Korokkes de Camarón | $6.990 |
| 6 | Korokkes de Atún | $6.990 |
| 10 | Gyozas Salteadas | $6.990 |
| 6 | Gunkan Plátano | $6.990 |
| No indicada | Papas Jiren | $6.990 |

## Categorías pendientes de transcripción y aprobación

- Cortes individuales.
- Rolls sin arroz.
- Rolls premium con arroz.
- Tablas vegetarianas.
- Tablas calientes.
- Tablas frías.
- Tablas mixtas.

## Pendiente posterior a la transcripción

- Definir estructura de datos final.
- Definir identificadores estables de productos y categorías.
- Definir cómo representar opciones de proteína.
- Definir cómo representar ingredientes removibles, reemplazables y adicionales.
- Definir recargos de agregados y reemplazos.
- Validar la transcripción completa antes de cargarla al bot.
