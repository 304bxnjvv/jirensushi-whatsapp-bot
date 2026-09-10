# HU-01 — Iniciar conversación y elegir modalidad

**Área:** Backend · WhatsApp
**Estado:** Refinada; lista para desarrollo

## Historia

Como cliente,
quiero recibir bienvenida y elegir retiro o despacho,
para iniciar pedido sin repetir lo que ya escribí.

## Reglas

- En conversación nueva, bot conserva mensaje original y envía bienvenida una vez.
- Opciones: `Retiro en local` y `Despacho a domicilio`; también acepta texto libre/sinónimos.
- Si modalidad es clara, registra y continúa. Si es ambigua/no identificada, pregunta; no inventa.
- Datos adicionales del primer mensaje quedan como candidatos para historias posteriores.
- MVP opera solo con Sucursal Viña del Mar.
- Retiro continúa a HU-02; despacho continúa a HU-10.
- Un borrador se abandona tras 60 minutos sin actividad. No aplica a pedido Pendiente, Aceptado ni atención humana.
- Cliente no puede iniciar pedido nuevo mientras tenga uno Aceptado y no Entregado.
- Solicitud humana tiene prioridad y continúa a HU-20. No se muestra lista de sucursales.

## Mensaje base

> ¡Hola! 👋 Bienvenido a Jiren Sushi Viña del Mar 🍣
> ¿Quieres hacer tu pedido con retiro en local o despacho a domicilio?

## Criterios de aceptación

- Bienvenida aparece una vez por conversación nueva.
- Mensaje inicial siempre se conserva.
- Botones y texto libre producen mismo resultado.
- Una elección válida genera una sola transición.
- Ambigüedad no avanza.
- Reinicio por 60 minutos marca borrador anterior `Abandonado`.
- Pedido activo no permite comenzar otro.
- Solicitud humana pausa flujo normal y deriva a HU-20.
