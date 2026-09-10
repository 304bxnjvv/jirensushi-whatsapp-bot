# HU-20 — Transferir conversación a atención humana

**Área:** Frontend · Backend · WhatsApp  
**Estado:** Refinada; lista para desarrollo

## Historia

Como cliente,
quiero solicitar una persona cuando lo necesite,
para continuar la misma conversación sin perder lo hablado con el bot.

## Reglas

- Cliente puede pedir humano en cualquier etapa.
- Si aún no indicó modalidad, bot pregunta si quiere comunicarse con Sucursal Viña del Mar antes de derivar.
- Admin puede tomar manualmente cualquier chat aunque cliente no lo pida.
- Panel muestra historial completo y cola `Requiere atención`, más antigua primero.
- Al tomar chat, bot se pausa y envía: `Te derivamos con una persona. Te responderemos por este chat.`
- Cuenta local y CEO pueden responder; no se asigna a persona particular.
- Mensajes humanos se identifican con `Equipo Jiren:`.
- Cliente puede seguir enviando mensajes mientras espera.
- Fuera de horario se informa próxima apertura.
- Si nadie toma chat en 15 minutos, informar indisponibilidad, reactivar bot y ofrecer continuar.
- Admin puede cerrar atención humana manualmente.
- Al reactivar bot: informar cambio, usar contexto completo, resumir acuerdo y pedir confirmación antes de continuar.
- Conversación humana completa queda guardada y visible para CEO.
- Continuidad correcta del contexto es requisito; no existe flujo que descarte lo conversado.

## Criterios de aceptación

- Mientras humano controla chat, bot no responde.
- Solo una respuesta llega por turno.
- Historial aparece completo y ordenado.
- Al volver al bot, cliente conoce cambio y confirma resumen.
- Vencimiento de 15 minutos no elimina mensajes ni carrito.
- Toma/devolución quedan en auditoría.

## Fuera de alcance

- Asignación individual, turnos o métricas de soporte.
- Derivación automática por alergia o mensajes no entendidos.
