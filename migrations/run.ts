import dotenv from "dotenv";
dotenv.config();

import { getTransactionConnection } from "../src/database";
import fs from "fs/promises";
import { Result } from "typescript-result";

async function executeSqlFile(fileName: string) {
  const file = (await fs.readFile(fileName)).toString();

  const queries = file
    .split(";")
    .filter((v) => v.trim().length > 0)
    .map((v) => {
      return { query: v };
    });

  const connResult = await getTransactionConnection();
  if (connResult.isError()) {
    return connResult;
  }

  const conn = connResult.getOrThrow();
  const promises = [];

  for (let i = 0; i < queries.length; i++) {
    promises.push(conn.query(queries[i].query));
  }

  const results = await Promise.allSettled(promises);

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "rejected") {
      const errorResult = results[i] as PromiseRejectedResult;

      return Result.error(
        new Error(
          "Could not execute one of the queries: " + errorResult.reason,
        ),
      );
    }
  }

  return await conn.commit();
}

(async () => {
  console.log("DB update started");

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
    const downRes = await executeSqlFile("./migrations/down.sql");
    console.log("Down result:", downRes);

    if (downRes.isError()) {
      process.exit(1);
    }
  }

  if (up) {
    const upRes = await executeSqlFile("./migrations/up.sql");
    console.log("Up result:", upRes);

    if (upRes.isError()) {
      process.exit(1);
    }
  }

  console.log("DB udpate successfully ended");
  process.exit(0);
})();
