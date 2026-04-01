import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Eres el asistente de Brand It Panama y Confecciones Boston. Ayudas con preguntas sobre leads, clientes, cuentas por cobrar, guías de transporte y caja menuda. Responde en español, de forma concisa y profesional.`;

type Message = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  const { messages } = (await request.json()) as { messages: Message[] };

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  return NextResponse.json({ reply: text });
}
