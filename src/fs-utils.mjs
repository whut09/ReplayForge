import { access, mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

export async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function readTextIfExists(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readFile(filePath, "utf8");
}

export async function readJsonIfExists(filePath) {
  const raw = await readTextIfExists(filePath);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw);
}

export async function listFiles(root, options = {}) {
  const maxFiles = options.maxFiles ?? 80;
  const ignore = new Set([".git", "node_modules", "dist", "build", ".next", "coverage", "assets"]);
  const files = [];

  async function walk(current) {
    if (files.length >= maxFiles) {
      return;
    }

    const entries = await readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (files.length >= maxFiles || ignore.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(current, entry.name);
      const relative = path.relative(root, fullPath).replaceAll("\\", "/");
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const info = await stat(fullPath);
        if (info.size <= 200_000) {
          files.push(relative);
        }
      }
    }
  }

  await walk(root);
  return files;
}
