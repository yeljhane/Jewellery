import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { processOfflineSale, type OfflineSaleEnvelope } from "@/lib/offline-pos-server";

export async function POST(request: Request) {
  try {
    await requireRole(["OWNER", "MANAGER", "SALES"]);
    const envelope = (await request.json()) as OfflineSaleEnvelope;
    if (!envelope?.clientTxnId || !envelope?.queuedAt || !envelope?.fields) {
      return NextResponse.json({ status: "FAILED", message: "Invalid offline transaction." }, { status: 400 });
    }
    const result = await processOfflineSale(envelope);
    return NextResponse.json(result, { status: result.status === "FAILED" ? 422 : result.status === "CONFLICT" ? 409 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synchronization failed.";
    const unauthorized = message === "Unauthorized" || message === "Forbidden";
    return NextResponse.json({ status: "FAILED", message }, { status: unauthorized ? 401 : 500 });
  }
}
