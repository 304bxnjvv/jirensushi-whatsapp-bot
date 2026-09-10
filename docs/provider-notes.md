# Integraciones de WhatsApp y OpenAI

Los adaptadores usan HTTPS mediante `fetch`, sin SDK y sin llamadas reales en las pruebas. Exportaciones públicas: `verifySignature`, `parseWebhook`, `sendWhatsApp`, `interpretIntent` y `ProviderError`, desde `src/providers/index.ts`.

## WhatsApp Cloud API

Se necesitan `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_APP_SECRET` y `META_VERIFY_TOKEN`. La versión se configura en `META_GRAPH_VERSION`; el valor predeterminado del proyecto es `v23.0`. El token viaja únicamente en `Authorization`, nunca en la URL. El identificador devuelto confirma aceptación por la API, no entrega al teléfono. La colección oficial muestra el endpoint `/messages` y la respuesta `messages[0].id`. [Colección oficial de Meta](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api).

`verifySignature` valida HMAC SHA-256 sobre el cuerpo UTF-8 original con Web Crypto. La ruta debe comprobar `X-Hub-Signature-256` antes de interpretar JSON. También debe restringir `value.metadata.phone_number_id` al número configurado antes de pasar el evento al analizador: la firma identifica la aplicación, y una aplicación puede recibir eventos de varios números. [Ejemplo oficial de firmas](https://github.com/fbsamples/whatsapp-api-examples/blob/main/signature-validation-with-webhooks-payloads/app.py).

`parseWebhook` recorre todos los elementos y mensajes de un lote. Conserva IDs de botones/listas y coordenadas válidas; convierte el timestamp Unix a ISO. Omite estructuras inválidas y actualizaciones de estado sin mensajes. Audio, imágenes y formatos no compatibles generan un texto que permite pedir al cliente una consulta escrita; no se descargan ni transcriben. El servicio debe conservar la hora original del mensaje como `lastCustomerAt`, sin adelantarla al procesar una cola atrasada. El MVP trabaja con números telefónicos; no incorpora identificadores de usuarios que oculten su número.

Cada llamada de envío corresponde a una fila de salida y realiza un solo intento. El servicio debe dividir textos mayores de 4.096 caracteres en filas independientes. Los mensajes interactivos admiten texto de hasta 1.024 caracteres y 10 opciones. Con hasta tres opciones se usan botones; con cuatro a diez, una lista. Se recortan solamente etiquetas visibles: títulos de botones a 20 caracteres; títulos y descripciones de listas a 24 y 72. Los IDs permanecen intactos. Duplicar IDs o exceder límites causa un error previo al envío. [Botones y listas oficiales](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/interactive/), [límites de filas oficiales](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/types/RowObject/). La documentación del SDK de Meta está archivada y se usa como referencia del formato; el SDK no se instala.

### Notificaciones fuera de la ventana de atención

La implementación utiliza mensajes libres solamente cuando la última intervención del cliente ocurrió hace menos de 24 horas. Una fecha inválida o futura tampoco habilita mensajes libres. Fuera de esa ventana se exige `META_STATUS_TEMPLATE`: nombre de una plantilla de utilidad ya aprobada, en español con código `es`, y exactamente un parámetro de texto en el cuerpo. El nombre por sí solo no crea ni aprueba la plantilla. [Formato oficial de plantillas](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/).

Un texto de plantilla que se puede presentar a aprobación es `Actualización de tu pedido en Jiren Sushi: {{1}}`. Debe existir exactamente esa estructura de parámetro en la plantilla aprobada. La aprobación y clasificación final corresponden a Meta y quedan pendientes de la configuración real de la cuenta.

Las opciones se convierten en instrucciones dentro del parámetro: por ejemplo, `Responde: Reabrir pedido`. El dominio debe reconocer esas etiquetas en texto. Se normalizan saltos de línea y espacios en el parámetro. Se rechaza un contenido final superior a 1.024 caracteres para evitar perder información. Sin plantilla se genera `template_required`, que debe mostrarse como envío bloqueado en la operación; no se descarta el mensaje ni se sustituye por texto libre.

### Errores y reintentos

`ProviderError` expone `provider`, `code`, `retryable` y `uncertain`, sin mensajes crudos del proveedor, teléfono, contenido ni tokens. Una respuesta explícita transitoria de Meta (`error.is_transient`), HTTP 429 o un error de servidor identificado permiten que la cola programe intentos limitados. Errores de configuración o validación requieren corrección.

El límite de una petición es 12 segundos, incluido leer el cuerpo. En WhatsApp un fallo de conexión, timeout, HTTP 408, error ambiguo de gateway o éxito sin un ID `wamid.` válido queda `uncertain: true`, `retryable: false`: el proveedor podría haber aceptado el envío. La cola debe mostrarlo para conciliación y no reenviarlo automáticamente. No existe una garantía de envío externo exactamente una vez. Un ID confirmado debe guardarse antes de considerar completado el trabajo.

## Interpretación opcional con OpenAI

Sin `OPENAI_API_KEY` el adaptador devuelve `null` sin llamar a la red. Con clave se usa Responses API, `store: false`, salida estructurada estricta, 1.200 tokens de salida máximos y el modelo `OPENAI_MODEL` (predeterminado `gpt-4.1-mini`). No se proporcionan herramientas al modelo. [Salidas estructuradas oficiales](https://developers.openai.com/api/docs/guides/structured-outputs), [modelo configurado](https://developers.openai.com/api/docs/models/gpt-4.1-mini).

El servicio incorpora diccionarios confiables, derivados del catálogo, en `conversation.data`: `allowedProducts` y `allowedCategories` como listas `{id,name}`, y `allowedIngredients` como lista de textos. No se obtienen del mensaje del cliente. El contexto enviado contiene hasta 150 productos, 30 categorías, 150 ingredientes y los últimos 12 mensajes de cliente/bot/humano, de hasta 1.000 caracteres cada uno. El mensaje actual se limita a 4.000 caracteres. No se serializa el objeto de conversación completo ni sus metadatos privados.

Acciones admitidas: `product`, `category`, `quantity`, `modifications`, `allergy`, `human`, `mode`, `unknown`. Cada respuesta se valida de nuevo localmente. Los IDs e ingredientes deben pertenecer a los diccionarios. La cantidad debe ser un entero positivo representable con precisión; HU-06 no fija un máximo comercial. `text` solo admite los modos `retiro`/`despacho` o una categoría del catálogo; nunca se usa para responder libremente al cliente. Precios, estados de aceptación, instrucciones de ejecución y campos adicionales quedan fuera del esquema. El adaptador devuelve precio provisional cero para las modificaciones validadas, y el dominio debe recalcularlo siempre.

Respuestas ambiguas, rechazadas, incompletas, mal formadas o fuera del dominio devuelven `null`. Un error HTTP/transportado devuelve un error seguro para que el servicio aplique su continuación determinista. Las pruebas verifican la lógica y los formatos con un transporte HTTP controlado; no acreditan disponibilidad de credenciales, aprobación de plantillas ni comportamiento real del modelo en la cuenta del comercio.
