# HU-02 — Seleccionar sucursal para retiro

**Área:** Backend  
**Componente:** WhatsApp bot  
**Tipo:** Historia de usuario

## Historia

Como cliente que eligió retiro en local,
quiero seleccionar una sucursal y conocer si está abierta,
para continuar mi pedido en el local correcto.

## Lista aprobada

Bot muestra sucursales en este orden:

1. Valparaíso
2. Viña del Mar
3. Placilla
4. Reñaca
5. Quilpué
6. Quillota

## Reglas

1. Lista se muestra después de seleccionar `Retiro en local`.
2. Cliente puede elegir mediante lista interactiva o texto libre.
3. Comparación de texto ignora mayúsculas, minúsculas y tildes.
4. Bot tolera errores ortográficos menores cuando resultado identifica una única sucursal.
5. Bot nunca inventa selección cuando texto coincide con más de una sucursal o confianza es insuficiente.
6. Si no reconoce sucursal, muestra nuevamente lista completa.
7. Tras selección válida, bot consulta horario de esa sucursal.
8. Si local está abierto, continúa hacia flujo de carta.
9. Si local está cerrado, informa próxima apertura y termina flujo.
10. No ofrece automáticamente otra sucursal abierta.
11. No existe margen previo al cierre: se usa hora publicada exacta.

## Horarios aprobados

| Sucursal | Lunes a sábado | Domingo |
|---|---|---|
| Valparaíso | 11:00–23:30 | 12:00–20:00 |
| Viña del Mar | 11:00–23:30 | 12:00–20:00 |
| Placilla | Lun–mar 11:00–22:45; mié–sáb 11:00–23:40 | 12:00–19:15 |
| Reñaca | Lun–mié 11:00–22:45; jue–sáb 11:00–23:45 | 12:00–21:00 |
| Quilpué | Lun–jue 11:00–22:30; vie–sáb 11:00–23:30 | 12:00–19:30 |
| Quillota | 11:00–23:00 | 12:00–20:00 |

## Casos de uso

### Caso 1 — Mostrar sucursales

**Dado** que cliente eligió retiro  
**Cuando** inicia flujo de sucursal  
**Entonces** bot muestra seis sucursales en orden aprobado.

### Caso 2 — Selección desde lista

**Dado** que lista está visible  
**Cuando** cliente pulsa `Viña del Mar`  
**Entonces** bot registra esa sucursal una sola vez y valida horario.

### Caso 3 — Selección por texto

**Dado** que cliente escribe `Quillota`  
**Cuando** bot interpreta respuesta  
**Entonces** registra Quillota y valida horario.

### Caso 4 — Texto sin tilde o con error menor

**Dado** que cliente escribe `renaca` o `quilpue`  
**Cuando** existe una única coincidencia clara  
**Entonces** bot normaliza nombre y registra Reñaca o Quilpué.

### Caso 5 — Sucursal no reconocida

**Dado** que texto no identifica una sucursal con seguridad  
**Cuando** bot procesa respuesta  
**Entonces** no selecciona ninguna y vuelve a mostrar lista completa.

### Caso 6 — Sucursal abierta

**Dado** que sucursal seleccionada está dentro de horario  
**Cuando** bot valida horario  
**Entonces** confirma sucursal y deriva hacia flujo de carta.

### Caso 7 — Sucursal cerrada

**Dado** que sucursal seleccionada está fuera de horario  
**Cuando** bot valida horario  
**Entonces** informa que está cerrada, comunica próxima apertura y termina flujo.

### Caso 8 — Cierre exacto

**Dado** que sucursal sigue dentro de horario publicado  
**Cuando** faltan pocos minutos para cierre  
**Entonces** bot permite continuar sin aplicar margen adicional.

## Criterios de aceptación

- Lista contiene exactamente seis sucursales y respeta orden aprobado.
- Selección interactiva y texto libre producen misma sucursal.
- Tildes y mayúsculas no afectan reconocimiento.
- Error menor solo se acepta con coincidencia única.
- Selección inválida nunca avanza.
- Horario correcto se aplica según sucursal y día.
- Local cerrado muestra próxima apertura y finaliza.
- Local abierto deriva hacia carta.

## Fuera de alcance

- Mostrar o gestionar carta.
- Armar carrito.
- Seleccionar horario de retiro.
- Calcular tiempo de preparación.
- Flujo de despacho.
- Ofrecer una sucursal alternativa.

