import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const executable = process.platform === "win32" ? "lhci.cmd" : "lhci";
const command = path.resolve("node_modules", ".bin", executable);
const child = spawn(command, ["autorun", "--config=./lighthouserc.cjs"], {
  stdio: "inherit",
  env: {
    ...process.env,
    CHROME_PATH: chromium.executablePath()
  }
});

child.on("error", (error) => {
  console.error(`[lighthouse] Failed to start: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[lighthouse] Terminated by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
