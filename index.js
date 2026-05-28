const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

const TOKEN = "vk1.a.DFpGODtua09zfskmdog0tBmqODJUj9lXKYhNmE3g1-waSd9V1Cmd3A1kU2HVHGcC-uaQQbwJBz98TrK8_W9gujp8qz2piuC4oTE_5jbbQNPaRhohirwd0ufQPc4dbi8xi7N2br_8MJtfCjGLSxBCwKAIiFRt9PfXR9p4CELXw1NElhWG0LS0-KPDO0Ac9M3IDVsHgdHgVcpWXMgY1nJLZw";
const CONFIRMATION_TOKEN = "38f02508";

const FREE_DAILY_LIMIT = 20;
const ADMIN_IDS = [302920827];

function isAdmin(userId) {
  return ADMIN_IDS.includes(userId);
}

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
        { action: { type: "text", label: "🚫 Жалоба" }, color: "negative" },
        { action: { type: "text", label: "👤 Моя анкета" }, color: "secondary" },
        { action: { type: "text", label: "📊 Лимит" }, color: "secondary" }
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

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

async function resetViewsIfNeeded(user) {
  const today = todayDate();

  if (user.last_view_date !== today) {
    await updateUser(user.id, {
      daily_views: 0,
      last_view_date: today
    });

    user.daily_views = 0;
    user.last_view_date = today;
  }

  return user;
}

async function canViewProfiles(user) {
  if (user.is_vip) return true;

  user = await resetViewsIfNeeded(user);

  return user.daily_views < FREE_DAILY_LIMIT;
}

async function increaseViews(user) {
  if (user.is_vip) return;

  await updateUser(user.id, {
    daily_views: (user.daily_views || 0) + 1,
    last_view_date: todayDate()
  });
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
    await sendMessage(userId, "Ошибка проверки VIP-кода 😔", keyboard());
    return;
  }

  if (!vipCode) {
    await sendMessage(userId, "❌ VIP-код не найден.", keyboard());
    return;
  }

  if (vipCode.is_used) {
    await sendMessage(userId, "❌ Этот VIP-код уже использован.", keyboard());
    return;
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
    "👑 VIP успешно активирован!\n\nТеперь у тебя:\n• Безлимитный просмотр\n• Кто лайкнул тебя ❤️",
    keyboard()
  );
}

async function showProfile(userId) {
  let currentUser = await getUser(userId);

  if (!currentUser) return;

  const allowed = await canViewProfiles(currentUser);

  if (!allowed) {
    await sendMessage(
      userId,
      `👑 Лимит просмотров закончился.\n\nБесплатно доступно ${FREE_DAILY_LIMIT} анкет в сутки.\n\nАктивируй VIP для безлимитного просмотра ❤️`,
      keyboard()
    );

    return;
  }

  const { data: liked } = await supabase
    .from("likes")
    .select("to_user")
    .eq("from_user", userId);

  const likedIds = liked ? liked.map(x => x.to_user) : [];
  likedIds.push(userId);

  let query = supabase
    .from("users")
    .select("*")
    .eq("step", "done")
    .eq("is_banned", false)
    .limit(1);

  if (currentUser.gender && currentUser.looking_for) {
    query = query
      .eq("gender", currentUser.looking_for)
      .eq("looking_for", currentUser.gender);
  }

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
      "Пока нет подходящих анкет 😔",
      keyboard()
    );

    return;
  }

  await increaseViews(currentUser);
  currentUser = await getUser(userId);

  const profile = profiles[0];

  await updateUser(userId, {
    viewing_user: profile.id
  });

  const text =
    `✨ Анкета\n\n` +
    `Имя: ${profile.name || "Не указано"}\n` +
    `Возраст: ${profile.age || "Не указан"}\n` +
    `Город: ${profile.city || "Не указан"}\n` +
    `О себе: ${profile.about || "Не указано"}\n\n` +
    `📊 Осталось просмотров: ${
      currentUser.is_vip
        ? "∞"
        : Math.max(0, FREE_DAILY_LIMIT - (currentUser.daily_views || 0))
    }`;

  if (profile.photo) {
    await sendMessage(userId, text, keyboard(), profile.photo);
    return;
  }

  await sendMessage(userId, text, keyboard());
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

  const { error } = await supabase
    .from("likes")
    .insert([
      {
        from_user: userId,
        to_user: targetId
      }
    ]);

  if (error) {
    console.log("LIKE ERROR:", error);
  }

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

  await sendMessage(
    targetId,
    "❤️ Тебя кто-то лайкнул!\n\nНажми «👑 Кто лайкнул», чтобы посмотреть.",
    keyboard()
  );
}

  await updateUser(userId, {
    viewing_user: null
  });

  await showProfile(userId);
}

