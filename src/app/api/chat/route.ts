import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

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
        system: "Eres el asistente de Brand It Panama y Confecciones Boston. Ayudas con preguntas sobre leads, clientes, cuentas por cobrar, guías de transporte y caja menuda. Responde en español, de forma concisa y profesional.",
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
