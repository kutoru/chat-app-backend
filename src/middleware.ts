import { validateToken } from "./tokens";
import { FastifyReply, FastifyRequest } from "fastify";

export async function logMiddleware(
  request: FastifyRequest,
  response: FastifyReply,
) {
  console.log(request.method, request.url);
}

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
