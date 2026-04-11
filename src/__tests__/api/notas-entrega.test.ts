import { describe, it, expect, vi } from "vitest";

// Mock supabase — POST path: insert -> select -> single
vi.mock("@/lib/supabase-af", () => ({
  getSupabaseAF: () => ({
    from: (table: string) => {
      if (table === "notas_entrega") {
        return {
          select: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: 1, numero: "NE-001", estado: "abierta" },
                  error: null,
                }),
            }),
          }),
        };
      }
      // notas_entrega_items
      return {
        insert: () => Promise.resolve({ error: null }),
      };
    },
  }),
}));

import { POST } from "@/app/api/notas-entrega/route";
import { NextRequest } from "next/server";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/notas-entrega", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/notas-entrega", () => {
  it("creates a nota even without cliente (field is optional in DB insert)", async () => {
    const res = await POST(
      makeRequest({
        fecha: "2026-04-09",
        items: [{ descripcion: "Camiseta", cantidad: 10 }],
      })
    );
    // The route doesn't validate cliente — it passes body.cliente (undefined) through
    // This verifies the route doesn't crash on missing cliente
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.numero).toBe("NE-001");
  });

  it("creates a nota with all fields", async () => {
    const res = await POST(
      makeRequest({
        fecha: "2026-04-09",
        cliente: "Cliente Test",
        atencion: "Juan",
        items: [{ descripcion: "Polo", cantidad: 5, marca: "Boston" }],
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.estado).toBe("abierta");
  });
});
