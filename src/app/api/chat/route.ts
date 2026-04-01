import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

const COMPANY_KEY = "confecciones_boston";

async function buildContext(): Promise<string> {
  const db = getSupabaseAF();

  // Leads summary
  const { data: leads } = await db
    .from("leads")
    .select("nombre, empresa, estado, estado_venta, vendedora, fecha_seguimiento, telefono")
    .order("created_at", { ascending: false })
    .limit(200);

  let leadsContext = "";
  if (leads && leads.length > 0) {
    const prospectos = leads.filter((l) => l.estado === "prospecto" && (l.estado_venta === "activo" || !l.estado_venta));
    const convertidos = leads.filter((l) => l.estado_venta === "convertido");
    const noConvertidos = leads.filter((l) => l.estado_venta === "no_convertido" || l.estado_venta === "perdido");

    const today = new Date().toISOString().split("T")[0];
    const pendientes = prospectos.filter((l) => l.fecha_seguimiento && l.fecha_seguimiento <= today);

    leadsContext = `\n\n## LEADS (${leads.length} total)
- Prospectos activos: ${prospectos.length}
- Convertidos: ${convertidos.length}
- No convertidos: ${noConvertidos.length}
- Pendientes de seguimiento (fecha vencida): ${pendientes.length}

### Prospectos activos:
${prospectos.slice(0, 50).map((l) => `- ${l.nombre} | ${l.empresa || "sin empresa"} | vendedora: ${l.vendedora || "N/A"} | tel: ${l.telefono || "N/A"} | seguimiento: ${l.fecha_seguimiento || "sin fecha"}`).join("\n")}`;
  }

  // CxC summary
  const { data: uploads } = await db
    .from("cxc_uploads")
    .select("id, uploaded_at")
    .eq("company_key", COMPANY_KEY)
    .order("uploaded_at", { ascending: false })
    .limit(1);

  let cxcContext = "";
  if (uploads && uploads.length > 0) {
    const { data: rows } = await db
      .from("cxc_rows")
      .select("nombre, total, d_0_30, d_31_60, d_61_90, d_91_120, d_121_180, d_181_270, d_271_365, d_mas_365")
      .eq("upload_id", uploads[0].id)
      .order("total", { ascending: false });

    if (rows && rows.length > 0) {
      const validRows = rows.filter((r) => {
        const n = (r.nombre || "").trim();
        return n && isNaN(Number(n)) && Number(r.total) > 0;
      });

      const totalDeuda = validRows.reduce((s, r) => s + Number(r.total), 0);
      const vencidos = validRows.filter((r) =>
        Number(r.d_121_180) + Number(r.d_181_270) + Number(r.d_271_365) + Number(r.d_mas_365) > 0
      );
      const vigilancia = validRows.filter((r) => Number(r.d_91_120) > 0 && !vencidos.includes(r));

      const fmt = (n: number) => n.toLocaleString("es-PA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      cxcContext = `\n\n## CUENTAS POR COBRAR (última carga: ${uploads[0].uploaded_at})
- Total clientes con deuda: ${validRows.length}
- Deuda total: $${fmt(totalDeuda)}
- Clientes vencidos (121+ días): ${vencidos.length}
- Clientes en vigilancia (91-120 días): ${vigilancia.length}

### Top 30 clientes por deuda:
${validRows.slice(0, 30).map((r) => {
  const plus90 = Number(r.d_91_120) + Number(r.d_121_180) + Number(r.d_181_270) + Number(r.d_271_365) + Number(r.d_mas_365);
  return `- ${r.nombre} | total: $${fmt(Number(r.total))} | 90+: $${fmt(plus90)}`;
}).join("\n")}`;
    }
  }

  return leadsContext + cxcContext;
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const context = await buildContext();

    const systemPrompt = `Eres el asistente de Brand It Panama y Confecciones Boston. Ayudas con preguntas sobre leads, clientes, cuentas por cobrar, guías de transporte y caja menuda. Responde en español, de forma concisa y profesional.

Tienes acceso a los datos actuales del sistema:
${context}

Usa estos datos para responder preguntas específicas sobre clientes, leads, deudas, seguimientos, etc. Si te preguntan algo que no está en los datos, dilo claramente.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[CHAT] Anthropic error:", response.status, responseText);
      return NextResponse.json({ error: responseText }, { status: response.status });
    }

    const data = JSON.parse(responseText);
    return NextResponse.json({ content: data.content[0].text });

  } catch (error) {
    console.error("[CHAT] Exception:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
