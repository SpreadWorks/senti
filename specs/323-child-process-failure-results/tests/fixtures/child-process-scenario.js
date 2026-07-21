import { writeSync } from "node:fs";

const scenario = process.argv[2];

if (scenario === "signal") {
  writeSync(1, "not ok 1 - signal fixture must not look like an assertion\n");
  process.kill(process.pid, "SIGKILL");
} else if (scenario === "timeout") {
  setTimeout(() => {}, 1000);
} else if (scenario === "max-buffer") {
  writeSync(1, "x".repeat(4096));
} else if (scenario === "assertion-failure") {
  writeSync(1, "not ok 1 - expected assertion failure\n");
  writeSync(2, "assertion detail\n");
  process.exitCode = 3;
} else if (scenario === "passed") {
  writeSync(1, "ok 1 - expected pass\n");
} else {
  writeSync(2, `unknown scenario: ${scenario}\n`);
  process.exitCode = 64;
}
