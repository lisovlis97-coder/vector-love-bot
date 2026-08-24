const fs = require("fs");
const path = require("path");
const Module = require("module");

const wrapperPath = path.join(__dirname, "app_v4_1.js");
let wrapperSource = fs.readFileSync(wrapperPath, "utf8");

const marker = 'const patched = new Module(sourcePath, module.parent);';
const injection = `
source = source.replace(
  /function getPhotoAttachment\\(vkMessage\\) \\{[\\s\\S]*?\\n\\}/,
  'function getPhotoAttachment(vkMessage) {\\n  const photoAttachment = (vkMessage.attachments || []).find(item => item.type === "photo");\\n  if (!photoAttachment) return null;\\n  const photo = photoAttachment.photo;\\n  return "photo" + photo.owner_id + "_" + photo.id + (photo.access_key ? "_" + photo.access_key : "");\\n}'
);

source = source.replaceAll(
  "💘 У ВАС ВЗАИМНАЯ СИМПАТИЯ!",
  "💘 Взаимная симпатия!"
);

source = source.replaceAll(
  "Нажми «💌 Написать» — и начинай знакомство 😊",
  "Вы понравились друг другу ❤️\\n\\nСамое время написать и познакомиться поближе 😉"
);

source = source.replace(
  'if (hours <= 72) return "🟡 Был(а) на днях";\\n  return "";',
  'if (hours <= 72) return "🟡 Был(а) на днях";\\n  if (hours <= 168) return "🔵 Был(а) на этой неделе";\\n  return "";'
);

source = source.replace(
  '[{ action: { type: "text", label: "📋 Чёрный список" }, color: "secondary" }]',
  '[{ action: { type: "text", label: "📋 Чёрный список" }, color: "secondary" }, { action: { type: "text", label: "↩️ Продолжить" }, color: "secondary" }]'
);

source = source.replace(
  'async function sendMessage(userId, message, kb = null, attachment = null) {',
  'function likeNoticeKeyboard(isVip) {\\n  return JSON.stringify({ one_time: false, buttons: [[{ action: { type: "text", label: isVip ? "❤️ Посмотреть лайк" : "👑 VIP" }, color: "positive" }], [{ action: { type: "text", label: "👀 Смотреть" }, color: "primary" }]] });\\n}\\n\\nasync function sendMessage(userId, message, kb = null, attachment = null) {'
);

source = source.replace(
  '  } else {\\n    await sendMessage(userId, "❤️ Лайк отправлен!", mainKeyboard());\\n    await sendMessage(targetId, "❤️ Тебя кто-то лайкнул!\\n\\nНажми «👑 Кто лайкнул», чтобы посмотреть.", mainKeyboard());\\n  }',
  '  } else {\\n    await sendMessage(userId, "❤️ Лайк отправлен!", mainKeyboard());\\n    const targetUser = await normalizeVip(await getUser(targetId));\\n    const vipTarget = isVipActive(targetUser);\\n    const noticeText = vipTarget ? "❤️ Тебя лайкнули!\\n\\nМожешь сразу посмотреть, кто это 👀" : "❤️ Кому-то понравилась твоя анкета 👀\\n\\nХочешь узнать, кто это? С VIP можно смотреть входящие лайки сразу.";\\n    await sendMessage(targetId, noticeText, likeNoticeKeyboard(vipTarget));\\n  }'
);

source = source.replace(
  'async function processMessage(vkMessage) {',
  'async function showVipScreen(userId) {\\n  const user = await normalizeVip(await getUser(userId));\\n  if (!user) return;\\n  const active = isVipActive(user);\\n  let text = "👑 Vector Love VIP — 199 ₽ / месяц\\n\\nЧто входит:\\n• безлимитный просмотр анкет\\n• видно, кто тебя лайкнул\\n• приоритет анкеты в выдаче\\n• 🔥 буст раз в сутки\\n\\n";\\n  text += active ? ("✅ VIP активен" + (user.vip_until ? " до " + formatDateRu(user.vip_until) : " без срока") + ".") : "Для активации введи полученный код формата VIP-XXXX.";\\n  await sendMessage(userId, text, mainKeyboard());\\n}\\n\\nasync function resumeFlow(userId, user) {\\n  if (!user) return;\\n  const step = user.step;\\n  if (step === "done") { if (user.viewing_user) { const target = await getUser(user.viewing_user); if (target) { const badges = profileBadges(target); const text = "💫 " + (target.name || "Без имени") + ", " + (target.age || "?") + "\\n📍 " + (target.city || "Город не указан") + (badges ? "\\n" + badges : "") + "\\n\\n" + (target.about || "О себе пока ничего не рассказано"); await sendMessage(userId, text, mainKeyboard(), target.photo || null); return; } } await showProfile(userId); return; }\\n  if (step === "edit_menu") { await sendMessage(userId, "✏️ Продолжаем редактирование. Что хочешь изменить?", editKeyboard()); return; }\\n  if (step === "edit_name") { await sendMessage(userId, "Напиши новое имя:"); return; }\\n  if (step === "edit_age") { await sendMessage(userId, "Напиши новый возраст:"); return; }\\n  if (step === "edit_city") { await sendMessage(userId, "Напиши новый город:"); return; }\\n  if (step === "edit_about") { await sendMessage(userId, "Напиши новое описание о себе:"); return; }\\n  if (step === "edit_photo") { await sendMessage(userId, "Отправь новое фото 📸"); return; }\\n  if (step === "edit_looking_for") { await sendMessage(userId, "Кого хочешь найти?", lookingKeyboard()); return; }\\n  if (step === "filter_age_min") { await sendMessage(userId, "Напиши минимальный возраст поиска:"); return; }\\n  if (step === "filter_age_max") { await sendMessage(userId, "Теперь напиши максимальный возраст:"); return; }\\n  const prompts = { name: "Напиши своё имя 👇", age: "Сколько тебе лет? 🔞", city: "Из какого ты города? 🏙", gender: "Кто ты?", looking_for: "Кого хочешь найти?", about: "Расскажи коротко о себе ✨", photo: "Теперь отправь фото 📸" };\\n  const kb = step === "gender" ? genderKeyboard() : step === "looking_for" ? lookingKeyboard() : null;\\n  await sendMessage(userId, prompts[step] || "Продолжаем 👇", kb);\\n}\\n\\nasync function processMessage(vkMessage) {'
);

source = source.replace(
  '  if (message === "кто лайкнул" || message === "👑 кто лайкнул") { await showWhoLikedCard(userId); return; }',
  '  if (message === "кто лайкнул" || message === "👑 кто лайкнул" || message === "❤️ посмотреть лайк" || message === "посмотреть лайк") { await showWhoLikedCard(userId); return; }'
);

source = source.replace(
  /  if \\(message === "vip" \\|\\| message === "👑 vip"\\) \\{[^\\n]*\\n?/,
  '  if (message === "vip" || message === "👑 vip") { await showVipScreen(userId); return; }\\n'
);

source = source.replace(
  '  if ((message === "старт" || message === "начать") && user.step === "done") { await sendMessage(userId,"❤️ Твоя анкета уже создана. Нажми «👀 Смотреть».",mainKeyboard()); return; }',
  '  if (message === "↩️ продолжить" || message === "продолжить") { await resumeFlow(userId, user); return; }\\n  if (message === "старт" || message === "начать") { await resumeFlow(userId, user); return; }'
);
`;

wrapperSource = wrapperSource.replace(marker, injection + "\n" + marker);

const patchedWrapper = new Module(wrapperPath, module.parent);
patchedWrapper.filename = wrapperPath;
patchedWrapper.paths = module.paths;
patchedWrapper._compile(wrapperSource, wrapperPath);
