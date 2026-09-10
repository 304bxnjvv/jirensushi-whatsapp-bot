# Estado de implementación — 10 de septiembre de 2026

## Resultado verificable

Aplicación implementada en la rama `feat/mvp-vina`. Bot y panel funcionan con SQLite local y simulador autenticado. El Worker productivo, D1 y la clave de OpenAI están configurados en Cloudflare: [panel del piloto](https://jiren-sushi-vina.barqodex.workers.dev). Adaptadores Meta/OpenAI implementados con pruebas de protocolo; **WhatsApp real aún no está conectado**.

- `npm run check`: 80 pruebas aprobadas, TypeScript correcto y empaquetado de Worker correcto.
- Prueba de panel con API controlada: aceptación, protección contra HTML del cliente, conservación de borrador al actualizar, devolución humana y móvil.
- Prueba integrada sin mocks: pedido de retiro completo → pendiente → aceptar con 45 minutos → entregado; mensajes y auditoría guardados; humano toma chat, bot calla, devuelve, cliente confirma cambios; CEO y móvil de 375/768 px.
- Dependencias actualizadas a Wrangler 4.131.0; auditoría npm sin vulnerabilidades detectadas en esta revisión.
- Verificación independiente en GitHub Actions (Node 24/Linux y Chromium): [ejecución aprobada](https://github.com/304bxnjvv/jirensushi-whatsapp-bot/actions/runs/34506291207).

[Entrega para revisión: PR #24](https://github.com/304bxnjvv/jirensushi-whatsapp-bot/pull/24). `main` no se ha modificado. Las 22 historias activas están In Progress y se mantienen sus responsables; HU-11 permanece retirada.

Esto acredita comportamiento local, no aprobación de Meta, disponibilidad del modelo, entrega real a teléfonos ni capacidad bajo carga productiva.

## Cobertura de HU/TEC

| Historias | Implementación | Evidencia principal |
|---|---|---|
| HU-01, HU-02 | Bienvenida, modalidades, mensaje original, abandono auditado, Viña y horarios | `bot.test.ts`, `regressions.test.ts`, `service.test.ts` |
| HU-03 | Alcance, reglas, arquitectura, arranque y límites | README, documento transversal y este informe |
| TEC-03, HU-04, HU-05 | JSON, categorías, paginación, detalle, coincidencia no ambigua | `catalog.test.ts`, `bot.test.ts` |
| HU-06, HU-07 | Cantidad libre entera, elecciones y recargos por unidad, carrito | `bot.test.ts`, `regressions.test.ts` |
| HU-08, HU-09 | ASAP, bloques de 15 min con mínimo 30, nombre, teléfono y pago | `bot.test.ts`, `regressions.test.ts`, `ui-real.mjs` |
| HU-10, HU-12 | Zona, tarifa, dirección textual y referencia; total reconfirmado si cambia tarifa | `bot.test.ts`, `regressions.test.ts` |
| HU-13 | Resumen, confirmación única, bloqueo de pedido activo | `bot.test.ts`, `service.test.ts`, `ui-real.mjs` |
| HU-14, HU-15 | Login, roles, búsqueda, estados, notificaciones y panel responsive | `auth.test.ts`, `http.test.ts`, pruebas de navegador |
| HU-16, HU-19 | Aceptar/rechazar con auditoría, concurrencia y entrega irreversible | `service.test.ts`, pruebas de navegador |
| HU-17, HU-18 | Avisos, cola de salida y reapertura por ingredientes con original bloqueado | `providers.test.ts`, `service.test.ts`, `bot.test.ts` |
| HU-20 | Chat humano, pausa, espera, resumen confirmado y notas conservadas en pedido | `service.test.ts`, `regressions.test.ts`, `ui-real.mjs` |
| TEC-01, TEC-02 | Webhook firmado, filtro receptor, inbox/outbox durables y D1/SQLite | `providers.test.ts`, `http.test.ts`, `service.test.ts` |

HU-11 fue retirada. HU-19 corresponde a **Entregado**, no a cierre excepcional. El cierre excepcional está disponible en Configuración y respeta reapertura.

## Pendiente antes del piloto real

1. Usuario CEO productivo, contraseña segura conservada por el negocio y evaluación de expresiones reales con el equipo.
2. Aplicación/número de prueba Meta, webhook suscrito, permisos y plantilla de utilidad aprobada.
3. Presupuesto y evaluación de expresiones reales con el equipo. Las pruebas de protocolo no demuestran calidad lingüística del modelo en vivo.
4. Confirmar límites de cobertura y dirección oficial. No habilitar despacho real basándose solo en nombres de zonas provisionales.
5. Prueba real de recepción/entrega, reconexión, ventanas de 24 horas, carga del local y aceptación de negocio.

El acuerdo humano se conserva completo en historial y como nota del pedido. El bot aplica automáticamente únicamente campos reconocidos y validados (por ejemplo, hora y modificación de una unidad identificada); ante ambigüedad solicita aclaración. No interpreta cualquier promesa humana como autorización para cambiar precios o aceptar pedidos.

El tablero debe mantenerse **In Progress** mientras falten piloto/integraciones; código implementado no equivale a HU productiva aceptada. No cambiar responsables existentes ni cerrar historias por el mero hecho de publicar una rama.
