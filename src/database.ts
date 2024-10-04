import mysql from "mysql2/promise";
import { Result } from "./Result";
import { PoolConnection } from "mysql2/promise";

const pool = mysql.createPool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

export async function runTransaction(
  queries: {
    query: string;
    params?: any[];
  }[],
): Promise<Result<void>> {
  const connResult: Result<PoolConnection> = await Result.tryAsync(async () => {
    return await pool.getConnection();
  });
  if (connResult.err()) {
    return connResult;
  }

  const conn = connResult.value();
  const tranResult: Result<void> = await Result.tryAsync(async () => {
    return await conn.beginTransaction();
  });
  if (tranResult.err()) {
    return tranResult;
  }

  const promises = [];

  for (let i = 0; i < queries.length; i++) {
    promises.push(conn.query(queries[i].query, queries[i].params));
  }

  const results = await Promise.allSettled(promises);

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "rejected") {
      const result = results[i] as PromiseRejectedResult;
      return Result.Err(
        "Could not execute one of the queries: " + result.reason,
      );
    }
  }

  const commitResult: Result<void> = await Result.tryAsync(async () => {
    return await conn.commit();
  });
  if (commitResult.err()) {
    return commitResult;
  }

  conn.release();

  return Result.Ok(null as unknown as void);
}

export async function query<T>(
  q: string,
  params?: any[],
): Promise<Result<T[]>> {
  return Result.tryAsync(async () => {
    const [result, _fields] = await pool.query(q, params);
    return result as T[];
  });
}
