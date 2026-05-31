"use client";

import { useEffect, useState } from "react";

// "Datos al [última fecha de documento] · sincronizado [synced_at]" — hora Panamá.
type Frescura = { data_al: string | null; synced_at: string | null };

const TZ = "America/Panama";

function fmtFecha(d: string | null): string | null {
  if (!d) return null;
  // d es DATE "YYYY-MM-DD": anclar a mediodía Panamá para no correr de día.
  const dt = new Date(`${d}T12:00:00-05:00`);
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("es-PA", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
}

function fmtSync(s: string | null): string | null {
  if (!s) return null;
  const dt = new Date(s);
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleString("es-PA", { timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function FrescuraBadge({ endpoint }: { endpoint: string }) {
  const [f, setF] = useState<Frescura | null>(null);

  useEffect(() => {
    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setF(d as Frescura); })
      .catch(() => {});
  }, [endpoint]);

  if (!f || (!f.data_al && !f.synced_at)) return null;
  const dataAl = fmtFecha(f.data_al);
  const sync = fmtSync(f.synced_at);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <span className="w-2 h-2 rounded-full bg-green-500" />
      {dataAl && <>Datos al {dataAl}</>}
      {sync && <span className="text-gray-400">· sincronizado {sync}</span>}
    </span>
  );
}
