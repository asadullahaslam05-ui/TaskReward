import { NextRequest } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    let files: string[];
    try {
      files = await readdir(migrationsDir);
    } catch {
      return apiSuccess({ migrations: [], count: 0, totalSize: 0 });
    }
    const sqlFiles = files.filter(f => f.endsWith(".sql")).filter(f => !f.includes("SETUP_COMPLETE")).sort();
    const migrations: { filename: string; number: number; title: string; content: string; size: number; lineCount: number }[] = [];
    for (const filename of sqlFiles) {
      const filePath = path.join(migrationsDir, filename);
      const content = await readFile(filePath, "utf-8");
      const match = filename.match(/^(\d+)/);
      const number = match ? parseInt(match[1]) : 999;
      const title = filename.replace(/^\d+_/, "").replace(/\.sql$/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      migrations.push({ filename, number, title, content, size: content.length, lineCount: content.split("\n").length });
    }
    migrations.sort((a, b) => a.number - b.number);
    return apiSuccess({ migrations, count: migrations.length, totalSize: migrations.reduce((s, m) => s + m.size, 0) });
  } catch (error) {
    return handleApiError(error);
  }
}
