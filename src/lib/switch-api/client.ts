// Cliente Switch API — Brand It (single-empresa: Confecciones Boston).
//
// Reconstruido desde specs del sprint. Detalles NO negociables heredados del
// doc de fashiongr (validado al centavo en producción para 8 empresas):
//   - Header de auth: 'Authorization: <token>' SIN prefijo "Bearer".
//   - El JWT viene anidado en response.data.token (no en la raíz).
//   - Re-auth automático cuando el API responde codigo '0006' (TOKEN INVALIDO).
//   - parseMonto: Switch formatea montos ≥ $1,000 con coma de miles ("1,234.56").
//     Number() crudo sobre eso da NaN → siempre limpiar la coma primero.
//
// Sin las env vars (SWITCH_BOSTON_API_*), createSwitchClient() tira al construir.
// Eso es esperado hasta que Daniel configure el usuario API dedicado.

const TOKEN_TTL_MS = 60 * 60 * 1000; // 60 min
const SWITCH_CODE_TOKEN_INVALIDO = "0006";
const DEFAULT_PAGE_SIZE = 50;

/**
 * Switch formatea montos con coma de miles. Number("1,234.56") === NaN.
 * Limpiamos la coma antes de convertir. Devuelve 0 si no parsea (lenient).
 */
export function parseMonto(s: string | number | null | undefined): number {
  if (s == null) return 0;
  if (typeof s === "number") return Number.isFinite(s) ? s : 0;
  const n = Number(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

interface SwitchEnv {
  url: string;
  user: string;
  password: string;
}

/** Envelope estándar de respuestas Switch: { codigo, mensaje, data, paginacion }. */
interface SwitchEnvelope<T> {
  codigo?: string;
  mensaje?: string;
  data: T;
  paginacion?: { porPagina?: number; paginaActual?: number; total?: number };
}

export interface SwitchClient {
  /** GET de un endpoint; devuelve el `data` del envelope. */
  get<T = unknown>(endpoint: string, params?: Record<string, string | number>): Promise<T>;
  /** GET paginado; concatena todas las páginas (page size 50 por default). */
  getPaginated<T = unknown>(
    endpoint: string,
    params?: Record<string, string | number>,
    pageSize?: number
  ): Promise<T[]>;
}

function readEnv(): SwitchEnv {
  const url = process.env.SWITCH_BOSTON_API_URL;
  const user = process.env.SWITCH_BOSTON_API_USER;
  const password = process.env.SWITCH_BOSTON_API_PASSWORD;
  if (!url || !user || !password) {
    throw new Error(
      "Switch API: faltan env vars (SWITCH_BOSTON_API_URL / SWITCH_BOSTON_API_USER / SWITCH_BOSTON_API_PASSWORD)"
    );
  }
  return { url: url.replace(/\/+$/, ""), user, password };
}

// Cache de token en memoria (per-instance de la función serverless).
let cachedToken: { token: string; expiresAt: number } | null = null;

async function authenticate(env: SwitchEnv): Promise<string> {
  const res = await fetch(`${env.url}/autenticacion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: env.user, password: env.password }),
  });
  if (!res.ok) {
    throw new Error(`Switch /autenticacion HTTP ${res.status}`);
  }
  const json = (await res.json()) as SwitchEnvelope<{ token?: string }>;
  const token = json?.data?.token;
  if (!token || typeof token !== "string") {
    throw new Error("Switch /autenticacion: token no encontrado en response.data.token");
  }
  cachedToken = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return token;
}

async function getToken(env: SwitchEnv, forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  return authenticate(env);
}

async function request<T>(
  env: SwitchEnv,
  endpoint: string,
  params: Record<string, string | number> | undefined,
  retryOnTokenInvalido = true
): Promise<SwitchEnvelope<T>> {
  const token = await getToken(env);
  const url = new URL(`${env.url}${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    // Authorization SIN "Bearer " — requisito del API de Switch.
    headers: { Authorization: token, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Switch GET ${endpoint} HTTP ${res.status}`);
  }
  const json = (await res.json()) as SwitchEnvelope<T>;

  // 0006 = TOKEN INVALIDO → re-auth una vez y reintentar.
  if (json?.codigo === SWITCH_CODE_TOKEN_INVALIDO && retryOnTokenInvalido) {
    await authenticate(env); // fuerza refresh del cache
    return request<T>(env, endpoint, params, false);
  }
  return json;
}

/**
 * Extrae el array de filas del `data` del envelope. Los list endpoints de Switch
 * anidan el array dentro de un objeto: `{ data: { facturas: [...] } }`. Buscamos
 * por claves conocidas y, si no, la primera propiedad array.
 */
function extractRows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of ["facturas", "notasCredito", "notasDebito", "recibos", "clientes", "lista", "items", "resultado", "data"]) {
      if (Array.isArray(o[k])) return o[k] as T[];
    }
    for (const v of Object.values(o)) {
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

const MAX_PAGES = 1000; // backstop anti-loop-infinito

async function getPaginated<T>(
  env: SwitchEnv,
  endpoint: string,
  params: Record<string, string | number> = {},
  pageSize = DEFAULT_PAGE_SIZE
): Promise<T[]> {
  // Switch pagina con porPagina (tamaño) + paginaActual (1-indexed). Corta por
  // acumulado real vs paginacion.total — NO por page*size: el API capa porPagina
  // en silencio, así que asumir "cada página trajo pageSize" truncaría.
  const all: T[] = [];
  let total = 0;
  let traidos = 0;

  for (let paginaActual = 1; paginaActual <= MAX_PAGES; paginaActual++) {
    const resp = await request<unknown>(env, endpoint, { ...params, porPagina: pageSize, paginaActual });
    if (paginaActual === 1) total = Number(resp.paginacion?.total ?? 0);

    const rows = extractRows<T>(resp.data);
    if (rows.length === 0) break; // página vacía → fin

    all.push(...rows);
    traidos += rows.length;

    if (total > 0 && traidos >= total) break; // ya trajimos todo lo reportado
  }
  return all;
}

/**
 * Construye el cliente Switch para Boston. Sin parámetro de empresa
 * (single-empresa). Tira si faltan las env vars.
 */
export function createSwitchClient(): SwitchClient {
  const env = readEnv();
  return {
    get: <T = unknown>(endpoint: string, params?: Record<string, string | number>) =>
      request<T>(env, endpoint, params).then((r) => r.data),
    getPaginated: <T = unknown>(
      endpoint: string,
      params?: Record<string, string | number>,
      pageSize?: number
    ) => getPaginated<T>(env, endpoint, params, pageSize),
  };
}
