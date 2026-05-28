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
      [
        { action: { type: "text", label: "👑 VIP" }, color: "secondary" },
        { action: { type: "text", label: "👑 Кто лайкнул" }, color: "secondary" }
      ],
      [
        { action: { type: "text", label: "🔄 Заново" }, color: "secondary" }
      ]
    ]
  });
}

function genderKeyboard() {
  return JSON.stringify({
    one_time: true,
    buttons: [[
      { action: { type: "text", label: "Парень" }, color: "primary" },
      { action: { type: "text", label: "Девушка" }, color: "primary" }
    ]]
  });
}

function lookingKeyboard() {
  return JSON.stringify({
    one_time: true,
    buttons: [[
      { action: { type: "text", label: "Ищу парня" }, color: "primary" },
      { action: { type: "text", label: "Ищу девушку" }, color: "primary" }
    ]]
  });
}

async function sendMessage(userId, message, kb = null, attachment = null) {
  try {

    const params = {
      user_id: userId,
      random_id: Date.now(),
      message,
      access_token: TOKEN,
      v: "5.199"
    };

    if (kb) params.keyboard = kb;
    if (attachment) params.attachment = attachment;

    await axios.post(
      "https://api.vk.com/method/messages.send",
      null,
      { params }
    );

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

  if (error) {
    console.log("GET USER ERROR:", error);
  }

  return data;
}

async function updateUser(userId, fields) {

  const { error } = await supabase
    .from("users")
    .update(fields)
    .eq("id", userId);

  if (error) {
    console.log("UPDATE USER ERROR:", error);
  }
}

function getPhotoAttachment(vkMessage) {

  const attachments = vkMessage.attachments || [];

  const photoAttachment = attachments.find(
    item => item.type === "photo"
  );

  if (!photoAttachment) return null;

  const photo = photoAttachment.photo;

  return `photo${photo.owner_id}_${photo.id}`;
}

async function activateVipCode(userId, code) {

  const upperCode = code.toUpperCase();

  const { data: vipCode, error } = await supabase
    .from("vip_codes")
    .select("*")
    .eq("code", upperCode)
    .maybeSingle();

  if (error) {

    console.log("VIP CODE ERROR:", error);

    await sendMessage(
      userId,
      "Ошибка проверки VIP-кода 😔",
      keyboard()
    );

    return true;
  }

  if (!vipCode) {

    await sendMessage(
      userId,
      "❌ VIP-код не найден.",
      keyboard()
    );

    return true;
  }

  if (vipCode.is_used) {

    await sendMessage(
      userId,
      "❌ Этот VIP-код уже использован.",
      keyboard()
    );

    return true;
  }

  await supabase
    .from("vip_codes")
    .update({
      is_used: true,
      used_by: userId,
      used_at: new Date()
    })
    .eq("id", vipCode.id);

  await updateUser(userId, {
    is_vip: true
  });

  await sendMessage(
    userId,
    "👑 VIP успешно активирован!\n\nТеперь тебе доступна функция «Кто лайкнул» ❤️",
    keyboard()
  );

  return true;
}

async function showProfile(userId) {

  const currentUser = await getUser(userId);

  const { data: liked } = await supabase
    .from("likes")
    .select("to_user")
    .eq("from_user", userId);

  const likedIds = liked
    ? liked.map(x => x.to_user)
    : [];

  likedIds.push(userId);

  let query = supabase
    .from("users")
    .select("*")
    .eq("step", "done")
    .limit(1);

  if (
    currentUser.gender &&
    currentUser.looking_for
  ) {

    query = query
      .eq("gender", currentUser.looking_for)
      .eq("looking_for", currentUser.gender);
  }

  query = query.not(
    "id",
    "in",
    `(${likedIds.join(",")})`
  );

  const { data: profiles, error } = await query;

  if (error) {

    console.log("PROFILE ERROR:", error);

    await sendMessage(
      userId,
      "Ошибка загрузки анкет 😔",
      keyboard()
    );

    return;
  }

  if (!profiles || profiles.length === 0) {

    await sendMessage(
      userId,
      "Пока нет подходящих анкет 😔",
      keyboard()
    );

    return;
  }

  const profile = profiles[0];

  await updateUser(userId, {
    viewing_user: profile.id
  });

  const text =
    `✨ Анкета\n\n` +
    `Имя: ${profile.name}\n` +
    `Возраст: ${profile.age}\n` +
    `Город: ${profile.city}\n` +
    `О себе: ${profile.about}`;

  if (profile.photo) {

    await sendMessage(
      userId,
      text,
      keyboard(),
      profile.photo
    );

    return;
  }

  await sendMessage(
    userId,
    text,
    keyboard()
  );
}

async function handleLike(userId) {

  const user = await getUser(userId);

  if (!user || !user.viewing_user) {

    await sendMessage(
      userId,
      "Сначала нажми «👀 Смотреть».",
      keyboard()
    );

    return;
  }

  const targetId = user.viewing_user;

  await supabase
    .from("likes")
    .insert([
      {
        from_user: userId,
        to_user: targetId
      }
    ]);

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
      `🎉 У вас взаимная симпатия!\n\n${otherUser.name}, ${otherUser.age}\nhttps://vk.com/id${otherUser.id}`,
      keyboard()
    );

    await sendMessage(
      otherUser.id,
      `🎉 У вас взаимная симпатия!\n\nhttps://vk.com/id${userId}`,
      keyboard()
    );

  } else {

    await sendMessage(
      userId,
      "❤️ Лайк отправлен!",
      keyboard()
    );
  }

  await updateUser(userId, {
    viewing_user: null
  });

  await showProfile(userId);
}

