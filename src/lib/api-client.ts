// Helper de fetch para el cliente (P1). Centraliza el patrón correcto de las
// mutaciones/lecturas del browser:
//   - try/catch de red → mensaje humano (no "TypeError: Failed to fetch").
//   - verifica res.ok y extrae {error} del body → lanza ApiError con ese mensaje.
//   - devuelve el JSON parseado en éxito.
// El llamador hace try/catch, muestra el mensaje por toast y NO cierra el form si
// falla (así no se pierden los datos escritos).

export class ApiError extends Error {}

interface SendOpts {
  method?: string;
  body?: unknown;
  /** Por default no cachea (mutaciones y datos frescos). */
  cache?: RequestCache;
}

export async function apiSend<T = unknown>(url: string, opts: SendOpts = {}): Promise<T> {
  const hasBody = opts.body !== undefined;
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (hasBody ? "POST" : "GET"),
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(opts.body) : undefined,
      cache: opts.cache ?? "no-store",
    });
  } catch {
    throw new ApiError("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const serverMsg =
      data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `No se pudo completar la acción (error ${res.status}). Intenta de nuevo.`;
    throw new ApiError(serverMsg);
  }

  return data as T;
}

/** Mensaje legible de cualquier error atrapado (ApiError o genérico). */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Ocurrió un error. Intenta de nuevo.";
}
