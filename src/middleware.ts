import users from "./logic/users";
import { validateToken } from "./tokens";
import { FastifyReply, FastifyRequest } from "fastify";
import { handleError } from "./utils";

export async function logMiddlewarePre(
  request: FastifyRequest,
  response: FastifyReply,
) {
  console.log(request.method, request.url);
}

export async function logMiddlewarePost(
  request: FastifyRequest,
  response: FastifyReply,
) {
  console.log("Response:", response.statusCode);
}

export async function authMiddleware(
  request: FastifyRequest,
  response: FastifyReply,
) {
  const tokenRes = request.cookies.t
    ? await validateToken(request.cookies.t)
    : undefined;

  if (!tokenRes || tokenRes?.isError()) {
    return response.code(401).send({ message: "Invalid auth token" });
  }

  request.userId = tokenRes.getOrThrow().userId;
}

export async function adminMiddleware(
  request: FastifyRequest,
  response: FastifyReply,
) {
  const result = await users.isAdmin(request.userId!);
  if (result.isError()) {
    return handleError(response, result.error);
  }

  const authorized = result.getOrThrow();
  if (!authorized) {
    return response.code(403).send({ message: "Forbidden" });
  }
}
