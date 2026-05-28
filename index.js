const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

const TOKEN = "vk1.a.DFpGODtua09zfskmdog0tBmqODJUj9lXKYhNmE3g1-waSd9V1Cmd3A1kU2HVHGcC-uaQQbwJBz98TrK8_W9gujp8qz2piuC4oTE_5jbbQNPaRhohirwd0ufQPc4dbi8xi7N2br_8MJtfCjGLSxBCwKAIiFRt9PfXR9p4CELXw1NElhWG0LS0-KPDO0Ac9M3IDVsHgdHgVcpWXMgY1nJLZw";
const CONFIRMATION_TOKEN = "e2f60e43";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function sendMessage(userId, message) {
  await axios.post("https://api.vk.com/method/messages.send", null, {
    params: {
      user_id: userId,
      random_id: Date.now(),
      message,
      access_token: TOKEN,
      v: "5.199"
    }
  });
}

async function getUser(userId) {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  return data;
}

async function updateUser(userId, fields) {
  await supabase
    .from("users")
    .update(fields)
    .eq("id", userId);
}

app.post("/", async (req, res) => {
  const body = req.body;

  if (body.type === "confirmation") {
    return res.send(CONFIRMATION_TOKEN);
  }

  if (body.type === "message_new") {
    const userId = body.object.message.from_id;
    const text = body.object.message.text.trim();
    const message = text.toLowerCase();

    let user = await getUser(userId);

    if (message === "старт" || message === "начать") {
      if (!user) {
        await supabase.from("users").insert([{ id: userId }]);
        user = await getUser(userId);
      }

      await sendMessage(
        userId,
        "❤️ Добро пожаловать в Vector Love!\n\nДавай создадим твою анкету.\n\nНапиши свое имя 👇"
      );

      await updateUser(userId, { about: "step_name" });
      return res.send("ok");
    }

    if (!user) {
      await sendMessage(userId, "✨ Напиши «старт», чтобы начать.");
      return res.send("ok");
    }

    if (user.about === "step_name") {
      await updateUser(userId, {
        name: text,
        about: "step_age"
      });

      await sendMessage(userId, "Сколько тебе лет? 🔞");
      return res.send("ok");
    }

    if (user.about === "step_age") {
      const age = parseInt(text);

      if (!age || age < 18 || age > 80) {
        await sendMessage(userId, "Напиши возраст цифрами. Только 18+.");
        return res.send("ok");
      }

      await updateUser(userId, {
        age,
        about: "step_city"
      });

      await sendMessage(userId, "Из какого ты города? 🏙");
      return res.send("ok");
    }

    if (user.about === "step_city") {
      await updateUser(userId, {
        city: text,
        about: "step_about"
      });

      await sendMessage(
        userId,
        "Расскажи коротко о себе: хобби, интересы, кого хочешь найти ✨"
      );
      return res.send("ok");
    }

    if (user.about === "step_about") {
      await updateUser(userId, {
        about: text
      });

      const finalUser = await getUser(userId);

      await sendMessage(
        userId,
        `🔥 Анкета готова!\n\nИмя: ${finalUser.name}\nВозраст: ${finalUser.age}\nГород: ${finalUser.city}\nО себе: ${finalUser.about}\n\nСкоро добавим фото, лайки и просмотр анкет ❤️`
      );

      return res.send("ok");
    }

    await sendMessage(
      userId,
      "✨ Анкета уже создана.\n\nСкоро добавим просмотр людей и лайки ❤️"
    );
  }

  return res.send("ok");
});

app.get("/", (req, res) => {
  res.send("Vector Love bot is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
