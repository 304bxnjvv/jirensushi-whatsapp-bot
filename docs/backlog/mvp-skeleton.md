# Esqueleto de historias — MVP

Este archivo define únicamente el mapa de trabajo. Las historias marcadas como `Por definir` no están listas para desarrollo hasta documentar reglas y criterios de aceptación.

## Ya documentadas

| ID | Nombre | Área | Estado |
|---|---|---|---|
| HU-01 | Iniciar conversación y elegir modalidad | Backend · WhatsApp | Documentada |
| HU-02 | Seleccionar sucursal para retiro | Backend · WhatsApp | Documentada |
| HU-03 | Documentar contexto transversal del proyecto | Transversal | Documentada |

## Base técnica

| ID | Nombre | Área | Estado |
|---|---|---|---|
| TEC-01 | Preparar integración con WhatsApp Cloud API | Backend · WhatsApp | Por definir |
| TEC-02 | Guardar estado de la conversación | Backend | Por definir |
| TEC-03 | Estructurar y cargar la carta de comida | Backend | Por definir |

## Carta y armado del pedido

| ID | Nombre | Área | Estado |
|---|---|---|---|
| HU-04 | Navegar la carta por categorías | Backend · WhatsApp | Por definir |
| HU-05 | Consultar producto, precio e ingredientes | Backend · WhatsApp | Por definir |
| HU-06 | Elegir cantidad y personalizar producto | Backend · WhatsApp | Por definir |
| HU-07 | Revisar y modificar el carrito | Backend · WhatsApp | Por definir |
| HU-08 | Elegir pedido lo antes posible o programado | Backend · WhatsApp | Por definir |
| HU-09 | Registrar datos necesarios del cliente | Backend · WhatsApp | Por definir |

## Despacho

| ID | Nombre | Área | Estado |
|---|---|---|---|
| HU-10 | Validar dirección de despacho | Backend · WhatsApp | Por definir |
| HU-11 | Asignar sucursal por ruta vehicular | Backend | Por definir |
| HU-12 | Calcular costo de despacho por zona | Backend | Por definir |

## Confirmación y panel mínimo

| ID | Nombre | Área | Estado |
|---|---|---|---|
| HU-13 | Revisar y solicitar confirmación del pedido | Backend · WhatsApp | Por definir |
| HU-14 | Acceder al panel de una sucursal | Frontend · Backend | Por definir |
| HU-15 | Ver pedidos pendientes de mi sucursal | Frontend · Backend | Por definir |
| HU-16 | Aceptar o rechazar un pedido | Frontend · Backend | Por definir |
| HU-17 | Informar el resultado al cliente | Backend · WhatsApp | Por definir |
| HU-18 | Modificar y reenviar un pedido rechazado | Backend · WhatsApp | Por definir |

## Límite del MVP

- Incluye chatbot de WhatsApp que recibe y confirma pedidos completos.
- Incluye panel mínimo por sucursal para ver pedidos propios y aceptar o rechazar.
- Incluye solamente carta de comida; tragos quedan fuera hasta recibir fuente oficial.
- No incluye página pública, dashboard operativo avanzado ni coordinación automática de repartidores.
