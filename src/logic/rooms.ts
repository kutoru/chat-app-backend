import { Result } from "typescript-result";
import { getTransactionConnection, poolQuery } from "../database";
import AppError from "../models/AppError";
import Room from "../models/Room";
import { ResultSetHeader } from "mysql2/promise";

const USER_DOES_NOT_EXIST_ERR = new Error(AppError.UserDoesNotExist);
const SELF_CHAT_ERR = new Error(AppError.SelfChatIsNotSupported);

async function createDirectChat(data: {
  fromUserId: number;
  toUsername: string;
}) {
  // getting user id from the username

  const usernameResult = await poolQuery<{ id: number }[]>(
    "SELECT id FROM users WHERE username = ?",
    [data.toUsername],
  );
  if (usernameResult.isError()) {
    return usernameResult;
  }

  const toUserId = usernameResult.getOrThrow()[0]?.id;
  if (!toUserId) {
    return Result.error(USER_DOES_NOT_EXIST_ERR);
  }

  if (data.fromUserId === toUserId) {
    return Result.error(SELF_CHAT_ERR);
  }

  // check if the room already exists, and send it out if it does

  const roomResult = await poolQuery<
    (Room & { user_id?: number; profile_image?: string })[]
  >(
    `SELECT rooms.*, users.id AS user_id, users.profile_image AS profile_image FROM rooms
    LEFT JOIN user_rooms ON rooms.id = user_rooms.room_id
    LEFT JOIN users ON users.id = user_rooms.user_id
    WHERE rooms.type = 'direct' AND (users.id = ? OR users.id = ?);`,
    [data.fromUserId, toUserId],
  );
  if (roomResult.isError()) {
    return roomResult;
  }

  const rooms = roomResult.getOrThrow();
  if (rooms.length > 0) {
    if (rooms.length !== 2) {
      return Result.error(
        new Error("Fetched a direct room, but didn't get two users"),
      );
    }

    const room = rooms.find((r) => r.user_id! !== data.fromUserId)!;

    room.cover_image = room.profile_image;
    room.user_id = undefined;
    room.profile_image = undefined;

    return Result.ok(room as Room);
  }

  // otherwise, crate a new room

  const connRes = await getTransactionConnection();
  if (connRes.isError()) {
    return connRes;
  }

  const conn = connRes.getOrThrow();

  const roomInsertRes = await conn.query<ResultSetHeader>(
    "INSERT INTO rooms (type) VALUES ('direct');",
  );
  if (roomInsertRes.isError()) {
    return roomInsertRes;
  }

  const roomId = roomInsertRes.getOrThrow().insertId;

  const userInsertRes = await conn.query(
    "INSERT INTO user_rooms (user_id, room_id) VALUES (?, ?), (?, ?);",
    [data.fromUserId, roomId, toUserId, roomId],
  );
  if (userInsertRes.isError()) {
    return userInsertRes;
  }

  const messageInsertRes = await conn.query(
    "INSERT INTO messages (room_id, text) VALUES (?, 'Chat has been created');",
    [roomId],
  );
  if (messageInsertRes.isError()) {
    return messageInsertRes;
  }

  const commitRes = await conn.commit();
  if (commitRes.isError()) {
    return commitRes;
  }

  // send the new room

  const newRoomResult = await poolQuery<
    (Room & { user_id?: number; profile_image?: string })[]
  >(
    `SELECT rooms.*, users.id AS user_id, users.profile_image AS profile_image FROM rooms
    LEFT JOIN user_rooms ON rooms.id = user_rooms.room_id
    LEFT JOIN users ON users.id = user_rooms.user_id
    WHERE rooms.id = ? AND (users.id = ? OR users.id = ?);`,
    [roomId, data.fromUserId, toUserId],
  );
  if (newRoomResult.isError()) {
    return newRoomResult;
  }

  const newRooms = newRoomResult.getOrThrow();
  if (newRooms.length !== 2) {
    return Result.error(
      new Error("Created a new direct room, but didn't get two users"),
    );
  }

  const newRoom = newRooms.find((r) => r.user_id! !== data.fromUserId)!;

  newRoom.cover_image = newRoom.profile_image;
  newRoom.user_id = undefined;
  newRoom.profile_image = undefined;

  return Result.ok(newRoom as Room);
}

export default { createDirectChat };
