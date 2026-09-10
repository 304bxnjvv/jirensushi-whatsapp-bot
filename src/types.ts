export type Role = "local" | "ceo";
export type Mode = "retiro" | "despacho";
export type Status = "Pendiente" | "Aceptado" | "Rechazado" | "Entregado";
export interface User {
  id: string;
  username: string;
  role: Role;
}
export interface Zone {
  id: string;
  name: string;
  price: number;
  description: string;
  enabled: boolean;
}
export interface Settings {
  branch: string;
  address: string;
  manualClosed: boolean;
  reopenAt: string | null;
  zones: Zone[];
  asapMinutes: number;
  retentionDays: number;
}
export interface OptionGroup {
  id: string;
  name: string;
  min: number;
  max: number;
  options: string[];
}
export interface Product {
  id: string;
  name: string;
  order: number;
  price: number;
  displayQuantity: number | null;
  description: string;
  ingredients: string[];
  preparation: string[];
  optionGroups: OptionGroup[];
  components: { quantity: number; name: string }[];
}
export interface Category {
  id: string;
  name: string;
  order: number;
  products: Product[];
}
export interface Catalog {
  currency: string;
  categories: Category[];
}
export interface Modification {
  action: "add" | "remove" | "replace";
  ingredient: string;
  from?: string;
  price: number;
  kind?: "ingredient" | "wrap";
}
export interface CartItem {
  id: string;
  productId: string;
  name: string;
  basePrice: number;
  options: Record<string, string>;
  modifications: Modification[];
  subtotal: number;
}
export interface Schedule {
  kind: "asap" | "scheduled";
  time?: string;
  estimateMinutes?: number;
}
export interface Draft {
  mode?: Mode;
  items: CartItem[];
  customerName?: string;
  address?: string;
  zoneId?: string;
  deliveryFee: number;
  reference?: string;
  location?: { latitude: number; longitude: number };
  schedule?: Schedule;
  payment?: "Tarjeta" | "Efectivo";
  allergy?: string;
  humanNotes?: string[];
  total: number;
  reopenedFrom?: string;
}
export interface Order extends Draft {
  id: string;
  number: string;
  phone: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
  version: number;
  locked: boolean;
  reason?: "ingredients" | "closed";
  missing?: { productId: string; ingredient: string }[];
  comment?: string;
  delayNotified?: boolean;
}
export interface Message {
  id: string;
  phone: string;
  role: "customer" | "bot" | "human" | "system";
  text: string;
  createdAt: string;
  delivery?: string;
}
export interface Conversation {
  phone: string;
  stage: string;
  mode: "bot" | "waiting" | "human";
  draft: Draft;
  data: Record<string, any>;
  updatedAt: string;
  lastCustomerAt: string;
  waitingSince?: string;
  orderId?: string;
  version: number;
  simulated?: boolean;
}
export interface Reply {
  text: string;
  choices?: { id: string; title: string; description?: string }[];
}
export interface Incoming {
  id: string;
  phone: string;
  text: string;
  location?: { latitude: number; longitude: number };
  timestamp?: string;
  simulated?: boolean;
}
export interface Intent {
  text?: string;
  action?: string;
  productId?: string;
  quantity?: number;
  modifications?: Modification[];
  allergy?: string;
}
export interface BotContext {
  now: Date;
  settings: Settings;
  orders: Order[];
  history: Message[];
  interpret?: (
    text: string,
    conversation: Conversation,
  ) => Promise<Intent | null>;
}
export interface BotResult {
  conversation: Conversation;
  replies: Reply[];
  submit?: Draft;
  reopenOrderId?: string;
}
export interface DbResult<T = unknown> {
  success: boolean;
  results: T[];
  meta: { changes?: number; last_row_id?: number };
}
export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, any>>(column?: string): Promise<T | null>;
  all<T = Record<string, any>>(): Promise<DbResult<T>>;
  run(): Promise<DbResult>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch<T = unknown>(statements: Statement[]): Promise<DbResult<T>[]>;
  exec(sql: string): Promise<unknown>;
}
export interface Env {
  DB: Database;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  APP_ENV?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  META_ACCESS_TOKEN?: string;
  META_PHONE_NUMBER_ID?: string;
  META_APP_SECRET?: string;
  META_VERIFY_TOKEN?: string;
  META_GRAPH_VERSION?: string;
  META_STATUS_TEMPLATE?: string;
}
export interface Audit {
  id: number;
  actor: string;
  action: string;
  target: string;
  detail: string;
  createdAt: string;
}
