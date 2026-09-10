const $ = (s) => document.querySelector(s);
const state = {
  user: null,
  page: "orders",
  status: "Pendiente",
  q: "",
  orders: [],
  counts: {},
  chats: [],
  selected: null,
  chat: null,
  settings: null,
  capabilities: {},
  simMessages: [],
  simPhone: "56912345678",
  simNow: "",
  seen: new Set(),
  notified: false,
  pendingLoaded: false,
  fresh: new Set(),
};
const money = (n) => "$" + Number(n ?? 0).toLocaleString("es-CL");
const date = (s) =>
  s
    ? new Date(s).toLocaleString("es-CL", {
        timeZone: "America/Santiago",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "class") n.className = v;
    else if (k === "value") n.value = v;
    else if (k === "checked") n.checked = v;
    else if (v !== false && v !== undefined && v !== null)
      n.setAttribute(k, v === true ? "" : String(v));
  }
  for (const child of children.flat(Infinity))
    if (child !== null && child !== undefined && child !== false)
      n.append(child instanceof Node ? child : String(child));
  return n;
}
const button = (text, fn, cls = "", attrs = {}) =>
  el(
    "button",
    {
      type: "button",
      class: cls,
      onclick: () => Promise.resolve(fn()).catch(showError),
      ...attrs,
    },
    text,
  );
const field = (label, input, hint) =>
  el(
    "label",
    { class: "field" },
    el("span", {}, label),
    input,
    hint && el("small", {}, hint),
  );
const input = (name, value = "", type = "text", attrs = {}) =>
  el("input", { name, type, value, ...attrs });
const status = (s) => el("span", { class: "status " + s.toLowerCase() }, s);
const empty = (title, text) =>
  el("div", { class: "empty" }, el("h2", {}, title), el("p", {}, text));
