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

async function roomsDirectPost(
  fromUserId: number,
  toUsername: string,
): Promise<Result<Room, Error>> {
  // getting user id from the username

  const usernameResult = await poolQuery<{ id: number }[]>(
    "SELECT id FROM users WHERE username = ?;",
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

  const roomResult = await getDirectRoomFromUserId(fromUserId, toUserId);
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
    "INSERT INTO user_rooms (user_id, room_id) VALUES (?), (?);",
    [
      [fromUserId, roomId],
      [toUserId, roomId],
    ],
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

  // TODO: send the message that has been inserted to all relevant websocket clients

  // send the new room

  const newRoomRes = await getDirectRoomFromRoomId(roomId, toUserId);
  if (newRoomRes.isError()) {
    return newRoomRes;
  }

  if (newRoomRes.value === undefined) {
    return Result.error(
      new Error("Inserted a direct room but could not get it"),
    );
  }

  //@ts-ignore
  return newRoomRes;
}

async function getDirectRoomFromUserId(
  fromUserId: number,
  toUserId: number,
): Promise<Result<Room | undefined, Error>> {
  const roomResult = await poolQuery<
    (Room & { username?: string; profile_image?: string })[]
  >(
    `SELECT
      filtered_rooms.*, users.username, users.profile_image
    FROM (
      SELECT rooms.* FROM rooms
      LEFT JOIN user_rooms ON user_rooms.room_id = rooms.id
      WHERE rooms.type = 'direct' AND user_rooms.user_id = ?
    ) AS filtered_rooms
    LEFT JOIN user_rooms ON user_rooms.room_id = filtered_rooms.id
    LEFT JOIN users ON users.id = user_rooms.user_id
    WHERE users.id = ?;`,
    [fromUserId, toUserId],
  );

  if (roomResult.isError()) {
    return roomResult;
  }

  const room = roomResult.getOrThrow()[0];
  if (!room) {
    return Result.ok(room);
  }

  room.cover_image = room.profile_image;
  room.profile_image = undefined;
  room.name = room.username;
  room.username = undefined;

  return Result.ok(room);
}

async function getDirectRoomFromRoomId(
  roomId: number,
  toUserId: number,
): Promise<Result<Room | undefined, Error>> {
  const roomResult = await poolQuery<
    (Room & { username?: string; profile_image?: string })[]
  >(
    `SELECT
      rooms.*, users.username, users.profile_image
    FROM rooms
    LEFT JOIN user_rooms ON user_rooms.room_id = rooms.id
    LEFT JOIN users ON users.id = user_rooms.user_id
    WHERE rooms.id = ? AND users.id = ?;`,
    [roomId, toUserId],
  );

  if (roomResult.isError()) {
    return roomResult;
  }

  const room = roomResult.getOrThrow()[0];
  if (!room) {
    return Result.ok(room);
  }

  room.cover_image = room.profile_image;
  room.profile_image = undefined;
  room.name = room.username;
  room.username = undefined;

  return Result.ok(room);
}

export default { roomsDirectPost, roomsGet };