async function handleReport(userId) {
  const user = await getUser(userId);

  if (!user || !user.viewing_user) {
    await sendMessage(
      userId,
      "Сначала открой анкету через «👀 Смотреть».",
      keyboard()
    );

    return;
  }

  const targetId = user.viewing_user;

  const { error } = await supabase
    .from("reports")
    .insert([
      {
        from_user: userId,
        to_user: targetId,
        reason: "Жалоба из бота"
      }
    ]);

  if (error) {
    await sendMessage(
      userId,
      "Ты уже отправлял жалобу на эту анкету.",
      keyboard()
    );

    return;
  }

  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .eq("to_user", targetId);

  if (reports && reports.length >= 3) {
    await updateUser(targetId, {
      is_banned: true
    });
  }

  await updateUser(userId, {
    viewing_user: null
  });

  await sendMessage(
    userId,
    "🚫 Жалоба отправлена. Мы скрыли эту анкету из твоего просмотра.",
    keyboard()
  );

  await showProfile(userId);
}

async function showAdminPanel(userId) {
  if (!isAdmin(userId)) {
    await sendMessage(userId, "Нет доступа.");
    return;
  }

  const { count: totalUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  const { count: readyProfiles } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("step", "done");

  const { count: vipUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("is_vip", true);

  const { count: bannedUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("is_banned", true);

  const { count: reportsCount } = await supabase
    .from("reports")
    .select("*", { count: "exact", head: true });

  await sendMessage(
    userId,
    `🛠 Админка Vector Love\n\n` +
    `👥 Пользователей всего: ${totalUsers || 0}\n` +
    `✅ Готовых анкет: ${readyProfiles || 0}\n` +
    `👑 VIP: ${vipUsers || 0}\n` +
    `🚫 Забанено: ${bannedUsers || 0}\n` +
    `⚠️ Жалоб всего: ${reportsCount || 0}\n\n` +
    `Команды:\n` +
    `статистика\n` +
    `жалобы\n` +
    `выдать vip ID\n` +
    `бан ID\n` +
    `разбан ID\n` +
    `код VIP-XXX`
  );
}

async function showReports(userId) {
  if (!isAdmin(userId)) {
    await sendMessage(userId, "Нет доступа.");
    return;
  }

  const { data: reports, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    await sendMessage(userId, "Ошибка загрузки жалоб.");
    return;
  }

  if (!reports || reports.length === 0) {
    await sendMessage(userId, "Жалоб пока нет.");
    return;
  }

  let text = "⚠️ Последние жалобы:\n\n";

  for (const report of reports) {
    text +=
      `От: ${report.from_user}\n` +
      `На: ${report.to_user}\n` +
      `Причина: ${report.reason || "не указана"}\n\n`;
  }

  await sendMessage(userId, text);
}

async function giveVip(adminId, targetId) {
  if (!isAdmin(adminId)) {
    await sendMessage(adminId, "Нет доступа.");
    return;
  }

  await updateUser(targetId, { is_vip: true });

  await sendMessage(adminId, `👑 VIP выдан пользователю ${targetId}.`);

  await sendMessage(
    targetId,
    "👑 Администратор выдал тебе VIP.\n\nТеперь доступны премиум-функции ❤️",
    keyboard()
  );
}

async function banUser(adminId, targetId) {
  if (!isAdmin(adminId)) {
    await sendMessage(adminId, "Нет доступа.");
    return;
  }

  await updateUser(targetId, { is_banned: true });

  await sendMessage(adminId, `🚫 Пользователь ${targetId} забанен.`);
}

async function unbanUser(adminId, targetId) {
  if (!isAdmin(adminId)) {
    await sendMessage(adminId, "Нет доступа.");
    return;
  }

  await updateUser(targetId, { is_banned: false });

  await sendMessage(adminId, `✅ Пользователь ${targetId} разбанен.`);
}

async function createVipCode(adminId, code) {
  if (!isAdmin(adminId)) {
    await sendMessage(adminId, "Нет доступа.");
    return;
  }

  const upperCode = code.toUpperCase();

  const { error } = await supabase
    .from("vip_codes")
    .insert([{ code: upperCode }]);

  if (error) {
    await sendMessage(adminId, "Такой код уже есть или ошибка создания.");
    return;
  }

  await sendMessage(adminId, `✅ VIP-код создан:\n${upperCode}`);
}
async function showWhoLiked(userId) {
  const user = await getUser(userId);

  if (!user.is_vip) {
    await sendMessage(
      userId,
      "👑 Это VIP-функция.\n\nС VIP ты увидишь, кто поставил тебе лайк ❤️",
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

    if (liker && !liker.is_banned) {
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

  if (message === "админ" || message === "статистика") {
  await showAdminPanel(userId);
  return;
}

if (message === "жалобы") {
  await showReports(userId);
  return;
}

if (message.startsWith("выдать vip ")) {
  const targetId = Number(message.replace("выдать vip ", "").trim());

  if (!targetId) {
    await sendMessage(userId, "Напиши так: выдать vip 302920827");
    return;
  }

  await giveVip(userId, targetId);
  return;
}

if (message.startsWith("бан ")) {
  const targetId = Number(message.replace("бан ", "").trim());

  if (!targetId) {
    await sendMessage(userId, "Напиши так: бан 302920827");
    return;
  }

  await banUser(userId, targetId);
  return;
}

if (message.startsWith("разбан ")) {
  const targetId = Number(message.replace("разбан ", "").trim());

  if (!targetId) {
    await sendMessage(userId, "Напиши так: разбан 302920827");
    return;
  }

  await unbanUser(userId, targetId);
  return;
}

if (message.startsWith("код ")) {
  const code = text.replace("код ", "").trim();

  if (!code) {
    await sendMessage(userId, "Напиши так: код VIP-NEW-199");
    return;
  }

  await createVipCode(userId, code);
  return;
}
  if (text.toUpperCase().startsWith("VIP-")) {
    await activateVipCode(userId, text);
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

  if (user.is_banned) {
    await sendMessage(
      userId,
      "🚫 Твоя анкета заблокирована из-за жалоб.",
      keyboard()
    );

    return;
  }

  if (message === "смотреть" || message === "👀 смотреть") {
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

  if (message === "лайк" || message === "❤️ лайк") {
    await handleLike(userId);
    return;
  }

  if (message === "далее" || message === "👎 далее") {
    await updateUser(userId, {
      viewing_user: null
    });

    await showProfile(userId);

    return;
  }

  if (message === "жалоба" || message === "🚫 жалоба") {
    await handleReport(userId);
    return;
  }

  if (message === "кто лайкнул" || message === "👑 кто лайкнул") {
    await showWhoLiked(userId);
    return;
  }

  if (message === "лимит" || message === "📊 лимит") {
    user = await resetViewsIfNeeded(user);

    const left = user.is_vip
      ? "∞"
      : Math.max(0, FREE_DAILY_LIMIT - (user.daily_views || 0));

    await sendMessage(
      userId,
      `📊 Осталось просмотров сегодня: ${left}`,
      keyboard()
    );

    return;
  }

  if (message === "vip" || message === "👑 vip") {
    await sendMessage(
      userId,
      "👑 VIP — 199₽\n\nПосле оплаты отправь VIP-код ❤️",
      keyboard()
    );

    return;
  }

  if (message === "заново" || message === "🔄 заново") {
    await updateUser(userId, {
      name: null,
      age: null,
      city: null,
      gender: null,
      looking_for: null,
      about: null,
      photo: null,
      viewing_user: null,
      is_banned: false,
      step: "name"
    });

    await sendMessage(
      userId,
      "Ок, заполним анкету заново.\n\nНапиши свое имя 👇"
    );

    return;
  }

  if ((message === "старт" || message === "начать") && user.step === "done") {
    await sendMessage(
      userId,
      "❤️ Твоя анкета уже создана.\n\nНажми «👀 Смотреть».",
      keyboard()
    );

    return;
  }

  if (message === "старт" || message === "начать") {
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

    if (!age || age < 18 || age > 80) {
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
    if (message !== "парень" && message !== "девушка") {
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

    if (message === "ищу парня") lookingFor = "парень";
    if (message === "ищу девушку") lookingFor = "девушка";

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
