# Panel de trabajo Jiren

The first screen is the live order queue for Viña, with a compact ticket list and the selected order next to it. The CEO enters through one branch card. The panel should feel like a readable kitchen pass: order number, elapsed time, food, and the next decision are the visual priorities.

## Tokens

- Ink `#253440`, paper `#ffffff`, work surface `#f2f5f7`, line `#dbe2e7`, brand salmon `#ed744b`, accessible action orange `#a63817`.
- Aptos / Segoe UI / system sans. Strong 28px page titles; 18px order identifiers; 14–16px operational content. Numbers use tabular figures, not a second decorative font.
- Left alignment, 236px navigation, flexible list and 420px detail pane; mobile becomes a queue with a full-width detail view. No dashboard chart filler. Ticket rows are separated by lines; status color is always paired with text.

```text
Jiren Sushi       Viña del Mar                         connection / user
Pedidos       | Pendientes  Aceptados  Rechazados  Entregados
Conversaciones| search                    | order #, customer, elapsed
Local y zonas | ticket                    | items + exact modifications
Envíos        | ticket                    | allergy / payment / delivery
Simulador     | ticket                    | accept / reject / deliver
```

Reviewed against the brief: removed generic analytics tiles and marketing copy. The single distinctive treatment is a compact salmon brand rail and a ticket edge on the selected order; the rest is a quiet light workspace. Waiting human chats and failed outbound messages have concrete action labels. Polling updates queues/history without replacing open forms or typed replies. Native dialogs provide confirmation; stale versions produce a visible conflict and refresh the affected record. No customer-controlled HTML is inserted.

Verification targets: login and role entry, meaningful order actions and concurrency failures, preserved chat draft under polling, exact simulator choice IDs, human release summary, mobile overflow, and local-only credential/simulator visibility.
