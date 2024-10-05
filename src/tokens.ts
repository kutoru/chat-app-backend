import jwt from "jsonwebtoken";
import { Result } from "typescript-result";
import JwtPayload from "./models/JwtPayload";

const TOKEN_TTL = Number(process.env.TOKEN_TTL);
const TOKEN_SECRET = process.env.TOKEN_SECRET!;

export async function generateNewToken(userId: number) {
  if (!userId || typeof userId !== "number") {
    return Result.error(new Error("Invalid userId for a new token: " + userId));
  }

  const payload: JwtPayload = {
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL,
    userId: userId,
  };

  const result: Result<string, Error> = await new Promise((resolve, reject) => {
    jwt.sign(payload, TOKEN_SECRET, (error, token) => {
      if (error) {
        resolve(Result.error(error));
      } else {
        resolve(Result.ok(token!));
      }
    });
  });

  return result;
}

export async function validateToken(
  token: string,
): Promise<Result<JwtPayload, Error>> {
  return await new Promise((resolve, reject) => {
    jwt.verify(token, TOKEN_SECRET, (error, payload) => {
      if (error) {
        resolve(Result.error(error));
      } else {
        resolve(Result.ok(payload as JwtPayload));
      }
    });
  });
}
