import { WebSocket } from "@fastify/websocket";
import { FastifyRequest } from "fastify";
import { poolQuery } from "../database";
import ClientMessage from "../models/ClientMessage";
import messages from "../logic/messages";
import PendingMessage from "../models/PendingMessage";
import { Result } from "typescript-result";
import FileInfo from "../models/FileInfo";

const connections = new Map<number, (message: WebSocketMessage) => void>();

type WebSocketMessage = {
  type: "message" | "files";
  data: ClientMessage | FileInfo[];
};

function isPendingMessage(message: any): message is PendingMessage {
  return (
    typeof message.temp_id === "number" &&
    typeof message.room_id === "number" &&
    typeof message.text === "string"
  );
}

export async function wsGet(conn: WebSocket, request: FastifyRequest) {
  if (!request.userId) {
    throw new Error("Invalid userId");
  }

  const userId = request.userId;

  conn.on("message", async (rawMsg) => {
    const msg = rawMsg.toString();

    if (msg === "ack") {
      console.log("Socket connected", userId);
      connections.set(userId, (message) => {
        conn.send(JSON.stringify(message));
      });

      return;
    }

    try {
      const pendingMessage = JSON.parse(msg);
      if (!isPendingMessage(pendingMessage)) {
        return;
      }

      const result = await messages.addNewMessage(userId, pendingMessage);
      if (result.isError()) {
        // TODO: return the error to the client perhaps
        console.warn("Could not save a message", result);
        return;
      }

      const message = result.getOrThrow();
      const sendRes = await sendMessage(message);
      if (sendRes.isError()) {
        console.warn("Could not send a message", sendRes);
      }
    } catch (error) {
      console.warn(error);
    }
  });

  conn.on("close", () => {
    console.log("Socket disconnected", userId);
    connections.delete(userId);
  });
}

async function sendMessage(message: ClientMessage) {
  const userIdsRes = await poolQuery<{ user_id: number }[]>(
    "SELECT user_id FROM user_rooms WHERE room_id = ?;",
    [message.room_id],
  );
  if (userIdsRes.isError()) {
    return userIdsRes;
  }

  const userIds = userIdsRes.getOrThrow();

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i].user_id;
    const sendToUser = connections.get(userId);
    if (sendToUser) {
      message.from_self = message.sender_id === userId;
      sendToUser({ type: "message", data: message });
    }
  }

  return Result.ok();
}

async function sendFiles(files: FileInfo[]) {
  const userIdsRes = await poolQuery<{ user_id: number }[]>(
    `SELECT user_rooms.user_id
    FROM messages
    INNER JOIN user_rooms ON user_rooms.room_id = messages.room_id
    WHERE messages.id = ?;`,
    [files[0].message_id],
  );
  if (userIdsRes.isError()) {
    return userIdsRes;
  }

  const userIds = userIdsRes.getOrThrow();

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i].user_id;
    const sendToUser = connections.get(userId);
    if (sendToUser) {
      sendToUser({ type: "files", data: files });
    }
  }

  return Result.ok();
}

export default {
  sendMessage,
  sendFiles,
};
