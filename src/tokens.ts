const TOKEN_TTL = Number(process.env.TOKEN_TTL);

export default function generateNewToken(userId: number) {
  if (!userId || typeof userId !== "number") {
    throw new Error("Invalid userId for a new token");
  }

  return TOKEN_TTL + "abcde" + userId;
}
