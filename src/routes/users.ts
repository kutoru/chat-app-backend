import { FastifyReply, FastifyRequest } from "fastify";
import users from "../logic/users";
import { handleError } from "../utils";

type SameSite = undefined | "lax" | "none" | "strict" | boolean;

const TOKEN_TTL = Number(process.env.TOKEN_TTL);
const COOKIE_PARAMS = {
  maxAge: TOKEN_TTL,
  path: "/",
  httpOnly: true,
  sameSite: "none" as SameSite,
};

export async function loginPost(
  request: FastifyRequest,
  response: FastifyReply,
) {
  const result = await users.login(request.body as any);
  if (result.isError()) {
    return handleError(response, result.error);
  }

  const cookieValue = result.getOrThrow();
  response.setCookie("t", cookieValue, COOKIE_PARAMS);

  return response.send({});
}

export async function registerPost(
  request: FastifyRequest,
  response: FastifyReply,
) {
  const result = await users.register(request.body as any);
  if (result.isError()) {
    return handleError(response, result.error);
  }

  const cookieValue = result.getOrThrow();
  response.setCookie("t", cookieValue, COOKIE_PARAMS);

  return response.send({});
}

export async function passPost(
  request: FastifyRequest<{
    Body: { oldPassword: string; newPassword: string };
  }>,
  response: FastifyReply,
) {
  const result = await users.passPost(
    request.userId!,
    request.body.oldPassword,
    request.body.newPassword,
  );
  if (result.isError()) {
    return handleError(response, result.error);
  }

  return response.send({});
}

export async function logoutGet(
  request: FastifyRequest,
  response: FastifyReply,
) {
  response.setCookie("t", "", { maxAge: 0 });
  return response.send({});
}

export async function usersGet(
  request: FastifyRequest,
  response: FastifyReply,
) {
  const result = await users.usersGet(request.userId!);
  if (result.isError()) {
    return handleError(response, result.error);
  }

  return response.send({ data: result.getOrThrow() });
}

export async function usersAllGet(
  request: FastifyRequest,
  response: FastifyReply,
) {
  const result = await users.usersAllGet();
  if (result.isError()) {
    return handleError(response, result.error);
  }

  return response.send({ data: result.getOrThrow() });
}
