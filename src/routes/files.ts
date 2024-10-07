import { FastifyReply, FastifyRequest } from "fastify";
import fs from "fs/promises";
import fsSync from "fs";
import files from "../logic/files";
import { handleError } from "../utils";

export async function filesGet(
  request: FastifyRequest<{ Params: { fileHash: string } }>,
  response: FastifyReply,
) {
  const fileHash = request.params.fileHash;

  // avoiding the "..%2F.env" file
  if (fileHash.includes("/")) {
    return response.code(400).send({ message: "Invalid file hash" });
  }

  const filePath = "./files/" + fileHash;
  const exists = await fs.stat(filePath).then(
    () => true,
    () => false,
  );

  if (!exists) {
    return response.code(400).send({ message: "Invalid file hash" });
  }

  const stream = fsSync.createReadStream(filePath);
  return response.send(stream);
}

export async function filesPfpPost(
  request: FastifyRequest,
  response: FastifyReply,
) {
  const data = await request.file();
  if (!data) {
    return response.code(400).send({ message: "Invalid body" });
  }

  const result = await files.pfpPost(request.userId!, data);
  if (result.isError()) {
    return handleError(response, result.error);
  }

  const hash = result.getOrThrow();

  return response.send({ data: hash });
}
