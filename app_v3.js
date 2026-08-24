const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

const TOKEN = process.env.VK_TOKEN || "";
const CONFIRMATION_TOKEN = "38f02508";

const FREE_DAILY_LIMIT = 20;
const VIP_DAYS = 30;
const ADMIN_IDS = [302920827];

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

function isAdmin(userId) {
  return ADMIN_IDS.includes(userId);
}

function mainKeyboard() {
  return JSON.stringify({
    one_time: false,
    buttons: [
      [{ action: { type: "text", label: "👀 Смотреть" }, color: "primary" }],
      [
        { action: { type: "text", label: "❤️ Лайк" }, color: "positive" },
        { action: { type: "text", label: "👎 Далее" }, color: "negative" },
        { action: { type: "text", label: "⛔ В ЧС" }, color: "negative" }
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
        { action: { type: "text", label: "✏️ Изменить" }, color: "secondary" },
        { action: { type: "text", label: "🎯 Возраст" }, color: "secondary" }
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
        { action: { type: "text", label: "📋 Чёрный список" }, color: "secondary" },
        { action: { type: "text", label: "🗑 Удалить анкету" }, color: "negative" }
      ],
      [{ action: { type: "text", label: "Отмена" }, color: "secondary" }]
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

function reportReasonKeyboard() {
  return JSON.stringify({
    one_time: true,
    buttons: [
      [
        { action: { type: "text", label: "Фейк" }, color: "secondary" },
        { action: { type: "text", label: "Реклама" }, color: "secondary" }
      ],
      [
        { action: { type: "text", label: "Оскорбления" }, color: "secondary" },
        { action: { type: "text", label: "18+ контент" }, color: "secondary" }
      ],
      [
        { action: { type: "text", label: "Другая причина" }, color: "secondary" },
        { action: { type: "text", label: "Отмена" }, color: "secondary" }
      ]
    ]
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
  return error;
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

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateRu(value) {
  if (!value) return "без срока";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "без срока";
  return d.toLocaleDateString("ru-RU");
}

function isVipActive(user) {
  if (!user?.is_vip) return false;
  if (!user.vip_until) return true;
  return new Date(user.vip_until).getTime() > Date.now();
}

async function normalizeVip(user) {
  if (!user) return user;
  if (user.is_vip && user.vip_until && !isVipActive(user)) {
    await updateUser(user.id, { is_vip: false });
    user.is_vip = false;
  }
  return user;
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
  user = await normalizeVip(user);
  if (isVipActive(user)) return true;
  user = await resetViewsIfNeeded(user);
  return (user.daily_views || 0) < FREE_DAILY_LIMIT;
}

async function increaseViews(user) {
  user = await normalizeVip(user);
  if (isVipActive(user)) return;

  await updateUser(user.id, {
    daily_views: (user.daily_views || 0) + 1,
    last_view_date: todayDate()
  });
}

async function getSkippedIds(userId) {
  const { data, error } = await supabase
    .from("skips")
    .select("to_user")
    .eq("from_user", userId);

  if (error) {
    console.log("GET SKIPS ERROR:", error);
    return [];
  }

  return (data || []).map(x => x.to_user);
}

async function saveSkip(userId, targetId) {
  const { error } = await supabase
    .from("skips")
    .upsert(
      [{ from_user: userId, to_user: targetId }],
      { onConflict: "from_user,to_user" }
    );

  if (error) console.log("SAVE SKIP ERROR:", error);
}

async function getBlockedIds(userId) {
  const { data, error } = await supabase
    .from("blocks")
    .select("from_user,to_user")
    .or(`from_user.eq.${userId},to_user.eq.${userId}`);

  if (error) {
    console.log("GET BLOCKS ERROR:", error);
    return [];
  }

  const ids = new Set();
  for (const item of data || []) {
    if (item.from_user === userId) ids.add(item.to_user);
    if (item.to_user === userId) ids.add(item.from_user);
  }
  return Array.from(ids);
}

async function recordProfileView(viewerId, viewedId) {
  const { error } = await supabase
    .from("profile_views")
    .insert([{ viewer_id: viewerId, viewed_id: viewedId }]);

  if (error) console.log("PROFILE VIEW ERROR:", error);
}

async function getProfileStats(userId) {
  const { count: views } = await supabase
    .from("profile_views")
    .select("*", { count: "exact", head: true })
    .eq("viewed_id", userId);

  const { count: likes } = await supabase
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("to_user", userId);

  return {
    views: views || 0,
    likes: likes || 0
  };
}

function weightedPick(profiles) {
  if (!profiles.length) return null;

  const weighted = [];
  for (const profile of profiles) {
    const weight = isVipActive(profile) ? 3 : 1;
    for (let i = 0; i < weight; i += 1) weighted.push(profile);
  }

  return weighted[Math.floor(Math.random() * weighted.length)];
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
    await sendMessage(userId, "Ошибка проверки VIP-кода 😔", mainKeyboard());
    return;
  }

  if (!vipCode) {
    await sendMessage(userId, "❌ VIP-код не найден.", mainKeyboard());
    return;
  }

  if (vipCode.is_used) {
    await sendMessage(userId, "❌ Этот VIP-код уже использован.", mainKeyboard());
    return;
  }

  const current = await normalizeVip(user);
  const base = isVipActive(current) && current.vip_until
    ? new Date(current.vip_until)
    : new Date();
  const vipUntil = addDays(base, VIP_DAYS).toISOString();

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
    await sendMessage(userId, "Не удалось активировать VIP-код 😔", mainKeyboard());
    return;
  }

  await updateUser(userId, {
    is_vip: true,
    vip_until: vipUntil
  });

  await sendMessage(
    userId,
    `👑 VIP активирован до ${formatDateRu(vipUntil)}!\n\n` +
    "• безлимитный просмотр\n" +
    "• «Кто лайкнул» карточками\n" +
    "• приоритет твоей анкеты в выдаче 🔥",
    mainKeyboard()
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
      mainKeyboard()
    );
    return;
  }

  currentUser = await getUser(userId);

  const [{ data: liked }, { data: reported }, skippedIds, blockedIds] = await Promise.all([
    supabase.from("likes").select("to_user").eq("from_user", userId),
    supabase.from("reports").select("to_user").eq("from_user", userId),
    getSkippedIds(userId),
    getBlockedIds(userId)
  ]);

  const excludedIds = new Set([userId]);
  for (const item of liked || []) excludedIds.add(item.to_user);
  for (const item of reported || []) excludedIds.add(item.to_user);
  for (const id of skippedIds) excludedIds.add(id);
  for (const id of blockedIds) excludedIds.add(id);

  let query = supabase
    .from("users")
    .select("*")
    .eq("step", "done")
    .eq("is_banned", false)
    .eq("is_hidden", false)
    .gte("age", currentUser.age_min || 18)
    .lte("age", currentUser.age_max || 80)
    .limit(50);

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
    await sendMessage(userId, "Ошибка загрузки анкет 😔", mainKeyboard());
    return;
  }

  if (!profiles || profiles.length === 0) {
    await updateUser(userId, { viewing_user: null, viewing_mode: "browse" });
    await sendMessage(userId, "Пока нет новых подходящих анкет 😔", mainKeyboard());
    return;
  }

  const sameCity = profiles.filter(
    p => p.city && currentUser.city &&
      p.city.trim().toLowerCase() === currentUser.city.trim().toLowerCase()
  );

  const pool = sameCity.length > 0 ? sameCity : profiles;
  const profile = weightedPick(pool);

  await increaseViews(currentUser);
  currentUser = await getUser(userId);

  await Promise.all([
    updateUser(userId, { viewing_user: profile.id, viewing_mode: "browse" }),
    recordProfileView(userId, profile.id)
  ]);

  const text =
    `✨ Анкета\n\n` +
    `Имя: ${profile.name || "Не указано"}\n` +
    `Возраст: ${profile.age || "Не указан"}\n` +
    `Город: ${profile.city || "Не указан"}\n` +
    `О себе: ${profile.about || "Не указано"}\n\n` +
    (isVipActive(profile) ? "👑 VIP-профиль\n" : "") +
    `📊 Осталось просмотров: ${isVipActive(currentUser) ? "∞" : Math.max(0, FREE_DAILY_LIMIT - (currentUser.daily_views || 0))}`;

  await sendMessage(userId, text, mainKeyboard(), profile.photo || null);
}

async function showWhoLikedCard(userId) {
  let user = await normalizeVip(await getUser(userId));

  if (!user) {
    await sendMessage(userId, "Сначала создай анкету.");
    return;
  }

  if (!isVipActive(user)) {
    await sendMessage(
      userId,
      "👑 Это VIP-функция.\n\nС VIP ты увидишь анкеты тех, кто поставил тебе лайк ❤️",
      mainKeyboard()
    );
    return;
  }

  const [{ data: likes }, { data: dismissed }, blockedIds] = await Promise.all([
    supabase.from("likes").select("from_user").eq("to_user", userId),
    supabase.from("like_dismissals").select("liker_id").eq("user_id", userId),
    getBlockedIds(userId)
  ]);

  const dismissedIds = new Set((dismissed || []).map(x => x.liker_id));
  const blocked = new Set(blockedIds);
  const likerIds = (likes || [])
    .map(x => x.from_user)
    .filter(id => !dismissedIds.has(id) && !blocked.has(id));

  if (!likerIds.length) {
    await updateUser(userId, { viewing_user: null, viewing_mode: "browse" });
    await sendMessage(userId, "Пока новых лайков нет 😔", mainKeyboard());
    return;
  }

  const { data: outgoing } = await supabase
    .from("likes")
    .select("to_user")
    .eq("from_user", userId)
    .in("to_user", likerIds);

  const alreadyLiked = new Set((outgoing || []).map(x => x.to_user));
  const pendingIds = likerIds.filter(id => !alreadyLiked.has(id));

  if (!pendingIds.length) {
    await updateUser(userId, { viewing_user: null, viewing_mode: "browse" });
    await sendMessage(userId, "Все входящие лайки уже обработаны ❤️", mainKeyboard());
    return;
  }

  const { data: profiles, error } = await supabase
    .from("users")
    .select("*")
    .in("id", pendingIds)
    .eq("step", "done")
    .eq("is_banned", false)
    .eq("is_hidden", false)
    .limit(20);

  if (error || !profiles || profiles.length === 0) {
    if (error) console.log("WHO LIKED ERROR:", error);
    await sendMessage(userId, "Пока новых лайков нет 😔", mainKeyboard());
    return;
  }

  const profile = profiles[0];
  await updateUser(userId, { viewing_user: profile.id, viewing_mode: "liked" });

  const text =
    `👑 Тебя лайкнул(а)\n\n` +
    `${profile.name || "Без имени"}, ${profile.age || "?"}\n` +
    `${profile.city || "Город не указан"}\n` +
    `${profile.about || "О себе не указано"}\n\n` +
    `❤️ Нажми «Лайк» — и будет взаимная симпатия.\n` +
    `👎 «Далее» — пропустить.`;

  await sendMessage(userId, text, mainKeyboard(), profile.photo || null);
}

async function handleLike(userId) {
  const user = await getUser(userId);

  if (!user || !user.viewing_user) {
    await sendMessage(userId, "Сначала нажми «👀 Смотреть» или открой «👑 Кто лайкнул».", mainKeyboard());
    return;
  }

  const targetId = user.viewing_user;
  const mode = user.viewing_mode || "browse";

  const { error } = await supabase
    .from("likes")
    .upsert(
      [{ from_user: userId, to_user: targetId }],
      { onConflict: "from_user,to_user", ignoreDuplicates: true }
    );

  if (error) console.log("LIKE ERROR:", error);

  const { data: match } = await supabase
    .from("likes")
    .select("*")
    .eq("from_user", targetId)
    .eq("to_user", userId)
    .maybeSingle();

  if (match) {
    const [otherUser, currentUser] = await Promise.all([
      getUser(targetId),
      getUser(userId)
    ]);

    await sendMessage(
      userId,
      `❤️ ВЗАИМНАЯ СИМПАТИЯ!\n\n` +
      `${otherUser?.name || "Пользователь"}, ${otherUser?.age || "?"}\n` +
      `👉 https://vk.com/id${targetId}\n\n` +
      `Самое время написать первым 😏`,
      mainKeyboard(),
      otherUser?.photo || null
    );

    await sendMessage(
      targetId,
      `❤️ ВЗАИМНАЯ СИМПАТИЯ!\n\n` +
      `${currentUser?.name || "Пользователь"}, ${currentUser?.age || "?"}\n` +
      `👉 https://vk.com/id${userId}\n\n` +
      `Кажется, пора знакомиться 😊`,
      mainKeyboard(),
      currentUser?.photo || null
    );
  } else {
    await sendMessage(userId, "❤️ Лайк отправлен!", mainKeyboard());
    await sendMessage(
      targetId,
      "❤️ Тебя кто-то лайкнул!\n\nНажми «👑 Кто лайкнул», чтобы посмотреть.",
      mainKeyboard()
    );
  }

  await updateUser(userId, { viewing_user: null, viewing_mode: "browse" });

  if (mode === "liked") {
    await showWhoLikedCard(userId);
  } else {
    await showProfile(userId);
  }
}

async function handleSkip(userId) {
  const user = await getUser(userId);

  if (!user || !user.viewing_user) {
    await sendMessage(userId, "Сначала открой анкету.", mainKeyboard());
    return;
  }

  const targetId = user.viewing_user;
  const mode = user.viewing_mode || "browse";

  if (mode === "liked") {
    const { error } = await supabase
      .from("like_dismissals")
      .upsert(
        [{ user_id: userId, liker_id: targetId }],
        { onConflict: "user_id,liker_id" }
      );
    if (error) console.log("LIKE DISMISS ERROR:", error);
  } else {
    await saveSkip(userId, targetId);
  }

  await updateUser(userId, { viewing_user: null, viewing_mode: "browse" });

  if (mode === "liked") {
    await showWhoLikedCard(userId);
  } else {
    await showProfile(userId);
  }
}

async function handleBlock(userId) {
  const user = await getUser(userId);

  if (!user || !user.viewing_user) {
    await sendMessage(
      userId,
      "Сначала открой анкету, которую хочешь добавить в чёрный список.",
      mainKeyboard()
    );
    return;
  }

  const targetId = user.viewing_user;
  const mode = user.viewing_mode || "browse";

  const { error } = await supabase
    .from("blocks")
    .upsert(
      [{ from_user: userId, to_user: targetId }],
      { onConflict: "from_user,to_user" }
    );

  if (error) {
    console.log("BLOCK ERROR:", error);
    await sendMessage(userId, "Не получилось добавить в ЧС.", mainKeyboard());
    return;
  }

  await updateUser(userId, { viewing_user: null, viewing_mode: "browse" });
  await sendMessage(userId, "⛔ Пользователь добавлен в чёрный список.", mainKeyboard());

  if (mode === "liked") {
    await showWhoLikedCard(userId);
  } else {
    await showProfile(userId);
  }
}

async function showBlockList(userId) {
  const { data: blocks, error } = await supabase
    .from("blocks")
    .select("to_user")
    .eq("from_user", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.log("BLOCK LIST ERROR:", error);
    await sendMessage(userId, "Ошибка загрузки чёрного списка.", mainKeyboard());
    return;
  }

  if (!blocks || !blocks.length) {
    await sendMessage(userId, "📋 Чёрный список пуст.", mainKeyboard());
    return;
  }

  const ids = blocks.map(x => x.to_user);
  const { data: users } = await supabase
    .from("users")
    .select("id,name,age")
    .in("id", ids);

  const byId = new Map((users || []).map(x => [x.id, x]));
  let text = "📋 Чёрный список:\n\n";

  for (const id of ids) {
    const u = byId.get(id);
    text += `${u?.name || "Пользователь"}, ${u?.age || "?"} — ID ${id}\n`;
  }

  text += "\nЧтобы вернуть человека: разблокировать ID";
  await sendMessage(userId, text, mainKeyboard());
}

async function unblockUser(userId, targetId) {
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("from_user", userId)
    .eq("to_user", targetId);

  if (error) {
    console.log("UNBLOCK ERROR:", error);
    await sendMessage(userId, "Не получилось убрать из ЧС.", mainKeyboard());
    return;
  }

  await sendMessage(userId, `✅ Пользователь ${targetId} убран из чёрного списка.`, mainKeyboard());
}

async function startReport(userId) {
  const user = await getUser(userId);

  if (!user || !user.viewing_user) {
    await sendMessage(userId, "Сначала открой анкету через «👀 Смотреть».", mainKeyboard());
    return;
  }

  await updateUser(userId, {
    action_state: "report_reason",
    action_target: user.viewing_user
  });

  await sendMessage(userId, "🚫 Выбери причину жалобы:", reportReasonKeyboard());
}

async function submitReport(userId, reason) {
  const user = await getUser(userId);
  const targetId = user?.action_target;

  if (!targetId) {
    await updateUser(userId, { action_state: null, action_target: null });
    await sendMessage(userId, "Анкета для жалобы не найдена.", mainKeyboard());
    return;
  }

  const { error } = await supabase
    .from("reports")
    .upsert(
      [{ from_user: userId, to_user: targetId, reason }],
      { onConflict: "from_user,to_user", ignoreDuplicates: true }
    );

  await updateUser(userId, {
    action_state: null,
    action_target: null,
    viewing_user: null,
    viewing_mode: "browse"
  });

  if (error) {
    console.log("REPORT ERROR:", error);
    await sendMessage(userId, "Не получилось отправить жалобу.", mainKeyboard());
    return;
  }

  const { data: reports } = await supabase
    .from("reports")
    .select("from_user")
    .eq("to_user", targetId);

  const uniqueReporters = new Set((reports || []).map(x => x.from_user));
  if (uniqueReporters.size >= 3) {
    await updateUser(targetId, { is_banned: true });
  }

  await sendMessage(userId, "🚫 Жалоба отправлена. Эта анкета больше не попадётся тебе.", mainKeyboard());
  await showProfile(userId);
}

async function processActionState(userId, user, message) {
  if (user.action_state !== "report_reason") return false;

  if (message === "отмена") {
    await updateUser(userId, { action_state: null, action_target: null });
    await sendMessage(userId, "Жалоба отменена.", mainKeyboard());
    return true;
  }

  const reasons = new Map([
    ["фейк", "Фейк"],
    ["реклама", "Реклама"],
    ["оскорбления", "Оскорбления"],
    ["18+ контент", "18+ контент"],
    ["другая причина", "Другая причина"]
  ]);

  if (!reasons.has(message)) {
    await sendMessage(userId, "Выбери причину кнопкой ниже.", reportReasonKeyboard());
    return true;
  }

  await submitReport(userId, reasons.get(message));
  return true;
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
      ? "🙈 Анкета скрыта. Теперь она не будет показываться другим пользователям."
      : "👀 Анкета снова видна другим пользователям.",
    mainKeyboard()
  );
}

async function showMyProfile(userId) {
  let user = await normalizeVip(await getUser(userId));
  if (!user) {
    await sendMessage(userId, "Анкета не найдена.");
    return;
  }

  user = await resetViewsIfNeeded(user);
  const stats = await getProfileStats(userId);

  const viewsLeft = isVipActive(user)
    ? "∞"
    : Math.max(0, FREE_DAILY_LIMIT - (user.daily_views || 0));

  const vipText = isVipActive(user)
    ? `Да${user.vip_until ? `, до ${formatDateRu(user.vip_until)}` : ""}`
    : "Нет";

  const text =
    `👤 Моя анкета\n\n` +
    `Имя: ${user.name || "Не указано"}\n` +
    `Возраст: ${user.age || "Не указан"}\n` +
    `Город: ${user.city || "Не указан"}\n` +
    `Пол: ${user.gender || "Не указан"}\n` +
    `Ищу: ${user.looking_for || "Не указано"}\n` +
    `Возраст поиска: ${user.age_min || 18}–${user.age_max || 80}\n` +
    `О себе: ${user.about || "Не указано"}\n\n` +
    `👑 VIP: ${vipText}\n` +
    `🙈 Скрыта: ${user.is_hidden ? "Да" : "Нет"}\n` +
    `📊 Осталось просмотров: ${viewsLeft}\n\n` +
    `📈 Статистика анкеты\n` +
    `👀 Просмотров: ${stats.views}\n` +
    `❤️ Лайков: ${stats.likes}`;

  await sendMessage(userId, text, mainKeyboard(), user.photo || null);
}

async function showEditMenu(userId) {
  const user = await getUser(userId);

  if (!user || user.step !== "done") {
    await sendMessage(userId, "Сначала закончи анкету.", mainKeyboard());
    return;
  }

  await updateUser(userId, { step: "edit_menu" });
  await sendMessage(userId, "✏️ Что хочешь изменить?", editKeyboard());
}

async function startAgeFilter(userId) {
  const user = await getUser(userId);

  if (!user || user.step !== "done") {
    await sendMessage(userId, "Сначала закончи анкету.", mainKeyboard());
    return;
  }

  await updateUser(userId, { step: "filter_age_min" });
  await sendMessage(
    userId,
    `🎯 Сейчас: ${user.age_min || 18}–${user.age_max || 80} лет.\n\nНапиши минимальный возраст:`
  );
}

async function deleteOwnProfile(userId) {
  const user = await getUser(userId);
  if (!user) {
    await sendMessage(userId, "Анкета уже удалена.");
    return;
  }

  await Promise.all([
    supabase.from("likes").delete().or(`from_user.eq.${userId},to_user.eq.${userId}`),
    supabase.from("reports").delete().or(`from_user.eq.${userId},to_user.eq.${userId}`),
    supabase.from("skips").delete().or(`from_user.eq.${userId},to_user.eq.${userId}`),
    supabase.from("blocks").delete().or(`from_user.eq.${userId},to_user.eq.${userId}`),
    supabase.from("profile_views").delete().or(`viewer_id.eq.${userId},viewed_id.eq.${userId}`),
    supabase.from("like_dismissals").delete().or(`user_id.eq.${userId},liker_id.eq.${userId}`)
  ]);

  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId);

  if (error) {
    console.log("DELETE OWN PROFILE ERROR:", error);
    await sendMessage(userId, "Не получилось удалить анкету. Попробуй позже.", mainKeyboard());
    return;
  }

  await sendMessage(userId, "🗑 Анкета удалена.\n\nЕсли захочешь вернуться — просто напиши «Старт» ❤️");
}

async function processEditStep(userId, user, message, text, vkMessage) {
  if (user.step === "edit_menu") {
    if (message === "отмена") {
      await updateUser(userId, { step: "done" });
      await sendMessage(userId, "Изменения отменены.", mainKeyboard());
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

    if (message === "📋 чёрный список" || message === "чёрный список") {
      await updateUser(userId, { step: "done" });
      await showBlockList(userId);
      return true;
    }

    if (message === "🗑 удалить анкету" || message === "удалить анкету") {
      await updateUser(userId, { step: "delete_confirm" });
      await sendMessage(
        userId,
        "⚠️ Точно удалить анкету?\n\nЛайки, просмотры и история тоже будут удалены.",
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
    await sendMessage(userId, "Удаление отменено.", mainKeyboard());
    return true;
  }

  if (user.step === "edit_name") {
    if (!text) {
      await sendMessage(userId, "Имя не может быть пустым.");
      return true;
    }
    await updateUser(userId, { name: text, step: "done" });
    await sendMessage(userId, "✅ Имя изменено.", mainKeyboard());
    return true;
  }

  if (user.step === "edit_age") {
    const age = parseInt(text, 10);
    if (!age || age < 18 || age > 80) {
      await sendMessage(userId, "Напиши возраст цифрами от 18 до 80.");
      return true;
    }
    await updateUser(userId, { age, step: "done" });
    await sendMessage(userId, "✅ Возраст изменён.", mainKeyboard());
    return true;
  }

  if (user.step === "edit_city") {
    if (!text) {
      await sendMessage(userId, "Город не может быть пустым.");
      return true;
    }
    await updateUser(userId, { city: text, step: "done" });
    await sendMessage(userId, "✅ Город изменён.", mainKeyboard());
    return true;
  }

  if (user.step === "edit_about") {
    await updateUser(userId, { about: text, step: "done" });
    await sendMessage(userId, "✅ Описание изменено.", mainKeyboard());
    return true;
  }

  if (user.step === "edit_photo") {
    const photo = getPhotoAttachment(vkMessage);
    if (!photo) {
      await sendMessage(userId, "Отправь именно фото 📸");
      return true;
    }
    await updateUser(userId, { photo, step: "done" });
    await sendMessage(userId, "✅ Фото изменено.", mainKeyboard());
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
    await sendMessage(userId, "✅ Настройка поиска изменена.", mainKeyboard());
    return true;
  }

  if (user.step === "filter_age_min") {
    const minAge = parseInt(text, 10);
    if (!minAge || minAge < 18 || minAge > 80) {
      await sendMessage(userId, "Минимальный возраст — от 18 до 80.");
      return true;
    }

    await updateUser(userId, {
      age_min: minAge,
      step: "filter_age_max"
    });
    await sendMessage(userId, `Минимум ${minAge}. Теперь напиши максимальный возраст:`);
    return true;
  }

  if (user.step === "filter_age_max") {
    const maxAge = parseInt(text, 10);
    const freshUser = await getUser(userId);
    const minAge = freshUser.age_min || 18;

    if (!maxAge || maxAge < minAge || maxAge > 80) {
      await sendMessage(userId, `Максимальный возраст должен быть от ${minAge} до 80.`);
      return true;
    }

    await updateUser(userId, {
      age_max: maxAge,
      step: "done"
    });
    await sendMessage(userId, `✅ Фильтр установлен: ${minAge}–${maxAge} лет.`, mainKeyboard());
    return true;
  }

  return false;
}

async function showAdminPanel(userId) {
  if (!isAdmin(userId)) {
    await sendMessage(userId, "Нет доступа.");
    return;
  }

  const [total, ready, vip, banned, reports] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("step", "done"),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("is_vip", true),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("is_banned", true),
    supabase.from("reports").select("*", { count: "exact", head: true })
  ]);

  await sendMessage(
    userId,
    `🛠 Админка Vector Love\n\n` +
    `👥 Пользователей всего: ${total.count || 0}\n` +
    `✅ Готовых анкет: ${ready.count || 0}\n` +
    `👑 VIP: ${vip.count || 0}\n` +
    `🚫 Забанено: ${banned.count || 0}\n` +
    `⚠️ Жалоб всего: ${reports.count || 0}\n\n` +
    `Команды:\n` +
    `статистика\nжалобы\nновые анкеты\nпоиск ID\nудалить ID\n` +
    `выдать vip ID\nбан ID\nразбан ID\nкод VIP-XXX`
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

  if (!users || !users.length) {
    await sendMessage(userId, "Анкет пока нет.");
    return;
  }

  let text = "🆕 Последние анкеты:\n\n";
  for (const user of users) {
    text += `ID: ${user.id}\n${user.name || "Без имени"}, ${user.age || "?"}\n${user.city || "Не указан"}\n\n`;
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

  const stats = await getProfileStats(targetId);
  const text =
    `🔎 Анкета пользователя\n\n` +
    `ID: ${user.id}\nИмя: ${user.name || "Не указано"}\n` +
    `Возраст: ${user.age || "Не указан"}\nГород: ${user.city || "Не указан"}\n` +
    `Пол: ${user.gender || "Не указан"}\nИщет: ${user.looking_for || "Не указано"}\n` +
    `Возраст поиска: ${user.age_min || 18}–${user.age_max || 80}\n` +
    `О себе: ${user.about || "Не указано"}\n\n` +
    `Шаг: ${user.step || "Не указан"}\nVIP: ${isVipActive(user) ? "Да" : "Нет"}\n` +
    `VIP до: ${user.vip_until ? formatDateRu(user.vip_until) : "—"}\n` +
    `Скрыта: ${user.is_hidden ? "Да" : "Нет"}\nЗабанен: ${user.is_banned ? "Да" : "Нет"}\n` +
    `Просмотров сегодня: ${user.daily_views || 0}\n` +
    `Всего просмотров анкеты: ${stats.views}\nЛайков: ${stats.likes}`;

  await sendMessage(adminId, text, null, user.photo || null);
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

  await Promise.all([
    supabase.from("likes").delete().or(`from_user.eq.${targetId},to_user.eq.${targetId}`),
    supabase.from("reports").delete().or(`from_user.eq.${targetId},to_user.eq.${targetId}`),
    supabase.from("skips").delete().or(`from_user.eq.${targetId},to_user.eq.${targetId}`),
    supabase.from("blocks").delete().or(`from_user.eq.${targetId},to_user.eq.${targetId}`),
    supabase.from("profile_views").delete().or(`viewer_id.eq.${targetId},viewed_id.eq.${targetId}`),
    supabase.from("like_dismissals").delete().or(`user_id.eq.${targetId},liker_id.eq.${targetId}`)
  ]);

  const { error } = await supabase.from("users").delete().eq("id", targetId);

  if (error) {
    console.log("DELETE USER ERROR:", error);
    await sendMessage(adminId, "Ошибка удаления анкеты.");
    return;
  }

  await sendMessage(adminId, `🗑 Анкета удалена.\n\nID: ${targetId}\n${user.name || "Без имени"}, ${user.age || "?"}`);
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
    .limit(15);

  if (error) {
    await sendMessage(userId, "Ошибка загрузки жалоб.");
    return;
  }

  if (!reports || !reports.length) {
    await sendMessage(userId, "Жалоб пока нет.");
    return;
  }

  let text = "⚠️ Последние жалобы:\n\n";
  for (const report of reports) {
    text += `От: ${report.from_user}\nНа: ${report.to_user}\nПричина: ${report.reason || "не указана"}\n\n`;
  }

  await sendMessage(userId, text);
}

async function giveVip(adminId, targetId) {
  if (!isAdmin(adminId)) {
    await sendMessage(adminId, "Нет доступа.");
    return;
  }

  let user = await normalizeVip(await getUser(targetId));
  if (!user) {
    await sendMessage(adminId, "Пользователь не найден.");
    return;
  }

  const base = isVipActive(user) && user.vip_until ? new Date(user.vip_until) : new Date();
  const vipUntil = addDays(base, VIP_DAYS).toISOString();

  await updateUser(targetId, { is_vip: true, vip_until: vipUntil });
  await sendMessage(adminId, `👑 VIP выдан пользователю ${targetId} до ${formatDateRu(vipUntil)}.`);
  await sendMessage(targetId, `👑 Администратор выдал тебе VIP до ${formatDateRu(vipUntil)} ❤️`, mainKeyboard());
}

async function banUser(adminId, targetId) {
  if (!isAdmin(adminId)) {
    await sendMessage(adminId, "Нет доступа.");
    return;
  }

  if (!await getUser(targetId)) {
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

  if (!await getUser(targetId)) {
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
  const { error } = await supabase.from("vip_codes").insert([{ code: upperCode }]);

  if (error) {
    await sendMessage(adminId, "Такой код уже есть или ошибка создания.");
    return;
  }

  await sendMessage(adminId, `✅ VIP-код создан:\n${upperCode}`);
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

  if (message.startsWith("разблокировать ")) {
    const targetId = Number(message.replace("разблокировать ", "").trim());
    if (!targetId) {
      await sendMessage(userId, "Напиши так: разблокировать 123456789", mainKeyboard());
      return;
    }
    await unblockUser(userId, targetId);
    return;
  }

  if (!user) {
    if (text.toUpperCase().startsWith("VIP-")) {
      await sendMessage(userId, "Сначала напиши «Старт» и создай анкету. После этого активируй VIP-код.");
      return;
    }

    const { error } = await supabase
      .from("users")
      .insert([{ id: userId, step: "name", age_min: 18, age_max: 80, viewing_mode: "browse" }]);

    if (error) {
      console.log("CREATE USER ERROR:", error);
      await sendMessage(userId, "Не получилось начать регистрацию 😔");
      return;
    }

    await sendMessage(userId, "❤️ Добро пожаловать в Vector Love!\n\nНапиши свое имя 👇");
    return;
  }

  if (text.toUpperCase().startsWith("VIP-")) {
    await activateVipCode(userId, text);
    return;
  }

  user = await normalizeVip(user);

  if (user.is_banned) {
    await sendMessage(userId, "🚫 Твоя анкета заблокирована из-за жалоб.", mainKeyboard());
    return;
  }

  if (await processActionState(userId, user, message)) return;
  if (await processEditStep(userId, user, message, text, vkMessage)) return;

  if (message === "смотреть" || message === "👀 смотреть") {
    if (user.step !== "done") {
      await sendMessage(userId, "Сначала закончи анкету.", mainKeyboard());
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

  if (message === "⛔ в чс" || message === "в чс") {
    await handleBlock(userId);
    return;
  }

  if (message === "жалоба" || message === "🚫 жалоба") {
    await startReport(userId);
    return;
  }

  if (message === "кто лайкнул" || message === "👑 кто лайкнул") {
    await showWhoLikedCard(userId);
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

  if (message === "возраст" || message === "🎯 возраст") {
    await startAgeFilter(userId);
    return;
  }

  if (message === "чёрный список" || message === "📋 чёрный список") {
    await showBlockList(userId);
    return;
  }

  if (message === "лимит" || message === "📊 лимит") {
    user = await resetViewsIfNeeded(user);
    const left = isVipActive(user)
      ? "∞"
      : Math.max(0, FREE_DAILY_LIMIT - (user.daily_views || 0));

    await sendMessage(userId, `📊 Осталось просмотров сегодня: ${left}`, mainKeyboard());
    return;
  }

  if (message === "vip" || message === "👑 vip") {
    const vipInfo = isVipActive(user)
      ? `\n\n✅ Твой VIP активен${user.vip_until ? ` до ${formatDateRu(user.vip_until)}` : ""}.`
      : "";

    await sendMessage(
      userId,
      "👑 VIP — 199₽ / месяц\n\n" +
      "• безлимитный просмотр анкет\n" +
      "• «Кто лайкнул» карточками\n" +
      "• приоритет анкеты в выдаче\n\n" +
      "После оплаты напиши VIP-код в сообщения сообщества." + vipInfo,
      mainKeyboard()
    );
    return;
  }

  if (message === "скрыть" || message === "🙈 скрыть") {
    await toggleHidden(userId);
    return;
  }

  if ((message === "старт" || message === "начать") && user.step === "done") {
    await sendMessage(userId, "❤️ Твоя анкета уже создана.\n\nНажми «👀 Смотреть».", mainKeyboard());
    return;
  }

  if (message === "старт" || message === "начать") {
    await sendMessage(userId, "Продолжаем анкету 👇");
    return;
  }

  if (user.step === "name") {
    if (!text) {
      await sendMessage(userId, "Напиши имя текстом.");
      return;
    }
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
    if (!text) {
      await sendMessage(userId, "Напиши название города.");
      return;
    }
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

    await updateUser(userId, {
      photo,
      step: "done",
      age_min: user.age_min || 18,
      age_max: user.age_max || 80,
      viewing_mode: "browse"
    });

    await sendMessage(
      userId,
      "🔥 Анкета готова!\n\nТеперь нажми «👀 Смотреть» ❤️",
      mainKeyboard()
    );
    return;
  }

  if (user.step === "done") {
    await sendMessage(userId, "Нажми «👀 Смотреть».", mainKeyboard());
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
  res.send("Vector Love bot v3 is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Vector Love v3 started on port ${PORT}`);
});
