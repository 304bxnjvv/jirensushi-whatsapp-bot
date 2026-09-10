import type {
  BotContext,
  BotResult,
  CartItem,
  Conversation,
  Incoming,
  Product,
  Reply,
} from "../types.ts";
import {
  catalog,
  products,
  categoriesReply,
  categoryPage,
  findProduct,
  matchCatalog,
  normalize,
  productDetail,
  uniqueMatch,
  formatMoney,
} from "./catalog.ts";
import {
  branchAvailability,
  displayTime,
  scheduledTime,
  chileParts,
} from "./hours.ts";
import {
  parseModifications,
  priceModification,
  recalculate,
  validateDraft,
} from "./pricing.ts";
import { applyAgreement } from "./agreement.ts";
export function newConversation(phone: string, now: Date): Conversation {
  return {
    phone,
    stage: "mode",
    mode: "bot",
    draft: { items: [], deliveryFee: 0, total: 0 },
    data: {},
    version: 0,
    updatedAt: now.toISOString(),
    lastCustomerAt: now.toISOString(),
  };
}
const yes = (s: string) =>
  /^(si|confirm|confirmar|confirmar unidad|confirmar resumen|confirmar pedido|correcto|ok|si continuar)$/.test(
    s,
  );
const no = (s: string) => /^(no|modificar|cambiar)$/.test(s);
const choice = (
  text: string,
  values: { id: string; title: string }[],
): Reply => ({ text, choices: values });
function menu(c: Conversation): Reply {
  c.stage = "menu";
  return categoriesReply();
}
function blockedProducts(c: Conversation): string[] {
  const missing = (c.data.excludedIngredients ?? []) as string[];
  const ids = (c.data.excludedProducts ?? []) as string[];
  return products
    .filter(
      (p) =>
        ids.includes(p.id) ||
        missing.some((i) =>
          [
            ...p.ingredients,
            ...p.preparation,
            ...p.components.map((x) => x.name),
          ].some((t) => normalize(t).includes(normalize(i))),
        ),
    )
    .map((p) => p.id);
}
function summary(c: Conversation): string {
  const d = c.draft;
  recalculate(d);
  return [
    "Pedido a nombre de " +
      (d.customerName ?? "por indicar") +
      ", ¿es correcto?",
    ...d.items.map(
      (i, n) =>
        `${n + 1}. ${i.name} · ${formatMoney(i.subtotal)}${
          Object.keys(i.options).length
            ? "\n   " +
              Object.entries(i.options)
                .map(([k, v]) => k + ": " + v)
                .join("; ")
            : ""
        }${i.modifications.length ? "\n   " + i.modifications.map((m) => (m.action === "remove" ? "Quitar " : m.action === "replace" ? "Cambiar " + m.from + " por " : "Agregar ") + m.ingredient + " (" + formatMoney(m.price) + ")").join("; ") : ""}`,
    ),
    "Modalidad: " + (d.mode ?? "por indicar"),
    d.mode === "despacho"
      ? "Dirección: " +
        d.address +
        "\nZona: " +
        (d.zoneId ?? "por indicar") +
        "\nReferencia: " +
        (d.reference ?? "Sin referencia") +
        "\nDespacho: " +
        formatMoney(d.deliveryFee)
      : "Retiro: Sucursal Viña del Mar",
    "Horario: " +
      (d.schedule?.kind === "asap"
        ? "Lo antes posible (estimación inicial 30 min)"
        : d.schedule?.time
          ? displayTime(d.schedule.time)
          : "por indicar"),
    "Pago: " + (d.payment ?? "por indicar"),
    "Teléfono: " + c.phone,
    d.allergy ? "Alergia informada: " + d.allergy : "",
    ...(d.humanNotes?.length
      ? ["Acuerdos confirmados con el equipo:", ...d.humanNotes]
      : []),
    "Total: " + formatMoney(d.total),
  ]
    .filter(Boolean)
    .join("\n");
}
function cart(c: Conversation): Reply {
  c.stage = "cart";
  return choice(
    summary(c) +
      "\nPuedes escribir editar 1 o eliminar 1 para cambiar una unidad.",
    [
      { id: "menu", title: "Agregar productos" },
      { id: "checkout", title: "Continuar pedido" },
    ],
  );
}
function unit(c: Conversation): CartItem {
  return c.data.unit as CartItem;
}
function startUnit(c: Conversation, p: Product): Reply {
  c.data.unit = {
    id: crypto.randomUUID(),
    productId: p.id,
    name: p.name,
    basePrice: p.price,
    options: {},
    modifications: [],
    subtotal: p.price,
  };
  c.data.optionIndex = 0;
  if (p.optionGroups.length) {
    c.stage = "option";
    return optionReply(c, p);
  }
  c.stage = "modify_question";
  return modifyQuestion(c);
}
function optionReply(c: Conversation, p: Product): Reply {
  const g = p.optionGroups[c.data.optionIndex];
  const values = g.options.map((x) => ({ id: "option:" + x, title: x }));
  if (c.data.configured?.length)
    values.push({ id: "copy", title: "Igual a la anterior" });
  return choice(
    `Unidad ${c.data.unitIndex ?? 1} de ${c.data.quantity ?? 1}. Elige ${g.name}:`,
    values,
  );
}
function modifyQuestion(c: Conversation): Reply {
  const choices = [
    { id: "modify:yes", title: "Sí" },
    { id: "modify:no", title: "No" },
  ];
  if ((c.data.configured as CartItem[] | undefined)?.length)
    choices.push({ id: "copy", title: "Igual a la anterior" });
  return choice(
    `Unidad ${c.data.unitIndex ?? 1} de ${c.data.quantity ?? 1}. ¿Quieres modificar ingredientes? Puedes escribir cancelar unidad.`,
    choices,
  );
}
function unitSummary(c: Conversation): Reply {
  c.stage = "unit_confirm";
  const i = unit(c);
  return choice(
    i.name +
      "\n" +
      Object.entries(i.options)
        .map(([k, v]) => k + ": " + v)
        .join("\n") +
      "\n" +
      i.modifications
        .map(
          (m) =>
            (m.action === "remove"
              ? "Quitar "
              : m.action === "replace"
                ? "Cambiar " + m.from + " por "
                : "Agregar ") +
            m.ingredient +
            " " +
            formatMoney(m.price),
        )
        .join("\n") +
      "\nSubtotal unidad: " +
      formatMoney(i.subtotal),
    [
      { id: "unit:confirm:" + i.id, title: "Confirmar unidad" },
      { id: "unit:modify", title: "Modificar" },
      { id: "unit:cancel", title: "Cancelar unidad" },
    ],
  );
}
function finishUnit(c: Conversation, add: boolean): Reply {
  const configured = (c.data.configured ?? []) as CartItem[];
  if (add) configured.push(structuredClone(unit(c)));
  c.data.configured = configured;
  if (c.data.editItemId) {
    if (add) {
      const idx = c.draft.items.findIndex((x) => x.id === c.data.editItemId);
      if (idx >= 0) c.draft.items[idx] = { ...unit(c), id: c.data.editItemId };
    }
    delete c.data.editItemId;
    recalculate(c.draft);
    return cart(c);
  }
  if ((c.data.unitIndex ?? 1) < (c.data.quantity ?? 1)) {
    c.data.unitIndex++;
    return startUnit(c, findProduct(c.data.productId)!);
  }
  c.draft.items.push(...configured);
  delete c.data.configured;
  delete c.data.unit;
  recalculate(c.draft);
  return menu(c);
}
function scheduledPrompt(c: Conversation): Reply {
  c.stage = "schedule";
  return choice("¿Cuándo deseas tu pedido?", [
    { id: "asap", title: "Lo antes posible" },
    { id: "program", title: "Programar una hora" },
  ]);
}
function zonePrompt(c: Conversation, ctx: BotContext): Reply {
  c.stage = "zone";
  return choice(
    "Elige tu zona de despacho en Viña del Mar. Si no aparece o no estás seguro de la cobertura, pide hablar con el local.",
    [
      ...ctx.settings.zones
        .filter((z) => z.enabled)
        .map((z) => ({
          id: "zone:" + z.id,
          title: z.name,
          description: formatMoney(z.price),
        })),
      { id: "outside", title: "Fuera de cobertura" },
    ],
  );
}
function namePrompt(c: Conversation): Reply {
  c.stage = "name";
  return {
    text: "¿A nombre de quién dejamos el pedido? Escribe nombre y apellido.",
  };
}
export async function processMessage(
  prior: Conversation | null,
  input: Incoming,
  ctx: BotContext,
): Promise<BotResult> {
  let c = structuredClone(prior ?? newConversation(input.phone, ctx.now));
  const replies: Reply[] = [];
  const done = (reply?: Reply, extra: Partial<BotResult> = {}): BotResult => {
    if (reply) replies.push(reply);
    c.updatedAt = ctx.now.toISOString();
    c.lastCustomerAt = ctx.now.toISOString();
    return { conversation: c, replies, ...extra };
  };
  const active = ctx.orders.find((o) =>
    ["Pendiente", "Aceptado"].includes(o.status),
  );
  if (
    prior &&
    c.mode === "bot" &&
    c.stage !== "human_confirm" &&
    !active &&
    +ctx.now - Date.parse(c.updatedAt) >= 60 * 60000
  ) {
    c = newConversation(input.phone, ctx.now);
    c.data.abandoned = true;
    prior = null;
  }
  let raw = input.text.trim();
  let t = normalize(raw);
  const availability = branchAvailability(ctx.now, ctx.settings);
  if (c.mode === "human" || c.mode === "waiting") return done();
  if (!prior && !active) {
    c.data.firstMessage = input.text;
    c.data.candidates = {
      original: input.text,
      product: matchCatalog(input.text)?.product?.id,
    };
    replies.push({
      text: "¡Hola! 👋 Bienvenido a Jiren Sushi Viña del Mar 🍣",
    });
  }
  if (t === "human" || /persona|humano|ejecutivo|comunica.*local/.test(t)) {
    if (!availability.open)
      return done({
        text:
          "El local está cerrado. Próxima apertura: " +
          displayTime(availability.nextOpening),
      });
    c.data.resumeStage = c.stage;
    if (!c.draft.mode) {
      c.stage = "human_branch";
      return done(
        choice("¿Quieres comunicarte con el equipo de Sucursal Viña del Mar?", [
          { id: "human:confirm", title: "Sí, comunicarme" },
          { id: "menu", title: "Volver" },
        ]),
      );
    }
    c.mode = "waiting";
    c.waitingSince = ctx.now.toISOString();
    return done({
      text: "Solicitamos atención de una persona del equipo. Puedes seguir escribiendo mientras esperas.",
    });
  }
  if (
    c.stage === "human_branch" &&
    (yes(t) || raw === "human:confirm" || t === "si comunicarme")
  ) {
    c.mode = "waiting";
    c.waitingSince = ctx.now.toISOString();
    return done({
      text: "Solicitamos atención del equipo de Viña del Mar. Puedes seguir escribiendo mientras esperas.",
    });
  }
  if (c.stage === "human_confirm") {
    if (yes(t)) {
      const agreement = c.data.humanSummary ?? "";
      const warnings = active ? [] : applyAgreement(c, agreement, ctx);
      c.stage = c.data.resumeStage ?? "menu";
      delete c.data.humanSummary;
      const recent = ctx.history
        .filter((m) => m.role === "human")
        .map((m) => m.text)
        .join("\n");
      c.data.humanContext = recent;
      // Interpret confirmed agreement through the same validated conversation steps.
      if (c.stage === "human_confirm" || c.stage === "human_branch")
        c.stage = "menu";
      if (active)
        return done({
          text:
            "Conservé lo conversado. Tu pedido " +
            active.number +
            " sigue " +
            active.status.toLowerCase() +
            ".",
        });
      if (warnings.length)
        return done({
          ...cart(c),
          text: warnings.join("\n") + "\n" + summary(c),
        });
      return done(
        c.stage === "menu"
          ? menu(c)
          : {
              text:
                "Gracias por confirmar. Continuamos con tu pedido.\n" +
                summary(c),
              choices: [
                { id: "checkout", title: "Continuar pedido" },
                { id: "cart", title: "Ver carrito" },
              ],
            },
      );
    }
    return done(
      choice(
        "Vuelves a ser atendido por el bot. Lo acordado: " +
          c.data.humanSummary +
          "\n¿Confirmas este resumen?",
        [
          { id: "confirm", title: "Confirmar resumen" },
          { id: "human", title: "Hablar con persona" },
        ],
      ),
    );
  }
  if (active)
    return done({
      text:
        "Tu pedido " +
        active.number +
        " sigue " +
        active.status.toLowerCase() +
        ". No puedes iniciar otro hasta que termine. Te avisaremos por este chat.",
    });
  if (/^(nuevo pedido|new)$/.test(t)) {
    c = newConversation(input.phone, ctx.now);
    return done(
      choice("¿Quieres retiro en local o despacho a domicilio?", [
        { id: "mode:retiro", title: "Retiro en local" },
        { id: "mode:despacho", title: "Despacho a domicilio" },
      ]),
    );
  }
  if (/^(reabrir|reabrir pedido|reopen)$/.test(t)) {
    const o = ctx.orders[0];
    if (
      !o ||
      o.status !== "Rechazado" ||
      o.reason !== "ingredients" ||
      o.locked
    )
      return done({
        text: "Ese pedido no permite reapertura. Puedes iniciar un nuevo pedido.",
      });
    c = newConversation(input.phone, ctx.now);
    c.draft = {
      mode: o.mode,
      items: structuredClone(
        o.items.filter(
          (i) => !o.missing?.some((m) => m.productId === i.productId),
        ),
      ),
      deliveryFee: o.deliveryFee,
      zoneId: o.zoneId,
      address: o.address,
      reference: o.reference,
      allergy: o.allergy,
      total: 0,
      reopenedFrom: o.id,
    };
    c.data.excludedProducts = o.missing?.map((m) => m.productId) ?? [];
    c.data.excludedIngredients =
      o.missing
        ?.map((m) => m.ingredient)
        .filter((m) =>
          products.some((p) =>
            [
              ...p.ingredients,
              ...p.preparation,
              ...p.components.map((x) => x.name),
            ].some((i) => normalize(i).includes(normalize(m))),
          ),
        ) ?? [];
    recalculate(c.draft);
    return done(c.draft.items.length ? cart(c) : menu(c), {
      reopenOrderId: o.id,
    });
  }
  if (/alergi[ac]|alergico|alergica/.test(t)) {
    c.draft.allergy = raw;
    return done({
      text: "Anoté la alergia en tu pedido para que el local la revise. El bot no puede garantizar ausencia de alérgenos. Continuemos.",
      choices: [
        { id: "cart", title: "Ver carrito" },
        { id: "menu", title: "Ver carta" },
      ],
    });
  }
  if (!availability.canScheduleToday)
    return done({
      text:
        "El local está cerrado. Próxima apertura: " +
        displayTime(availability.nextOpening),
    });
  // Human/unknown language classification only when it cannot affect already structured data without validation.
  const clearMode =
    /retiro|retirar|recoger|buscar al local|despacho|delivery|envio|domicilio/.test(
      t,
    );
  const clearModification =
    c.stage === "modifications" &&
    parseModifications(raw, findProduct(c.data.productId)!, unit(c).options)
      .modifications;
  if (
    ctx.interpret &&
    !clearMode &&
    !matchCatalog(raw) &&
    !clearModification &&
    !raw.includes(":") &&
    !/^(si|no|confirmar|menu|carrito|finalizar|retiro|despacho|tarjeta|efectivo|\d+)$/.test(
      t,
    ) &&
    ["mode", "menu", "category", "quantity", "modifications"].includes(c.stage)
  ) {
    const result = await ctx.interpret(raw, c).catch(() => null);
    if (
      result?.action === "product" &&
      result.productId &&
      findProduct(result.productId)
    )
      raw = "product:" + result.productId;
    else if (result?.action === "category" && result.text)
      raw = "category:" + result.text;
    else if (
      result?.action === "quantity" &&
      Number.isSafeInteger(result.quantity) &&
      result.quantity! > 0
    )
      raw = String(result.quantity);
    else if (
      result?.action === "mode" &&
      ["retiro", "despacho"].includes(result.text ?? "")
    )
      raw = "mode:" + result.text;
    else if (result?.action === "human")
      return processMessage(
        c,
        { ...input, text: "human" },
        { ...ctx, interpret: undefined },
      );
    else if (
      result?.action === "modifications" &&
      result.modifications?.length &&
      c.stage === "modifications"
    ) {
      const p = findProduct(c.data.productId)!;
      const validated = result.modifications.map(priceModification);
      if (validated.every(Boolean)) {
        const descriptions = validated.map((m) =>
          m!.action === "remove"
            ? "sin " + m!.ingredient
            : m!.action === "replace"
              ? "cambiar " +
                (m!.kind === "wrap" ? "envoltura de " : "") +
                m!.from +
                " por " +
                m!.ingredient
              : "agregar " +
                (m!.kind === "wrap" ? "envoltura de " : "") +
                m!.ingredient,
        );
        raw = descriptions.join(", ");
      }
    }
    t = normalize(raw);
  }
  if (
    (raw.startsWith("product:") ||
      raw.startsWith("category:") ||
      raw.startsWith("page:")) &&
    !["menu", "category", "detail", "cart"].includes(c.stage)
  )
    return done({
      text: "Esa opción es de una etapa anterior. Termina o cancela la unidad actual antes de elegir otro producto.",
    });
  if (raw.startsWith("unit:confirm:") && raw.slice(13) !== unit(c)?.id)
    return done({
      text: "Esa confirmación pertenece a otra unidad. Revisa y confirma la unidad actual.",
    });
  const isMenu = [
    "menu",
    "menú",
    "volver",
    "volver a categorias",
    "agregar productos",
    "ver carta",
  ].includes(t);
  if (
    ["option", "modify_question", "modifications", "unit_confirm"].includes(
      c.stage,
    ) &&
    (isMenu ||
      [
        "cart",
        "carrito",
        "ver carrito",
        "checkout",
        "finalizar",
        "continuar pedido",
      ].includes(t))
  )
    return done({
      text: "Primero confirma o cancela la unidad actual. Las unidades ya confirmadas se conservarán.",
      choices: [{ id: "unit:cancel", title: "Cancelar unidad" }],
    });
  if (isMenu)
    return done(
      c.draft.mode
        ? menu(c)
        : choice("¿Retiro en local o despacho?", [
            { id: "mode:retiro", title: "Retiro en local" },
            { id: "mode:despacho", title: "Despacho a domicilio" },
          ]),
    );
  const pickup =
    /retiro|retirar|recoger|paso a buscar|voy a buscar|buscar al local/.test(t);
  const delivery = /despacho|delivery|envio|domicilio|que lo traigan/.test(t);
  if (raw.startsWith("mode:") && c.stage !== "mode")
    return done({
      text: "Esa opción pertenece a una etapa anterior. Para cambiar la modalidad, usa Modificar pedido en el resumen.",
    });
  if (c.stage === "mode") {
    if (pickup === delivery)
      return done(
        choice(
          "¿Quieres hacer tu pedido con retiro en local o despacho a domicilio?",
          [
            { id: "mode:retiro", title: "Retiro en local" },
            { id: "mode:despacho", title: "Despacho a domicilio" },
          ],
        ),
      );
    c.draft.mode = pickup ? "retiro" : "despacho";
    if (pickup) {
      c.draft.deliveryFee = 0;
      return done(c.data.editCheckout ? confirm(c) : menu(c));
    }
    return done(zonePrompt(c, ctx));
  }
  if (c.stage === "zone") {
    if (raw === "outside" || /fuera|no aparece|no se/.test(t)) {
      c.stage = "mode";
      return done(
        choice(
          "No podemos ofrecer despacho fuera de cobertura. Puedes elegir retiro en Viña del Mar.",
          [
            { id: "mode:retiro", title: "Retiro en local" },
            { id: "human", title: "Hablar con persona" },
          ],
        ),
      );
    }
    const zone = raw.startsWith("zone:")
      ? ctx.settings.zones.find((z) => z.id === raw.slice(5) && z.enabled)
      : uniqueMatch(
          raw,
          ctx.settings.zones.filter((z) => z.enabled),
          (z) => [z.name, z.id],
        );
    if (!zone) return done(zonePrompt(c, ctx));
    c.draft.zoneId = zone.id;
    c.draft.deliveryFee = zone.price;
    c.stage = "address";
    return done({
      text: "Escribe calle y número de tu dirección de despacho.",
    });
  }
  if (c.stage === "address") {
    if (input.location) {
      c.draft.location = input.location;
      return done({
        text: "Guardé la ubicación. Escribe también calle y número para el pedido.",
      });
    }
    if (!/[a-záéíóúñ]/i.test(raw) || !/\d/.test(raw) || raw.length < 5)
      return done({
        text: "Necesito calle y número. La dirección se guardará tal como la escribas.",
      });
    c.draft.address = raw;
    c.stage = "reference";
    return done(
      choice("¿Quieres agregar una referencia para el reparto?", [
        { id: "skip-reference", title: "Sin referencia" },
      ]),
    );
  }
  if (c.stage === "reference") {
    if (!["sin referencia", "skip reference", "no"].includes(t))
      c.draft.reference = raw;
    return done(c.data.editCheckout ? confirm(c) : menu(c));
  }
  if (["cart", "carrito", "ver carrito"].includes(t))
    return done(c.draft.items.length ? cart(c) : menu(c));
  if (["checkout", "finalizar", "continuar pedido"].includes(t)) {
    if (!c.draft.items.length) return done(menu(c));
    return done(scheduledPrompt(c));
  }
  if (raw.startsWith("category:") || raw.startsWith("page:")) {
    const [, id, page] = raw.split(":");
    c.stage = "category";
    c.data.categoryId = id;
    return done(categoryPage(id, Number(page ?? 0), blockedProducts(c)));
  }
  if (
    ["menu", "category", "detail"].includes(c.stage) ||
    raw.startsWith("product:")
  ) {
    const match = raw.startsWith("product:")
      ? { product: findProduct(raw.slice(8)) }
      : matchCatalog(raw);
    if (match?.product) {
      if (blockedProducts(c).includes(match.product.id))
        return done(
          categoriesReply(
            "Ese producto no está disponible para este pedido reabierto. Elige otra opción.",
          ),
        );
      c.stage = "detail";
      c.data.productId = match.product.id;
      return done(productDetail(match.product));
    }
    if (match?.category) {
      c.stage = "category";
      c.data.categoryId = match.category.id;
      return done(categoryPage(match.category.id, 0, blockedProducts(c)));
    }
    if (c.stage !== "detail") return done(menu(c));
  }
  if (c.stage === "detail") {
    if (raw === "quantity" || t === "elegir cantidad") {
      c.stage = "quantity";
      return done(
        choice(
          "¿Cuántas unidades quieres? También puedes escribir otra cantidad.",
          [
            { id: "1", title: "1" },
            { id: "2", title: "2" },
            { id: "3", title: "3" },
          ],
        ),
      );
    }
    return done(productDetail(findProduct(c.data.productId)!));
  }
  if (c.stage === "quantity") {
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
      return done({ text: "Ingresa una cantidad entera mayor que cero." });
    c.data.quantity = Number(raw);
    c.data.unitIndex = 1;
    c.data.configured = [];
    return done(startUnit(c, findProduct(c.data.productId)!));
  }
  if (
    ["option", "modify_question", "modifications", "unit_confirm"].includes(
      c.stage,
    )
  ) {
    if (raw === "unit:cancel" || t === "cancelar unidad")
      return done(finishUnit(c, false));
    if (
      (raw === "copy" || t === "igual a la anterior") &&
      c.data.configured?.length
    ) {
      c.data.unit = {
        ...structuredClone(c.data.configured.at(-1)),
        id: crypto.randomUUID(),
      };
      return done(unitSummary(c));
    }
  }
  if (c.stage === "option") {
    const p = findProduct(c.data.productId)!;
    const g = p.optionGroups[c.data.optionIndex];
    const option = uniqueMatch(raw.replace(/^option:/, ""), g.options, (x) => [
      x,
    ]);
    if (!option) return done(optionReply(c, p));
    unit(c).options[g.id] = option;
    c.data.optionIndex++;
    if (c.data.optionIndex < p.optionGroups.length)
      return done(optionReply(c, p));
    c.stage = "modify_question";
    return done(modifyQuestion(c));
  }
  if (c.stage === "modify_question") {
    if (raw === "modify:no" || t === "no") return done(unitSummary(c));
    if (raw === "modify:yes" || yes(t)) {
      c.stage = "modifications";
      return done({
        text: "Escribe todas las modificaciones para esta unidad. Ejemplo: sin queso crema, agregar camarón.",
      });
    }
    return done(modifyQuestion(c));
  }
  if (c.stage === "modifications") {
    const result = parseModifications(
      raw,
      findProduct(c.data.productId)!,
      unit(c).options,
    );
    if (!result.modifications) return done({ text: result.error! });
    unit(c).modifications = result.modifications;
    unit(c).subtotal =
      unit(c).basePrice +
      result.modifications.reduce((sum, m) => sum + m.price, 0);
    return done(unitSummary(c));
  }
  if (c.stage === "unit_confirm") {
    if (
      raw === "unit:confirm" ||
      raw === "unit:confirm:" + unit(c).id ||
      yes(t)
    )
      return done(finishUnit(c, true));
    if (raw === "unit:modify" || no(t)) {
      const p = findProduct(c.data.productId)!;
      c.data.optionIndex = 0;
      c.stage = p.optionGroups.length ? "option" : "modify_question";
      return done(
        p.optionGroups.length ? optionReply(c, p) : modifyQuestion(c),
      );
    }
    return done(unitSummary(c));
  }
  if (c.stage === "cart") {
    const m = t.match(/^(editar|modificar|eliminar|quitar)\s+(\d+)$/);
    if (m) {
      const idx = Number(m[2]) - 1;
      const item = c.draft.items[idx];
      if (!item) return done(cart(c));
      if (["eliminar", "quitar"].includes(m[1])) {
        c.draft.items.splice(idx, 1);
        recalculate(c.draft);
        return done(c.draft.items.length ? cart(c) : menu(c));
      }
      c.data.editItemId = item.id;
      c.data.productId = item.productId;
      c.data.unit = { ...structuredClone(item), id: crypto.randomUUID() };
      c.data.quantity = 1;
      c.data.unitIndex = 1;
      c.data.configured = [];
      c.data.optionIndex = 0;
      const p = findProduct(item.productId)!;
      c.stage = p.optionGroups.length ? "option" : "modify_question";
      return done(
        p.optionGroups.length ? optionReply(c, p) : modifyQuestion(c),
      );
    }
    return done(cart(c));
  }
  if (c.stage === "schedule") {
    if (raw === "asap" || t === "lo antes posible") {
      if (!availability.open)
        return done({
          text:
            "El local aún no está disponible. Próxima apertura: " +
            displayTime(availability.nextOpening) +
            ". Puedes programar una hora para hoy.",
          choices: [{ id: "program", title: "Programar una hora" }],
        });
      c.draft.schedule = {
        kind: "asap",
        estimateMinutes: ctx.settings.asapMinutes,
      };
      return done(c.data.editCheckout ? confirm(c) : payment(c));
    }
    if (raw === "program" || t === "programar una hora") {
      c.stage = "schedule_time";
      return done({
        text: "Escribe la hora para hoy (al menos 30 minutos desde ahora, bloques de 15 minutos).",
      });
    }
    c.stage = "schedule_time";
  }
  if (c.stage === "schedule_time") {
    const match = t.match(
      /^(?:a las )?(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm|hrs|horas))?$/,
    );
    if (!match)
      return done({ text: "Escribe una hora para hoy, por ejemplo 20:30." });
    let h = Number(match[1]),
      m = Number(match[2] ?? 0);
    if (h > 23 || m > 59)
      return done({ text: "Hora inválida. Escribe por ejemplo 20:30." });
    const p = chileParts(ctx.now);
    if (match[3] === "pm" && h < 12) h += 12;
    else if (match[3] === "am" && h === 12) h = 0;
    else if (
      !match[3] &&
      h >= 1 &&
      h <= 11 &&
      h * 60 + m < p.hour * 60 + p.minute
    )
      h += 12;
    const rounded = Math.ceil(m / 15) * 15;
    h += Math.floor(rounded / 60);
    m = rounded % 60;
    let proposed = scheduledTime(
      h + ":" + String(m).padStart(2, "0"),
      ctx.now,
      ctx.settings,
    );
    if (!proposed.ok && !match[3] && h >= 1 && h <= 11)
      proposed = scheduledTime(
        h + 12 + ":" + String(m).padStart(2, "0"),
        ctx.now,
        ctx.settings,
      );
    if (!proposed.ok) return done({ text: proposed.error! });
    if (Number(match[2] ?? 0) % 15 !== 0) {
      c.data.proposedTime = proposed.time;
      c.stage = "schedule_proposal";
      return done(
        choice(
          "El siguiente bloque disponible es " +
            displayTime(proposed.time!) +
            ". ¿Lo eliges?",
          [
            { id: "confirm", title: "Sí, elegir bloque" },
            { id: "change-time", title: "Cambiar hora" },
          ],
        ),
      );
    }
    c.draft.schedule = { kind: "scheduled", time: proposed.time };
    return done(c.data.editCheckout ? confirm(c) : payment(c));
  }
  if (c.stage === "schedule_proposal") {
    if (yes(t)) {
      c.draft.schedule = { kind: "scheduled", time: c.data.proposedTime };
      return done(c.data.editCheckout ? confirm(c) : payment(c));
    }
    c.stage = "schedule_time";
    return done({ text: "Escribe otra hora para hoy." });
  }
  if (c.stage === "payment") {
    if (/tarjeta|card/.test(t)) c.draft.payment = "Tarjeta";
    else if (/efectivo|cash/.test(t)) c.draft.payment = "Efectivo";
    else return done(payment(c));
    return done(c.data.editCheckout ? confirm(c) : namePrompt(c));
  }
  if (c.stage === "name") {
    if (raw.length < 1 || raw.length > 120) return done(namePrompt(c));
    c.draft.customerName = raw;
    return done(confirm(c));
  }
  if (c.stage === "confirm") {
    if (raw === "cancel" || t === "cancelar pedido") {
      c.stage = "cancel_confirm";
      return done(
        choice("¿Confirmas cancelar este borrador?", [
          { id: "cancel:confirm", title: "Sí, cancelar" },
          { id: "confirm:back", title: "Volver al pedido" },
        ]),
      );
    }
    if (raw === "edit" || t === "modificar pedido") {
      c.stage = "edit_checkout";
      return done(
        choice("¿Qué quieres modificar?", [
          { id: "edit:cart", title: "Productos" },
          { id: "edit:mode", title: "Modalidad" },
          { id: "edit:address", title: "Dirección y zona" },
          { id: "edit:schedule", title: "Horario" },
          { id: "edit:payment", title: "Medio de pago" },
          { id: "edit:name", title: "Nombre" },
        ]),
      );
    }
    if (t === "confirmar pedido" || raw === "submit") {
      const valid = validateDraft(c.draft, ctx.settings, ctx.now);
      if (!valid.valid)
        return done({
          text: valid.error!,
          choices: [{ id: "edit", title: "Modificar pedido" }],
        });
      if (JSON.stringify(valid.draft) !== JSON.stringify(c.draft)) {
        c.draft = valid.draft!;
        const updated = confirm(c);
        return done({
          ...updated,
          text:
            "La información o los precios se actualizaron. Revisa y confirma el nuevo resumen.\n" +
            updated.text,
        });
      }
      c.draft = valid.draft!;
      c.stage = "submitted";
      return done(undefined, { submit: structuredClone(valid.draft) });
    }
    return done(confirm(c));
  }
  if (c.stage === "edit_checkout") {
    const action = raw.replace(/^edit:/, "");
    c.data.editCheckout = true;
    if (action === "cart" || t === "productos") return done(cart(c));
    if (action === "mode" || t === "modalidad") {
      c.stage = "mode";
      return done(
        choice("Elige modalidad.", [
          { id: "mode:retiro", title: "Retiro en local" },
          { id: "mode:despacho", title: "Despacho a domicilio" },
        ]),
      );
    }
    if (action === "address" || t === "direccion y zona")
      return done(
        c.draft.mode === "despacho"
          ? zonePrompt(c, ctx)
          : {
              text: "Tu pedido es para retiro en Viña del Mar.",
              choices: [{ id: "cart", title: "Ver carrito" }],
            },
      );
    if (action === "schedule" || t === "horario")
      return done(scheduledPrompt(c));
    if (action === "payment" || t === "medio de pago") return done(payment(c));
    if (action === "name" || t === "nombre") return done(namePrompt(c));
    return done({ text: "Elige una sección del resumen para modificar." });
  }
  if (c.stage === "cancel_confirm") {
    if (raw === "cancel:confirm" || yes(t) || t === "si cancelar") {
      c = newConversation(input.phone, ctx.now);
      c.stage = "cancelled";
      return done({
        text: "Pedido cancelado. Si quieres, puedes iniciar un nuevo pedido.",
      });
    }
    return done(confirm(c));
  }
  if (["cancelled", "submitted"].includes(c.stage)) {
    c = newConversation(input.phone, ctx.now);
    return processMessage(c, input, ctx);
  }
  return done(menu(c));
}
function payment(c: Conversation): Reply {
  c.stage = "payment";
  return choice("¿Cómo pagarás al recibir o retirar?", [
    { id: "tarjeta", title: "Tarjeta" },
    { id: "efectivo", title: "Efectivo" },
  ]);
}
function confirm(c: Conversation): Reply {
  c.stage = "confirm";
  delete c.data.editCheckout;
  return choice(summary(c), [
    { id: "submit", title: "Confirmar pedido" },
    { id: "edit", title: "Modificar pedido" },
    { id: "cancel", title: "Cancelar pedido" },
  ]);
}
