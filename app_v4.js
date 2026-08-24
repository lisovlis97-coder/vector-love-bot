const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

const TOKEN = process.env.VK_TOKEN || "";
const CONFIRMATION_TOKEN = "38f02508";
const FREE_DAILY_LIMIT = 20;
const VIP_DAYS = 30;
const BOOST_HOURS = 6;
const ADMIN_IDS = [302920827];

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function isAdmin(userId) { return ADMIN_IDS.includes(userId); }
function todayDate() { return new Date().toISOString().split("T")[0]; }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function addHours(date, hours) { const d = new Date(date); d.setHours(d.getHours() + hours); return d; }
function formatDateRu(value) { if (!value) return "без срока"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "без срока" : d.toLocaleDateString("ru-RU"); }
function formatDateTimeRu(value) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU"); }
function isVipActive(user) { if (!user?.is_vip) return false; if (!user.vip_until) return true; return new Date(user.vip_until).getTime() > Date.now(); }
function isBoostActive(user) { return Boolean(user?.boosted_until && new Date(user.boosted_until).getTime() > Date.now()); }

function mainKeyboard() {
  return JSON.stringify({ one_time: false, buttons: [
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
      { action: { type: "text", label: "👑 Кто лайкнул" }, color: "secondary" },
      { action: { type: "text", label: "🔥 Буст" }, color: "secondary" }
    ],
    [
      { action: { type: "text", label: "🙈 Скрыть" }, color: "secondary" },
      { action: { type: "text", label: "✏️ Изменить" }, color: "secondary" },
      { action: { type: "text", label: "🎯 Возраст" }, color: "secondary" }
    ],
    [{ action: { type: "text", label: "📋 Чёрный список" }, color: "secondary" }]
  ]});
}

function genderKeyboard() {
  return JSON.stringify({ one_time: true, buttons: [[
    { action: { type: "text", label: "Парень" }, color: "primary" },
    { action: { type: "text", label: "Девушка" }, color: "primary" }
  ]]});
}

function lookingKeyboard() {
  return JSON.stringify({ one_time: true, buttons: [[
    { action: { type: "text", label: "Ищу парня" }, color: "primary" },
    { action: { type: "text", label: "Ищу девушку" }, color: "primary" }
  ]]});
}

function editKeyboard() {
  return JSON.stringify({ one_time: true, buttons: [
    [{ action: { type: "text", label: "Имя" }, color: "secondary" }, { action: { type: "text", label: "Возраст" }, color: "secondary" }],
    [{ action: { type: "text", label: "Город" }, color: "secondary" }, { action: { type: "text", label: "О себе" }, color: "secondary" }],
    [{ action: { type: "text", label: "Фото" }, color: "secondary" }, { action: { type: "text", label: "Кого ищу" }, color: "secondary" }],
    [{ action: { type: "text", label: "🗑 Удалить анкету" }, color: "negative" }, { action: { type: "text", label: "Отмена" }, color: "secondary" }]
  ]});
}

function deleteConfirmKeyboard() {
  return JSON.stringify({ one_time: true, buttons: [[
    { action: { type: "text", label: "Да, удалить" }, color: "negative" },
    { action: { type: "text", label: "Отмена" }, color: "secondary" }
  ]]});
}

function reportReasonKeyboard() {
  return JSON.stringify({ one_time: true, buttons: [
    [{ action: { type: "text", label: "Фейк" }, color: "secondary" }, { action: { type: "text", label: "Реклама" }, color: "secondary" }],
    [{ action: { type: "text", label: "Оскорбления" }, color: "secondary" }, { action: { type: "text", label: "18+ контент" }, color: "secondary" }],
    [{ action: { type: "text", label: "Другая причина" }, color: "secondary" }, { action: { type: "text", label: "Отмена" }, color: "secondary" }]
  ]});
}

function matchKeyboard(targetId) {
  return JSON.stringify({ one_time: false, buttons: [
    [{ action: { type: "open_link", link: `https://vk.com/im?sel=${targetId}`, label: "💌 Написать" } }],
    [{ action: { type: "text", label: "👀 Смотреть" }, color: "primary" }]
  ]});
}

async function sendMessage(userId, message, kb = null, attachment = null) {
  try {
    const params = { user_id: userId, random_id: Date.now(), message, access_token: TOKEN, v: "5.199" };
    if (kb) params.keyboard = kb;
    if (attachment) params.attachment = attachment;
    const response = await axios.post("https://api.vk.com/method/messages.send", null, { params });
    if (response.data.error) console.log("VK SEND ERROR:", response.data.error);
  } catch (e) { console.log("SEND ERROR:", e.response?.data || e.message); }
}

async function getUser(userId) {
  const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
  if (error) console.log("GET USER ERROR:", error);
  return data;
}

async function updateUser(userId, fields) {
  const { error } = await supabase.from("users").update(fields).eq("id", userId);
  if (error) console.log("UPDATE USER ERROR:", error);
  return error;
}

function getPhotoAttachment(vkMessage) {
  const photoAttachment = (vkMessage.attachments || []).find(item => item.type === "photo");
  if (!photoAttachment) return null;
  const photo = photoAttachment.photo;
  return `photo${photo.owner_id}_${photo.id}`;
}

async function normalizeVip(user) {
  if (!user) return user;
  if (user.is_vip && user.vip_until && !isVipActive(user)) {
    await updateUser(user.id, { is_vip: false, boosted_until: null });
    user.is_vip = false;
    user.boosted_until = null;
  }
  return user;
}

