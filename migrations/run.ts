import dotenv from "dotenv";
dotenv.config();

import { runTransaction } from "../src/database";
import fs from "fs/promises";

async function executeFile(fileName: string) {
  const file = (await fs.readFile(fileName)).toString();

  const queries = file
    .split(";")
    .filter((v) => v.trim().length > 0)
    .map((v) => {
      return { query: v };
    });

  return await runTransaction(queries);
}

(async () => {
  console.log("DB update start");

  let up = false;
  let down = false;

  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];

    if (arg === "--up") {
      up = true;
    } else if (arg === "--down") {
      down = true;
    } else if (arg === "--reset") {
      up = true;
      down = true;
    }
  }

  if (down) {
    const downRes = await executeFile("./migrations/down.sql");
    console.log("Down result:", downRes);

    if (downRes.err()) {
      process.exit(0);
    }
  }

  if (up) {
    const upRes = await executeFile("./migrations/up.sql");
    console.log("Up result:", upRes);

    if (upRes.err()) {
      process.exit(0);
    }
  }

  console.log("DB udpate end");
  process.exit(0);
})();
