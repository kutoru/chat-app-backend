import { MultipartFile } from "@fastify/multipart";
import fsSync from "fs";
import { pipeline } from "node:stream/promises";
import FileType from "file-type";
import sharp from "sharp";
import { Result } from "typescript-result";
import AppError from "../models/AppError";
import { poolQuery } from "../database";
import fs from "fs/promises";
import { ResultSetHeader } from "mysql2";
import FileInfo from "../models/FileInfo";
import websocket from "../websocket";

// cache locks files
sharp.cache(false);

const INVALID_FILE_TYPE_ERR = new Error(AppError.InvalidFileType);
const FORBIDDEN_ERR = new Error(AppError.Forbidden);

async function filesPfpPost(userId: number, data: MultipartFile) {
  if (!data.mimetype.startsWith("image/")) {
    return Result.error(INVALID_FILE_TYPE_ERR);
  }

  // saving the full image

  const hash = crypto.randomUUID();
  const tempPath = "./files/temp/" + hash;

  const writeRes = await Result.try(
    async () => await pipeline(data.file, fsSync.createWriteStream(tempPath)),
  );
  if (writeRes.isError()) {
    return writeRes;
  }

  const fileExt = (await FileType.fromFile(tempPath))?.ext;
  if (!fileExt) {
    deleteFile(tempPath);
    return Result.error(INVALID_FILE_TYPE_ERR);
  }

  const fileName = hash + "." + fileExt;
  const filePath = "./files/" + fileName;

  // resizing & cropping

  const resizeRes = await Result.try(async () => {
    return await sharp(tempPath)
      .resize(128, 128, { fit: "cover" })
      .toFile(filePath);
  });

  deleteFile(tempPath);

  if (resizeRes.isError()) {
    return resizeRes;
  }

  // getting the old image to delete it later

  const oldImageRes = await poolQuery<{ profile_image: string }[]>(
    "SELECT profile_image FROM users WHERE id = ?;",
    [userId],
  );

  let oldImage = undefined;
  if (oldImageRes.isError()) {
    console.warn("Could not get previous user image");
  } else {
    oldImage = oldImageRes.getOrThrow()[0]?.profile_image;
  }

  // updating the db

  const updateRes = await poolQuery(
    "UPDATE users SET profile_image = ? WHERE id = ?;",
    [fileName, userId],
  );
  if (updateRes.isError()) {
    deleteFile(filePath);
    return updateRes;
  }

  if (oldImage) {
    deleteFile("./files/" + oldImage);
  }

  return Result.ok(fileName);
}

async function filesMessagePost(
  userId: number,
  messageId: number,
  iter: AsyncIterableIterator<MultipartFile>,
) {
  // validate that the user is the message's owner

  const messageRes = await poolQuery<{ id: number }[]>(
    "SELECT id FROM messages WHERE id = ? AND sender_id = ?;",
    [messageId, userId],
  );
  if (messageRes.isError()) {
    return messageRes;
  }

  if (!messageRes.getOrThrow().length) {
    return Result.error(FORBIDDEN_ERR);
  }

  // saving the files to disk

  const insertData = [];

  for (let i = 0; i < 50; i++) {
    const data = await iter.next();
    if (data.done) {
      break;
    }

    const result = await saveMessageFile(messageId, i, data.value);
    if (result.isError()) {
      insertData.forEach((v) => deleteFile("/files/" + v[2]));
      return result;
    }

    insertData.push(result.getOrThrow());
  }

  // inserting and sending the file data

  const insertRes = await poolQuery<ResultSetHeader>(
    "INSERT INTO files (message_id, message_index, file_hash, file_name) VALUES ?;",
    [insertData],
  );
  if (insertRes.isError()) {
    insertData.forEach((v) => deleteFile("/files/" + v[2]));
    return insertRes;
  }

  const filesInfoRes = await poolQuery<FileInfo[]>(
    "SELECT * FROM files WHERE message_id = ? AND files.message_index < ?;",
    [messageId, insertData.length],
  );
  if (filesInfoRes.isError()) {
    return filesInfoRes;
  }

  const sendRes = await websocket.sendFiles(filesInfoRes.getOrThrow());
  if (sendRes.isError()) {
    console.warn("Could not send the files info:", sendRes);
  }

  return Result.ok();
}

async function saveMessageFile(
  messageId: number,
  messageIndex: number,
  data: MultipartFile,
): Promise<Result<[number, number, string, string], Error>> {
  // for now only images are allowed

  if (!data.mimetype.startsWith("image/")) {
    return Result.error(INVALID_FILE_TYPE_ERR);
  }

  const originalName = data.filename;

  // saving the file

  const tempHash = crypto.randomUUID();
  const tempPath = "./files/" + tempHash;

  const writeRes = await Result.try(
    async () => await pipeline(data.file, fsSync.createWriteStream(tempPath)),
  );
  if (writeRes.isError()) {
    return writeRes;
  }

  const fileExt = (await FileType.fromFile(tempPath))?.ext;
  if (!fileExt) {
    deleteFile(tempPath);
    return Result.error(INVALID_FILE_TYPE_ERR);
  }

  // adding the extension

  const hash = tempHash + "." + fileExt;
  const path = tempPath + "." + fileExt;

  const renameRes = await Result.try(async () => fs.rename(tempPath, path));
  if (renameRes.isError()) {
    deleteFile(tempPath);
    return renameRes;
  }

  return Result.ok([messageId, messageIndex, hash, originalName]);
}

function deleteFile(path: string) {
  fsSync.unlink(path, (err) => {
    if (err) {
      console.warn("Could not delete a file:", err);
    }
  });
}

export default {
  filesPfpPost,
  filesMessagePost,
};
