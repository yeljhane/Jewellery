import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const prismaCli = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");
const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const candidatePorts = Array.from({ length: 11 }, (_, index) => 3000 + index);

async function findRunningApp() {
  for (const port of candidatePorts) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 700);

    try {
      const response = await fetch(`http://127.0.0.1:${port}/login`, {
        signal: controller.signal,
      });
      const html = await response.text();
      if (/Avenue JOAILLERIE/i.test(html)) return port;
    } catch {
      // This port is not serving the app; continue checking the next one.
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

function runNodeCli(entryPoint, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entryPoint, ...args], {
      cwd: projectRoot,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0 || signal === "SIGINT") {
        resolve();
        return;
      }

      reject(new Error(`${path.basename(entryPoint)} exited with code ${code ?? "unknown"}.`));
    });
  });
}

const runningPort = await findRunningApp();

if (runningPort !== null) {
  console.log(`\nAvenue JOAILLERIE is already running at http://localhost:${runningPort}`);
  console.log("Open that address, or stop the existing server with Ctrl+C before starting it again.\n");
} else {
  try {
    await runNodeCli(prismaCli, ["generate"]);
    await runNodeCli(prismaCli, ["db", "push", "--skip-generate"]);
    await runNodeCli(nextCli, ["dev", "--turbopack"]);
  } catch (error) {
    console.error(`\nUnable to start Avenue JOAILLERIE: ${error.message}`);
    process.exitCode = 1;
  }
}
