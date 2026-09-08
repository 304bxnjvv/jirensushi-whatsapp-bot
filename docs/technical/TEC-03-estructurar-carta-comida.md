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

## Categoría 2 — Cortes individuales

Cada corte cuesta **$8.990** y requiere elegir exactamente una proteína. La cantidad de piezas no aparece indicada en la imagen y no debe inventarse.

| Producto | Relleno mostrado | Envuelto mostrado | Precio |
|---|---|---|---:|
| Rainbow Rolls | Queso Crema, Cebollín y Proteína | Palta + Salmón o Camarón | $8.990 |
| Masago Rolls | Queso Crema, Palta y Proteína | Masago | $8.990 |
| Plátano Rolls | Queso Crema, Palta y Proteína | Plátano | $8.990 |
| Panko Rolls | Queso Crema, Palta y Proteína | Panko | $8.990 |
| California Rolls | Queso Crema, Palta y Proteína | Sésamo | $8.990 |
| Sake Rolls | Queso Crema, Palta y Proteína | Salmón | $8.990 |
| Maguro Rolls | Queso Crema, Palta y Proteína | Atún | $8.990 |
| Futomaki Rolls | Queso Crema, Palta y Proteína | Alga Nori | $8.990 |
| Cheese Rolls | Palta, Cebollín y Proteína | Queso Crema | $8.990 |
| Avocado Rolls | Queso Crema, Cebollín y Proteína | Palta | $8.990 |

### Proteínas disponibles

- Kanikama.
- Pollo Teriyaki.
- Palmito.
- Champiñón.
- Atún.
- Camarón.
- Salmón.
- Pulpo.

### Regla especial de Rainbow Rolls

Además de la proteína interior, el cliente debe elegir si el exterior lleva salmón o camarón.

## Categorías pendientes de transcripción y aprobación

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
