import { Result } from "typescript-result";
import { getTransactionConnection, poolQuery } from "../database";
import AppError from "../models/AppError";
import Room from "../models/Room";
import { ResultSetHeader } from "mysql2/promise";
import RoomPreview from "../models/RoomPreview";
import messages from "./messages";
import websocket from "../websocket";

const USER_DOES_NOT_EXIST_ERR = new Error(AppError.UserDoesNotExist);
const SELF_CHAT_ERR = new Error(AppError.SelfChatIsNotSupported);
const INVALID_FIELDS_ERR = new Error(AppError.InvalidFields);

async function roomsGet(userId: number) {
  const roomsRes = await poolQuery<RoomPreview[]>(
    `SELECT
      fil_rooms.id, fil_rooms.type, fil_rooms.created,
      display_data.name, display_data.cover_image,
      msg.created AS message_created, msg.text AS message_text

    # getting user rooms

    FROM (
      SELECT rooms.* FROM rooms
      LEFT JOIN user_rooms ON user_rooms.room_id = rooms.id
      WHERE user_rooms.user_id = ?
    ) AS fil_rooms

    # getting the latest message for each room

    INNER JOIN (
      SELECT * FROM messages WHERE messages.id IN (
        SELECT MAX(messages.id) FROM messages GROUP BY messages.room_id
      )
    ) AS msg ON msg.room_id = fil_rooms.id

    # if the room type is 'group' (or if it is 'direct')
    # getting room name (or the other user's name)
    # and the room cover (or the other user's pfp)

    INNER JOIN (
      (
        SELECT rooms.id AS room_id, rooms.name, rooms.cover_image
        FROM rooms WHERE rooms.type = 'group'
      ) UNION (
        SELECT user_rooms.room_id, users.username AS name, users.profile_image AS cover_image
        FROM rooms
        INNER JOIN user_rooms ON user_rooms.room_id = rooms.id
        INNER JOIN users ON users.id = user_rooms.user_id
        WHERE rooms.type = 'direct' AND users.id != ?
      )
    ) AS display_data ON display_data.room_id = fil_rooms.id

    ORDER BY message_created DESC;`,
    [userId, userId],
  );

  return roomsRes;
}

async function roomsIdGet(userId: number, roomId: number) {
  const roomResult = await poolQuery<RoomPreview[]>(
    `SELECT
      fil_rooms.id, fil_rooms.type, fil_rooms.created,
      display_data.name, display_data.cover_image,
      msg.created AS message_created, msg.text AS message_text

    FROM (
      SELECT rooms.* FROM rooms
      LEFT JOIN user_rooms ON user_rooms.room_id = rooms.id
      WHERE rooms.id = ? AND user_rooms.user_id = ?
    ) AS fil_rooms

    INNER JOIN (
      SELECT * FROM messages WHERE messages.id IN (
        SELECT MAX(messages.id) FROM messages GROUP BY messages.room_id
      )
    ) AS msg ON msg.room_id = fil_rooms.id

    INNER JOIN (
        (SELECT rooms.id AS room_id, rooms.name, rooms.cover_image
        FROM rooms
        WHERE rooms.type = 'group')
      UNION
        (SELECT user_rooms.room_id, users.username AS name, users.profile_image AS cover_image
        FROM rooms
        INNER JOIN user_rooms ON user_rooms.room_id = rooms.id
        INNER JOIN users ON users.id = user_rooms.user_id
        WHERE rooms.type = 'direct' AND users.id != ?)
    ) AS display_data ON display_data.room_id = fil_rooms.id;`,
    [roomId, userId, userId],
  );

  return roomResult.map((v) => v[0]);
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

  const messageInsertRes = await conn.query<ResultSetHeader>(
    "INSERT INTO messages (room_id, text) VALUES (?, 'Chat has been created');",
    [roomId],
  );
  if (messageInsertRes.isError()) {
    return messageInsertRes;
  }

  const messageId = messageInsertRes.getOrThrow().insertId;

  const commitRes = await conn.commit();
  if (commitRes.isError()) {
    return commitRes;
  }

  // send the system message to all relevant clients

  const messageRes = await messages.getSystemMessage(messageId);
  if (messageRes.isError()) {
    console.warn("Could not get a new system message", messageRes);
  } else {
    const newMessage = messageRes.getOrThrow();

    const sendRes = await websocket.sendMessage(newMessage);
    if (sendRes.isError()) {
      console.warn("Could not send a new system message", sendRes);
    }
  }

  // respond with the new room

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
    INNER JOIN user_rooms ON user_rooms.room_id = filtered_rooms.id
    INNER JOIN users ON users.id = user_rooms.user_id
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
    INNER JOIN user_rooms ON user_rooms.room_id = rooms.id
    INNER JOIN users ON users.id = user_rooms.user_id
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

async function roomsGroupPost(
  userId: number,
  groupName: string,
): Promise<Result<Room, Error>> {
  if (groupName.length < 4 || groupName.length > 255) {
    return Result.error(INVALID_FIELDS_ERR);
  }

  // creating the room

  const connRes = await getTransactionConnection();
  if (connRes.isError()) {
    return connRes;
  }

  const conn = connRes.getOrThrow();

  const roomInsertRes = await conn.query<ResultSetHeader>(
    "INSERT INTO rooms (name, type) VALUES (?, 'group');",
    [groupName],
  );
  if (roomInsertRes.isError()) {
    return roomInsertRes;
  }

  const roomId = roomInsertRes.getOrThrow().insertId;

  const userInsertRes = await conn.query(
    "INSERT INTO user_rooms (user_id, room_id) VALUES (?);",
    [[userId, roomId]],
  );
  if (userInsertRes.isError()) {
    return userInsertRes;
  }

  const messageInsertRes = await conn.query<ResultSetHeader>(
    "INSERT INTO messages (room_id, text) VALUES (?, 'Chat has been created');",
    [roomId],
  );
  if (messageInsertRes.isError()) {
    return messageInsertRes;
  }

  const messageId = messageInsertRes.getOrThrow().insertId;

  const commitRes = await conn.commit();
  if (commitRes.isError()) {
    return commitRes;
  }

  // sending the system message

  const messageRes = await messages.getSystemMessage(messageId);
  if (messageRes.isError()) {
    console.warn("Could not get a new system message", messageRes);
  } else {
    const newMessage = messageRes.getOrThrow();

    const sendRes = await websocket.sendMessage(newMessage);
    if (sendRes.isError()) {
      console.warn("Could not send a new system message", sendRes);
    }
  }

  // respond with the new room

  const newRoomRes = await poolQuery<Room[]>(
    "SELECT * FROM rooms WHERE id = ?;",
    [roomId],
  );
  if (newRoomRes.isError()) {
    return newRoomRes;
  }

  const room = newRoomRes.getOrThrow()[0];
  if (!room) {
    return Result.error(
      new Error("Inserted a direct room but could not get it"),
    );
  }

  return Result.ok(room);
}

export default { roomsGet, roomsIdGet, roomsDirectPost, roomsGroupPost };
