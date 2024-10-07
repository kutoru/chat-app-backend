import dotenv from "dotenv";
dotenv.config();

import {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  fastify,
} from "fastify";
import fastifyCookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { roomsDirectPostSchema, loginSchema } from "./models/fastify-schemas";
import { loginPost, registerPost, usersGet } from "./routes/users";
import { filesGet, filesPfpPost } from "./routes/files";
import { roomsDirectPost } from "./routes/rooms";
import fastifyWebsocket from "@fastify/websocket";
import { wsGet } from "./websocket";
import fastifyMultipart from "@fastify/multipart";
import { adminMiddleware, authMiddleware, logMiddleware } from "./middleware";

const FRONTEND_URL = process.env.FRONTEND_URL!;

declare module "fastify" {
  interface FastifyRequest {
    userId: number | null;
  }
}

const app = fastify();
app.decorateRequest("userId", null);
app.register(fastifyCookie);
app.register(fastifyWebsocket);
app.register(fastifyMultipart);
app.register(cors, {
  origin: [FRONTEND_URL],
  allowedHeaders: ["Content-Type"],
  credentials: true,
});

async function publicRoutes(fastify: FastifyInstance, _opts: any) {
  fastify.post("/login", { schema: loginSchema }, loginPost);
  fastify.post("/register", { schema: loginSchema }, registerPost);
}

async function privateRoutes(
  fastify: FastifyInstance,
  _opts: any,
  done: (err?: Error) => void,
) {
  fastify.addHook("preHandler", authMiddleware);

  fastify.get("/users", usersGet);

  fastify.post("/files/pfp", filesPfpPost);
  fastify.get("/files/:fileHash", filesGet);

  fastify.post(
    "/rooms/direct",
    { schema: roomsDirectPostSchema },
    roomsDirectPost,
  );

  fastify.get("/ws", { websocket: true }, wsGet);

  done();
}

async function adminRoutes(fastify: FastifyInstance, _opts: any) {
  fastify.addHook("preHandler", authMiddleware);
  fastify.addHook("preHandler", adminMiddleware);

  fastify.get(
    "/users/all",
    async (request: FastifyRequest, response: FastifyReply) => {
      return response.send({ data: "Some users data" });
    },
  );
}

app.addHook("preHandler", logMiddleware);
app.register(publicRoutes);
app.register(privateRoutes);
app.register(adminRoutes);

(async () => {
  const res = await app.listen({ port: 3030, host: "0.0.0.0" });
  console.log("Listening at", res);
})();
