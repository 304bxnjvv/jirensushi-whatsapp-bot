# Jiren Sushi — MVP Viña del Mar

Bot de WhatsApp y panel interno para **una sucursal**. Retiro, despacho por zona, carta JSON, personalización por unidad, pedidos y atención humana. Sin sitio público, n8n, Google Maps API ni coordinación automática de repartidores.

Implementación disponible localmente y desplegada para el piloto en [jiren-sushi-vina.barqodex.workers.dev](https://jiren-sushi-vina.barqodex.workers.dev). **Aún no está conectado a un WhatsApp real.** Consulta [estado y cobertura de historias](docs/implementation-status.md).

## Probar la aplicación

Requisitos: Node.js 24 o superior y npm. Node 22.18+ también satisface el mínimo declarado; las pruebas de entrega se ejecutaron con Node 25.

```sh
npm ci --ignore-scripts
npm run dev
```

Abre [panel local](http://localhost:8787). El servidor escucha solo en este equipo.

| Cuenta local de demostración | Contraseña | Acceso |
|---|---|---|
| `local` | `Local-demo-2026!` | Pedidos, conversaciones y configuración |
| `ceo` | `CEO-demo-2026!` | Lo anterior y auditoría |

Estas cuentas se crean únicamente en `.local/jiren.sqlite`, nunca en producción. El simulador no usa credenciales ni envía mensajes externos. No expongas este servidor de desarrollo a Internet.

En **Simulador**, elige “Usar horario abierto”, escribe `retiro`, selecciona un producto y sigue los botones. Confirma el pedido y revisa **Pedidos** para aceptarlo, rechazarlo o entregarlo. Usa teléfonos de prueba distintos para conversaciones independientes.

El reloj del simulador afecta solo mensajes del cliente; panel y temporizadores usan hora real. La base local persiste tras reiniciar. Las pruebas de navegador agregan datos ficticios con teléfonos únicos en esa base, sin borrar datos existentes.

## Verificación

```sh
npm run check
npm run test:ui
npm audit --audit-level=high
```

`check` ejecuta TypeScript, pruebas y empaquetado de Cloudflare **sin desplegar**. Las pruebas de navegador usan Microsoft Edge instalado. Para Chromium de Playwright, instala `npx playwright install chromium` y establece `PLAYWRIGHT_CHANNEL=chromium` en tu terminal antes de `npm run test:ui`.

GitHub Actions ejecuta las mismas verificaciones en Node 24/Linux. No despliega ni requiere secretos.

## Componentes

| Carpeta | Responsabilidad |
|---|---|
| `src/data/catalog.json` | 76 productos, ocho categorías y precios aprobados |
| `src/domain` | Conversación, carta, horarios, recargos y validación final |
| `src/service.ts` | Pedidos, atención humana, persistencia, reintentos y retención |
| `src/providers` | Adaptadores HTTP oficiales de Meta y OpenAI |
| `public` | Panel responsive y simulador local |
| `migrations` | Esquema D1/SQLite, usuarios, historial y auditoría |
| `tests` | Pruebas de reglas, persistencia, protocolos y navegador |

Los textos ambiguos pueden usar OpenAI; botones y reglas conocidas funcionan sin IA. La IA interpreta intención: nunca fija precios, acepta pedidos ni obtiene herramientas para modificar la base. [Contrato de API](docs/api-contract.md) · [Integraciones](docs/provider-notes.md).

## Antes de conectar servicios reales

1. Confirmar dirección oficial y límites de las zonas con el local. Las tarifas iniciales son $2.500, $3.500 y $4.500; la cobertura exacta sigue pendiente.
2. Cloudflare/D1 ya está creado y migrado; el Worker está publicado en la dirección anterior.
3. Crear usuarios propios de local y CEO con contraseñas únicas. No reutilizar cuentas de demostración.
4. `OPENAI_API_KEY` ya está configurado como secreto en Cloudflare. Configurar los secretos Meta mediante el gestor de secretos de Cloudflare. No pegarlos en el chat ni guardarlos en Git.
5. Crear la aplicación de Meta, registrar el número de prueba, suscribir `/webhook` y verificar firma, número receptor, recepción y entrega.
6. Aprobar y configurar la plantilla de utilidad para mensajes fuera de la ventana de 24 horas. Hacer piloto con el equipo antes de usar el número de Jiren.

Configuración de secretos: `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_STATUS_TEMPLATE` y, para texto libre asistido, `OPENAI_API_KEY`. Modelo configurable mediante `OPENAI_MODEL`. El nombre de plantilla no implica aprobación de Meta.

Comandos para el desarrollador **después de autorizar/configurar la cuenta**:

```sh
npx wrangler login
npx wrangler d1 create jiren
# Actualizar database_id en wrangler.jsonc con el resultado anterior.
npx wrangler d1 migrations apply jiren --remote
npx wrangler secret put META_ACCESS_TOKEN
# Repetir secret put para los secretos necesarios; valores se ingresan interactivamente.
npm run deploy
```

`scripts/create-user.ts USUARIO local|ceo` recibe una contraseña por entrada estándar y emite SQL con hash y sal aleatoria, no la contraseña. El desarrollador debe usar una entrada oculta segura, guardar ese SQL fuera de Git e importarlo en D1. Con `--reset` emite actualización de clave y revocación de sesiones, conservando el rol existente. No existe registro público ni autogestión de usuarios.

## Operación y límites

- Confirmación del cliente crea **Pendiente**; solamente el local confirma aceptación. Un pedido activo bloquea otro del mismo teléfono.
- Atención humana pausa el bot. Al devolverlo, el trabajador resume lo acordado; cliente confirma. Los términos reconocidos pasan por las reglas y el acuerdo íntegro acompaña el pedido como nota. Los cambios ambiguos requieren aclaración: no se inventan precios ni productos.
- Borrador inactivo: 60 minutos. Espera humana: 15 minutos. Pendiente: aviso a los 10 minutos, sin rechazo automático.
- Panel muestra tres días de historial, más todos los activos. Retención de registros terminados: 90 días; pedidos activos y atención humana conservan contexto hasta cerrarse. Después quedan estadísticas diarias sin identificadores personales.
- Envío externo incierto no se reintenta automáticamente: podría duplicarse. Revisar en **Mensajes enviados**. Errores claramente reintentables tienen intentos limitados.
- Texto y controles de WhatsApp; sin transcripción de audios ni interpretación de imágenes en este MVP.

[Tablero](https://github.com/users/304bxnjvv/projects/1) · [Contexto transversal](docs/user-stories/HU-03-contexto-transversal-del-proyecto.md) · [Carta aprobada](docs/technical/TEC-03-estructurar-carta-comida.md)
