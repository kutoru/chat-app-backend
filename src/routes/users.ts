import { FastifyReply, FastifyRequest } from "fastify";
import users from "../logic/users";
import { handleError } from "../utils";

const TOKEN_TTL = Number(process.env.TOKEN_TTL);

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
    sameSite: "none",
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

export async function usersGet(
  request: FastifyRequest,
  response: FastifyReply,
) {
  const result = await users.usersGet(request.userId!);
  console.log("usersGet res:", result);

  if (result.isError()) {
    return handleError(response, result.error);
  }

  return response.send({ data: result.getOrThrow() });
}
