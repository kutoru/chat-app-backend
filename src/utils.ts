import { FastifyReply } from "fastify";
import AppError from "./models/AppError";
import fsSync from "fs";

export function handleError(response: FastifyReply, error: Error) {
  let code = 500;
  let message = "Server error";

  switch (error.message) {
    case AppError.InvalidCredentials:
    case AppError.InvalidCredentialsFormat:
    case AppError.UserExists:
    case AppError.UserDoesNotExist:
    case AppError.InvalidFileType:
    case AppError.SelfChatIsNotSupported:
    case AppError.InvalidFields:
    case AppError.IsAlreadyMember:
    case AppError.NewPasswordRepeated:
      code = 400;
      message = error.message;
      break;
    case AppError.Forbidden:
      code = 403;
      message = error.message;
      break;
    default:
      console.log("Unknown error:", error);
  }

  return response.code(code).send({ message });
}

export function initializeDirectories() {
  fsSync.mkdirSync("./files/temp", { recursive: true });
}

export function parseNumber(val: string) {
  try {
    return Number(val);
  } catch (error) {
    return undefined;
  }
}
