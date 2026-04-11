import { describe, it, expect, vi } from "vitest";

// Mock supabase before importing the route
vi.mock("@/lib/supabase-af", () => ({
  getSupabaseAF: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

import { POST } from "@/app/api/auth/route";
import { NextRequest } from "next/server";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/auth", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth", () => {
  it("returns 400 when password is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Contraseña requerida");
  });

  it("returns 400 when password is empty string", async () => {
    const res = await POST(makeRequest({ password: "" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Contraseña requerida");
  });

  it("returns 401 when password is incorrect (no user found)", async () => {
    const res = await POST(makeRequest({ password: "wrongpass" }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Contraseña incorrecta");
  });
});
