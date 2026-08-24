const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

const TOKEN = "vk1.a.DFpGODtua09zfskmdog0tBmqODJUj9lXKYhNmE3g1-waSd9V1Cmd3A1kU2HVHGcC-uaQQbwJBz98TrK8_W9gujp8qz2piuC4oTE_5jbbQNPaRhohirwd0ufQPc4dbi8xi7N2br_8MJtfCjGLSxBCwKAIiFRt9PfXR9p4CELXw1NElhWG0LS0-KPDO0Ac9M3IDVsHgdHgVcpWXMgY1nJLZw";
const CONFIRMATION_TOKEN = "38f02508";

const FREE_DAILY_LIMIT = 20;
const ADMIN_IDS = [302920827];
const sessionSkips = new Map();
let skipsTableAvailable = true;

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
        { action: { type: "text", label: "🙈 Скрыть" }, color: "secondary" },
        { action: { type: "text", label: "✏️ Изменить" }, color: "secondary" }
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

function editKeyboard() {
  return JSON.stringify({
    one_time: true,
    buttons: [
      [
        { action: { type: "text", label: "Имя" }, color: "secondary" },
        { action: { type: "text", label: "Возраст" }, color: "secondary" }
      ],
      [
        { action: { type: "text", label: "Город" }, color: "secondary" },
        { action: { type: "text", label: "О себе" }, color: "secondary" }
      ],
      [
        { action: { type: "text", label: "Фото" }, color: "secondary" },
        { action: { type: "text", label: "Кого ищу" }, color: "secondary" }
      ],
      [
        { action: { type: "text", label: "🗑 Удалить анкету" }, color: "negative" },
        { action: { type: "text", label: "Отмена" }, color: "secondary" }
      ]
    ]
  });
}

