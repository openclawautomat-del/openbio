// Copies static assets next to the standalone server so it can serve them.
import { cpSync, existsSync, mkdirSync } from "node:fs";
const sa = ".next/standalone";
if (!existsSync(sa)) process.exit(0);
mkdirSync(`${sa}/.next`, { recursive: true });
cpSync(".next/static", `${sa}/.next/static`, { recursive: true });
if (existsSync("public")) cpSync("public", `${sa}/public`, { recursive: true });
if (existsSync("migrations")) cpSync("migrations", `${sa}/migrations`, { recursive: true });
console.log("Standalone bundle ready: node server.js");
