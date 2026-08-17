import { NextResponse } from "next/server";
import fs from "fs";
import { auth } from "@/lib/auth";
import { assertSqliteFile, getSqliteDbPath } from "@/lib/db-path";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "OWNER" && role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const dbPath = getSqliteDbPath();
    assertSqliteFile(dbPath);
      const data = fs.readFileSync(dbPath);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="avenue-backup-${stamp}.db"`,
        "Content-Length": String(data.length),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
