import { Result } from "typescript-result";
import { poolQuery } from "../database";
import LoginBody from "../models/LoginBody";
import User from "../models/User";
import bcrypt from "bcrypt";
import generateNewToken from "../tokens";
import AppError from "../models/AppError";
import { ResultSetHeader } from "mysql2";

const INVALID_CREDS_ERR = new Error(AppError.InvalidCredentials);
const USER_EXISTS_ERR = new Error(AppError.UserExists);
const INVALID_CREDS_FORMAT_ERR = new Error(AppError.InvalidCredentialsFormat);

async function login(body: LoginBody) {
  const res = await poolQuery<User[]>(
    `SELECT * FROM users WHERE username = ?;`,
    [body.username],
  );
  if (res.isError()) {
    return res;
  }

  const user = res.getOrThrow()[0];
  if (!user) {
    return Result.error(INVALID_CREDS_ERR);
  }

  const isMatch = await bcrypt.compare(body.password, user.password);
  if (!isMatch) {
    return Result.error(INVALID_CREDS_ERR);
  }

  const token = generateNewToken(user.id);

  return Result.ok(token);
}

async function register(body: LoginBody) {
  if (body.username.length < 4 || body.password.length < 4) {
    return Result.error(INVALID_CREDS_FORMAT_ERR);
  }

  const usernameRes = await poolQuery<{ username: string }[]>(
    `SELECT username FROM users WHERE username = ?;`,
    [body.username],
  );
  if (usernameRes.isError()) {
    return usernameRes;
  }

  const existingUsername = usernameRes.getOrThrow()[0];
  if (existingUsername) {
    return Result.error(USER_EXISTS_ERR);
  }

  const hashedPass = await bcrypt.hash(body.password, 10);

  const insertRes = await poolQuery<ResultSetHeader>(
    `INSERT INTO users (username, password) VALUES (?, ?);`,
    [body.username, hashedPass],
  );
  if (insertRes.isError()) {
    return insertRes;
  }

  const userId = insertRes.getOrThrow().insertId;
  const token = generateNewToken(userId);

  return Result.ok(token);
}

export default {
  login,
  register,
};
