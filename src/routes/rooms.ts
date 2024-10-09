import { FastifyReply, FastifyRequest } from "fastify";
import rooms from "../logic/rooms";
import { handleError, parseNumber } from "../utils";
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
  request: FastifyRequest<{ Params: { id: string } }>,
  response: FastifyReply,
) {
  const roomId = parseNumber(request.params.id);
  if (!roomId) {
    return response.code(400).send({ message: "Invalid param" });
  }

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

export async function roomsGroupPost(
  request: FastifyRequest<{ Body: { groupName: string } }>,
  response: FastifyReply,
) {
  const result = await rooms.roomsGroupPost(
    request.userId!,
    request.body.groupName,
  );
  if (result.isError()) {
    return handleError(response, result.error);
  }

  return response.send({ data: result.getOrThrow() });
}

export async function roomsIdMessagesGet(
  request: FastifyRequest<{ Params: { id: string } }>,
  response: FastifyReply,
) {
  const roomId = parseNumber(request.params.id);
  if (!roomId) {
    return response.code(400).send({ message: "Invalid param" });
  }

  const result = await messages.messagesGet(request.userId!, roomId);
  if (result.isError()) {
    return handleError(response, result.error);
  }

  return response.send({ data: result.getOrThrow() });
}
