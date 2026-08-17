import fs from "fs";
import path from "path";

/** Resolve SQLite file path from DATABASE_URL (supports file:./dev.db relative to prisma/). */
export function getSqliteDbPath(): string {
  const url = process.env.DATABASE_URL || "file:./dev.db";
  const raw = url.replace(/^file:/, "");
  if (path.isAbsolute(raw)) return raw;
  // Prisma resolves relative paths against the prisma directory
  return path.resolve(process.cwd(), "prisma", raw.replace(/^\.\//, ""));
}

export function assertSqliteFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error("Database file not found.");
  }
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(16);
  fs.readSync(fd, buf, 0, 16, 0);
  fs.closeSync(fd);
  const header = buf.toString("utf8");
  if (!header.startsWith("SQLite format 3")) {
    throw new Error("Not a valid SQLite database file.");
  }
}