function deleteConfirmKeyboard() {
  return JSON.stringify({
    one_time: true,
    buttons: [[
      { action: { type: "text", label: "Да, удалить" }, color: "negative" },
      { action: { type: "text", label: "Отмена" }, color: "secondary" }
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
  return (user.daily_views || 0) < FREE_DAILY_LIMIT;
}

async function increaseViews(user) {
  if (user.is_vip) return;

  await updateUser(user.id, {
    daily_views: (user.daily_views || 0) + 1,
    last_view_date: todayDate()
  });
}

function addSessionSkip(userId, targetId) {
  if (!sessionSkips.has(userId)) sessionSkips.set(userId, new Set());
  sessionSkips.get(userId).add(targetId);
}

async function getSkippedIds(userId) {
  const ids = new Set(sessionSkips.has(userId) ? Array.from(sessionSkips.get(userId)) : []);

  if (!skipsTableAvailable) return Array.from(ids);

  const { data, error } = await supabase
    .from("skips")
    .select("to_user")
    .eq("from_user", userId);

  if (error) {
    skipsTableAvailable = false;
    console.log("SKIPS TABLE NOT AVAILABLE:", error.message || error);
    return Array.from(ids);
  }

  for (const item of data || []) ids.add(item.to_user);
  return Array.from(ids);
}

async function saveSkip(userId, targetId) {
  addSessionSkip(userId, targetId);

  if (!skipsTableAvailable) return;

  const { error } = await supabase
    .from("skips")
    .upsert(
      [{ from_user: userId, to_user: targetId }],
      { onConflict: "from_user,to_user" }
    );

  if (error) {
    skipsTableAvailable = false;
    console.log("SAVE SKIP ERROR:", error.message || error);
  }
}

async function activateVipCode(userId, code) {
  const user = await getUser(userId);

  if (!user) {
    await sendMessage(userId, "Сначала создай анкету через «Старт», а потом активируй VIP-код.");
    return;
  }

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

  const { error: markError } = await supabase
    .from("vip_codes")
    .update({
      is_used: true,
      used_by: userId,
      used_at: new Date().toISOString()
    })
    .eq("id", vipCode.id);

  if (markError) {
    console.log("VIP CODE UPDATE ERROR:", markError);
    await sendMessage(userId, "Не удалось активировать VIP-код 😔", keyboard());
    return;
  }

  await updateUser(userId, { is_vip: true });

  await sendMessage(
    userId,
    "👑 VIP успешно активирован!\n\nТеперь у тебя:\n• безлимитный просмотр\n• доступ к «Кто лайкнул» ❤️",
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

  const { data: reported } = await supabase
    .from("reports")
    .select("to_user")
    .eq("from_user", userId);

  const skippedIds = await getSkippedIds(userId);
  const excludedIds = new Set([userId]);

  for (const item of liked || []) excludedIds.add(item.to_user);
  for (const item of reported || []) excludedIds.add(item.to_user);
  for (const id of skippedIds) excludedIds.add(id);

  let query = supabase
    .from("users")
    .select("*")
    .eq("step", "done")
    .eq("is_banned", false)
    .eq("is_hidden", false)
    .limit(20);

  if (currentUser.gender && currentUser.looking_for) {
    query = query
      .eq("gender", currentUser.looking_for)
      .eq("looking_for", currentUser.gender);
  }

  const ids = Array.from(excludedIds);
  if (ids.length > 0) {
    query = query.not("id", "in", `(${ids.join(",")})`);
  }

  const { data: profiles, error } = await query;

  if (error) {
    console.log("PROFILE ERROR:", error);
    await sendMessage(userId, "Ошибка загрузки анкет 😔", keyboard());
    return;
  }

  if (!profiles || profiles.length === 0) {
    await sendMessage(userId, "Пока нет новых подходящих анкет 😔", keyboard());
    return;
  }

  const sameCity = profiles.filter(
    p => p.city && currentUser.city && p.city.trim().toLowerCase() === currentUser.city.trim().toLowerCase()
  );

  const pool = sameCity.length > 0 ? sameCity : profiles;
  const profile = pool[Math.floor(Math.random() * pool.length)];

  await increaseViews(currentUser);
  currentUser = await getUser(userId);

  await updateUser(userId, { viewing_user: profile.id });

  const text =
    `✨ Анкета\n\n` +
    `Имя: ${profile.name || "Не указано"}\n` +
    `Возраст: ${profile.age || "Не указан"}\n` +
    `Город: ${profile.city || "Не указан"}\n` +
    `О себе: ${profile.about || "Не указано"}\n\n` +
    `📊 Осталось просмотров: ${currentUser.is_vip ? "∞" : Math.max(0, FREE_DAILY_LIMIT - (currentUser.daily_views || 0))}`;

  if (profile.photo) {
    await sendMessage(userId, text, keyboard(), profile.photo);
    return;
  }

  await sendMessage(userId, text, keyboard());
}

async function handleLike(userId) {
  const user = await getUser(userId);

  if (!user || !user.viewing_user) {
    await sendMessage(userId, "Сначала нажми «👀 Смотреть».", keyboard());
    return;
  }

  const targetId = user.viewing_user;

  const { error } = await supabase
    .from("likes")
    .insert([{ from_user: userId, to_user: targetId }]);

  if (error) console.log("LIKE ERROR:", error);

  const { data: match } = await supabase
    .from("likes")
    .select("*")
    .eq("from_user", targetId)
    .eq("to_user", userId)
    .maybeSingle();

  if (match) {
    const otherUser = await getUser(targetId);
    const currentUser = await getUser(userId);

    await sendMessage(
      userId,
      `❤️ Взаимная симпатия!\n\n${otherUser?.name || "Пользователь"}, ${otherUser?.age || "?"}\nhttps://vk.com/id${targetId}\n\nНе тяни с первым сообщением 😏`,
      keyboard()
    );

    await sendMessage(
      targetId,
      `❤️ Взаимная симпатия!\n\n${currentUser?.name || "Пользователь"}, ${currentUser?.age || "?"}\nhttps://vk.com/id${userId}\n\nКажется, пора познакомиться поближе 😊`,
      keyboard()
    );
  } else {
    await sendMessage(userId, "❤️ Лайк отправлен!", keyboard());
    await sendMessage(
      targetId,
      "❤️ Тебя кто-то лайкнул!\n\nНажми «👑 Кто лайкнул», чтобы посмотреть.",
      keyboard()
    );
  }

  await updateUser(userId, { viewing_user: null });
  await showProfile(userId);
}

async function handleSkip(userId) {
  const user = await getUser(userId);

  if (!user || !user.viewing_user) {
    await sendMessage(userId, "Сначала открой анкету через «👀 Смотреть».", keyboard());
    return;
  }

  await saveSkip(userId, user.viewing_user);
  await updateUser(userId, { viewing_user: null });
  await showProfile(userId);
}

async function handleReport(userId) {
  const user = await getUser(userId);

  if (!user || !user.viewing_user) {
    await sendMessage(userId, "Сначала открой анкету через «👀 Смотреть».", keyboard());
    return;
  }

  const targetId = user.viewing_user;

  const { error } = await supabase
    .from("reports")
    .insert([{ from_user: userId, to_user: targetId, reason: "Жалоба из бота" }]);

  if (error) {
    await sendMessage(userId, "Ты уже отправлял жалобу на эту анкету.", keyboard());
    return;
  }

  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .eq("to_user", targetId);

  if (reports && reports.length >= 3) {
    await updateUser(targetId, { is_banned: true });
  }

  await updateUser(userId, { viewing_user: null });
  await sendMessage(userId, "🚫 Жалоба отправлена. Эта анкета больше не будет попадаться тебе.", keyboard());
  await showProfile(userId);
}

async function toggleHidden(userId) {
  const user = await getUser(userId);

  if (!user) {
    await sendMessage(userId, "Анкета не найдена.");
    return;
  }

  const newStatus = !user.is_hidden;
  await updateUser(userId, { is_hidden: newStatus });

  await sendMessage(
    userId,
    newStatus
      ? "🙈 Анкета скрыта.\n\nТеперь она не будет показываться другим пользователям."
      : "👀 Анкета снова видна другим пользователям.",
    keyboard()
  );
}

async function showMyProfile(userId) {
  const user = await getUser(userId);

  if (!user) {
    await sendMessage(userId, "Анкета не найдена.");
    return;
  }

  const viewsLeft = user.is_vip
    ? "∞"
    : Math.max(0, FREE_DAILY_LIMIT - (user.daily_views || 0));

  const text =
    `👤 Моя анкета\n\n` +
    `Имя: ${user.name || "Не указано"}\n` +
    `Возраст: ${user.age || "Не указан"}\n` +
    `Город: ${user.city || "Не указан"}\n` +
    `Пол: ${user.gender || "Не указан"}\n` +
    `Ищу: ${user.looking_for || "Не указано"}\n` +
    `О себе: ${user.about || "Не указано"}\n\n` +
    `👑 VIP: ${user.is_vip ? "Да" : "Нет"}\n` +
    `🙈 Скрыта: ${user.is_hidden ? "Да" : "Нет"}\n` +
    `📊 Осталось просмотров: ${viewsLeft}`;

  if (user.photo) {
    await sendMessage(userId, text, keyboard(), user.photo);
    return;
  }

  await sendMessage(userId, text, keyboard());
}

async function showEditMenu(userId) {
  const user = await getUser(userId);

  if (!user || user.step !== "done") {
    await sendMessage(userId, "Сначала закончи анкету.", keyboard());
    return;
  }

  await sendMessage(userId, "✏️ Что хочешь изменить?", editKeyboard());
  await updateUser(userId, { step: "edit_menu" });
}

async function deleteOwnProfile(userId) {
  const user = await getUser(userId);

  if (!user) {
    await sendMessage(userId, "Анкета уже удалена.");
    return;
  }

  await supabase
    .from("likes")
    .delete()
    .or(`from_user.eq.${userId},to_user.eq.${userId}`);

  await supabase
    .from("reports")
    .delete()
    .or(`from_user.eq.${userId},to_user.eq.${userId}`);

  if (skipsTableAvailable) {
    const { error } = await supabase
      .from("skips")
      .delete()
      .or(`from_user.eq.${userId},to_user.eq.${userId}`);

    if (error) {
      skipsTableAvailable = false;
      console.log("DELETE SKIPS ERROR:", error.message || error);
    }
  }

  sessionSkips.delete(userId);

  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId);

  if (error) {
    console.log("DELETE OWN PROFILE ERROR:", error);
    await sendMessage(userId, "Не получилось удалить анкету. Попробуй позже.", keyboard());
    return;
  }

  await sendMessage(
    userId,
    "🗑 Анкета удалена.\n\nЕсли захочешь вернуться — просто напиши «Старт» ❤️"
  );
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
    `статистика\nжалобы\nновые анкеты\nпоиск ID\nудалить ID\nвыдать vip ID\nбан ID\nразбан ID\nкод VIP-XXX`
  );
}

async function showNewProfiles(userId) {
  if (!isAdmin(userId)) {
    await sendMessage(userId, "Нет доступа.");
    return;
  }

  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .eq("step", "done")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    await sendMessage(userId, "Ошибка загрузки анкет.");
    return;
  }

  if (!users || users.length === 0) {
    await sendMessage(userId, "Анкет пока нет.");
    return;
  }

  let text = "🆕 Последние анкеты:\n\n";

  for (const user of users) {
    text +=
      `ID: ${user.id}\n` +
      `${user.name || "Без имени"}, ${user.age || "?"}\n` +
      `${user.city || "Не указан"}\n\n`;
  }

  await sendMessage(userId, text);
}

async function searchUserById(adminId, targetId) {
  if (!isAdmin(adminId)) {
    await sendMessage(adminId, "Нет доступа.");
    return;
  }

  const user = await getUser(targetId);

  if (!user) {
    await sendMessage(adminId, "Пользователь не найден.");
    return;
  }

  const text =
    `🔎 Анкета пользователя\n\n` +
    `ID: ${user.id}\n` +
    `Имя: ${user.name || "Не указано"}\n` +
    `Возраст: ${user.age || "Не указан"}\n` +
    `Город: ${user.city || "Не указан"}\n` +
    `Пол: ${user.gender || "Не указан"}\n` +
    `Ищет: ${user.looking_for || "Не указано"}\n` +
    `О себе: ${user.about || "Не указано"}\n\n` +
    `Шаг: ${user.step || "Не указан"}\n` +
    `VIP: ${user.is_vip ? "Да" : "Нет"}\n` +
    `Скрыта: ${user.is_hidden ? "Да" : "Нет"}\n` +
    `Забанен: ${user.is_banned ? "Да" : "Нет"}\n` +
    `Просмотров сегодня: ${user.daily_views || 0}`;

  if (user.photo) {
    await sendMessage(adminId, text, null, user.photo);
    return;
  }

  await sendMessage(adminId, text);
}

async function deleteUserById(adminId, targetId) {
  if (!isAdmin(adminId)) {
    await sendMessage(adminId, "Нет доступа.");
    return;
  }

  const user = await getUser(targetId);

  if (!user) {
    await sendMessage(adminId, "Пользователь не найден.");
    return;
  }

  await supabase
    .from("likes")
    .delete()
    .or(`from_user.eq.${targetId},to_user.eq.${targetId}`);

  await supabase
    .from("reports")
    .delete()
    .or(`from_user.eq.${targetId},to_user.eq.${targetId}`);

  if (skipsTableAvailable) {
    const { error: skipDeleteError } = await supabase
      .from("skips")
      .delete()
      .or(`from_user.eq.${targetId},to_user.eq.${targetId}`);

    if (skipDeleteError) skipsTableAvailable = false;
  }

  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", targetId);

  if (error) {
    console.log("DELETE USER ERROR:", error);
    await sendMessage(adminId, "Ошибка удаления анкеты.");
    return;
  }

  await sendMessage(
    adminId,
    `🗑 Анкета удалена.\n\nID: ${targetId}\n${user.name || "Без имени"}, ${user.age || "?"}`
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

  const user = await getUser(targetId);

  if (!user) {
    await sendMessage(adminId, "Пользователь не найден.");
    return;
  }

  await updateUser(targetId, { is_vip: true });
  await sendMessage(adminId, `👑 VIP выдан пользователю ${targetId}.`);
  await sendMessage(targetId, "👑 Администратор выдал тебе VIP.\n\nТеперь доступны премиум-функции ❤️", keyboard());
}

async function banUser(adminId, targetId) {
  if (!isAdmin(adminId)) {
    await sendMessage(adminId, "Нет доступа.");
    return;
  }

  const user = await getUser(targetId);

  if (!user) {
    await sendMessage(adminId, "Пользователь не найден.");
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

  const user = await getUser(targetId);

  if (!user) {
    await sendMessage(adminId, "Пользователь не найден.");
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

  if (!user) {
    await sendMessage(userId, "Сначала создай анкету.");
    return;
  }

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
    await sendMessage(userId, "Пока тебя никто не лайкнул 😔", keyboard());
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

  await sendMessage(userId, text, keyboard());
}

async function processEditStep(userId, user, message, text, vkMessage) {
  if (user.step === "edit_menu") {
    if (message === "отмена") {
      await updateUser(userId, { step: "done" });
      await sendMessage(userId, "Изменения отменены.", keyboard());
      return true;
    }

    if (message === "имя") {
      await updateUser(userId, { step: "edit_name" });
      await sendMessage(userId, "Напиши новое имя:");
      return true;
    }

    if (message === "возраст") {
      await updateUser(userId, { step: "edit_age" });
      await sendMessage(userId, "Напиши новый возраст:");
      return true;
    }

    if (message === "город") {
      await updateUser(userId, { step: "edit_city" });
      await sendMessage(userId, "Напиши новый город:");
      return true;
    }

    if (message === "о себе") {
      await updateUser(userId, { step: "edit_about" });
      await sendMessage(userId, "Напиши новый текст «О себе»:");
      return true;
    }

    if (message === "фото") {
      await updateUser(userId, { step: "edit_photo" });
      await sendMessage(userId, "Отправь новое фото 📸");
      return true;
    }

    if (message === "кого ищу") {
      await updateUser(userId, { step: "edit_looking_for" });
      await sendMessage(userId, "Кого хочешь найти?", lookingKeyboard());
      return true;
    }

    if (message === "🗑 удалить анкету" || message === "удалить анкету") {
      await updateUser(userId, { step: "delete_confirm" });
      await sendMessage(
        userId,
        "⚠️ Точно удалить анкету?\n\nЛайки и история тоже будут удалены.",
        deleteConfirmKeyboard()
      );
      return true;
    }

    await sendMessage(userId, "Выбери, что хочешь изменить.", editKeyboard());
    return true;
  }

  if (user.step === "delete_confirm") {
    if (message === "да, удалить") {
      await deleteOwnProfile(userId);
      return true;
    }

    await updateUser(userId, { step: "done" });
    await sendMessage(userId, "Удаление отменено.", keyboard());
    return true;
  }

  if (user.step === "edit_name") {
    if (!text) {
      await sendMessage(userId, "Имя не может быть пустым.");
      return true;
    }

    await updateUser(userId, { name: text, step: "done" });
    await sendMessage(userId, "✅ Имя изменено.", keyboard());
    return true;
  }

  if (user.step === "edit_age") {
    const age = parseInt(text, 10);

    if (!age || age < 18 || age > 80) {
      await sendMessage(userId, "Напиши возраст цифрами от 18 до 80.");
      return true;
    }

    await updateUser(userId, { age, step: "done" });
    await sendMessage(userId, "✅ Возраст изменён.", keyboard());
    return true;
  }

  if (user.step === "edit_city") {
    if (!text) {
      await sendMessage(userId, "Город не может быть пустым.");
      return true;
    }

    await updateUser(userId, { city: text, step: "done" });
    await sendMessage(userId, "✅ Город изменён.", keyboard());
    return true;
  }

  if (user.step === "edit_about") {
    await updateUser(userId, { about: text, step: "done" });
    await sendMessage(userId, "✅ Описание изменено.", keyboard());
    return true;
  }

  if (user.step === "edit_photo") {
    const photo = getPhotoAttachment(vkMessage);

    if (!photo) {
      await sendMessage(userId, "Отправь именно фото 📸");
      return true;
    }

    await updateUser(userId, { photo, step: "done" });
    await sendMessage(userId, "✅ Фото изменено.", keyboard());
    return true;
  }

  if (user.step === "edit_looking_for") {
    let lookingFor = null;

    if (message === "ищу парня") lookingFor = "парень";
    if (message === "ищу девушку") lookingFor = "девушка";

    if (!lookingFor) {
      await sendMessage(userId, "Выбери вариант.", lookingKeyboard());
      return true;
    }

    await updateUser(userId, { looking_for: lookingFor, step: "done" });
    await sendMessage(userId, "✅ Настройка поиска изменена.", keyboard());
    return true;
  }

  return false;
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

  if (message === "новые анкеты") {
    await showNewProfiles(userId);
    return;
  }

  if (message.startsWith("поиск ")) {
    const targetId = Number(message.replace("поиск ", "").trim());

    if (!targetId) {
      await sendMessage(userId, "Напиши так: поиск 302920827");
      return;
    }

    await searchUserById(userId, targetId);
    return;
  }

  if (message.startsWith("удалить ")) {
    const targetId = Number(message.replace("удалить ", "").trim());

    if (!targetId) {
      await sendMessage(userId, "Напиши так: удалить 302920827");
      return;
    }

    await deleteUserById(userId, targetId);
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
    const code = text.replace(/^код\s+/i, "").trim();

    if (!code) {
      await sendMessage(userId, "Напиши так: код VIP-NEW-199");
      return;
    }

    await createVipCode(userId, code);
    return;
  }

  if (!user) {
    if (text.toUpperCase().startsWith("VIP-")) {
      await sendMessage(
        userId,
        "Сначала напиши «Старт» и создай анкету. После этого активируй VIP-код."
      );
      return;
    }

    await supabase
      .from("users")
      .insert([{ id: userId, step: "name" }]);

    await sendMessage(
      userId,
      "❤️ Добро пожаловать в Vector Love!\n\nНапиши свое имя 👇"
    );
    return;
  }

  if (text.toUpperCase().startsWith("VIP-")) {
    await activateVipCode(userId, text);
    return;
  }

  if (user.is_banned) {
    await sendMessage(userId, "🚫 Твоя анкета заблокирована из-за жалоб.", keyboard());
    return;
  }

  const handledEdit = await processEditStep(userId, user, message, text, vkMessage);
  if (handledEdit) return;

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
    await handleSkip(userId);
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

  if (message === "моя анкета" || message === "👤 моя анкета") {
    await showMyProfile(userId);
    return;
  }

  if (message === "изменить" || message === "✏️ изменить") {
    await showEditMenu(userId);
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
      "👑 VIP — 199₽ / месяц\n\n" +
      "Оплата через VK Donut ❤️\n\n" +
      "После оплаты напиши в сообщения сообщества:\n" +
      "«Хочу VIP-код»\n\n" +
      "Ты получишь:\n" +
      "• безлимитный просмотр анкет\n" +
      "• доступ к «Кто лайкнул»\n" +
      "• будущие VIP-функции 🔥",
      keyboard()
    );
    return;
  }

  if (message === "скрыть" || message === "🙈 скрыть") {
    await toggleHidden(userId);
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
      step: "name"
    });

    await sendMessage(userId, "Ок, заполним анкету заново.\n\nНапиши свое имя 👇");
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
    await sendMessage(userId, "Продолжаем анкету 👇");
    return;
  }

  if (user.step === "name") {
    await updateUser(userId, { name: text, step: "age" });
    await sendMessage(userId, "Сколько тебе лет? 🔞");
    return;
  }

  if (user.step === "age") {
    const age = parseInt(text, 10);

    if (!age || age < 18 || age > 80) {
      await sendMessage(userId, "Напиши возраст цифрами от 18 до 80.");
      return;
    }

    await updateUser(userId, { age, step: "city" });
    await sendMessage(userId, "Из какого ты города? 🏙");
    return;
  }

  if (user.step === "city") {
    await updateUser(userId, { city: text, step: "gender" });
    await sendMessage(userId, "Кто ты?", genderKeyboard());
    return;
  }

  if (user.step === "gender") {
    if (message !== "парень" && message !== "девушка") {
      await sendMessage(userId, "Выбери: Парень или Девушка", genderKeyboard());
      return;
    }

    await updateUser(userId, { gender: message, step: "looking_for" });
    await sendMessage(userId, "Кого хочешь найти?", lookingKeyboard());
    return;
  }

  if (user.step === "looking_for") {
    let lookingFor = null;

    if (message === "ищу парня") lookingFor = "парень";
    if (message === "ищу девушку") lookingFor = "девушка";

    if (!lookingFor) {
      await sendMessage(userId, "Выбери вариант", lookingKeyboard());
      return;
    }

    await updateUser(userId, { looking_for: lookingFor, step: "about" });
    await sendMessage(userId, "Расскажи коротко о себе ✨");
    return;
  }

  if (user.step === "about") {
    await updateUser(userId, { about: text, step: "photo" });
    await sendMessage(userId, "Теперь отправь фото 📸");
    return;
  }

  if (user.step === "photo") {
    const photo = getPhotoAttachment(vkMessage);

    if (!photo) {
      await sendMessage(userId, "Отправь именно фото 📸");
      return;
    }

    await updateUser(userId, { photo, step: "done" });
    await sendMessage(
      userId,
      "🔥 Анкета готова!\n\nТеперь нажми «👀 Смотреть» ❤️",
      keyboard()
    );
    return;
  }

  if (user.step === "done") {
    await sendMessage(userId, "Нажми «👀 Смотреть».", keyboard());
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
