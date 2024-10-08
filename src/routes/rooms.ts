import { FastifyReply, FastifyRequest } from "fastify";
import rooms from "../logic/rooms";
import { handleError } from "../utils";
import messages from "../logic/messages";

export async function roomsGet(
  request: FastifyRequest,
  response: FastifyReply,
) {
  const result = await rooms.roomsGet(request.userId!);
  if (result.isError()) {
    return handleError(response, result.error);
  }

  return response.send({ data: result.getOrThrow() });
}

export async function roomsIdGet(
  request: FastifyRequest<{ Params: { id: number } }>,
  response: FastifyReply,
) {
  const roomId = request.params.id;

  const result = await rooms.roomsIdGet(request.userId!, roomId);
  if (result.isError()) {
    return handleError(response, result.error);
  }

  return response.send({ data: result.getOrThrow() });
}

export async function roomsDirectPost(
  request: FastifyRequest<{ Body: { username: string } }>,
  response: FastifyReply,
) {
  const result = await rooms.roomsDirectPost(
    request.userId!,
    request.body.username,
  );
  if (result.isError()) {
    return handleError(response, result.error);
  }

  const room = result.getOrThrow();

  return response.send({ data: room });
}

export async function roomsIdMessagesGet(
  request: FastifyRequest<{ Params: { id: number } }>,
  response: FastifyReply,
) {
  const roomId = request.params.id;

  const result = await messages.messagesGet(request.userId!, roomId);
  console.log("msgs:", result);
  if (result.isError()) {
    return handleError(response, result.error);
  }

  return response.send({ data: result.getOrThrow() });
}
