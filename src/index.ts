import dotenv from "dotenv";
dotenv.config();

import { FastifyInstance, fastify } from "fastify";
import fastifyCookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { roomsDirectPostSchema, loginSchema } from "./models/fastify-schemas";
import { loginPost, registerPost, usersAllGet, usersGet } from "./routes/users";
import { filesGet, filesMessagePost, filesPfpPost } from "./routes/files";
import {
  roomsDirectPost,
  roomsGet,
  roomsIdGet,
  roomsIdMessagesGet,
} from "./routes/rooms";
import fastifyWebsocket from "@fastify/websocket";
import { wsGet } from "./websocket";
import fastifyMultipart from "@fastify/multipart";
import {
  adminMiddleware,
  authMiddleware,
  logMiddlewarePost,
  logMiddlewarePre,
} from "./middleware";
import { initializeDirectories } from "./utils";

const FRONTEND_URL = process.env.FRONTEND_URL!;
const MAX_FILE_SIZE_IN_MB = Number(process.env.MAX_FILE_SIZE_IN_MB);

initializeDirectories();

declare module "fastify" {
  interface FastifyRequest {
    userId: number | null;
  }
}

const app = fastify();
app.decorateRequest("userId", null);
app.register(fastifyCookie);
app.register(fastifyWebsocket);
app.register(fastifyMultipart, {
  limits: {
    fileSize: 1024 * 1024 * MAX_FILE_SIZE_IN_MB,
  },
});
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
  fastify.post("/files/message/:messageId", filesMessagePost);
  fastify.get("/files/:fileHash", filesGet);

  fastify.get("/rooms", roomsGet);
  fastify.get("/rooms/:id", roomsIdGet);
  fastify.post(
    "/rooms/direct",
    { schema: roomsDirectPostSchema },
    roomsDirectPost,
  );
  fastify.get("/rooms/:id/messages", roomsIdMessagesGet);

  fastify.get("/ws", { websocket: true }, wsGet);

  done();
}

async function adminRoutes(fastify: FastifyInstance, _opts: any) {
  fastify.addHook("preHandler", authMiddleware);
  fastify.addHook("preHandler", adminMiddleware);

  fastify.get("/users/all", usersAllGet);
}

app.addHook("preHandler", logMiddlewarePre);
app.addHook("onSend", logMiddlewarePost);
app.register(publicRoutes);
app.register(privateRoutes);
app.register(adminRoutes);

(async () => {
  await app.listen({ port: 3030, host: "0.0.0.0" });
  console.log("Listening at port", 3030);
})();
