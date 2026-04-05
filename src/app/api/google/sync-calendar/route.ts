// Requiere en Vercel: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_GOOGLE_CLIENT_ID
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const accessToken = request.headers.get("x-google-token");

  if (!accessToken) {
    return NextResponse.json({ error: "No Google access token" }, { status: 401 });
  }

  const body = await request.json();
  const { leadId, nombre, fecha, nota } = body;

  if (!nombre || !fecha) {
    return NextResponse.json({ error: "nombre and fecha are required" }, { status: 400 });
  }

  // Create event in Google Calendar
  const event = {
    summary: `Seguimiento: ${nombre}`,
    description: nota || `Seguimiento de lead: ${nombre}`,
    start: {
      date: fecha,
    },
    end: {
      date: fecha,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 60 },
      ],
    },
  };

  const gcalRes = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  const gcalData = await gcalRes.json();

  if (!gcalRes.ok) {
    return NextResponse.json(
      { error: gcalData.error?.message || "Error creating event" },
      { status: gcalRes.status }
    );
  }

  return NextResponse.json({ success: true, eventId: gcalData.id });
}
