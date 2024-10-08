import { Result } from "typescript-result";
import { poolQuery } from "../database";
import ClientMessage from "../models/ClientMessage";
import File from "../models/File";
import { ResultSetHeader } from "mysql2";
import PendingMessage from "../models/PendingMessage";
import AppError from "../models/AppError";

const FORBIDDEN_ERR = new Error(AppError.Forbidden);

async function messagesGet(userId: number, roomId: number) {
  const messageRes = await poolQuery<ClientMessage[]>(
    `SELECT 
      msgs.id, msgs.room_id, msgs.text, msgs.created,
      users.username, users.profile_image,
      IF(msgs.sender_id = ?, true, false) AS from_self
    FROM (
      SELECT messages.* FROM messages
      INNER JOIN user_rooms ON user_rooms.room_id = messages.room_id
      WHERE user_rooms.user_id = ?
    ) AS msgs
    LEFT JOIN users ON users.id = msgs.sender_id
    WHERE msgs.room_id = ?
    ORDER BY msgs.id DESC;`,
    [userId, userId, roomId],
  );
  if (messageRes.isError()) {
    return messageRes;
  }

  const messages = messageRes.getOrThrow();
  const filePromises = [];

  for (let i = 0; i < messages.length; i++) {
    filePromises.push(
      poolQuery<File[]>(
        `SELECT * FROM files WHERE message_id = ?
        ORDER BY message_id DESC, message_index ASC;`,
        [messages[i].id],
      ),
    );
  }

  const fileResults = await Promise.all(filePromises);

  for (let i = 0, j = 0; i < fileResults.length; i++) {
    if (fileResults[i].isError()) {
      console.warn("Could not get files for a message", fileResults[i]);
      continue;
    }

    const files = fileResults[i].getOrThrow();
    if (!files.length) {
      continue;
    }

    while (j < messages.length) {
      if (messages[j].id === files[0].message_id) {
        messages[j].files = files;

        j++;
        break;
      }

      j++;
    }
  }

  return Result.ok(messages);
}

async function addNewMessage(userId: number, message: PendingMessage) {
  const validationRes = await poolQuery<{ user_id: number }[]>(
    `SELECT user_rooms.user_id FROM rooms
    INNER JOIN user_rooms ON user_rooms.room_id = rooms.id
    WHERE user_rooms.user_id = ? AND rooms.id = ?;`,
    [userId, message.room_id],
  );
  if (validationRes.isError()) {
    return validationRes;
  }

  const isMember = !!validationRes.getOrThrow()[0];
  if (!isMember) {
    return Result.error(FORBIDDEN_ERR);
  }

  const insertRes = await poolQuery<ResultSetHeader>(
    "INSERT INTO messages (room_id, sender_id, text) VALUES (?);",
    [[message.room_id, userId, message.text]],
  );
  if (insertRes.isError()) {
    return insertRes;
  }

  const messageId = insertRes.getOrThrow().insertId;

  const messageRes = await poolQuery<ClientMessage[]>(
    `SELECT 
      messages.id, messages.room_id, messages.text, messages.created, messages.sender_id,
      users.username, users.profile_image
    FROM messages
    INNER JOIN user_rooms ON user_rooms.room_id = messages.room_id
    INNER JOIN users ON users.id = user_rooms.user_id
    WHERE users.id = ? AND messages.id = ?;`,
    [userId, messageId],
  );

  return messageRes.map((m) => {
    m[0].temp_id = message.temp_id;
    return m[0];
  });
}

async function getSystemMessage(messageId: number) {
  const messageRes = await poolQuery<ClientMessage[]>(
    `SELECT messages.id, messages.room_id, messages.text, messages.created, messages.sender_id
    FROM messages WHERE messages.id = ?;`,
    [messageId],
  );

  return messageRes.map((m) => {
    m[0].from_self = false;
    return m[0];
  });
}

export default {
  messagesGet,
  addNewMessage,
  getSystemMessage,
};