async function resetViewsIfNeeded(user) {
  const today = todayDate();
  if (user.last_view_date !== today) {
    await updateUser(user.id, { daily_views: 0, last_view_date: today });
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
  await updateUser(user.id, { daily_views: (user.daily_views || 0) + 1, last_view_date: todayDate() });
}

async function recordAction(userId, action) {
  const { error } = await supabase.from("action_events").insert([{ user_id: userId, action }]);
  if (error) console.log("ACTION LOG ERROR:", error);
}

async function checkActionLimit(userId, action) {
  const rules = action === "report"
    ? { minutes: 60, max: 5, text: "Слишком много жалоб за короткое время. Попробуй позже." }
    : { minutes: 10, max: 30, text: "Слишком много действий подряд 😅 Сделай небольшую паузу." };
  const since = new Date(Date.now() - rules.minutes * 60 * 1000).toISOString();
  const { count, error } = await supabase.from("action_events").select("*", { count: "exact", head: true })
    .eq("user_id", userId).eq("action", action).gte("created_at", since);
  if (error) { console.log("ACTION LIMIT ERROR:", error); return { allowed: true }; }
  if ((count || 0) >= rules.max) return { allowed: false, text: rules.text };
  return { allowed: true };
}

async function getSkippedIds(userId) {
  const { data, error } = await supabase.from("skips").select("to_user").eq("from_user", userId);
  if (error) { console.log("GET SKIPS ERROR:", error); return []; }
  return (data || []).map(x => x.to_user);
}

async function saveSkip(userId, targetId) {
  const { error } = await supabase.from("skips").upsert([{ from_user: userId, to_user: targetId }], { onConflict: "from_user,to_user" });
  if (error) console.log("SAVE SKIP ERROR:", error);
}

async function getBlockedIds(userId) {
  const { data, error } = await supabase.from("blocks").select("from_user,to_user").or(`from_user.eq.${userId},to_user.eq.${userId}`);
  if (error) { console.log("GET BLOCKS ERROR:", error); return []; }
  const ids = new Set();
  for (const item of data || []) {
    if (item.from_user === userId) ids.add(item.to_user);
    if (item.to_user === userId) ids.add(item.from_user);
  }
  return Array.from(ids);
}

async function recordProfileView(viewerId, viewedId) {
  const { error } = await supabase.from("profile_views").insert([{ viewer_id: viewerId, viewed_id: viewedId }]);
  if (error) console.log("PROFILE VIEW ERROR:", error);
}

async function getProfileStats(userId) {
  const [{ count: views }, { count: likes }] = await Promise.all([
    supabase.from("profile_views").select("*", { count: "exact", head: true }).eq("viewed_id", userId),
    supabase.from("likes").select("*", { count: "exact", head: true }).eq("to_user", userId)
  ]);
  return { views: views || 0, likes: likes || 0 };
}

function weightedPick(profiles) {
  if (!profiles.length) return null;
  const weighted = [];
  for (const profile of profiles) {
    let weight = 1;
    if (isVipActive(profile)) weight = 3;
    if (isBoostActive(profile)) weight = 8;
    for (let i = 0; i < weight; i += 1) weighted.push(profile);
  }
  return weighted[Math.floor(Math.random() * weighted.length)];
}

async function activateBoost(userId) {
  const user = await normalizeVip(await getUser(userId));
  if (!user || !isVipActive(user)) {
    await sendMessage(userId, "🔥 Буст доступен только с активным VIP.", mainKeyboard());
    return;
  }
  if (user.last_boost_at) {
    const next = new Date(user.last_boost_at).getTime() + 24 * 60 * 60 * 1000;
    if (next > Date.now()) {
      await sendMessage(userId, `🔥 Следующий буст будет доступен ${formatDateTimeRu(next)}.`, mainKeyboard());
      return;
    }
  }
  const until = addHours(new Date(), BOOST_HOURS).toISOString();
  await updateUser(userId, { boosted_until: until, last_boost_at: new Date().toISOString() });
  await sendMessage(userId, `🔥 Буст включён на ${BOOST_HOURS} часов! Твоя анкета будет показываться заметно чаще.`, mainKeyboard());
}

async function activateVipCode(userId, code) {
  const user = await getUser(userId);
  if (!user) { await sendMessage(userId, "Сначала создай анкету через «Старт»."); return; }
  const upperCode = code.toUpperCase();
  const { data: vipCode, error } = await supabase.from("vip_codes").select("*").eq("code", upperCode).maybeSingle();
  if (error || !vipCode) { await sendMessage(userId, "❌ VIP-код не найден.", mainKeyboard()); return; }
  if (vipCode.is_used) { await sendMessage(userId, "❌ Этот VIP-код уже использован.", mainKeyboard()); return; }
  const current = await normalizeVip(user);
  const base = isVipActive(current) && current.vip_until ? new Date(current.vip_until) : new Date();
  const vipUntil = addDays(base, VIP_DAYS).toISOString();
  const { error: markError } = await supabase.from("vip_codes").update({ is_used: true, used_by: userId, used_at: new Date().toISOString() }).eq("id", vipCode.id);
  if (markError) { await sendMessage(userId, "Не удалось активировать VIP-код 😔", mainKeyboard()); return; }
  await updateUser(userId, { is_vip: true, vip_until: vipUntil });
  await sendMessage(userId, `👑 VIP активирован до ${formatDateRu(vipUntil)}!\n\n• безлимитный просмотр\n• «Кто лайкнул» карточками\n• приоритет в выдаче\n• 🔥 буст раз в сутки`, mainKeyboard());
}

async function showProfile(userId) {
  let currentUser = await getUser(userId);
  if (!currentUser) return;
  if (!await canViewProfiles(currentUser)) {
    await sendMessage(userId, `👑 Лимит просмотров закончился.\n\nБесплатно доступно ${FREE_DAILY_LIMIT} анкет в сутки.`, mainKeyboard());
    return;
  }
  currentUser = await getUser(userId);
  const [{ data: liked }, { data: reported }, skippedIds, blockedIds] = await Promise.all([
    supabase.from("likes").select("to_user").eq("from_user", userId),
    supabase.from("reports").select("to_user").eq("from_user", userId),
    getSkippedIds(userId), getBlockedIds(userId)
  ]);
  const excludedIds = new Set([userId]);
  for (const item of liked || []) excludedIds.add(item.to_user);
  for (const item of reported || []) excludedIds.add(item.to_user);
  for (const id of skippedIds) excludedIds.add(id);
  for (const id of blockedIds) excludedIds.add(id);
  let query = supabase.from("users").select("*").eq("step", "done").eq("is_banned", false).eq("is_hidden", false)
    .gte("age", currentUser.age_min || 18).lte("age", currentUser.age_max || 80).limit(100);
  if (currentUser.gender && currentUser.looking_for) query = query.eq("gender", currentUser.looking_for).eq("looking_for", currentUser.gender);
  const ids = Array.from(excludedIds);
  if (ids.length) query = query.not("id", "in", `(${ids.join(",")})`);
  const { data: profiles, error } = await query;
  if (error) { console.log("PROFILE ERROR:", error); await sendMessage(userId, "Ошибка загрузки анкет 😔", mainKeyboard()); return; }
  if (!profiles?.length) { await updateUser(userId, { viewing_user: null, viewing_mode: "browse" }); await sendMessage(userId, "Пока нет новых подходящих анкет 😔", mainKeyboard()); return; }
  const sameCity = profiles.filter(p => p.city && currentUser.city && p.city.trim().toLowerCase() === currentUser.city.trim().toLowerCase());
  const profile = weightedPick(sameCity.length ? sameCity : profiles);
  await increaseViews(currentUser);
  currentUser = await getUser(userId);
  await Promise.all([updateUser(userId, { viewing_user: profile.id, viewing_mode: "browse" }), recordProfileView(userId, profile.id)]);
  const text = `✨ Анкета\n\n${profile.name || "Без имени"}, ${profile.age || "?"}\n📍 ${profile.city || "Город не указан"}\n\n${profile.about || "О себе не указано"}\n\n${isBoostActive(profile) ? "🔥 Сейчас в бусте\n" : isVipActive(profile) ? "👑 VIP-профиль\n" : ""}📊 Осталось просмотров: ${isVipActive(currentUser) ? "∞" : Math.max(0, FREE_DAILY_LIMIT - (currentUser.daily_views || 0))}`;
  await sendMessage(userId, text, mainKeyboard(), profile.photo || null);
}

async function showWhoLikedCard(userId) {
  const user = await normalizeVip(await getUser(userId));
  if (!user) { await sendMessage(userId, "Сначала создай анкету."); return; }
  if (!isVipActive(user)) { await sendMessage(userId, "👑 Это VIP-функция. С VIP ты увидишь тех, кто поставил тебе лайк ❤️", mainKeyboard()); return; }
  const [{ data: likes }, { data: dismissed }, blockedIds] = await Promise.all([
    supabase.from("likes").select("from_user").eq("to_user", userId),
    supabase.from("like_dismissals").select("liker_id").eq("user_id", userId),
    getBlockedIds(userId)
  ]);
  const dismissedIds = new Set((dismissed || []).map(x => x.liker_id));
  const blocked = new Set(blockedIds);
  const likerIds = (likes || []).map(x => x.from_user).filter(id => !dismissedIds.has(id) && !blocked.has(id));
  if (!likerIds.length) { await updateUser(userId, { viewing_user: null, viewing_mode: "browse" }); await sendMessage(userId, "Пока новых лайков нет 😔", mainKeyboard()); return; }
  const { data: outgoing } = await supabase.from("likes").select("to_user").eq("from_user", userId).in("to_user", likerIds);
  const alreadyLiked = new Set((outgoing || []).map(x => x.to_user));
  const pendingIds = likerIds.filter(id => !alreadyLiked.has(id));
  if (!pendingIds.length) { await sendMessage(userId, "Все входящие лайки уже обработаны ❤️", mainKeyboard()); return; }
  const { data: profiles, error } = await supabase.from("users").select("*").in("id", pendingIds).eq("step", "done").eq("is_banned", false).eq("is_hidden", false).limit(20);
  if (error || !profiles?.length) { await sendMessage(userId, "Пока новых лайков нет 😔", mainKeyboard()); return; }
  const profile = profiles[0];
  await updateUser(userId, { viewing_user: profile.id, viewing_mode: "liked" });
  const text = `👑 Тебя лайкнул(а)\n\n${profile.name || "Без имени"}, ${profile.age || "?"}\n📍 ${profile.city || "Город не указан"}\n\n${profile.about || "О себе не указано"}\n\n❤️ Лайк — взаимная симпатия\n👎 Далее — пропустить`;
  await sendMessage(userId, text, mainKeyboard(), profile.photo || null);
}

async function handleLike(userId) {
  const limit = await checkActionLimit(userId, "like");
  if (!limit.allowed) { await sendMessage(userId, limit.text, mainKeyboard()); return; }
  const user = await getUser(userId);
  if (!user?.viewing_user) { await sendMessage(userId, "Сначала открой анкету.", mainKeyboard()); return; }
  const targetId = user.viewing_user;
  const mode = user.viewing_mode || "browse";
  const { error } = await supabase.from("likes").upsert([{ from_user: userId, to_user: targetId }], { onConflict: "from_user,to_user", ignoreDuplicates: true });
  if (error) console.log("LIKE ERROR:", error);
  await recordAction(userId, "like");
  const { data: match } = await supabase.from("likes").select("*").eq("from_user", targetId).eq("to_user", userId).maybeSingle();
  if (match) {
    const [otherUser, currentUser] = await Promise.all([getUser(targetId), getUser(userId)]);
    await supabase.from("matches").upsert([{
      user1: Math.min(userId, targetId), user2: Math.max(userId, targetId), matched_at: new Date().toISOString()
    }], { onConflict: "user1,user2", ignoreDuplicates: true });
    await sendMessage(userId, `💘 У ВАС ВЗАИМНАЯ СИМПАТИЯ!\n\n${otherUser?.name || "Пользователь"}, ${otherUser?.age || "?"}\n📍 ${otherUser?.city || ""}\n\nНажми «💌 Написать» — и начинай знакомство 😊`, matchKeyboard(targetId), otherUser?.photo || null);
    await sendMessage(targetId, `💘 У ВАС ВЗАИМНАЯ СИМПАТИЯ!\n\n${currentUser?.name || "Пользователь"}, ${currentUser?.age || "?"}\n📍 ${currentUser?.city || ""}\n\nНажми «💌 Написать» — и начинай знакомство 😊`, matchKeyboard(userId), currentUser?.photo || null);
  } else {
    await sendMessage(userId, "❤️ Лайк отправлен!", mainKeyboard());
    await sendMessage(targetId, "❤️ Тебя кто-то лайкнул!\n\nНажми «👑 Кто лайкнул», чтобы посмотреть.", mainKeyboard());
  }
  await updateUser(userId, { viewing_user: null, viewing_mode: "browse" });
  if (mode === "liked") await showWhoLikedCard(userId); else await showProfile(userId);
}

async function handleSkip(userId) {
  const user = await getUser(userId);
  if (!user?.viewing_user) { await sendMessage(userId, "Сначала открой анкету.", mainKeyboard()); return; }
  const targetId = user.viewing_user;
  const mode = user.viewing_mode || "browse";
  if (mode === "liked") await supabase.from("like_dismissals").upsert([{ user_id: userId, liker_id: targetId }], { onConflict: "user_id,liker_id" });
  else await saveSkip(userId, targetId);
  await updateUser(userId, { viewing_user: null, viewing_mode: "browse" });
  if (mode === "liked") await showWhoLikedCard(userId); else await showProfile(userId);
}

async function handleBlock(userId) {
  const user = await getUser(userId);
  if (!user?.viewing_user) { await sendMessage(userId, "Сначала открой анкету, которую хочешь добавить в ЧС.", mainKeyboard()); return; }
  const targetId = user.viewing_user;
  const mode = user.viewing_mode || "browse";
  const { error } = await supabase.from("blocks").upsert([{ from_user: userId, to_user: targetId }], { onConflict: "from_user,to_user" });
  if (error) { await sendMessage(userId, "Не получилось добавить в ЧС.", mainKeyboard()); return; }
  await updateUser(userId, { viewing_user: null, viewing_mode: "browse" });
  await sendMessage(userId, "⛔ Пользователь добавлен в чёрный список.", mainKeyboard());
  if (mode === "liked") await showWhoLikedCard(userId); else await showProfile(userId);
}

async function showBlockList(userId) {
  const { data: blocks, error } = await supabase.from("blocks").select("to_user").eq("from_user", userId).order("created_at", { ascending: false }).limit(20);
  if (error) { await sendMessage(userId, "Ошибка загрузки чёрного списка.", mainKeyboard()); return; }
  if (!blocks?.length) { await sendMessage(userId, "📋 Чёрный список пуст.", mainKeyboard()); return; }
  const ids = blocks.map(x => x.to_user);
  const { data: users } = await supabase.from("users").select("id,name,age").in("id", ids);
  const byId = new Map((users || []).map(x => [x.id, x]));
  let text = "📋 Чёрный список:\n\n";
  for (const id of ids) { const u = byId.get(id); text += `${u?.name || "Пользователь"}, ${u?.age || "?"} — ID ${id}\n`; }
  text += "\nЧтобы вернуть человека: разблокировать ID";
  await sendMessage(userId, text, mainKeyboard());
}

async function unblockUser(userId, targetId) {
  const { error } = await supabase.from("blocks").delete().eq("from_user", userId).eq("to_user", targetId);
  if (error) { await sendMessage(userId, "Не получилось убрать из ЧС.", mainKeyboard()); return; }
  await sendMessage(userId, `✅ Пользователь ${targetId} убран из чёрного списка.`, mainKeyboard());
}

async function startReport(userId) {
  const limit = await checkActionLimit(userId, "report");
  if (!limit.allowed) { await sendMessage(userId, limit.text, mainKeyboard()); return; }
  const user = await getUser(userId);
  if (!user?.viewing_user) { await sendMessage(userId, "Сначала открой анкету.", mainKeyboard()); return; }
  await updateUser(userId, { action_state: "report_reason", action_target: user.viewing_user });
  await sendMessage(userId, "🚫 Выбери причину жалобы:", reportReasonKeyboard());
}

async function submitReport(userId, reason) {
  const user = await getUser(userId);
  const targetId = user?.action_target;
  if (!targetId) { await sendMessage(userId, "Анкета для жалобы не найдена.", mainKeyboard()); return; }
  const { error } = await supabase.from("reports").upsert([{ from_user: userId, to_user: targetId, reason }], { onConflict: "from_user,to_user", ignoreDuplicates: true });
  await updateUser(userId, { action_state: null, action_target: null, viewing_user: null, viewing_mode: "browse" });
  if (error) { await sendMessage(userId, "Не получилось отправить жалобу.", mainKeyboard()); return; }
  await recordAction(userId, "report");
  const { data: reports } = await supabase.from("reports").select("from_user").eq("to_user", targetId);
  if (new Set((reports || []).map(x => x.from_user)).size >= 3) await updateUser(targetId, { is_banned: true });
  await sendMessage(userId, "🚫 Жалоба отправлена. Эта анкета больше не попадётся тебе.", mainKeyboard());
  await showProfile(userId);
}

async function processActionState(userId, user, message) {
  if (user.action_state !== "report_reason") return false;
  if (message === "отмена") { await updateUser(userId, { action_state: null, action_target: null }); await sendMessage(userId, "Жалоба отменена.", mainKeyboard()); return true; }
  const reasons = new Map([["фейк","Фейк"],["реклама","Реклама"],["оскорбления","Оскорбления"],["18+ контент","18+ контент"],["другая причина","Другая причина"]]);
  if (!reasons.has(message)) { await sendMessage(userId, "Выбери причину кнопкой ниже.", reportReasonKeyboard()); return true; }
  await submitReport(userId, reasons.get(message));
  return true;
}

async function toggleHidden(userId) {
  const user = await getUser(userId);
  if (!user) return;
  const newStatus = !user.is_hidden;
  await updateUser(userId, { is_hidden: newStatus });
  await sendMessage(userId, newStatus ? "🙈 Анкета скрыта." : "👀 Анкета снова видна другим пользователям.", mainKeyboard());
}

async function showMyProfile(userId) {
  let user = await normalizeVip(await getUser(userId));
  if (!user) { await sendMessage(userId, "Анкета не найдена."); return; }
  user = await resetViewsIfNeeded(user);
  const stats = await getProfileStats(userId);
  const viewsLeft = isVipActive(user) ? "∞" : Math.max(0, FREE_DAILY_LIMIT - (user.daily_views || 0));
  const vipText = isVipActive(user) ? `Да${user.vip_until ? `, до ${formatDateRu(user.vip_until)}` : ""}` : "Нет";
  const text = `👤 Моя анкета\n\nИмя: ${user.name || "Не указано"}\nВозраст: ${user.age || "Не указан"}\nГород: ${user.city || "Не указан"}\nПол: ${user.gender || "Не указан"}\nИщу: ${user.looking_for || "Не указано"}\nВозраст поиска: ${user.age_min || 18}–${user.age_max || 80}\nО себе: ${user.about || "Не указано"}\n\n👑 VIP: ${vipText}\n🔥 Буст: ${isBoostActive(user) ? `до ${formatDateTimeRu(user.boosted_until)}` : "не активен"}\n🙈 Скрыта: ${user.is_hidden ? "Да" : "Нет"}\n📊 Осталось просмотров: ${viewsLeft}\n\n📈 Статистика анкеты\n👀 Просмотров: ${stats.views}\n❤️ Лайков: ${stats.likes}`;
  await sendMessage(userId, text, mainKeyboard(), user.photo || null);
}

async function showEditMenu(userId) {
  const user = await getUser(userId);
  if (!user || user.step !== "done") { await sendMessage(userId, "Сначала закончи анкету.", mainKeyboard()); return; }
  await updateUser(userId, { step: "edit_menu" });
  await sendMessage(userId, "✏️ Что хочешь изменить?", editKeyboard());
}

async function startAgeFilter(userId) {
  const user = await getUser(userId);
  if (!user || user.step !== "done") { await sendMessage(userId, "Сначала закончи анкету.", mainKeyboard()); return; }
  await updateUser(userId, { step: "filter_age_min" });
  await sendMessage(userId, `🎯 Сейчас: ${user.age_min || 18}–${user.age_max || 80} лет.\n\nНапиши минимальный возраст:`);
}

async function deleteOwnProfile(userId) {
  const user = await getUser(userId);
  if (!user) return;
  await Promise.all([
    supabase.from("likes").delete().or(`from_user.eq.${userId},to_user.eq.${userId}`),
    supabase.from("reports").delete().or(`from_user.eq.${userId},to_user.eq.${userId}`),
    supabase.from("skips").delete().or(`from_user.eq.${userId},to_user.eq.${userId}`),
    supabase.from("blocks").delete().or(`from_user.eq.${userId},to_user.eq.${userId}`),
    supabase.from("profile_views").delete().or(`viewer_id.eq.${userId},viewed_id.eq.${userId}`),
    supabase.from("like_dismissals").delete().or(`user_id.eq.${userId},liker_id.eq.${userId}`),
    supabase.from("matches").delete().or(`user1.eq.${userId},user2.eq.${userId}`),
    supabase.from("action_events").delete().eq("user_id", userId)
  ]);
  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (error) { await sendMessage(userId, "Не получилось удалить анкету.", mainKeyboard()); return; }
  await sendMessage(userId, "🗑 Анкета удалена. Если захочешь вернуться — напиши «Старт» ❤️");
}

async function processEditStep(userId, user, message, text, vkMessage) {
  if (user.step === "edit_menu") {
    if (message === "отмена") { await updateUser(userId, { step: "done" }); await sendMessage(userId, "Изменения отменены.", mainKeyboard()); return true; }
    const map = { "имя":"edit_name", "возраст":"edit_age", "город":"edit_city", "о себе":"edit_about", "фото":"edit_photo", "кого ищу":"edit_looking_for" };
    if (map[message]) {
      await updateUser(userId, { step: map[message] });
      if (message === "кого ищу") await sendMessage(userId, "Кого хочешь найти?", lookingKeyboard());
      else if (message === "фото") await sendMessage(userId, "Отправь новое фото 📸");
      else await sendMessage(userId, `Напиши новое значение: ${message}`);
      return true;
    }
    if (message === "🗑 удалить анкету" || message === "удалить анкету") { await updateUser(userId, { step: "delete_confirm" }); await sendMessage(userId, "⚠️ Точно удалить анкету?", deleteConfirmKeyboard()); return true; }
    await sendMessage(userId, "Выбери, что хочешь изменить.", editKeyboard()); return true;
  }
  if (user.step === "delete_confirm") {
    if (message === "да, удалить") await deleteOwnProfile(userId); else { await updateUser(userId, { step: "done" }); await sendMessage(userId, "Удаление отменено.", mainKeyboard()); }
    return true;
  }
  if (user.step === "edit_name") { if (!text) return true; await updateUser(userId, { name: text, step: "done" }); await sendMessage(userId, "✅ Имя изменено.", mainKeyboard()); return true; }
  if (user.step === "edit_age") { const age = parseInt(text,10); if (!age || age < 18 || age > 80) { await sendMessage(userId,"Возраст от 18 до 80."); return true; } await updateUser(userId,{age,step:"done"}); await sendMessage(userId,"✅ Возраст изменён.",mainKeyboard()); return true; }
  if (user.step === "edit_city") { if (!text) return true; await updateUser(userId,{city:text,step:"done"}); await sendMessage(userId,"✅ Город изменён.",mainKeyboard()); return true; }
  if (user.step === "edit_about") { await updateUser(userId,{about:text,step:"done"}); await sendMessage(userId,"✅ Описание изменено.",mainKeyboard()); return true; }
  if (user.step === "edit_photo") { const photo = getPhotoAttachment(vkMessage); if (!photo) { await sendMessage(userId,"Отправь именно фото 📸"); return true; } await updateUser(userId,{photo,step:"done"}); await sendMessage(userId,"✅ Фото изменено.",mainKeyboard()); return true; }
  if (user.step === "edit_looking_for") { const lookingFor = message === "ищу парня" ? "парень" : message === "ищу девушку" ? "девушка" : null; if (!lookingFor) { await sendMessage(userId,"Выбери вариант.",lookingKeyboard()); return true; } await updateUser(userId,{looking_for:lookingFor,step:"done"}); await sendMessage(userId,"✅ Настройка поиска изменена.",mainKeyboard()); return true; }
  if (user.step === "filter_age_min") { const minAge=parseInt(text,10); if(!minAge||minAge<18||minAge>80){await sendMessage(userId,"Минимальный возраст — от 18 до 80.");return true;} await updateUser(userId,{age_min:minAge,step:"filter_age_max"}); await sendMessage(userId,`Минимум ${minAge}. Теперь максимальный возраст:`); return true; }
  if (user.step === "filter_age_max") { const maxAge=parseInt(text,10); const fresh=await getUser(userId); const minAge=fresh.age_min||18; if(!maxAge||maxAge<minAge||maxAge>80){await sendMessage(userId,`Максимальный возраст от ${minAge} до 80.`);return true;} await updateUser(userId,{age_max:maxAge,step:"done"}); await sendMessage(userId,`✅ Фильтр: ${minAge}–${maxAge}.`,mainKeyboard()); return true; }
  return false;
}

async function adminDailyStats() {
  const start = `${todayDate()}T00:00:00.000Z`;
  const [users, likes, matches, reports] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }).gte("created_at", start),
    supabase.from("likes").select("*", { count: "exact", head: true }).gte("created_at", start),
    supabase.from("matches").select("*", { count: "exact", head: true }).gte("matched_at", start),
    supabase.from("reports").select("*", { count: "exact", head: true }).gte("created_at", start)
  ]);
  return { users: users.count||0, likes: likes.count||0, matches: matches.count||0, reports: reports.count||0 };
}

