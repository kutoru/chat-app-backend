import { Pool, PoolConnection, createPool } from "mysql2/promise";
import { Result } from "typescript-result";

const pool = createPool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

export async function poolQuery<T>(q: string, params?: any[]) {
  return await genericQuery<T>(pool, q, params);
}

async function genericQuery<T>(
  conn: PoolConnection | Pool,
  q: string,
  params?: any[],
): Promise<Result<T[], Error>> {
  return Result.try(async () => {
    const [result, _fields] = await conn.query(q, params);
    console.log("DB query res:", result, _fields);
    return result as T[];
  });
}

class TransactionConnection {
  private _released = false;
  constructor(private readonly _conn: PoolConnection) {}

  async query<T>(q: string, params?: any[]) {
    if (this._released) {
      throw new Error("Tried to use a released TransactionConnection");
    }

    return await genericQuery<T>(this._conn, q, params);
  }

  async commit(): Promise<Result<void, Error>> {
    const commitResult = await Result.try(async () => {
      return await this._conn.commit();
    });
    if (commitResult.isError()) {
      return commitResult;
    }

    this._conn.release();
    this._released = true;

    return Result.ok();
  }
}

export async function getTransactionConnection(): Promise<
  Result<TransactionConnection, Error>
> {
  const connResult = await Result.try(async () => {
    return await pool.getConnection();
  });
  if (connResult.isError()) {
    return connResult;
  }

  const conn = connResult.getOrThrow();

  const tranResult = await Result.try(async () => {
    return await conn.beginTransaction();
  });
  if (tranResult.isError()) {
    return tranResult;
  }

  return Result.ok(new TransactionConnection(conn));
}
