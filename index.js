const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

const TOKEN = "ТВОЙ_ТОКЕН_ВК";
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
