const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

const TOKEN = "vk1.a.DFpGODtua09zfskmdog0tBmqODJUj9lXKYhNmE3g1-waSd9V1Cmd3A1kU2HVHGcC-uaQQbwJBz98TrK8_W9gujp8qz2piuC4oTE_5jbbQNPaRhohirwd0ufQPc4dbi8xi7N2br_8MJtfCjGLSxBCwKAIiFRt9PfXR9p4CELXw1NElhWG0LS0-KPDO0Ac9M3IDVsHgdHgVcpWXMgY1nJLZw";
const CONFIRMATION_TOKEN = "e2f60e43";

async function sendMessage(userId, message) {
  await axios.post("https://api.vk.com/method/messages.send", null, {
    params: {
      user_id: userId,
      random_id: Date.now(),
      message: message,
      access_token: TOKEN,
      v: "5.199"
    }
  });
}

app.post("/", async (req, res) => {
  const body = req.body;

  if (body.type === "confirmation") {
    return res.send(CONFIRMATION_TOKEN);
  }

  if (body.type === "message_new") {
    const message = body.object.message.text.toLowerCase();
    const userId = body.object.message.from_id;

    if (message === "старт") {
      await sendMessage(
        userId,
        "❤️ Добро пожаловать в Vector Love!\n\nНапиши свое имя 👇"
      );
    } else {
      await sendMessage(
        userId,
        "✨ Напиши «старт», чтобы начать."
      );
    }
  }

  return res.send("ok");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
