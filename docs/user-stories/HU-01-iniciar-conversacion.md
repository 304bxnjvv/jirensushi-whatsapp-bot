# HU-01 — Iniciar conversación y elegir modalidad

**Área:** Backend  
**Componente:** WhatsApp bot  
**Tipo:** Historia de usuario

## Historia

Como cliente de Jiren Sushi,
quiero recibir una bienvenida y elegir cómo recibir mi pedido,
para comenzar sin repetir lo que ya escribí.

## Mensaje aprobado

```text
¡Hola! 👋 Bienvenido a Jiren Sushi 🍣
¿Quieres hacer tu pedido con retiro en local o despacho a domicilio?
```

Opciones interactivas:

- Retiro en local
- Despacho a domicilio

## Reglas

1. Ante primer mensaje del cliente, bot siempre envía bienvenida.
2. Bot conserva e interpreta mensaje original; cliente no debe repetirlo.
3. Modalidad puede elegirse mediante botón o texto libre.
4. Bot reconoce términos equivalentes, incluyendo retiro, recoger, delivery, despacho y envío.
5. Si detecta modalidad en mensaje original, saluda y continúa directamente por ruta correspondiente.
6. Si mensaje contiene una consulta que bot sabe responder, responde brevemente y vuelve a pedir modalidad.
7. Si no entiende modalidad, informa exactamente qué respuestas acepta.

## Mensaje de modalidad no identificada

```text
No logré identificar cómo quieres recibir tu pedido.

Puedes responder:
• Retiro en local
• Despacho a domicilio
```

## Casos de uso

### Caso 1 — Inicio sin modalidad

**Dado** que cliente inicia conversación con “Hola”  
**Cuando** bot recibe mensaje  
**Entonces** envía bienvenida y muestra ambas opciones.

### Caso 2 — Retiro escrito directamente

**Dado** que cliente inicia con “Quiero retirar un pedido”  
**Cuando** bot interpreta mensaje original  
**Entonces** envía bienvenida, identifica retiro y deriva al flujo de retiro sin pedir repetición.

### Caso 3 — Despacho con sinónimo

**Dado** que cliente inicia con “Necesito delivery”  
**Cuando** bot interpreta mensaje original  
**Entonces** envía bienvenida, identifica despacho y deriva al flujo de despacho.

### Caso 4 — Selección mediante botón

**Dado** que bot mostró opciones  
**Cuando** cliente pulsa una modalidad  
**Entonces** registra selección y deriva al flujo correspondiente.

### Caso 5 — Consulta conocida sin modalidad

**Dado** que cliente inicia con una consulta que bot sabe responder  
**Cuando** bot procesa mensaje  
**Entonces** envía bienvenida, responde consulta y vuelve a mostrar opciones de modalidad.

### Caso 6 — Modalidad no entendida

**Dado** que bot no puede identificar modalidad  
**Cuando** necesita continuar pedido  
**Entonces** muestra mensaje de modalidad no identificada con términos aceptados.

## Criterios de aceptación

- Bienvenida aparece al iniciar conversación.
- Mensaje inicial nunca se descarta.
- Botones y texto libre producen mismo resultado.
- Modalidad válida genera una sola derivación.
- Modalidad ambigua no se inventa.
- Cliente recibe instrucciones claras cuando bot no entiende.

## Fuera de alcance

- Elegir sucursal.
- Validar horarios.
- Mostrar carta.
- Armar carrito.
- Calcular despacho.
- Confirmar pedido.
- Implementar respuestas concretas de preguntas frecuentes.
