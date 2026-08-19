import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const sourceStatic = path.join(root, ".next", "static");
const targetStatic = path.join(root, ".next", "standalone", ".next", "static");

const sourcePublic = path.join(root, "public");
const targetPublic = path.join(root, ".next", "standalone", "public");

function copyDir(source, target) {
  if (!fs.existsSync(source)) {
    console.error(`Source directory not found: ${source}`);
    process.exit(1);
  }

  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, {
    recursive: true,
    force: true,
  });

  console.log(`Copied: ${source} -> ${target}`);
}

copyDir(sourceStatic, targetStatic);
copyDir(sourcePublic, targetPublic);

console.log("Standalone assets copied successfully.");