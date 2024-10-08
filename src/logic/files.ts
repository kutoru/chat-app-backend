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

  const resizeRes = await Result.try(async () => {
    return await sharp(tempPath)
      .resize(128, 128, { fit: "cover" })
      .toFile(filePath);
  });

  deleteFile(tempPath);

  if (resizeRes.isError()) {
    return resizeRes;
  }

  const updateRes = await poolQuery(
    "UPDATE users SET profile_image = ? WHERE id = ?;",
    [fileName, userId],
  );
  if (updateRes.isError()) {
    deleteFile(filePath);
    return updateRes;
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
