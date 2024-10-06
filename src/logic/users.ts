import { Result } from "typescript-result";
import { poolQuery } from "../database";
import User from "../models/User";
import bcrypt from "bcrypt";
import { generateNewToken } from "../tokens";
import AppError from "../models/AppError";
import { ResultSetHeader } from "mysql2";

const INVALID_CREDS_ERR = new Error(AppError.InvalidCredentials);
const USER_EXISTS_ERR = new Error(AppError.UserExists);
const INVALID_CREDS_FORMAT_ERR = new Error(AppError.InvalidCredentialsFormat);

async function login(data: { username: string; password: string }) {
  const res = await poolQuery<User[]>(
    `SELECT * FROM users WHERE username = ?;`,
    [data.username],
  );
  if (res.isError()) {
    return res;
  }

  const user = res.getOrThrow()[0];
  if (!user) {
    return Result.error(INVALID_CREDS_ERR);
  }

  const isMatch = await bcrypt.compare(data.password, user.password);
  if (!isMatch) {
    return Result.error(INVALID_CREDS_ERR);
  }

  const tokenRes = await generateNewToken(user.id);
  return tokenRes;
}

async function register(data: { username: string; password: string }) {
  if (
    data.username.length < 4 ||
    data.username.length > 255 ||
    data.password.length < 4 ||
    data.password.length > 255
  ) {
    return Result.error(INVALID_CREDS_FORMAT_ERR);
  }

  const usernameRes = await poolQuery<{ username: string }[]>(
    `SELECT username FROM users WHERE username = ?;`,
    [data.username],
  );
  if (usernameRes.isError()) {
    return usernameRes;
  }

  const existingUsername = usernameRes.getOrThrow()[0];
  if (existingUsername) {
    return Result.error(USER_EXISTS_ERR);
  }

  const hashedPass = await bcrypt.hash(data.password, 10);

  const insertRes = await poolQuery<ResultSetHeader>(
    `INSERT INTO users (username, password) VALUES (?, ?);`,
    [data.username, hashedPass],
  );
  if (insertRes.isError()) {
    return insertRes;
  }

  const userId = insertRes.getOrThrow().insertId;

  const tokenRes = await generateNewToken(userId);
  return tokenRes;
}

export default {
  login,
  register,
};
