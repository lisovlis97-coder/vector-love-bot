const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

const TOKEN = "vk1.a.DFpGODtua09zfskmdog0tBmqODJUj9lXKYhNmE3g1-waSd9V1Cmd3A1kU2HVHGcC-uaQQbwJBz98TrK8_W9gujp8qz2piuC4oTE_5jbbQNPaRhohirwd0ufQPc4dbi8xi7N2br_8MJtfCjGLSxBCwKAIiFRt9PfXR9p4CELXw1NElhWG0LS0-KPDO0Ac9M3IDVsHgdHgVcpWXMgY1nJLZw";
const CONFIRMATION_TOKEN = "38f02508";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

function keyboard() {
  return JSON.stringify({
    one_time: false,
    buttons: [
      [{ action: { type: "text", label: "👀 Смотреть" }, color: "primary" }],
      [
        { action: { type: "text", label: "❤️ Лайк" }, color: "positive" },
        { action: { type: "text", label: "👎 Далее" }, color: "negative" }
      ],
      [{ action: { type: "text", label: "🔄 Заново" }, color: "secondary" }]
    ]
  });
}

async function sendMessage(userId, message, kb = null) {
  try {
    const params = {
      user_id: userId,
      random_id: Date.now(),
      message,
      access_token: TOKEN,
      v: "5.199"
    };

    if (kb) params.keyboard = kb;

    const response = await axios.post(
      "https://api.vk.com/method/messages.send",
      null,
      { params }
    );

    if (response.data.error) {
      console.log("VK SEND ERROR:", response.data.error);
    }
  } catch (e) {
    console.log("SEND ERROR:", e.response?.data || e.message);
  }
}

async function getUser(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) console.log("GET USER ERROR:", error);
  return data;
}

async function updateUser(userId, fields) {
  const { error } = await supabase
    .from("users")
    .update(fields)
    .eq("id", userId);

  if (error) console.log("UPDATE USER ERROR:", error);
}

function getPhotoAttachment(vkMessage) {
  const attachments = vkMessage.attachments || [];
  const photoAttachment = attachments.find(item => item.type === "photo");

  if (!photoAttachment) return null;

  const photo = photoAttachment.photo;
  return `photo${photo.owner_id}_${photo.id}`;
}

async function showProfile(userId) {
  try {
    const { data: liked, error: likedError } = await supabase
      .from("likes")
      .select("to_user")
      .eq("from_user", userId);

    if (likedError) console.log("LIKED ERROR:", likedError);

    const likedIds = liked ? liked.map(x => x.to_user) : [];
    likedIds.push(userId);

    let query = supabase
      .from("users")
      .select("*")
      .eq("step", "done")
      .limit(1);

    query = query.not("id", "in", `(${likedIds.join(",")})`);

    const { data: profiles, error } = await query;

    if (error) {
      console.log("PROFILE ERROR:", error);
      await sendMessage(userId, "Ошибка загрузки анкет 😔", keyboard());
      return;
    }

    if (!profiles || profiles.length === 0) {
      await sendMessage(
        userId,
        "Пока нет новых анкет 😔\n\nНужна хотя бы ещё одна заполненная анкета.",
        keyboard()
      );
      return;
    }

    const profile = profiles[0];

    await updateUser(userId, { viewing_user: profile.id });

    await sendMessage(
      userId,
      `✨ Анкета\n\nИмя: ${profile.name}\nВозраст: ${profile.age}\nГород: ${profile.city}\nО себе: ${profile.about}`,
      keyboard()
    );
  } catch (e) {
    console.log("SHOW PROFILE CRASH:", e);
    await sendMessage(userId, "Критическая ошибка загрузки анкет 😔", keyboard());
  }
}

async function handleLike(userId) {
  const user = await getUser(userId);

  if (!user || !user.viewing_user) {
    await sendMessage(userId, "Сначала нажми «👀 Смотреть».", keyboard());
    return;
  }

  const targetId = user.viewing_user;

  const { error: likeError } = await supabase
    .from("likes")
    .insert([{ from_user: userId, to_user: targetId }]);

  if (likeError) console.log("LIKE ERROR:", likeError);

  const { data: match } = await supabase
    .from("likes")
    .select("*")
    .eq("from_user", targetId)
    .eq("to_user", userId)
    .maybeSingle();

  if (match) {
    const otherUser = await getUser(targetId);

    await sendMessage(
      userId,
      `🎉 У вас взаимная симпатия!\n\n${otherUser.name}, ${otherUser.age}, ${otherUser.city}\n\nМожно написать: https://vk.com/id${otherUser.id}`,
      keyboard()
    );

    await sendMessage(
      otherUser.id,
      `🎉 У вас взаимная симпатия!\n\nМожно написать: https://vk.com/id${userId}`,
      keyboard()
    );
  } else {
    await sendMessage(userId, "❤️ Лайк отправлен!", keyboard());
  }

  await updateUser(userId, { viewing_user: null });
  await showProfile(userId);
}

