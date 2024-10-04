import fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import dotenv from "dotenv";
import { loginSchema } from "./models/fastify-schemas";
import LoginBody from "./models/LoginBody";
import login from "./routes/login";

dotenv.config();

let a = 0;
const app = fastify();
app.register(fastifyCookie);

app.addHook("onRequest", async (req, res) => {
  console.log("From hook:", req.cookies);

  a++;
  if (a % 2 == 0) {
    res.code(400).send();
  }
});

app.get("/", async (request, response) => {
  return { some_key: "some_val" };
});

app.post("/login", { schema: loginSchema }, async (request, response) => {
  const result = await login(request.body as LoginBody);

  response.setCookie("t", "abcde", {
    maxAge: 60,
    path: "/",
    httpOnly: true,
    sameSite: false,
  });

  response.send({ some_key: "some_val" });
});

app.post("/register", async (request, response) => {
  return { some_key: "some_val" };
});

(async () => {
  const res = await app.listen({ port: 3030, host: "0.0.0.0" });
  console.log("Listening at", res);
})();