async function showAdminPanel(userId) {
  if (!isAdmin(userId)) { await sendMessage(userId,"Нет доступа."); return; }
  const [total, ready, vip, banned, reports, daily] = await Promise.all([
    supabase.from("users").select("*",{count:"exact",head:true}),
    supabase.from("users").select("*",{count:"exact",head:true}).eq("step","done"),
    supabase.from("users").select("*",{count:"exact",head:true}).eq("is_vip",true),
    supabase.from("users").select("*",{count:"exact",head:true}).eq("is_banned",true),
    supabase.from("reports").select("*",{count:"exact",head:true}),
    adminDailyStats()
  ]);
  const text = `🛠 Админка Vector Love\n\n👥 Всего: ${total.count||0}\n✅ Готовых: ${ready.count||0}\n👑 VIP: ${vip.count||0}\n🚫 Забанено: ${banned.count||0}\n⚠️ Жалоб всего: ${reports.count||0}\n\n📅 Сегодня\n🆕 Регистраций: ${daily.users}\n❤️ Лайков: ${daily.likes}\n💘 Матчей: ${daily.matches}\n🚫 Жалоб: ${daily.reports}\n\nКоманды:\nжалобы\nновые анкеты\nvip список\nбан список\nпоиск ID\nудалить ID\nвыдать vip ID\nбан ID\nразбан ID\nкод VIP-XXX`;
  await sendMessage(userId,text);
}

