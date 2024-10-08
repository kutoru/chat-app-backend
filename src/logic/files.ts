import { MultipartFile } from "@fastify/multipart";
import fsSync from "fs";
import { pipeline } from "node:stream/promises";
import FileType from "file-type";
import sharp from "sharp";
import { Result } from "typescript-result";
import AppError from "../models/AppError";
import { poolQuery } from "../database";

// cache locked files
sharp.cache(false);

const INVALID_FILE_TYPE_ERR = new Error(AppError.InvalidFileType);

async function pfpPost(userId: number, data: MultipartFile) {
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

function deleteFile(path: string) {
  fsSync.unlink(path, (err) => {
    if (err) {
      console.warn("Could not delete a temp file:", err);
    }
  });
}

export default {
  pfpPost,
};
