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
        <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="w-full max-w-md">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-orange-50 flex items-center justify-center text-3xl">
              ⚠️
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
              Algo salió mal
            </h1>
            <p className="text-gray-500 mb-8">
              Tuvimos un problema cargando esta página
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => reset()}
                className="bg-black text-white font-semibold px-6 py-3 rounded-xl text-sm min-h-[44px] active:opacity-80 transition-opacity"
              >
                Reintentar
              </button>
              <a
                href="/"
                className="bg-white border border-gray-200 text-black font-semibold px-6 py-3 rounded-xl text-sm min-h-[44px] flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                Volver al inicio
              </a>
            </div>

            {error?.digest && (
              <p className="mt-10 text-[11px] text-gray-300">
                Código: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
