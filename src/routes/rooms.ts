import { FastifyReply, FastifyRequest } from "fastify";
import rooms from "../logic/rooms";
import { handleError } from "../utils";

export async function roomsGet(
  request: FastifyRequest,
  response: FastifyReply,
) {
  if (!request.userId) {
    return response.code(500).send({ message: "Server error" });
  }

  const result = await rooms.roomsGet(request.userId);
  console.log("roomsGet", result);
  //   if (result.isError()) {
  //     return handleError(response, result.errorOrNull()!!);
  //   }

  //   return response.send(result.getOrThrow());
}

export async function roomsDirectPost(
  request: FastifyRequest<{ Body: { username: string } }>,
  response: FastifyReply,
) {
  if (!request.userId) {
    return response.code(500).send({ message: "Server error" });
  }

  const result = await rooms.roomsDirectPost(
    request.userId,
    request.body.username,
  );
  console.log("roomsDirectPost", result);
  if (result.isError()) {
    return handleError(response, result.errorOrNull()!!);
  }

  const room = result.getOrThrow();

  return response.send({ data: room });
}