function toast(message, error = false) {
  const n = $("#toast");
  n.textContent = message;
  n.hidden = false;
  n.classList.toggle("error", error);
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (n.hidden = true), 5000);
}
function showError(e) {
  toast(e.message ?? String(e), true);
}
async function api(path, options = {}) {
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error("Respuesta inesperada del servidor.");
  }
  if (!response.ok) {
    if (response.status === 401 && state.user) {
      state.user = null;
      renderLogin();
    }
    throw Error(data.error ?? "No se pudo completar la acción.");
  }
  return data;
}
const post = (path, body = {}) => api(path, { method: "POST", body });
function brand() {
  return el(
    "div",
    { class: "brand" },
    el("span", { class: "brand-mark", "aria-hidden": "true" }, "J"),
    el(
      "div",
      { class: "brand-name" },
      "Jiren Sushi",
      el("small", {}, "Viña del Mar"),
    ),
  );
}
function renderLogin() {
  const username = input("username", "", "text", {
    autocomplete: "username",
    required: true,
  });
  const password = input("password", "", "password", {
    autocomplete: "current-password",
    required: true,
  });
  const form = el(
    "form",
    {
      onsubmit: async (e) => {
        e.preventDefault();
        const submit = form.querySelector("button[type=submit]");
        submit.disabled = true;
        try {
          const r = await post("/login", {
            username: username.value,
            password: password.value,
          });
          state.user = r.user;
          Object.assign(state.capabilities, r.capabilities);
          state.page = r.user.role === "ceo" ? "branch" : "orders";
          await render();
        } catch (e) {
          showError(e);
        } finally {
          submit.disabled = false;
        }
      },
    },
    el("h2", {}, "Entrar al local"),
    el(
      "p",
      { class: "muted" },
      "Gestiona los pedidos y la atención por WhatsApp.",
    ),
    field("Usuario", username),
    field("Contraseña", password),
    el("button", { class: "primary", type: "submit" }, "Iniciar sesión"),
  );
  if (state.capabilities.simulator)
    form.append(
      el(
        "details",
        { class: "dev-accounts" },
        el("summary", {}, "Cuentas del entorno local"),
        el("p", {}, "Local: local / Local-demo-2026!"),
        el("p", {}, "CEO: ceo / CEO-demo-2026!"),
        el("p", {}, "Solo simulación. No envía mensajes reales."),
      ),
    );
  $("#app").replaceChildren(
    el(
      "main",
      { class: "login", id: "main" },
      el(
        "section",
        { class: "login-brand" },
        brand(),
        el(
          "div",
          { class: "login-intro" },
          el("h1", {}, "Cada pedido, en su punto."),
          el(
            "p",
            {},
            "La carta, la cocina y el cliente en una misma conversación.",
          ),
        ),
        el("p", { class: "login-footer" }, "Panel de operación del local"),
      ),
      el("section", { class: "login-form-area" }, form),
    ),
  );
}
function shell() {
  const nav = [
    ["orders", "Pedidos"],
    ["chats", "Conversaciones"],
    ["outbox", "Mensajes enviados"],
    ["settings", "Configuración"],
  ];
  if (state.user.role === "ceo") nav.push(["audit", "Auditoría"]);
  if (state.capabilities.simulator) nav.push(["sim", "Simulador"]);
  const sidebar = el(
    "nav",
    { class: "sidebar", "aria-label": "Panel" },
    ...(state.user.role === "ceo"
      ? [
          button("Mi sucursal", () => go("branch"), "", {
            "aria-current": state.page === "branch" ? "page" : undefined,
          }),
        ]
      : []),
    ...nav.map(([id, label]) =>
      button(label, () => go(id), "", {
        "aria-current": state.page === id ? "page" : undefined,
      }),
    ),
    el(
      "div",
      { class: "nav-footer" },
      button("Activar avisos", async () => {
        if ("Notification" in window) {
          const permission = await Notification.requestPermission();
          toast(
            permission === "granted"
              ? "Avisos activados."
              : "No se habilitaron notificaciones.",
          );
        }
        state.notified = true;
      }),
      button("Cerrar sesión", async () => {
        await post("/logout");
        state.user = null;
        renderLogin();
      }),
    ),
  );
  $("#app").replaceChildren(
    el(
      "header",
      { class: "topbar" },
      brand(),
      el(
        "div",
        { class: "topbar-meta" },
        el(
          "span",
          { class: "connection", id: "connection" },
          state.capabilities.simulator ? "Entorno de prueba" : "Conectado",
        ),
        el(
          "span",
          { class: "username" },
          state.user.username + " (" + state.user.role + ")",
        ),
      ),
    ),
    el(
      "div",
      { class: "shell" },
      sidebar,
      el("main", { id: "main", class: "main" }),
    ),
  );
}
async function go(page) {
  state.page = page;
  state.selected = null;
  state.chat = null;
  await render();
}
function heading(title, description) {
  return el(
    "div",
    { class: "page-heading" },
    el("div", {}, el("h1", {}, title), el("p", {}, description)),
  );
}
async function render() {
  shell();
  const main = $("#main");
  try {
    if (state.page === "orders") await renderOrders(main);
    if (state.page === "branch") {
      const r = await api("/orders");
      state.counts = r.counts;
      main.append(
        heading("Tu sucursal", "Supervisa pedidos y conversaciones."),
        el(
          "section",
          { class: "branch-card" },
          el("h2", {}, "Sucursal Viña del Mar"),
          el("p", { class: "muted" }, "5 Norte 615, Viña del Mar"),
          el(
            "div",
            { class: "branch-counts" },
            Object.entries(r.counts).map(([k, v]) =>
              el("div", {}, el("strong", {}, v), el("span", {}, k)),
            ),
          ),
          button("Entrar a la sucursal", () => go("orders"), "primary"),
        ),
      );
    }
    if (state.page === "chats") await renderChats(main);
    if (state.page === "settings") await renderSettings(main);
    if (state.page === "sim") renderSim(main);
    if (state.page === "audit") {
      const r = await api("/audit");
      main.append(
        heading("Auditoría", "Registro de acciones y cambios del local."),
        auditTable(r.audit),
      );
    }
    if (state.page === "outbox") await renderOutbox(main);
  } catch (e) {
    main.append(
      empty("No pudimos cargar esta vista", e.message),
      button("Volver a intentar", render),
    );
  }
}
async function observePending(data) {
  const pending = data ?? (await api("/orders?status=Pendiente"));
  state.counts = pending.counts;
  for (const o of pending.orders) {
    if (state.pendingLoaded && !state.seen.has(o.id)) {
      state.fresh.add(o.id);
      toast("Nuevo pedido " + o.number);
      if (state.notified) {
        try {
          const audio = new AudioContext(),
            oscillator = audio.createOscillator(),
            gain = audio.createGain();
          gain.gain.value = 0.12;
          oscillator.connect(gain);
          gain.connect(audio.destination);
          oscillator.start();
          oscillator.stop(audio.currentTime + 0.15);
          oscillator.onended = () => audio.close();
        } catch {}
      }
      if (
        document.hidden &&
        "Notification" in window &&
        Notification.permission === "granted"
      )
        new Notification("Nuevo pedido " + o.number, { body: o.customerName });
    }
    state.seen.add(o.id);
  }
  state.pendingLoaded = true;
  document
    .querySelectorAll("[role=tab] .badge")
    .forEach(
      (badge, index) =>
        (badge.textContent =
          state.counts[
            ["Pendiente", "Aceptado", "Rechazado", "Entregado"][index]
          ] ?? 0),
    );
}
async function fetchOrders() {
  const data = await api(
    "/orders?status=" + state.status + "&q=" + encodeURIComponent(state.q),
  );
  state.orders = data.orders;
  state.counts = data.counts;
  await observePending(state.status === "Pendiente" && !state.q ? data : null);
}
async function renderOrders(main) {
  await fetchOrders();
  main.append(
    heading(
      "Pedidos del local",
      "Revisa, acepta y entrega. Los pedidos activos se atienden por orden de llegada.",
    ),
  );
  const tabs = el(
    "div",
    { class: "tabs", role: "tablist", "aria-label": "Estado del pedido" },
    ["Pendiente", "Aceptado", "Rechazado", "Entregado"].map((s) =>
      button(
        [s, el("span", { class: "badge" }, state.counts[s] ?? 0)],
        async () => {
          state.status = s;
          state.selected = null;
          await render();
        },
        "",
        { role: "tab", "aria-selected": state.status === s },
      ),
    ),
  );
  main.append(tabs);
  const search = input("search", state.q, "search", {
    placeholder: "Número, nombre o teléfono",
    "aria-label": "Buscar pedido",
  });
  let timeout;
  search.addEventListener("input", () => {
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      state.q = search.value;
      await fetchOrders();
      paintQueue();
    }, 250);
  });
  main.append(
    el("div", { class: "search" }, search),
    el(
      "div",
      { class: "workspace", id: "workspace" },
      el("section", { class: "queue", id: "queue" }),
      el(
        "aside",
        { class: "detail", id: "detail" },
        empty(
          "Selecciona un pedido",
          "Verás aquí el detalle y las acciones disponibles.",
        ),
      ),
    ),
  );
  paintQueue();
}
function paintQueue() {
  const q = $("#queue");
  if (!q || state.page !== "orders") return;
  q.replaceChildren(
    el(
      "div",
      { class: "queue-label" },
      ["Pendiente", "Aceptado"].includes(state.status)
        ? "Más antiguos primero"
        : "Más recientes primero",
      el("span", {}, state.orders.length + " pedidos"),
    ),
  );
  for (const o of state.orders)
    q.append(
      button(
        [
          el(
            "div",
            { class: "ticket-line" },
            el("span", { class: "ticket-number" }, o.number),
            status(o.status),
          ),
          el(
            "div",
            { class: "ticket-line" },
            el("span", { class: "ticket-customer" }, o.customerName),
            el("span", { class: "price" }, money(o.total)),
          ),
          el(
            "div",
            { class: "ticket-meta" },
            date(o.createdAt) +
              " · " +
              (o.mode === "retiro" ? "Retiro" : "Despacho"),
          ),
          el(
            "div",
            { class: "ticket-products" },
            o.items.map((i) => i.name).join(", "),
          ),
          o.delayNotified &&
            el("small", {}, "Pendiente hace más de 10 minutos"),
        ],
        () => openOrder(o.id),
        "ticket" +
          (state.selected === o.id ? " active" : "") +
          (state.fresh.has(o.id) ? " fresh" : ""),
      ),
    );
  if (!state.orders.length)
    q.append(
      empty(
        "Sin pedidos en esta lista",
        "Los pedidos nuevos aparecerán automáticamente.",
      ),
    );
}
async function openOrder(id) {
  const { order: o, audit } = await api("/orders/" + id);
  state.selected = id;
  state.fresh.delete(id);
  $("#workspace").classList.add("detail-open");
  paintQueue();
  const d = $("#detail");
  const items = o.items.map((i) =>
    el(
      "div",
      { class: "detail-item" },
      el(
        "div",
        { class: "ticket-line" },
        el("strong", {}, i.name),
        el("span", { class: "price" }, money(i.subtotal)),
      ),
      Object.keys(i.options).length > 0 &&
        el(
          "p",
          {},
          Object.entries(i.options)
            .map(([k, v]) => k + ": " + v)
            .join("; "),
        ),
      i.modifications.map((m) =>
        el(
          "p",
          {},
          (m.action === "remove"
            ? "Quitar "
            : m.action === "replace"
              ? "Cambiar " + m.from + " por "
              : "Agregar ") +
            m.ingredient +
            " (" +
            money(m.price) +
            ")",
        ),
      ),
    ),
  );
  const timing =
    o.schedule?.kind === "scheduled"
      ? date(o.schedule.time)
      : (o.schedule?.time ??
        (o.schedule?.estimateMinutes ?? 30) + " minutos aprox.");
  const facts = el(
    "dl",
    { class: "facts" },
    el("dt", {}, "Cliente"),
    el("dd", {}, o.customerName),
    el("dt", {}, "WhatsApp"),
    el("dd", {}, o.phone),
    el("dt", {}, "Modalidad"),
    el("dd", {}, o.mode),
    el("dt", {}, "Horario"),
    el("dd", {}, timing),
    el("dt", {}, "Pago"),
    el("dd", {}, o.payment),
  );
  if (o.mode === "despacho")
    facts.append(
      el("dt", {}, "Dirección"),
      el(
        "dd",
        {},
        o.address,
        el("br"),
        el(
          "a",
          {
            href:
              "https://www.google.com/maps/search/?api=1&query=" +
              encodeURIComponent(o.address ?? ""),
            target: "_blank",
            rel: "noopener",
          },
          "Abrir dirección",
        ),
      ),
      el("dt", {}, "Zona"),
      el("dd", {}, o.zoneId),
      o.reference ? el("dt", {}, "Referencia") : document.createTextNode(""),
      o.reference ? el("dd", {}, o.reference) : document.createTextNode(""),
    );
  const actions = el("div", { class: "detail-actions" });
  if (!o.locked && o.status !== "Entregado") {
    if (o.status !== "Aceptado")
      actions.append(
        button("Aceptar pedido", () => acceptDialog(o), "primary"),
      );
    if (o.status !== "Rechazado")
      actions.append(
        button("Rechazar pedido", () => rejectDialog(o), "danger"),
      );
    if (o.status === "Aceptado")
      actions.append(
        button(
          "Marcar entregado",
          () =>
            confirmDialog(
              "Confirmar entrega",
              "Este cambio no se puede revertir.",
              "Confirmar entrega",
              () => changeOrder(o, { status: "Entregado" }),
            ),
          "primary",
        ),
      );
  }
  d.replaceChildren(
    el(
      "div",
      { class: "detail-top" },
      button(
        "Volver a pedidos",
        () => $("#workspace").classList.remove("detail-open"),
        "back-mobile small",
      ),
      status(o.status),
      el("h2", {}, o.number),
      el("p", { class: "muted" }, date(o.createdAt)),
    ),
    el(
      "div",
      { class: "detail-section" },
      facts,
      o.allergy &&
        el("div", { class: "allergy" }, "Alergia informada: " + o.allergy),
      o.humanNotes?.length > 0 &&
        el(
          "section",
          { class: "notice" },
          el("h3", {}, "Acuerdos con el equipo"),
          o.humanNotes.map((note) => el("p", {}, note)),
        ),
    ),
    el(
      "div",
      { class: "detail-section" },
      el("h3", {}, "Detalle del pedido"),
      items,
      el(
        "div",
        { class: "ticket-line" },
        el("span", {}, "Despacho"),
        el("span", {}, money(o.deliveryFee)),
      ),
      el(
        "div",
        { class: "total" },
        el("span", {}, "Total"),
        el("span", {}, money(o.total)),
      ),
    ),
    el(
      "div",
      { class: "detail-section" },
      o.locked &&
        el("p", {}, "Original bloqueado: el cliente reabrió este pedido."),
      o.reason &&
        el(
          "p",
          {},
          "Motivo: " +
            (o.reason === "closed" ? "Local cerrado" : "Falta de ingredientes"),
        ),
      o.missing?.map((m) =>
        el(
          "p",
          {},
          (o.items.find((i) => i.productId === m.productId)?.name ??
            m.productId) +
            ": falta " +
            m.ingredient,
        ),
      ),
      o.comment && el("p", {}, "Comentario interno: " + o.comment),
      actions,
    ),
    el(
      "div",
      { class: "detail-section" },
      el("h3", {}, "Historial"),
      audit.map((a) =>
        el(
          "div",
          { class: "audit-detail" },
          a.actor + " · " + date(a.createdAt),
          el("p", {}, a.action),
          el("p", {}, a.detail),
        ),
      ),
    ),
  );
}
function dialog(title, content, submitLabel, onSubmit) {
  const error = el("div", { class: "inline-error", role: "alert" });
  const form = el(
    "form",
    {
      onsubmit: async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type=submit]");
        btn.disabled = true;
        try {
          await onSubmit(new FormData(form));
          d.close();
          d.remove();
        } catch (e) {
          error.textContent = e.message;
        } finally {
          btn.disabled = false;
        }
      },
    },
    el("div", { class: "dialog-body" }, el("h2", {}, title), content, error),
    el(
      "div",
      { class: "dialog-actions" },
      button("Volver", () => {
        d.close();
        d.remove();
      }),
      el("button", { type: "submit", class: "primary" }, submitLabel),
    ),
  );
  const d = el("dialog", {}, form);
  d.addEventListener("close", () => d.remove());
  document.body.append(d);
  d.showModal();
  return d;
}
const confirmDialog = (title, text, label, fn) =>
  dialog(title, el("p", {}, text), label, fn);