async function showAdminList(userId, kind) {
  if (!isAdmin(userId)) { await sendMessage(userId,"Нет доступа."); return; }
  let q = supabase.from("users").select("id,name,age,city,vip_until,is_banned").order("created_at",{ascending:false}).limit(30);
  if (kind === "vip") q = q.eq("is_vip",true); else q = q.eq("is_banned",true);
  const { data, error } = await q;
  if (error) { await sendMessage(userId,"Ошибка загрузки списка."); return; }
  if (!data?.length) { await sendMessage(userId,kind === "vip" ? "VIP пользователей нет." : "Забаненных нет."); return; }
  let text = kind === "vip" ? "👑 VIP пользователи:\n\n" : "🚫 Забаненные:\n\n";
  for (const u of data) text += `${u.id} — ${u.name||"Без имени"}, ${u.age||"?"}, ${u.city||"—"}${kind==="vip"?` (до ${formatDateRu(u.vip_until)})`:""}\n`;
  await sendMessage(userId,text);
}

async function showNewProfiles(userId) {
  if (!isAdmin(userId)) return;
  const { data } = await supabase.from("users").select("id,name,age,city").eq("step","done").order("created_at",{ascending:false}).limit(10);
  let text="🆕 Последние анкеты:\n\n"; for(const u of data||[]) text += `${u.id}\n${u.name||"Без имени"}, ${u.age||"?"}, ${u.city||"—"}\n\n`; await sendMessage(userId,text);
}

