import { Result } from "typescript-result";
import { getTransactionConnection, poolQuery } from "../database";
import AppError from "../models/AppError";
import Room from "../models/Room";
import { ResultSetHeader } from "mysql2/promise";
import RoomPreview from "../models/RoomPreview";

const USER_DOES_NOT_EXIST_ERR = new Error(AppError.UserDoesNotExist);
const SELF_CHAT_ERR = new Error(AppError.SelfChatIsNotSupported);

async function roomsGet(userId: number) {
  const directRoomRes = await poolQuery<RoomPreview[]>(
    `SELECT
      rooms.id, users.username AS name, users.profile_image AS cover_image, rooms.type, rooms.created, msg.created AS message_created, msg.text AS message_text
    FROM rooms
    LEFT JOIN user_rooms ON user_rooms.room_id = rooms.id
    LEFT JOIN (
      SELECT * FROM messages WHERE messages.id IN (
        SELECT MAX(messages.id) FROM messages GROUP BY messages.room_id
      )
    ) AS msg ON msg.room_id = rooms.id
    LEFT JOIN users ON users.id != ? AND users.id IN (
      SELECT user_id FROM user_rooms WHERE user_rooms.room_id = rooms.id
    )
    WHERE rooms.type = 'direct' AND user_rooms.user_id = ?
    ORDER BY rooms.created DESC;`,
    [userId, userId],
  );
  if (directRoomRes.isError()) {
    return directRoomRes;
  }

  const groupRoomRes = await poolQuery<RoomPreview[]>(
    `SELECT
      rooms.id, rooms.name, rooms.cover_image, rooms.type, rooms.created, msg.created AS message_created, msg.text AS message_text
    FROM rooms
    LEFT JOIN user_rooms ON user_rooms.room_id = rooms.id
    LEFT JOIN (
      SELECT * FROM messages WHERE messages.id IN (
        SELECT MAX(messages.id) FROM messages GROUP BY messages.room_id
      )
    ) AS msg ON msg.room_id = rooms.id
    WHERE rooms.type = 'group' AND user_rooms.user_id = ?
    ORDER BY rooms.created DESC;`,
    [userId, userId],
  );
  if (groupRoomRes.isError()) {
    return groupRoomRes;
  }

  const directRooms = directRoomRes.getOrThrow();
  const groupRooms = groupRoomRes.getOrThrow();

  const rooms = directRooms
    .concat(groupRooms)
    .sort((a, b) => b.message_created - a.message_created);

  return Result.ok(rooms);
}

async function createDirectChat(
  fromUserId: number,
  toUsername: string,
): Promise<Result<Room, Error>> {
  // getting user id from the username

  const usernameResult = await poolQuery<{ id: number }[]>(
    "SELECT id FROM users WHERE username = ?",
    [toUsername],
  );
  if (usernameResult.isError()) {
    return usernameResult;
  }

  const toUserId = usernameResult.getOrThrow()[0]?.id;
  if (!toUserId) {
    return Result.error(USER_DOES_NOT_EXIST_ERR);
  }

  if (fromUserId === toUserId) {
    return Result.error(SELF_CHAT_ERR);
  }

  // check if the room already exists, and send it out if it does

  const roomResult = await getDirectRoom(fromUserId, toUserId);
  if (roomResult.isError() || roomResult.value !== undefined) {
    //@ts-ignore
    return roomResult;
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
    [fromUserId, roomId, toUserId, roomId],
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

  const newRoomRes = await getDirectRoom(fromUserId, toUserId, roomId);
  if (newRoomRes.isError()) {
    return newRoomRes;
  }

  if (newRoomRes.value === undefined) {
    return Result.error(new Error("Inserted the room but could not get it"));
  }

  //@ts-ignore
  return newRoomRes;
}

async function getDirectRoom(
  fromUserId: number,
  toUserId: number,
  roomId: number | undefined = undefined,
): Promise<Result<Room | undefined, Error>> {
  let roomField;
  let params;

  if (roomId) {
    roomField = "id";
    params = [roomId, fromUserId, toUserId];
  } else {
    roomField = "type";
    params = ["direct", fromUserId, toUserId];
  }

  const roomResult = await poolQuery<
    (Room & { user_id?: number; user_name?: string; profile_image?: string })[]
  >(
    `SELECT
      rooms.*, users.id AS user_id, users.username, users.profile_image
    FROM rooms
    LEFT JOIN user_rooms ON rooms.id = user_rooms.room_id
    LEFT JOIN users ON users.id = user_rooms.user_id
    WHERE rooms.${roomField} = ? AND (users.id = ? OR users.id = ?);`,
    params,
  );
  if (roomResult.isError()) {
    return roomResult;
  }

  const rooms = roomResult.getOrThrow();
  if (rooms.length === 0) {
    return Result.ok(undefined);
  }

  if (rooms.length !== 2) {
    return Result.error(new Error("Didn't get two users for a direct room"));
  }

  const room = rooms.find((r) => r.user_id === toUserId)!;

  room.cover_image = room.profile_image;
  room.profile_image = undefined;
  room.name = room.user_name;
  room.user_name = undefined;
  room.user_id = undefined;

  return Result.ok(room);
}

export default { createDirectChat, roomsGet };