async function changeOrder(o, changes) {
  await post("/orders/" + o.id + "/status", { version: o.version, ...changes });
  toast("Pedido actualizado.");
  state.status = changes.status;
  state.selected = null;
  await render();
}
function acceptDialog(o) {
  const content = el(
    "div",
    {},
    el("p", {}, "El cliente recibirá la confirmación por WhatsApp."),
  );
  if (o.schedule?.kind === "asap")
    content.append(
      field(
        "Minutos de preparación",
        input("minutes", o.schedule.estimateMinutes ?? 30, "number", {
          min: 1,
          max: 480,
          required: true,
        }),
      ),
      field(
        "O una hora exacta",
        input("time", "", "time"),
        "Si completas la hora, reemplaza la estimación en minutos.",
      ),
    );
  return dialog(
    "Aceptar " + o.number,
    content,
    "Confirmar aceptación",
    (data) =>
      changeOrder(o, {
        status: "Aceptado",
        estimateMinutes: Number(data.get("minutes") ?? 30),
        ...(data.get("time") ? { estimatedTime: data.get("time") } : {}),
      }),
  );
}
function rejectDialog(o) {
  const reason = el(
    "select",
    { name: "reason" },
    el("option", { value: "ingredients" }, "Falta de ingredientes"),
    el("option", { value: "closed" }, "Local cerrado"),
  );
  const pairs = el("div");
  let seq = 0;
  function addPair() {
    const key = seq++;
    const select = el(
      "select",
      { name: "product-" + key },
      [...new Map(o.items.map((i) => [i.productId, i])).values()].map((i) =>
        el("option", { value: i.productId }, i.name),
      ),
    );
    const row = el(
      "div",
      { class: "missing-pair" },
      field("Producto afectado", select),
      field(
        "Ingrediente faltante",
        input("ingredient-" + key, "", "text", {
          required: true,
          maxlength: 200,
        }),
      ),
      button("Quitar este motivo", () => row.remove(), "small"),
    );
    pairs.append(row);
  }
  addPair();
  const container = el(
    "div",
    {},
    pairs,
    button("Agregar otro ingrediente", addPair, "small"),
  );
  reason.addEventListener("change", () => {
    container.hidden = reason.value === "closed";
    container
      .querySelectorAll("input")
      .forEach((i) => (i.required = reason.value === "ingredients"));
  });
  return dialog(
    "Rechazar " + o.number,
    el(
      "div",
      {},
      field("Motivo de rechazo", reason),
      container,
      field(
        "Comentario interno (opcional)",
        el("textarea", { name: "comment", maxlength: 1000 }),
        "No se enviará al cliente.",
      ),
    ),
    "Confirmar rechazo",
    (data) => {
      const missing = [];
      for (const [k, v] of data)
        if (k.startsWith("product-"))
          missing.push({
            productId: v,
            ingredient: data.get("ingredient-" + k.slice(8)),
          });
      return changeOrder(o, {
        status: "Rechazado",
        reason: data.get("reason"),
        missing: data.get("reason") === "ingredients" ? missing : [],
        comment: data.get("comment"),
      });
    },
  );
}
async function renderChats(main) {
  const r = await api("/chats");
  state.chats = r.chats;
  main.append(
    heading(
      "Conversaciones",
      "Toma un chat para pausar el bot y responder como Equipo Jiren.",
    ),
    el(
      "div",
      { class: "workspace chat-layout", id: "workspace" },
      el("section", { class: "queue", id: "chat-queue" }),
      el(
        "section",
        { class: "chat-pane", id: "chat-pane" },
        empty(
          "Selecciona una conversación",
          "Las solicitudes de atención más antiguas aparecen primero.",
        ),
      ),
    ),
  );
  paintChats();
}
function paintChats() {
  const q = $("#chat-queue");
  if (!q) return;
  q.replaceChildren(
    el("div", { class: "queue-label" }, "Requiere atención primero"),
  );
  for (const c of state.chats)
    q.append(
      button(
        [
          el(
            "div",
            { class: "ticket-line" },
            el("strong", {}, c.draft.customerName ?? c.phone),
            status(c.mode),
          ),
          el(
            "small",
            {},
            c.phone + " · " + date(c.waitingSince ?? c.updatedAt),
          ),
        ],
        () => openChat(c.phone),
        "ticket",
      ),
    );
  if (!state.chats.length)
    q.append(
      empty(
        "Todavía no hay chats",
        "Aparecerán cuando escriban al número o uses el simulador.",
      ),
    );
}
function messagesView(messages) {
  return messages.map((m) =>
    el(
      "div",
      { class: "message " + m.role },
      el(
        "div",
        { class: "message-author" },
        m.role === "customer"
          ? "Cliente"
          : m.role === "human"
            ? "Equipo Jiren"
            : "Bot Jiren",
      ),
      el("div", { class: "message-text" }, m.text),
      el(
        "div",
        { class: "message-time" },
        date(m.createdAt) + (m.delivery ? " · " + m.delivery : ""),
      ),
    ),
  );
}
async function openChat(phone) {
  const r = await api("/chats/" + phone);
  state.chat = r;
  $("#workspace").classList.add("detail-open");
  const pane = $("#chat-pane");
  const actions = el("div", { class: "toolbar" });
  if (r.conversation.mode !== "human")
    actions.append(
      button(
        "Tomar chat",
        async () => {
          await post("/chats/" + phone + "/take", {
            version: state.chat.conversation.version,
          });
          await openChat(phone);
        },
        "primary",
      ),
    );
  else
    actions.append(
      button("Devolver al bot", () =>
        dialog(
          "Devolver la conversación al bot",
          field(
            "Resumen del acuerdo",
            el("textarea", {
              name: "summary",
              required: true,
              maxlength: 2500,
            }),
            "Resume horario, productos y cambios acordados. El cliente deberá confirmarlo.",
          ),
          "Confirmar devolución",
          async (data) => {
            await post("/chats/" + phone + "/release", {
              version: state.chat.conversation.version,
              summary: data.get("summary"),
            });
            await openChat(phone);
          },
        ),
      ),
    );
  const head = el(
    "div",
    { class: "chat-head" },
    button(
      "Volver a conversaciones",
      () => $("#workspace").classList.remove("detail-open"),
      "back-mobile small",
    ),
    status(r.conversation.mode),
    el("h2", {}, phone),
    actions,
  );
  const history = el(
    "div",
    { class: "chat-history", id: "chat-history" },
    messagesView(r.messages),
  );
  const compose = el("div", { class: "chat-compose" });
  if (r.conversation.mode === "human") {
    const message = el("textarea", {
      name: "text",
      required: true,
      maxlength: 3500,
    });
    const form = el(
      "form",
      {
        onsubmit: async (e) => {
          e.preventDefault();
          try {
            await post("/chats/" + phone + "/messages", {
              version: state.chat.conversation.version,
              text: message.value,
            });
            message.value = "";
            await refreshChat();
          } catch (e) {
            showError(e);
          }
        },
      },
      field("Mensaje de Equipo Jiren", message),
      el("small", {}, "Bot pausado mientras atiendes este chat."),
      el("button", { class: "primary", type: "submit" }, "Enviar mensaje"),
    );
    compose.append(form);
  } else
    compose.append(
      el(
        "p",
        { class: "muted" },
        r.conversation.mode === "waiting"
          ? "El cliente espera atención. Puedes tomar el chat."
          : "El bot atiende esta conversación.",
      ),
    );
  pane.replaceChildren(head, history, compose);
  history.scrollTop = history.scrollHeight;
}
async function refreshChat() {
  if (!state.chat || !$("#chat-history")) return;
  const r = await api("/chats/" + state.chat.conversation.phone);
  if (r.conversation.mode !== state.chat.conversation.mode) {
    await openChat(r.conversation.phone);
    return;
  }
  const changed = r.messages.length !== state.chat.messages.length;
  state.chat = r;
  if (changed) {
    const history = $("#chat-history"),
      atBottom =
        history.scrollHeight - history.scrollTop - history.clientHeight < 60;
    history.replaceChildren(...messagesView(r.messages));
    if (atBottom) history.scrollTop = history.scrollHeight;
  }
}
async function renderSettings(main) {
  const { settings: s } = await api("/settings");
  state.settings = s;
  main.append(
    heading(
      "Configuración del local",
      "Horarios excepcionales y zonas de despacho.",
    ),
  );
  const closed = input("closed", "", "checkbox", { checked: s.manualClosed });
  const reopen = input(
    "reopen",
    s.reopenAt ? localDateInput(new Date(s.reopenAt)) : "",
    "datetime-local",
  );
  const zones = el(
    "div",
    {},
    s.zones.map((z, i) =>
      el(
        "div",
        { class: "zone-row" },
        field(
          "Nombre de zona",
          input("zone-name-" + i, z.name, "text", { required: true }),
        ),
        el(
          "div",
          { class: "field-row" },
          field(
            "Costo de despacho",
            input("zone-price-" + i, z.price, "number", {
              min: 0,
              max: 100000,
              required: true,
            }),
          ),
          field("Cobertura del sector", input("zone-desc-" + i, z.description)),
        ),
        el(
          "label",
          { class: "checkbox" },
          input("zone-enabled-" + i, "on", "checkbox", { checked: z.enabled }),
          "Zona habilitada",
        ),
      ),
    ),
  );
  const form = el(
    "form",
    {
      class: "form-panel",
      onsubmit: async (e) => {
        e.preventDefault();
        try {
          const f = new FormData(form);
          const settings = {
            ...s,
            address: f.get("address"),
            manualClosed: closed.checked,
            reopenAt:
              closed.checked && reopen.value
                ? new Date(reopen.value).toISOString()
                : null,
            asapMinutes: Number(f.get("asap")),
            zones: s.zones.map((z, i) => ({
              ...z,
              name: f.get("zone-name-" + i),
              price: Number(f.get("zone-price-" + i)),
              description: f.get("zone-desc-" + i),
              enabled: f.has("zone-enabled-" + i),
            })),
          };
          await api("/settings", { method: "PUT", body: { settings } });
          toast("Configuración guardada.");
        } catch (e) {
          showError(e);
        }
      },
    },
    el("h2", {}, "Sucursal Viña del Mar"),
    el("p", {}, "Lunes a sábado 11:00–23:30 · Domingo 12:00–20:00"),
    field(
      "Dirección del local",
      input("address", s.address, "text", { required: true }),
    ),
    el(
      "label",
      { class: "checkbox" },
      closed,
      "Cerrar excepcionalmente el local",
    ),
    field("Fecha y hora de reapertura", reopen),
    field(
      "Estimación inicial (minutos)",
      input("asap", s.asapMinutes, "number", { min: 1, max: 480 }),
    ),
    el("h2", { class: "spaced" }, "Zonas de despacho"),
    el(
      "p",
      { class: "notice" },
      "Verifica los límites con el local antes de operar. El bot guarda la dirección; no verifica cobertura mediante mapas.",
    ),
    zones,
    el("button", { class: "primary", type: "submit" }, "Guardar configuración"),
  );
  main.append(form);
}
function localDateInput(date) {
  return new Date(+date - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function renderSim(main) {
  main.append(
    heading(
      "Simulador del cliente",
      "Prueba el mismo flujo del bot. Los mensajes se quedan en este equipo.",
    ),
  );
  const phone = input("phone", state.simPhone, "tel", {
    required: true,
    pattern: "[0-9]{7,16}",
  });
  const now = input("now", state.simNow, "datetime-local");
  const text = el("textarea", {
    name: "message",
    required: true,
    maxlength: 10000,
  });
  const form = el(
    "form",
    {
      class: "form-panel",
      onsubmit: async (e) => {
        e.preventDefault();
        await send(text.value);
      },
    },
    field("WhatsApp de prueba", phone, "Solo números, con código de país."),
    field("Fecha y hora de prueba", now, "Vacío usa la hora actual."),
    button(
      "Usar horario abierto",
      () => {
        const d = new Date();
        d.setHours(14, 0, 0, 0);
        now.value = localDateInput(d);
        state.simNow = now.value;
      },
      "small",
    ),
    field("Mensaje del cliente", text),
    el("button", { type: "submit", class: "primary" }, "Enviar como cliente"),
  );
  const history = el("div", { class: "chat-history", id: "sim-history" });
  async function send(value) {
    try {
      state.simPhone = phone.value;
      state.simNow = now.value;
      const r = await post("/dev/message", {
        phone: phone.value,
        text: value,
        ...(now.value ? { now: new Date(now.value).toISOString() } : {}),
      });
      state.simMessages.push(
        { role: "customer", text: value },
        ...r.replies.map((reply) => ({ role: "bot", ...reply })),
      );
      text.value = "";
      paint();
    } catch (e) {
      showError(e);
    }
  }
  function paint() {
    history.replaceChildren(
      ...state.simMessages.map((m) =>
        el(
          "div",
          { class: "message " + m.role },
          el(
            "div",
            { class: "message-author" },
            m.role === "customer" ? "Cliente de prueba" : "Bot Jiren",
          ),
          el("div", { class: "message-text" }, m.text),
          m.choices &&
            el(
              "div",
              { class: "choice-buttons" },
              m.choices.map((c) =>
                button(
                  [c.title, c.description && el("small", {}, c.description)],
                  () => send(c.id),
                ),
              ),
            ),
        ),
      ),
    );
    if (!state.simMessages.length)
      history.append(
        el("div", { class: "sim-empty" }, "Escribe hola o pide un producto."),
      );
    history.scrollTop = history.scrollHeight;
  }
  main.append(
    el(
      "p",
      { class: "notice" },
      "El reloj de prueba cambia solo los mensajes del simulador; las acciones del equipo y temporizadores usan la hora real.",
    ),
    el(
      "div",
      { class: "sim-layout" },
      form,
      el("section", { class: "sim-history" }, history),
    ),
  );
  paint();
}
async function renderOutbox(main) {
  const { messages } = await api("/outbox");
  main.append(
    heading(
      "Mensajes enviados",
      "Los errores y envíos pendientes quedan registrados.",
    ),
  );
  const list = el("div", { class: "outbox-list" });
  for (const m of messages)
    list.append(
      el(
        "article",
        { class: "outbox-item" },
        el(
          "div",
          { class: "ticket-line" },
          el("strong", {}, m.phone),
          status(m.state),
        ),
        el("p", {}, m.text),
        el("small", {}, date(m.createdAt)),
        m.error && el("p", { class: "notice error" }, m.error),
        ["blocked", "failed"].includes(m.state) &&
          button(
            "Reintentar envío",
            async () => {
              await post("/outbox/" + m.id + "/retry");
              await render();
            },
            "small",
          ),
        m.state === "uncertain" &&
          el(
            "p",
            { class: "notice" },
            "No se conoce el resultado del envío. Revisa WhatsApp antes de reenviar para evitar duplicados.",
          ),
      ),
    );
  main.append(
    messages.length
      ? list
      : empty(
          "Sin mensajes todavía",
          "Se registrarán al conversar con el bot o actualizar un pedido.",
        ),
  );
}
function auditTable(audit) {
  return el(
    "div",
    { class: "table-wrap" },
    el(
      "table",
      { class: "data-table" },
      el(
        "thead",
        {},
        el(
          "tr",
          {},
          ["Fecha", "Cuenta", "Acción", "Detalle"].map((t) => el("th", {}, t)),
        ),
      ),
      el(
        "tbody",
        {},
        audit.map((a) =>
          el(
            "tr",
            {},
            el("td", {}, date(a.createdAt)),
            el("td", {}, a.actor),
            el("td", {}, a.action),
            el("td", {}, a.detail),
          ),
        ),
      ),
    ),
  );
}
async function poll() {
  if (!state.user || document.querySelector("dialog[open]")) return;
  try {
    if (state.page === "orders") {
      await fetchOrders();
      paintQueue();
    } else await observePending();
    if (state.page === "chats") {
      const r = await api("/chats");
      state.chats = r.chats;
      paintChats();
      await refreshChat();
    }
    const n = $("#connection");
    if (n) {
      n.classList.remove("offline");
      n.textContent = state.capabilities.simulator
        ? "Entorno de prueba"
        : "Conectado";
    }
  } catch {
    const n = $("#connection");
    if (n) {
      n.classList.add("offline");
      n.textContent = "Reconectando…";
    }
  }
}
async function start() {
  try {
    const h = await api("/health");
    state.capabilities = h.capabilities ?? {};
  } catch {}
  try {
    const r = await api("/me");
    state.user = r.user;
    Object.assign(state.capabilities, r.capabilities);
    state.page = r.user.role === "ceo" ? "branch" : "orders";
    await render();
  } catch {
    renderLogin();
  }
  setInterval(poll, 5000);
}
start();