async function searchUserById(adminId,targetId) {
  if(!isAdmin(adminId)) return; const user=await getUser(targetId); if(!user){await sendMessage(adminId,"Пользователь не найден.");return;} const stats=await getProfileStats(targetId);
  await sendMessage(adminId,`🔎 Анкета\n\nID: ${user.id}\n${user.name||"Без имени"}, ${user.age||"?"}\n${user.city||"—"}\nVIP: ${isVipActive(user)?"Да":"Нет"}\nБуст: ${isBoostActive(user)?"Да":"Нет"}\nСкрыта: ${user.is_hidden?"Да":"Нет"}\nБан: ${user.is_banned?"Да":"Нет"}\nПросмотров: ${stats.views}\nЛайков: ${stats.likes}`,null,user.photo||null);
}

async function deleteUserById(adminId,targetId){if(!isAdmin(adminId))return;const u=await getUser(targetId);if(!u){await sendMessage(adminId,"Пользователь не найден.");return;}await Promise.all([supabase.from("likes").delete().or(`from_user.eq.${targetId},to_user.eq.${targetId}`),supabase.from("reports").delete().or(`from_user.eq.${targetId},to_user.eq.${targetId}`),supabase.from("skips").delete().or(`from_user.eq.${targetId},to_user.eq.${targetId}`),supabase.from("blocks").delete().or(`from_user.eq.${targetId},to_user.eq.${targetId}`),supabase.from("profile_views").delete().or(`viewer_id.eq.${targetId},viewed_id.eq.${targetId}`),supabase.from("like_dismissals").delete().or(`user_id.eq.${targetId},liker_id.eq.${targetId}`),supabase.from("matches").delete().or(`user1.eq.${targetId},user2.eq.${targetId}`),supabase.from("action_events").delete().eq("user_id",targetId)]);await supabase.from("users").delete().eq("id",targetId);await sendMessage(adminId,`🗑 Анкета ${targetId} удалена.`);}

