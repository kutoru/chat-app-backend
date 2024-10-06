import { FastifyReply, FastifyRequest } from "fastify";
import rooms from "../logic/rooms";
import { handleError } from "../utils";

export async function roomsDirectPost(
  request: FastifyRequest<{ Body: { username: string } }>,
  response: FastifyReply,
) {
  const result = await rooms.createDirectChat({
    fromUserId: request.userId!,
    toUsername: request.body.username,
  });
  console.log("roomsDirectPost", result);
  if (result.isError()) {
    return handleError(response, result.errorOrNull()!!);
  }

  return response.send(result.getOrThrow());
}
