import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email;
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { error } = await resend.contacts.create({
    email: email.trim(),
    audienceId: process.env.RESEND_AUDIENCE_ID!,
  });
  if (error) {
    console.error("Resend contact creation failed:", error);
    return NextResponse.json({ error: "Could not subscribe" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
