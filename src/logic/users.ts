import { Result } from "typescript-result";
import { poolQuery } from "../database";
import User from "../models/User";
import bcrypt from "bcrypt";
import { generateNewToken } from "../tokens";
import AppError from "../models/AppError";
import { ResultSetHeader } from "mysql2";

const SALT_ROUNDS = 10;

const INVALID_CREDS_ERR = new Error(AppError.InvalidCredentials);
const USER_EXISTS_ERR = new Error(AppError.UserExists);
const INVALID_CREDS_FORMAT_ERR = new Error(AppError.InvalidCredentialsFormat);
const PASS_REPEATED_ERR = new Error(AppError.NewPasswordRepeated);

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

  const hashedPass = await bcrypt.hash(data.password, SALT_ROUNDS);

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

async function passPost(
  userId: number,
  oldPassword: string,
  newPassword: string,
) {
  if (newPassword.length < 4 || newPassword.length > 255) {
    return Result.error(INVALID_CREDS_FORMAT_ERR);
  }

  const oldResult = await poolQuery<{ id: number; password: string }[]>(
    "SELECT id, password FROM users WHERE id = ?;",
    [userId],
  );
  if (oldResult.isError()) {
    return oldResult;
  }

  const oldUser = oldResult.getOrThrow()[0];

  const isMatch = await bcrypt.compare(oldPassword, oldUser.password);
  if (!isMatch) {
    return Result.error(INVALID_CREDS_ERR);
  }

  const newIsMatch = await bcrypt.compare(newPassword, oldUser.password);
  if (newIsMatch) {
    return Result.error(PASS_REPEATED_ERR);
  }

  const hashedPass = await bcrypt.hash(newPassword, SALT_ROUNDS);

  const updateRes = await poolQuery(
    "UPDATE users SET password = ? WHERE id = ?;",
    [hashedPass, userId],
  );
  if (updateRes.isError()) {
    return updateRes;
  }

  return Result.ok();
}

async function usersGet(userId: number) {
  const userResult = await poolQuery<Omit<User, "id" | "password" | "role">[]>(
    "SELECT username, profile_image, created FROM users WHERE id = ?;",
    [userId],
  );

  return userResult.map((v) => v[0]);
}

async function isAdmin(userId: number) {
  const roleRes = await poolQuery<{ role: "user" | "admin" }[]>(
    "SELECT role FROM users WHERE id = ?;",
    [userId],
  );

  return roleRes.map((v) => v[0].role === "admin");
}

async function usersAllGet() {
  const userRes = await poolQuery<{ id: number; username: string }>(
    "SELECT id, username FROM users;",
  );

  return userRes;
}

export default {
  login,
  register,
  passPost,
  usersGet,
  isAdmin,
  usersAllGet,
};
