import { WebSocket } from "@fastify/websocket";
import { FastifyRequest } from "fastify";
import Message from "../models/Message";
import { poolQuery } from "../database";

const connections = new Map<number, (message: Message) => void>();

export async function wsGet(conn: WebSocket, request: FastifyRequest) {
  console.log(request.userId);
  if (!request.userId) {
    throw new Error("Invalid userId");
  }

  const userId = request.userId;

  conn.on("message", (msg) => {
    console.log("onmessage", msg);
    // conn.send("Hello there " + msg);
  });

  conn.on("open", () => {
    console.log("conn open", userId);
    connections.set(userId, (message: Message) =>
      conn.send(JSON.stringify(message)),
    );
  });

  conn.on("close", () => {
    console.log("conn close", userId);
    connections.delete(userId);
  });
}

export async function sendMessage(message: Message) {
  const userIdsRes = await poolQuery<{ user_id: number }[]>(
    "SELECT user_id FROM user_rooms WHERE room_id = ?;",
    [message.room_id],
  );
  if (userIdsRes.isError()) {
    return userIdsRes;
  }

  const userIds = userIdsRes.getOrThrow();

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[0].user_id;
    const sendMessage = connections.get(userId);
    if (sendMessage) {
      sendMessage(message);
    }
  }
}
