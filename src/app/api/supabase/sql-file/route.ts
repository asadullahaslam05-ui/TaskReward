import { NextRequest } from "next/server";
import { readFile, readdir } from "fs/promises";
import path from "path";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("file");
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    if (!filename) {
      let files: string[];
      try { files = await readdir(migrationsDir); } catch { return apiSuccess({ files: [], count: 0 }); }
      const sqlFiles = files.filter(f => f.endsWith(".sql")).filter(f => !f.includes("SETUP_COMPLETE")).sort();
      const fileList = [];
      for (const f of sqlFiles) {
        const content = await readFile(path.join(migrationsDir, f), "utf-8");
        const match = f.match(/^(\d+)/);
        fileList.push({ filename: f, number: match ? parseInt(match[1]) : 999, title: f.replace(/^\d+_/, "").replace(/\.sql$/, "").replace(/_/g, " "), size: content.length, lineCount: content.split("\n").length });
      }
      fileList.sort((a, b) => a.number - b.number);
      return apiSuccess({ files: fileList, count: fileList.length });
    }
    if (!/^[\w\-]+\.sql$/.test(filename) || filename.includes("..") || filename.includes("/")) {
      return apiError("Invalid filename", 400);
    }
    const filePath = path.join(migrationsDir, filename);
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(migrationsDir);
    if (!resolvedPath.startsWith(resolvedDir + path.sep) && resolvedPath !== resolvedDir) {
      return apiError("Access denied", 403);
    }
    let content: string;
    try { content = await readFile(filePath, "utf-8"); } catch { return apiError(`File not found: ${filename}`, 404); }
    return apiSuccess({ filename, content, size: content.length, lineCount: content.split("\n").length, mimeType: "application/sql" });
  } catch (error) {
    return handleApiError(error);
  }
}