async function showReports(userId){if(!isAdmin(userId))return;const{data}=await supabase.from("reports").select("*").order("created_at",{ascending:false}).limit(15);if(!data?.length){await sendMessage(userId,"Жалоб пока нет.");return;}let text="⚠️ Последние жалобы:\n\n";for(const r of data)text+=`От: ${r.from_user}\nНа: ${r.to_user}\nПричина: ${r.reason||"—"}\n\n`;await sendMessage(userId,text);}
async function giveVip(adminId,targetId){if(!isAdmin(adminId))return;let u=await normalizeVip(await getUser(targetId));if(!u){await sendMessage(adminId,"Пользователь не найден.");return;}const base=isVipActive(u)&&u.vip_until?new Date(u.vip_until):new Date();const until=addDays(base,VIP_DAYS).toISOString();await updateUser(targetId,{is_vip:true,vip_until:until});await sendMessage(adminId,`👑 VIP выдан ${targetId} до ${formatDateRu(until)}.`);await sendMessage(targetId,`👑 Тебе выдан VIP до ${formatDateRu(until)} ❤️`,mainKeyboard());}
async function banUser(adminId,targetId){if(!isAdmin(adminId))return;if(!await getUser(targetId)){await sendMessage(adminId,"Пользователь не найден.");return;}await updateUser(targetId,{is_banned:true});await sendMessage(adminId,`🚫 ${targetId} забанен.`);}
async function unbanUser(adminId,targetId){if(!isAdmin(adminId))return;if(!await getUser(targetId)){await sendMessage(adminId,"Пользователь не найден.");return;}await updateUser(targetId,{is_banned:false});await sendMessage(adminId,`✅ ${targetId} разбанен.`);}
async function createVipCode(adminId,code){if(!isAdmin(adminId))return;const{error}=await supabase.from("vip_codes").insert([{code:code.toUpperCase()}]);await sendMessage(adminId,error?"Такой код уже есть или ошибка.":`✅ VIP-код создан:\n${code.toUpperCase()}`);}

