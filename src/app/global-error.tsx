"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="bg-white text-black">
        <div className="min-h-screen max-w-full overflow-x-auto p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            Error en la aplicación
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Pantalla de diagnóstico — detalle del error real
          </p>

          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
              Mensaje
            </p>
            <p className="text-lg sm:text-xl font-semibold text-red-600 break-words">
              {error?.message || "(sin mensaje)"}
            </p>
          </div>

          {error?.digest && (
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                Digest
              </p>
              <p className="font-mono text-sm break-all">{error.digest}</p>
            </div>
          )}

          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
              Stack
            </p>
            <pre className="font-mono text-xs whitespace-pre-wrap break-words max-w-full overflow-x-auto bg-gray-50 border border-gray-200 rounded-lg p-4">
              {error?.stack || "(sin stack)"}
            </pre>
          </div>

          <button
            onClick={() => reset()}
            className="bg-black text-white font-semibold px-6 py-3 rounded-xl text-sm min-h-[44px] active:opacity-80 transition-opacity"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
