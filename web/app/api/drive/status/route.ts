import { NextResponse } from "next/server";
import { driveConfigured, driveServiceAccountEmail } from "@/lib/drive";

export async function GET() {
  const configured = driveConfigured();
  return NextResponse.json({
    configured,
    mode: configured ? "google_drive_api" : "not_configured",
    service_account_email: driveServiceAccountEmail(),
    setup_hint: configured
      ? "Drive API conectada. Compartilhe as pastas dos clientes com a service account."
      : "Configure GOOGLE_SERVICE_ACCOUNT_JSON para conectar o Google Drive.",
  });
}
