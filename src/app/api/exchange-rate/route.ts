import { NextRequest, NextResponse } from "next/server";
import { fetchExchangeRate } from "@/lib/currency";

export async function GET(req: NextRequest) {
  const from = String(req.nextUrl.searchParams.get("from") || "USD").toUpperCase();
  const to = String(req.nextUrl.searchParams.get("to") || "INR").toUpperCase();

  const result = await fetchExchangeRate(from, to);
  return NextResponse.json({
    from,
    to,
    rate: result.rate,
    source: result.source,
    date: result.date ?? null,
  });
}
