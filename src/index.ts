import dotenv from "dotenv";
dotenv.config();

import fastify, { FastifyReply } from "fastify";
import fastifyCookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { loginSchema } from "./models/fastify-schemas";
import LoginBody from "./models/LoginBody";
import auth from "./routes/auth";
import AppError from "./models/AppError";
import { validateToken } from "./tokens";

const TOKEN_TTL = Number(process.env.TOKEN_TTL);
const FRONTEND_URL = process.env.FRONTEND_URL!;

const app = fastify();
app.register(fastifyCookie);
app.register(cors, {
  origin: [FRONTEND_URL],
  allowedHeaders: ["Content-Type"],
  credentials: true,
});

app.addHook("onRequest", async (req, res) => {
  console.log(req.method, req.url);

  const tokenRes = req.cookies.t
    ? await validateToken(req.cookies.t)
    : undefined;

  console.log("Req cookies:", req.cookies, tokenRes);
});

app.get("/", async (request, response) => {
  return { some_key: "some_val" };
});

app.post("/login", { schema: loginSchema }, async (request, response) => {
  const result = await auth.login(request.body as LoginBody);
  console.log("Login res:", result);

  if (result.isError()) {
    handleError(response, result.error);
    return;
  }

  const cookieValue = result.getOrThrow();
  response.setCookie("t", cookieValue, {
    maxAge: TOKEN_TTL,
    path: "/",
    httpOnly: true,
    sameSite: false,
  });

  response.send({});
});

app.post("/register", { schema: loginSchema }, async (request, response) => {
  const result = await auth.register(request.body as LoginBody);
  console.log("Register res:", result);

  if (result.isError()) {
    handleError(response, result.error);
    return;
  }

  const cookieValue = result.getOrThrow();
  response.setCookie("t", cookieValue, {
    maxAge: TOKEN_TTL,
    path: "/",
    httpOnly: true,
    sameSite: "none",
  });

  response.send({});
});

function handleError(response: FastifyReply, error: Error) {
  let code = 500;
  let message = "Server error";

  switch (error.message) {
    case AppError.InvalidCredentials:
    case AppError.InvalidCredentialsFormat:
    case AppError.UserExists:
      code = 400;
      message = error.message;
      break;
  }

  response.code(code).send({ message });
}

(async () => {
  const res = await app.listen({ port: 3030, host: "0.0.0.0" });
  console.log("Listening at", res);
})();
