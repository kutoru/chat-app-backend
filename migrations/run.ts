import dotenv from "dotenv";
dotenv.config();

import {
  TransactionConnection,
  getTransactionConnection,
} from "../src/database";
import fs from "fs/promises";
import { Result } from "typescript-result";

async function executeSqlFile(
  conn: TransactionConnection,
  fileName: string,
): Promise<Result<void, Error>> {
  const file = (await fs.readFile(fileName)).toString();
  const queries = file.split(";").filter((v) => v.trim().length > 0);
  const promises = [];

  for (let i = 0; i < queries.length; i++) {
    promises.push(conn.query(queries[i]));
  }

  const results = await Promise.all(promises);

  for (let i = 0; i < results.length; i++) {
    if (results[i].isError()) {
      const errorMessage = results[i].error!.message;

      return Result.error(
        new Error("Could not execute one of the queries: " + errorMessage),
      );
    }
  }

  return Result.ok();
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

  const connRes = await getTransactionConnection();
  if (connRes.isError()) {
    console.log(connRes);
    process.exit(1);
  }

  const conn = connRes.getOrThrow();

  if (down) {
    const downRes = await executeSqlFile(conn, "./migrations/down.sql");
    if (downRes.isError()) {
      console.log(downRes);
      process.exit(1);
    }
  }

  if (up) {
    const upRes = await executeSqlFile(conn, "./migrations/up.sql");
    if (upRes.isError()) {
      console.log(upRes);
      process.exit(1);
    }
  }

  const commitRes = await conn.commit();
  if (commitRes.isError()) {
    console.log(commitRes);
    process.exit(1);
  }

  console.log("DB udpate successfully ended");
  process.exit(0);
})();
