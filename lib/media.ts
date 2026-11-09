import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Build-time media lookup (server only). Content JSON names the file it expects (e.g. "media/colleges/law.jpg");
 * if the team has dropped that file — or the same name with another image extension — into public/, we use it.
 * Otherwise components fall back to the labelled placeholder. No code change is needed when media arrives.
 */
const PUBLIC = path.join(process.cwd(), "public");
const IMAGE_EXTS = [".jpg", ".jpeg", ".webp", ".avif", ".png"];

/** "/media/…" URL of the real file, or null if it hasn't been supplied yet. */
export function findMedia(rel: string | undefined): string | null {
  if (!rel) return null;
  if (existsSync(path.join(PUBLIC, rel))) return `/${rel}`;
  const ext = path.extname(rel);
  if (!IMAGE_EXTS.includes(ext.toLowerCase())) return null;
  const base = rel.slice(0, -ext.length);
  for (const alt of IMAGE_EXTS) if (existsSync(path.join(PUBLIC, base + alt))) return `/${base + alt}`;
  return null;
}