async function processMessage(vkMessage) {
  const userId = vkMessage.from_id;
  const text = (vkMessage.text || "").trim();
  const message = text.toLowerCase();

  console.log("MESSAGE:", { userId, message });

  let user = await getUser(userId);

  if (!user) {
    await supabase.from("users").insert([{ id: userId, step: "name" }]);

    await sendMessage(
      userId,
      "❤️ Добро пожаловать в Vector Love!\n\nДавай создадим твою анкету.\n\nНапиши свое имя 👇"
    );

    return;
  }

  if (message === "смотреть" || message === "👀 смотреть") {
    if (user.step !== "done") {
      await sendMessage(userId, "Сначала закончи анкету.", keyboard());
      return;
    }

    await showProfile(userId);
    return;
  }

  if (message === "лайк" || message === "❤️ лайк") {
    await handleLike(userId);
    return;
  }

  if (message === "далее" || message === "👎 далее") {
    await updateUser(userId, { viewing_user: null });
    await showProfile(userId);
    return;
  }

  if (message === "заново" || message === "🔄 заново") {
    await updateUser(userId, {
      name: null,
      age: null,
      city: null,
      about: null,
      photo: null,
      viewing_user: null,
      step: "name"
    });

    await sendMessage(userId, "Ок, заполним анкету заново.\n\nНапиши свое имя 👇");
    return;
  }

  if ((message === "старт" || message === "начать") && user.step === "done") {
    await sendMessage(
      userId,
      "❤️ Твоя анкета уже создана.\n\nНажми «👀 Смотреть» или «🔄 Заново».",
      keyboard()
    );
    return;
  }

  if (message === "старт" || message === "начать") {
    if (user.step === "name") await sendMessage(userId, "Напиши свое имя 👇");
    else if (user.step === "age") await sendMessage(userId, "Сколько тебе лет? 🔞");
    else if (user.step === "city") await sendMessage(userId, "Из какого ты города? 🏙");
    else if (user.step === "about") await sendMessage(userId, "Расскажи коротко о себе ✨");
    else if (user.step === "photo") await sendMessage(userId, "Отправь свое фото для анкеты 📸");
    else await sendMessage(userId, "Нажми «👀 Смотреть» или «🔄 Заново».", keyboard());

    return;
  }

  if (user.step === "name") {
    await updateUser(userId, { name: text, step: "age" });
    await sendMessage(userId, "Сколько тебе лет? 🔞");
    return;
  }

  if (user.step === "age") {
    const age = parseInt(text);

    if (!age || age < 18 || age > 80) {
      await sendMessage(userId, "Напиши возраст цифрами. Только 18+.");
      return;
    }

    await updateUser(userId, { age, step: "city" });
    await sendMessage(userId, "Из какого ты города? 🏙");
    return;
  }

  if (user.step === "city") {
    await updateUser(userId, { city: text, step: "about" });
    await sendMessage(userId, "Расскажи коротко о себе ✨");
    return;
  }

  if (user.step === "about") {
    await updateUser(userId, { about: text, step: "photo" });
    await sendMessage(userId, "Отлично 🔥\n\nТеперь отправь свое фото для анкеты 📸");
    return;
  }

  if (user.step === "photo") {
    const photo = getPhotoAttachment(vkMessage);

    if (!photo) {
      await sendMessage(userId, "Нужно отправить именно фото 📸");
      return;
    }

    await updateUser(userId, { photo, step: "done" });

    const finalUser = await getUser(userId);

    await sendMessage(
      userId,
      `🔥 Анкета готова!\n\nИмя: ${finalUser.name}\nВозраст: ${finalUser.age}\nГород: ${finalUser.city}\nО себе: ${finalUser.about}\n\nТеперь нажми «👀 Смотреть» ❤️`,
      keyboard()
    );

    return;
  }

  if (user.step === "done") {
    await sendMessage(
      userId,
      "Нажми «👀 Смотреть» или напиши «смотреть».",
      keyboard()
    );
    return;
  }

  await updateUser(userId, { step: "name" });
  await sendMessage(userId, "Напиши свое имя 👇");
}

app.post("/", async (req, res) => {
  try {
    const body = req.body;

    console.log("NEW EVENT:", body.type);

    if (body.type === "confirmation") {
      return res.send(CONFIRMATION_TOKEN);
    }

    if (body.type === "message_new") {
      res.send("ok");

      processMessage(body.object.message).catch(error => {
        console.log("PROCESS MESSAGE ERROR:", error);
      });

      return;
    }

    return res.send("ok");
  } catch (e) {
    console.log("GLOBAL ERROR:", e);
    return res.send("ok");
  }
});

app.get("/", (req, res) => {
  res.send("Vector Love bot is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