async function showWhoLiked(userId) {

  const user = await getUser(userId);

  if (!user.is_vip) {

    await sendMessage(
      userId,
      "👑 VIP — 199₽\n\nПосле оплаты отправь VIP-код.\n\nС VIP ты увидишь, кто поставил тебе лайк ❤️",
      keyboard()
    );

    return;
  }

  const { data: likes } = await supabase
    .from("likes")
    .select("from_user")
    .eq("to_user", userId);

  if (!likes || likes.length === 0) {

    await sendMessage(
      userId,
      "Пока тебя никто не лайкнул 😔",
      keyboard()
    );

    return;
  }

  let text = "👑 Тебя лайкнули:\n\n";

  for (const item of likes.slice(0, 10)) {

    const liker = await getUser(item.from_user);

    if (liker) {

      text +=
        `❤️ ${liker.name}, ${liker.age}\n` +
        `https://vk.com/id${liker.id}\n\n`;
    }
  }

  await sendMessage(
    userId,
    text,
    keyboard()
  );
}

async function processMessage(vkMessage) {

  const userId = vkMessage.from_id;

  const text = (vkMessage.text || "").trim();

  const message = text.toLowerCase();

  let user = await getUser(userId);

  if (
    text.toUpperCase().startsWith("VIP-")
  ) {

    await activateVipCode(
      userId,
      text
    );

    return;
  }

  if (!user) {

    await supabase
      .from("users")
      .insert([
        {
          id: userId,
          step: "name"
        }
      ]);

    await sendMessage(
      userId,
      "❤️ Добро пожаловать в Vector Love!\n\nНапиши свое имя 👇"
    );

    return;
  }

  if (
    message === "смотреть" ||
    message === "👀 смотреть"
  ) {

    if (user.step !== "done") {

      await sendMessage(
        userId,
        "Сначала закончи анкету.",
        keyboard()
      );

      return;
    }

    await showProfile(userId);

    return;
  }

  if (
    message === "лайк" ||
    message === "❤️ лайк"
  ) {

    await handleLike(userId);

    return;
  }

  if (
    message === "далее" ||
    message === "👎 далее"
  ) {

    await updateUser(userId, {
      viewing_user: null
    });

    await showProfile(userId);

    return;
  }

  if (
    message === "кто лайкнул" ||
    message === "👑 кто лайкнул"
  ) {

    await showWhoLiked(userId);

    return;
  }

  if (
    message === "vip" ||
    message === "👑 vip"
  ) {

    await sendMessage(
      userId,
      "👑 VIP — 199₽\n\nПосле оплаты отправь VIP-код.\n\nVIP открывает:\n• Кто лайкнул тебя\n• Будущие премиум функции ❤️",
      keyboard()
    );

    return;
  }

  if (
    message === "заново" ||
    message === "🔄 заново"
  ) {

    await updateUser(userId, {
      name: null,
      age: null,
      city: null,
      gender: null,
      looking_for: null,
      about: null,
      photo: null,
      viewing_user: null,
      step: "name"
    });

    await sendMessage(
      userId,
      "Ок, заполним анкету заново.\n\nНапиши свое имя 👇"
    );

    return;
  }

  if (
    (message === "старт" ||
    message === "начать") &&
    user.step === "done"
  ) {

    await sendMessage(
      userId,
      "❤️ Твоя анкета уже создана.\n\nНажми «👀 Смотреть».",
      keyboard()
    );

    return;
  }

  if (
    message === "старт" ||
    message === "начать"
  ) {

    await sendMessage(
      userId,
      "Продолжаем анкету 👇"
    );

    return;
  }

  if (user.step === "name") {

    await updateUser(userId, {
      name: text,
      step: "age"
    });

    await sendMessage(
      userId,
      "Сколько тебе лет? 🔞"
    );

    return;
  }

  if (user.step === "age") {

    const age = parseInt(text);

    if (
      !age ||
      age < 18 ||
      age > 80
    ) {

      await sendMessage(
        userId,
        "Напиши возраст цифрами."
      );

      return;
    }

    await updateUser(userId, {
      age,
      step: "city"
    });

    await sendMessage(
      userId,
      "Из какого ты города? 🏙"
    );

    return;
  }

  if (user.step === "city") {

    await updateUser(userId, {
      city: text,
      step: "gender"
    });

    await sendMessage(
      userId,
      "Кто ты?",
      genderKeyboard()
    );

    return;
  }

  if (user.step === "gender") {

    if (
      message !== "парень" &&
      message !== "девушка"
    ) {

      await sendMessage(
        userId,
        "Выбери: Парень или Девушка",
        genderKeyboard()
      );

      return;
    }

    await updateUser(userId, {
      gender: message,
      step: "looking_for"
    });

    await sendMessage(
      userId,
      "Кого хочешь найти?",
      lookingKeyboard()
    );

    return;
  }

  if (user.step === "looking_for") {

    let lookingFor = null;

    if (message === "ищу парня") {
      lookingFor = "парень";
    }

    if (message === "ищу девушку") {
      lookingFor = "девушка";
    }

    if (!lookingFor) {

      await sendMessage(
        userId,
        "Выбери вариант",
        lookingKeyboard()
      );

      return;
    }

    await updateUser(userId, {
      looking_for: lookingFor,
      step: "about"
    });

    await sendMessage(
      userId,
      "Расскажи коротко о себе ✨"
    );

    return;
  }

  if (user.step === "about") {

    await updateUser(userId, {
      about: text,
      step: "photo"
    });

    await sendMessage(
      userId,
      "Теперь отправь фото 📸"
    );

    return;
  }

  if (user.step === "photo") {

    const photo = getPhotoAttachment(vkMessage);

    if (!photo) {

      await sendMessage(
        userId,
        "Отправь именно фото 📸"
      );

      return;
    }

    await updateUser(userId, {
      photo,
      step: "done"
    });

    await sendMessage(
      userId,
      "🔥 Анкета готова!\n\nТеперь нажми «👀 Смотреть» ❤️",
      keyboard()
    );

    return;
  }

  if (user.step === "done") {

    await sendMessage(
      userId,
      "Нажми «👀 Смотреть».",
      keyboard()
    );

    return;
  }
}

app.post("/", async (req, res) => {

  try {

    const body = req.body;

    if (body.type === "confirmation") {
      return res.send(CONFIRMATION_TOKEN);
    }

    if (body.type === "message_new") {

      res.send("ok");

      processMessage(
        body.object.message
      ).catch(error => {

        console.log(
          "PROCESS MESSAGE ERROR:",
          error
        );
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
  console.log(
    `Server started on port ${PORT}`
  );
});
