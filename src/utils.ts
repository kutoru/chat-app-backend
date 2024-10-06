import { FastifyReply } from "fastify";
import AppError from "./models/AppError";

export function handleError(response: FastifyReply, error: Error) {
  let code = 500;
  let message = "Server error";

  switch (error.message) {
    case AppError.InvalidCredentials:
    case AppError.InvalidCredentialsFormat:
    case AppError.UserExists:
    case AppError.UserDoesNotExist:
      code = 400;
      message = error.message;
      break;
  }

  return response.code(code).send({ message });
}
