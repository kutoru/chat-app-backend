import { FastifyReply, FastifyRequest } from "fastify";
import users from "../logic/users";
import { handleError } from "../utils";
import { validateToken } from "../tokens";

const TOKEN_TTL = Number(process.env.TOKEN_TTL);

export async function authMiddleware(
  request: FastifyRequest,
  response: FastifyReply,
) {
  const tokenRes = request.cookies.t
    ? await validateToken(request.cookies.t)
    : undefined;

  console.log("Request cookies:", request.cookies, tokenRes);

  if (!tokenRes || tokenRes?.isError()) {
    return response.code(401).send({ message: "Invalid auth token" });
  }

  request.userId = tokenRes.getOrThrow().userId;
}

export async function adminMiddleware(
  request: FastifyRequest,
  response: FastifyReply,
) {
  // call the db and check if this user is an admin
  //   const result = await users.checkAdmin(request.userId!);
  //   console.log("Admin res:", request.userId, result);

  return response.code(403).send({ message: "Forbidden" });
}

export async function loginPost(
  request: FastifyRequest,
  response: FastifyReply,
) {
  const result = await users.login(request.body as any);
  console.log("Login res:", result);

  if (result.isError()) {
    return handleError(response, result.error);
  }

  const cookieValue = result.getOrThrow();
  response.setCookie("t", cookieValue, {
    maxAge: TOKEN_TTL,
    path: "/",
    httpOnly: true,
    sameSite: false,
  });

  return response.send({});
}

export async function registerPost(
  request: FastifyRequest,
  response: FastifyReply,
) {
  const result = await users.register(request.body as any);
  console.log("Register res:", result);

  if (result.isError()) {
    return handleError(response, result.error);
  }

  const cookieValue = result.getOrThrow();
  response.setCookie("t", cookieValue, {
    maxAge: TOKEN_TTL,
    path: "/",
    httpOnly: true,
    sameSite: "none",
  });

  return response.send({});
}
