import { NextResponse } from "next/server";
import { Resend } from "resend";

interface ContactRequestBody {
  name: string;
  email: string;
  msg: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ContactRequestBody>;
  const { name, email, msg } = body;

  if (!name?.trim() || !email?.trim() || !msg?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Faltan campos requeridos" },
      { status: 400 }
    );
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Arcade Vault <onboarding@resend.dev>",
      to: process.env.CONTACT_EMAIL_TO!,
      replyTo: email,
      subject: `[Arcade Vault] Nuevo mensaje de ${name}`,
      text: msg,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error al enviar correo de contacto:", error);
    return NextResponse.json(
      { ok: false, error: "Error al enviar el correo" },
      { status: 500 }
    );
  }
}
