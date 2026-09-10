# Panel API

Same-origin JSON, cookie authentication; all mutations require Content-Type: application/json and same-origin Origin (browser supplies it). Error response {error:string}. Success below.
- POST /api/login {username,password} => {user}; GET /api/me => {user, environment, capabilities:{whatsapp:boolean,openai:boolean,simulator:boolean}}
- POST /api/logout {} => {ok:true}
- GET /api/orders?status=Pendiente&q=... => {orders:Order[], counts:{Pendiente:number,Aceptado:number,Rechazado:number,Entregado:number}}
- GET /api/orders/:id => {order, audit:Audit[]}
- POST /api/orders/:id/status {version:number,status:'Aceptado'|'Rechazado'|'Entregado',estimateMinutes?:number,estimatedTime?:string,reason?:'ingredients'|'closed',missing?:[{productId,ingredient}],comment?:string} => {order}
- GET /api/settings => {settings:Settings}; PUT /api/settings {settings:Settings} => {settings}
- GET /api/chats => {chats:Conversation[]}; GET /api/chats/:phone => {conversation,messages:Message[],orders:Order[]}
- POST /api/chats/:phone/take {version:number} => {conversation}
- POST /api/chats/:phone/release {version:number,summary:string} => {conversation}. Human provides summary of agreement, bot includes full recent transcript for interpretation and asks customer confirmation.
- POST /api/chats/:phone/messages {version:number,text:string} => {conversation}
- GET /api/audit => {audit:Audit[]} CEO only.
- GET /api/outbox => {messages:[{id,phone,text,state,error,createdAt}]} operational failed deliveries.
- POST /api/outbox/:id/retry {} retries blocked/failed delivery; ambiguous sends require manual review.
- GET /api/catalog => catalog JSON (authenticated).
- POST /api/dev/message {phone,text,id?:string,now?:ISO} => {conversation,replies:Reply[],order?:Order}; only local APP_ENV=development. Deterministic clock accepted for simulator/test scheduling.
- POST /api/dev/tick {now?:ISO} => {ok:true}; local only.

Types in src/types.ts. Choice IDs must be submitted verbatim; free text also works. All dates ISO; display America/Santiago. Money CLP integers. Every order is one branch; no branch picker except CEO entry card. Production starts with zero users; provisioning script creates password hashes locally for database import. Local demo defaults user local / Local-demo-2026! and ceo / CEO-demo-2026!, only initialized by development runner.