async function processMessage(vkMessage) {
  const userId = vkMessage.from_id;
  const text = (vkMessage.text || "").trim();
  const message = text.toLowerCase();
  let user = await getUser(userId);

  if (message === "админ" || message === "статистика") { await showAdminPanel(userId); return; }
  if (message === "жалобы") { await showReports(userId); return; }
  if (message === "новые анкеты") { await showNewProfiles(userId); return; }
  if (message === "vip список") { await showAdminList(userId,"vip"); return; }
  if (message === "бан список") { await showAdminList(userId,"banned"); return; }
  if (message.startsWith("поиск ")) { const id=Number(message.replace("поиск ","").trim()); if(id) await searchUserById(userId,id); return; }
  if (message.startsWith("удалить ")) { const id=Number(message.replace("удалить ","").trim()); if(id) await deleteUserById(userId,id); return; }
  if (message.startsWith("выдать vip ")) { const id=Number(message.replace("выдать vip ","").trim()); if(id) await giveVip(userId,id); return; }
  if (message.startsWith("бан ")) { const id=Number(message.replace("бан ","").trim()); if(id) await banUser(userId,id); return; }
  if (message.startsWith("разбан ")) { const id=Number(message.replace("разбан ","").trim()); if(id) await unbanUser(userId,id); return; }
  if (message.startsWith("код ")) { const code=text.replace(/^код\s+/i,"").trim(); if(code) await createVipCode(userId,code); return; }
  if (message.startsWith("разблокировать ")) { const id=Number(message.replace("разблокировать ","").trim()); if(id) await unblockUser(userId,id); return; }

  if (!user) {
    const { error } = await supabase.from("users").insert([{ id:userId, step:"name", age_min:18, age_max:80, viewing_mode:"browse" }]);
    if (error) { await sendMessage(userId,"Не получилось начать регистрацию 😔"); return; }
    await sendMessage(userId,"❤️ Добро пожаловать в Vector Love!\n\nНапиши своё имя 👇"); return;
  }

  if (text.toUpperCase().startsWith("VIP-")) { await activateVipCode(userId,text); return; }
  user = await normalizeVip(user);
  if (user.is_banned) { await sendMessage(userId,"🚫 Твоя анкета заблокирована из-за жалоб.",mainKeyboard()); return; }
  if (await processActionState(userId,user,message)) return;
  if (await processEditStep(userId,user,message,text,vkMessage)) return;

  if (message === "смотреть" || message === "👀 смотреть") { if(user.step!=="done"){await sendMessage(userId,"Сначала закончи анкету.",mainKeyboard());return;} await showProfile(userId); return; }
  if (message === "лайк" || message === "❤️ лайк") { await handleLike(userId); return; }
  if (message === "далее" || message === "👎 далее") { await handleSkip(userId); return; }
  if (message === "⛔ в чс" || message === "в чс") { await handleBlock(userId); return; }
  if (message === "жалоба" || message === "🚫 жалоба") { await startReport(userId); return; }
  if (message === "кто лайкнул" || message === "👑 кто лайкнул") { await showWhoLikedCard(userId); return; }
  if (message === "моя анкета" || message === "👤 моя анкета") { await showMyProfile(userId); return; }
  if (message === "изменить" || message === "✏️ изменить") { await showEditMenu(userId); return; }
  if (message === "возраст" || message === "🎯 возраст") { await startAgeFilter(userId); return; }
  if (message === "чёрный список" || message === "📋 чёрный список") { await showBlockList(userId); return; }
  if (message === "🔥 буст" || message === "буст") { await activateBoost(userId); return; }
  if (message === "лимит" || message === "📊 лимит") { user=await resetViewsIfNeeded(user); const left=isVipActive(user)?"∞":Math.max(0,FREE_DAILY_LIMIT-(user.daily_views||0)); await sendMessage(userId,`📊 Осталось просмотров сегодня: ${left}`,mainKeyboard()); return; }
  if (message === "vip" || message === "👑 vip") { await sendMessage(userId,`👑 VIP — 199₽ / месяц\n\n• безлимитный просмотр\n• «Кто лайкнул» карточками\n• приоритет в выдаче\n• 🔥 буст раз в сутки${isVipActive(user)?`\n\n✅ VIP активен${user.vip_until?` до ${formatDateRu(user.vip_until)}`:""}.`:""}`,mainKeyboard()); return; }
  if (message === "скрыть" || message === "🙈 скрыть") { await toggleHidden(userId); return; }
  if ((message === "старт" || message === "начать") && user.step === "done") { await sendMessage(userId,"❤️ Твоя анкета уже создана. Нажми «👀 Смотреть».",mainKeyboard()); return; }

  if (user.step === "name") { if(!text){await sendMessage(userId,"Напиши имя текстом.");return;} await updateUser(userId,{name:text,step:"age"}); await sendMessage(userId,"Сколько тебе лет? 🔞"); return; }
  if (user.step === "age") { const age=parseInt(text,10); if(!age||age<18||age>80){await sendMessage(userId,"Возраст от 18 до 80.");return;} await updateUser(userId,{age,step:"city"}); await sendMessage(userId,"Из какого ты города? 🏙"); return; }
  if (user.step === "city") { if(!text){await sendMessage(userId,"Напиши название города.");return;} await updateUser(userId,{city:text,step:"gender"}); await sendMessage(userId,"Кто ты?",genderKeyboard()); return; }
  if (user.step === "gender") { if(message!=="парень"&&message!=="девушка"){await sendMessage(userId,"Выбери вариант.",genderKeyboard());return;} await updateUser(userId,{gender:message,step:"looking_for"}); await sendMessage(userId,"Кого хочешь найти?",lookingKeyboard()); return; }
  if (user.step === "looking_for") { const lf=message==="ищу парня"?"парень":message==="ищу девушку"?"девушка":null; if(!lf){await sendMessage(userId,"Выбери вариант.",lookingKeyboard());return;} await updateUser(userId,{looking_for:lf,step:"about"}); await sendMessage(userId,"Расскажи коротко о себе ✨"); return; }
  if (user.step === "about") { await updateUser(userId,{about:text,step:"photo"}); await sendMessage(userId,"Теперь отправь фото 📸"); return; }
  if (user.step === "photo") { const photo=getPhotoAttachment(vkMessage); if(!photo){await sendMessage(userId,"Отправь именно фото 📸");return;} await updateUser(userId,{photo,step:"done",age_min:user.age_min||18,age_max:user.age_max||80,viewing_mode:"browse"}); await sendMessage(userId,"🔥 Анкета готова! Теперь нажми «👀 Смотреть» ❤️",mainKeyboard()); return; }
  if (user.step === "done") await sendMessage(userId,"Нажми «👀 Смотреть».",mainKeyboard());
}

app.post("/", async (req,res) => {
  try {
    const body=req.body;
    if(body.type==="confirmation") return res.send(CONFIRMATION_TOKEN);
    if(body.type==="message_new") { res.send("ok"); processMessage(body.object.message).catch(e=>console.log("PROCESS MESSAGE ERROR:",e)); return; }
    return res.send("ok");
  } catch(e) { console.log("GLOBAL ERROR:",e); return res.send("ok"); }
});

app.get("/",(req,res)=>res.send("Vector Love bot v4 is running"));
const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`Vector Love v4 started on port ${PORT}`));
