import { mkdir, writeFile } from "fs/promises";
import path from "path";

export { isDiamondProduct, stockSortRank } from "@/lib/product-helpers";

const PRODUCT_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "products");
const LOGO_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "company");

async function saveImageFile(
  file: File | null,
  dir: string,
  urlPrefix: string
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }
  if (file.size > 4 * 1024 * 1024) {
    throw new Error("Image must be under 4MB");
  }

  await mkdir(dir, { recursive: true });
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext) ? ext : "png";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);
  return `${urlPrefix}/${filename}`;
}

export async function saveProductImage(file: File | null): Promise<string | null> {
  return saveImageFile(file, PRODUCT_UPLOAD_DIR, "/uploads/products");
}

export async function saveCompanyLogo(file: File | null): Promise<string | null> {
  return saveImageFile(file, LOGO_UPLOAD_DIR, "/uploads/company");
}
