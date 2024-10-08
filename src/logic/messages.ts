import { Result } from "typescript-result";
import { poolQuery } from "../database";
import ClientMessage from "../models/ClientMessage";
import File from "../models/File";

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

export default {
  messagesGet,
};
