// Requiere en Vercel: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_GOOGLE_CLIENT_ID
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${request.nextUrl.origin}/api/google/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId || "",
      client_secret: clientSecret || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    return NextResponse.json({ error: tokenData.error_description || tokenData.error }, { status: 400 });
  }

  // Redirect back to calendario with token in hash (client-side picks it up)
  const html = `
    <!DOCTYPE html>
    <html>
    <head><title>Conectando Google Calendar...</title></head>
    <body>
      <script>
        localStorage.setItem('google_access_token', '${tokenData.access_token}');
        ${tokenData.refresh_token ? `localStorage.setItem('google_refresh_token', '${tokenData.refresh_token}');` : ""}
        window.location.href = '/leads/calendario?google=connected';
      </script>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
