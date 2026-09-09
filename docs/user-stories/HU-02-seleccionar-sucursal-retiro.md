# HU-02 — Validar disponibilidad de Sucursal Viña del Mar

**Área:** Backend  
**Componente:** WhatsApp bot  
**Tipo:** Historia de usuario

## Historia

Como cliente que eligió retiro en local,
quiero saber si Sucursal Viña del Mar está abierta,
para continuar el pedido dentro de su horario.

## Reglas

1. El MVP funciona únicamente con Sucursal Viña del Mar.
2. El cliente no elige sucursal.
3. Después de seleccionar Retiro en local, el bot valida el horario de Viña del Mar.
4. Lunes a sábado abre de 11:00 a 23:30.
5. Domingo abre de 12:00 a 20:00.
6. Antes de la apertura se puede programar un pedido para el mismo día.
7. Si ya pasó el cierre, no se permite agendar y se informa la próxima apertura.
8. No existe margen previo al cierre: se usa la hora publicada exacta.
9. Si está abierto, el flujo continúa hacia la carta.

## Criterios de aceptación

- Nunca se muestra una lista de sucursales.
- Retiro queda asociado automáticamente a Sucursal Viña del Mar.
- Se aplica el horario correcto según el día.
- Antes de abrir se permite programar para ese mismo día.
- Después del cierre se informa la próxima apertura y no se agenda.
- Dentro del horario se continúa hacia la carta.

## Fuera de alcance

- Otras sucursales.
- Selección o asignación multisucursal.
- Carta, carrito y tiempo de preparación.
