import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { auth } from "@/lib/auth";
import { assertSqliteFile, getSqliteDbPath } from "@/lib/db-path";

export const runtime = "nodejs";

const MAX_BYTES = 80 * 1024 * 1024; // 80 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "OWNER" && role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose a .db backup file." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Backup file too large (max 80 MB)." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const tmp = path.join(os.tmpdir(), `avenue-restore-${Date.now()}.db`);
    fs.writeFileSync(tmp, buf);
    try {
      assertSqliteFile(tmp);
    } catch (e) {
      fs.unlinkSync(tmp);
      const message = e instanceof Error ? e.message : "Invalid file";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const dbPath = getSqliteDbPath();
    const bak = `${dbPath}.pre-restore.bak`;
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, bak);
    }
    fs.copyFileSync(tmp, dbPath);
    fs.unlinkSync(tmp);

    return NextResponse.json({
      ok: true,
      message:
        "Database restored. Restart the app (stop and run START.bat / npm run dev) to reload Prisma connections.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Restore failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
