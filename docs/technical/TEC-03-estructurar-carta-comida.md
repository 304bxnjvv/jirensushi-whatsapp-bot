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

## Categoría 3 — Rolls sin arroz

Todos cuestan **$11.900**. La cantidad de piezas no aparece indicada en la imagen.

| Producto | Relleno mostrado | Envuelto / preparación mostrada | Precio |
|---|---|---|---:|
| Avo Maguro | Queso Crema, Cebollín, Palmito y Atún | Envuelto en Palta | $11.900 |
| Avo Furay | Queso Crema, Palmito, Pimentón y Salmón Furay | Envuelto en Palta | $11.900 |
| Cheese Furay | Pollo Teriyaki, Palta, Cebollín y Camarón | Envuelto en Queso Furay | $11.900 |
| Tako Cheese | Palta, Cebollín, Pulpo y Champiñón Furay | Envuelto en Queso Crema | $11.900 |
| Eby Furay | Queso Crema, Palta, Cebollín y Salmón | Envuelto en Camarón Furay | $11.900 |
| Kyuri Rolls | Queso Crema, Palta, Salmón y Camarón | Envuelto en Pepino | $11.900 |
| Kurosaki Rolls | Queso Crema, Palta, Pollo Teriyaki y Cebollín | Envuelto en Plátano Furay | $11.900 |
| Maguro Sake | Queso Crema, Palta, Pimentón y Salmón | Envuelto en Atún | $11.900 |
| Maguro Furay | Queso Crema, Palta, Cebollín y Camarón Furay | Envuelto en Atún Furay | $11.900 |
| Sake Furay | Queso Crema, Palta, Pimentón y Camarón | Envuelto en Salmón Furay | $11.900 |
| Veggie | Palta, Palmito, Cebollín y Champiñón Furay | Envuelto en Queso Crema | $11.900 |
| Takeshi Rolls | Atún, Camarón Furay, Queso Crema y Palta | Envuelto en Pepino, bañado en salsa acevichada | $11.900 |
| Kempachi Rolls | Queso Crema, Champiñón Furay, Camarón, Palta y Cebollín | Envuelto en Salmón flameado | $11.900 |
| Hiroshi Rolls | Queso Crema, Palta, Masago, Camarón y Pollo Teriyaki | Envuelto en Plátano frito | $11.900 |
| Avo Teriyaki | Queso Crema, Pimentón Furay, Plátano frito y Pollo Teriyaki | Envuelto en Palta | $11.900 |

## Categoría 4 — Rolls premium con arroz

Todos cuestan **$11.900**. La cantidad de piezas no aparece indicada en la imagen.

| Producto | Descripción mostrada | Precio |
|---|---|---:|
| Hot Rolls | Relleno (Pollo Teriyaki, Palta, Cebollín). Envuelto en queso crema y bañado con salsa spicy, coronado con camarón furay, glaseado con salsa unagui. | $11.900 |
| Jiren Rolls | Relleno (Queso Crema, Pollo Teriyaki y Camarón). Envuelto en plátano y bañado con topping Jiren. | $11.900 |
| Dabura Rolls | Relleno (Queso Crema, Palta, Palmito). Envuelto en Salmón flameado, coronado con Camarón furay, bañado con salsa acevichada. | $11.900 |
| Himura Rolls | Relleno (Queso Crema, Pollo Teriyaki y Palta). Envuelto en plátano furay, coronado con queso cheddar gratinado, glaseado con salsa unagui. | $11.900 |
| Akira Rolls | Relleno (Palmito, Palta, Camarón). Envuelto en queso crema flameado, bañado con tartar de salmón. | $11.900 |
| Acevichado Rolls | Relleno (Queso Crema, Palta, Pulpo). Envuelto en alga nori y bañado con ceviche salmón. | $11.900 |
| Tropical Rolls | Relleno (Queso Crema, Palta, Salmón). Envuelto en mango, bañado con salsa acevichada. | $11.900 |
| Kirito Rolls | Relleno (Queso Crema, Palta, Champiñón Furay). Envuelto en plátano frito, bañado en topping de champiñones. | $11.900 |
| Kenji Rolls | Relleno (Camarón Furay y Queso Crema). Envuelto en nori, coronado con tartar de salmón flameado y toques de salsa Spicy. | $11.900 |
| Tenshin Rolls | Relleno (Queso Crema, Palta y Camarón Furay). Envuelto en atún, coronado con atún furay, bañado en salsa de maracuyá. | $11.900 |
| Wakame Rolls | Relleno (Queso Crema, Cebollín, Salmón Furay). Envuelto en Palta, bañado con topping wakame. | $11.900 |
| Huancaina Rolls | Relleno (Queso Crema, Palta, Cebollín, Camarón Furay). Envuelto en alga nori y bañado en salsa huancaína. | $11.900 |
| Veggie Rolls | Relleno (Palmito, Palta, Cebollín). Envuelto en queso crema, bañado con salsa spicy, coronado con champiñón Furay, glaseado con salsa unagui. | $11.900 |
| Hit Rolls | Relleno (Queso Crema, Palta, Camarón). Envuelto en atún, bañado en salsa Mango, coronado con salmón furay. | $11.900 |
| Whis Rolls | Relleno (Queso Crema, Salmón y Camarón). Envuelto en atún, bañado con salsa de maracuyá. | $11.900 |
| Megumi Rolls | Relleno (Queso Crema, Pimentón y Camarón). Envuelto en palta, bañado en topping ceviche y salsa acevichada. | $11.900 |
| Ginyu Rolls | Relleno (Queso Crema, Masago, Kanikama y Salmón). Envuelto en salmón, bañado en salsa de aceituna y salsa acevichada. | $11.900 |
| Bills Rolls | Relleno (Queso Crema, Palta, Camarón Furay). Envuelto en salmón flameado, bañado en topping de pulpo al olivo. | $11.900 |
| Hiroko Rolls | Relleno (Salmón, Queso Crema y Palta). Envuelto en pepino, coronado con topping de atún marinado. | $11.900 |
| Karin Rolls | Relleno (Camarón Furay, Queso Crema y Cebollín). Envuelto en palta y salmón, bañado en salsa acevichada, coronado con masago. | $11.900 |

## Categorías pendientes de transcripción y aprobación

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
