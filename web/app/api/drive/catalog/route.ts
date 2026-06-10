import { NextRequest, NextResponse } from "next/server";
import { driveCatalog, driveConfigured } from "@/lib/drive";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!driveConfigured()) {
      return NextResponse.json(
        { detail: "Google Drive não conectado. Configure GOOGLE_SERVICE_ACCOUNT_JSON." },
        { status: 400 }
      );
    }
    const { folder_url, max_files } = (await req.json()) as { folder_url: string; max_files?: number };
    const items = await driveCatalog(folder_url, max_files ?? 120);
    return NextResponse.json({ configured: true, mode: "google_drive_api", items });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
