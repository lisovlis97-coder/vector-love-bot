const fs = require("fs");
const path = require("path");
const Module = require("module");

const sourcePath = path.join(__dirname, "app_v4.js");
let source = fs.readFileSync(sourcePath, "utf8");

source = source.replace(
  'function isBoostActive(user) { return Boolean(user?.boosted_until && new Date(user.boosted_until).getTime() > Date.now()); }',
  'function isBoostActive(user) { return Boolean(user?.boosted_until && new Date(user.boosted_until).getTime() > Date.now()); }\nfunction hasPhoto(user) { return Boolean(user?.photo && String(user.photo).trim()); }\nfunction activityBadge(user) {\n  const value = user?.last_active_at || user?.created_at;\n  if (!value) return "";\n  const t = new Date(value).getTime();\n  if (!Number.isFinite(t)) return "";\n  const hours = (Date.now() - t) / 3600000;\n  if (hours <= 24) return "🟢 Был(а) недавно";\n  if (hours <= 72) return "🟡 Был(а) на днях";\n  if (hours <= 168) return "🔵 Был(а) на этой неделе";\n  return "";\n}\nfunction profileBadges(user) {\n  const badges = [];\n  if (isBoostActive(user)) badges.push("🔥 Буст");\n  else if (isVipActive(user)) badges.push("👑 VIP");\n  const activity = activityBadge(user);\n  if (activity) badges.push(activity);\n  return badges.join(" • ");\n}'
);

source = source.replace(
  'function formatDateTimeRu(value) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU"); }',
  'function formatDateTimeRu(value) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }\n\nfunction normalizeCity(value) {\n  let city = String(value || "").trim().toLowerCase().replace(/ё/g, "е").replace(/[.,]/g, " ").replace(/\\s+/g, " ");\n  city = city.replace(/^(г|город)\\s+/, "").replace(/\\s*-\\s*/g, "-");\n  const aliases = {\n    "нн": "нижний новгород",\n    "н новгород": "нижний новгород",\n    "ниж новгород": "нижний новгород",\n    "нижний": "нижний новгород",\n    "нижний новгород": "нижний новгород",\n    "мск": "москва",\n    "москва": "москва",\n    "спб": "санкт-петербург",\n    "с-петербург": "санкт-петербург",\n    "санкт петербург": "санкт-петербург",\n    "санкт-петербург": "санкт-петербург",\n    "питер": "санкт-петербург",\n    "екб": "екатеринбург",\n    "екат": "екатеринбург",\n    "екатеринбург": "екатеринбург",\n    "нск": "новосибирск",\n    "новосибирск": "новосибирск",\n    "ростов": "ростов-на-дону",\n    "ростов на дону": "ростов-на-дону",\n    "ростов-на-дону": "ростов-на-дону",\n    "кзн": "казань",\n    "казань": "казань"\n  };\n  return aliases[city] || city;\n}\n\nfunction canonicalCity(value) {\n  const normalized = normalizeCity(value);\n  const names = {\n    "нижний новгород": "Нижний Новгород",\n    "москва": "Москва",\n    "санкт-петербург": "Санкт-Петербург",\n    "екатеринбург": "Екатеринбург",\n    "новосибирск": "Новосибирск",\n    "ростов-на-дону": "Ростов-на-Дону",\n    "казань": "Казань"\n  };\n  return names[normalized] || String(value || "").trim().replace(/\\s+/g, " ");\n}'
);

source = source.replace(
  '    [{ action: { type: "text", label: "👀 Смотреть" }, color: "primary" }]\n  ]});\n}\n\nasync function sendMessage',
  '    [{ action: { type: "text", label: "👀 Смотреть дальше" }, color: "primary" }]\n  ]});\n}\n\nasync function sendMessage'
);

source = source.replace(
  'function weightedPick(profiles) {\n  if (!profiles.length) return null;\n  const weighted = [];\n  for (const profile of profiles) {\n    let weight = 1;\n    if (isVipActive(profile)) weight = 3;\n    if (isBoostActive(profile)) weight = 8;\n    for (let i = 0; i < weight; i += 1) weighted.push(profile);\n  }\n  return weighted[Math.floor(Math.random() * weighted.length)];\n}',
  'function weightedPick(profiles) {\n  if (!profiles.length) return null;\n  const now = Date.now();\n  const weighted = [];\n  for (const profile of profiles) {\n    let weight = 2;\n    if (isVipActive(profile)) weight += 2;\n    if (isBoostActive(profile)) weight += 7;\n\n    const activityValue = profile.last_active_at || profile.created_at;\n    const activeAt = activityValue ? new Date(activityValue).getTime() : 0;\n    const activeDays = activeAt ? (now - activeAt) / 86400000 : Infinity;\n\n    if (activeDays <= 1) weight += 5;\n    else if (activeDays <= 3) weight += 3;\n    else if (activeDays <= 7) weight += 1;\n    else if (activeDays > 60) weight = Math.min(weight, 1);\n    else if (activeDays > 30) weight = Math.max(1, Math.floor(weight / 2));\n\n    const createdAt = profile.created_at ? new Date(profile.created_at).getTime() : 0;\n    const ageDays = createdAt ? (now - createdAt) / 86400000 : Infinity;\n    if (ageDays <= 3) weight += 3;\n    else if (ageDays <= 14) weight += 1;\n\n    if (isBoostActive(profile)) weight = Math.max(weight, 9);\n    for (let i = 0; i < weight; i += 1) weighted.push(profile);\n  }\n  return weighted[Math.floor(Math.random() * weighted.length)];\n}\n\nasync function notifyAboutNewProfile(newUser) {\n  try {\n    if (!newUser || newUser.step !== "done" || newUser.is_banned || newUser.is_hidden || !hasPhoto(newUser) || !newUser.gender || !newUser.looking_for) return;\n    const activeSince = new Date(Date.now() - 14 * 86400000).toISOString();\n    const { data: candidates, error } = await supabase.from("users").select("*")\n      .eq("step", "done").eq("is_banned", false).eq("is_hidden", false)\n      .eq("gender", newUser.looking_for).eq("looking_for", newUser.gender)\n      .gte("last_active_at", activeSince).neq("id", newUser.id).limit(50);\n    if (error || !candidates?.length) return;\n    const sameCity = candidates.filter(u => u.city && newUser.city && normalizeCity(u.city) === normalizeCity(newUser.city));\n    const pool = sameCity.length ? sameCity : candidates;\n    let sent = 0;\n    for (const u of pool) {\n      if (sent >= 10) break;\n      const lastNotice = u.last_new_profile_notify_at ? new Date(u.last_new_profile_notify_at).getTime() : 0;\n      if (lastNotice && Date.now() - lastNotice < 24 * 3600000) continue;\n      await sendMessage(u.id, `✨ Появилась новая анкета${sameCity.length ? ` в городе ${newUser.city}` : ""}!\\n\\nЗагляни — возможно, это именно тот человек ❤️`, mainKeyboard());\n      await updateUser(u.id, { last_new_profile_notify_at: new Date().toISOString() });\n      sent += 1;\n    }\n  } catch (e) { console.log("NEW PROFILE NOTIFY ERROR:", e.message); }\n}'
);

source = source.replace(
  '  if (!currentUser) return;\n  if (!await canViewProfiles(currentUser)) {',
  '  if (!currentUser) return;\n  if (!hasPhoto(currentUser)) { await sendMessage(userId, "📸 Чтобы пользоваться поиском, сначала добавь фото в анкету.\\n\\nНажми «✏️ Изменить» → «Фото».", mainKeyboard()); return; }\n  if (!await canViewProfiles(currentUser)) {'
);

source = source.replace(
  '.eq("step", "done").eq("is_banned", false).eq("is_hidden", false)\n    .gte("age", currentUser.age_min || 18)',
  '.eq("step", "done").eq("is_banned", false).eq("is_hidden", false).not("photo", "is", null).neq("photo", "")\n    .gte("age", currentUser.age_min || 18)'
);

source = source.replace(
  '  const sameCity = profiles.filter(p => p.city && currentUser.city && p.city.trim().toLowerCase() === currentUser.city.trim().toLowerCase());',
  '  const sameCity = profiles.filter(p => p.city && currentUser.city && normalizeCity(p.city) === normalizeCity(currentUser.city));'
);

source = source.replace(
  '  const text = `✨ Анкета\\n\\n${profile.name || "Без имени"}, ${profile.age || "?"}\\n📍 ${profile.city || "Город не указан"}\\n\\n${profile.about || "О себе не указано"}\\n\\n${isBoostActive(profile) ? "🔥 Сейчас в бусте\\n" : isVipActive(profile) ? "👑 VIP-профиль\\n" : ""}📊 Осталось просмотров: ${isVipActive(currentUser) ? "∞" : Math.max(0, FREE_DAILY_LIMIT - (currentUser.daily_views || 0))}`;',
  '  const badges = profileBadges(profile);\n  const text = `💫 ${profile.name || "Без имени"}, ${profile.age || "?"}\\n📍 ${profile.city || "Город не указан"}${badges ? `\\n${badges}` : ""}\\n\\n${profile.about || "О себе пока ничего не рассказано"}\\n\\n❤️ Лайк   •   👎 Далее\\n📊 Осталось просмотров: ${isVipActive(currentUser) ? "∞" : Math.max(0, FREE_DAILY_LIMIT - (currentUser.daily_views || 0))}`;'
);

source = source.replace(
  '.in("id", pendingIds).eq("step", "done").eq("is_banned", false).eq("is_hidden", false).limit(20);',
  '.in("id", pendingIds).eq("step", "done").eq("is_banned", false).eq("is_hidden", false).not("photo", "is", null).neq("photo", "").limit(20);'
);

source = source.replace(
  '  const text = `👑 Тебя лайкнул(а)\\n\\n${profile.name || "Без имени"}, ${profile.age || "?"}\\n📍 ${profile.city || "Город не указан"}\\n\\n${profile.about || "О себе не указано"}\\n\\n❤️ Лайк — взаимная симпатия\\n👎 Далее — пропустить`;',
  '  const badges = profileBadges(profile);\n  const text = `👑 Тебя лайкнул(а)\\n\\n💫 ${profile.name || "Без имени"}, ${profile.age || "?"}\\n📍 ${profile.city || "Город не указан"}${badges ? `\\n${badges}` : ""}\\n\\n${profile.about || "О себе пока ничего не рассказано"}\\n\\n❤️ Лайк — взаимная симпатия\\n👎 Далее — пропустить`;'
);

source = source.replace(
  '  const text = `👤 Моя анкета\\n\\nИмя: ${user.name || "Не указано"}\\nВозраст: ${user.age || "Не указан"}\\nГород: ${user.city || "Не указан"}\\nПол: ${user.gender || "Не указан"}\\nИщу: ${user.looking_for || "Не указано"}\\nВозраст поиска: ${user.age_min || 18}–${user.age_max || 80}\\nО себе: ${user.about || "Не указано"}\\n\\n👑 VIP: ${vipText}\\n🔥 Буст: ${isBoostActive(user) ? `до ${formatDateTimeRu(user.boosted_until)}` : "не активен"}\\n🙈 Скрыта: ${user.is_hidden ? "Да" : "Нет"}\\n📊 Осталось просмотров: ${viewsLeft}\\n\\n📈 Статистика анкеты\\n👀 Просмотров: ${stats.views}\\n❤️ Лайков: ${stats.likes}`;',
  '  const badges = profileBadges(user);\n  const text = `👤 Моя анкета\\n\\n💫 ${user.name || "Не указано"}, ${user.age || "?"}\\n📍 ${user.city || "Город не указан"}${badges ? `\\n${badges}` : ""}\\n\\n${user.about || "О себе пока ничего не рассказано"}\\n\\n🔎 Ищу: ${user.looking_for || "Не указано"}, ${user.age_min || 18}–${user.age_max || 80} лет\\n👑 VIP: ${vipText}\\n🔥 Буст: ${isBoostActive(user) ? `до ${formatDateTimeRu(user.boosted_until)}` : "не активен"}\\n🙈 Скрыта: ${user.is_hidden ? "Да" : "Нет"}\\n📸 Фото: ${hasPhoto(user) ? "Да" : "Нет — добавь фото, чтобы попасть в выдачу"}\\n📊 Осталось просмотров: ${viewsLeft}\\n\\n📈 Статистика\\n👀 Просмотров: ${stats.views}\\n❤️ Лайков: ${stats.likes}`;'
);

source = source.replace(
  '  if (user.step === "edit_city") { if (!text) return true; await updateUser(userId,{city:text,step:"done"}); await sendMessage(userId,"✅ Город изменён.",mainKeyboard()); return true; }',
  '  if (user.step === "edit_city") { if (!text) return true; const city = canonicalCity(text); await updateUser(userId,{city,step:"done"}); await sendMessage(userId,`✅ Город изменён: ${city}.`,mainKeyboard()); return true; }'
);

source = source.replace(
  '  if (user.step === "city") { if(!text){await sendMessage(userId,"Напиши название города.");return;} await updateUser(userId,{city:text,step:"gender"}); await sendMessage(userId,"Кто ты?",genderKeyboard()); return; }',
  '  if (user.step === "city") { if(!text){await sendMessage(userId,"Напиши название города.");return;} const city = canonicalCity(text); await updateUser(userId,{city,step:"gender"}); await sendMessage(userId,`Запомнил: ${city} 👍\\n\\nКто ты?`,genderKeyboard()); return; }'
);

source = source.replace(
  '  let user = await getUser(userId);\n\n  if (message === "админ" || message === "статистика")',
  '  let user = await getUser(userId);\n  let wasInactive = false;\n  if (user) {\n    const lastActive = user.last_active_at ? new Date(user.last_active_at).getTime() : 0;\n    wasInactive = Boolean(lastActive && Date.now() - lastActive > 14 * 86400000);\n    if (!lastActive || Date.now() - lastActive > 5 * 60 * 1000) {\n      const nowIso = new Date().toISOString();\n      await updateUser(userId, { last_active_at: nowIso });\n      user.last_active_at = nowIso;\n    }\n  }\n\n  if (message === "админ" || message === "статистика")'
);

source = source.replace(
  '  user = await normalizeVip(user);\n  if (user.is_banned) { await sendMessage(userId,"🚫 Твоя анкета заблокирована из-за жалоб.",mainKeyboard()); return; }',
  '  user = await normalizeVip(user);\n  if (user.is_banned) { await sendMessage(userId,"🚫 Твоя анкета заблокирована из-за жалоб.",mainKeyboard()); return; }\n  if (wasInactive && user.step === "done") {\n    const lastReturn = user.last_return_message_at ? new Date(user.last_return_message_at).getTime() : 0;\n    if (!lastReturn || Date.now() - lastReturn > 14 * 86400000) {\n      await sendMessage(userId, "❤️ С возвращением в Vector Love! За время твоего отсутствия здесь могли появиться новые анкеты. Загляни в поиск 👀", mainKeyboard());\n      await updateUser(userId, { last_return_message_at: new Date().toISOString() });\n    }\n  }'
);

source = source.replace(
  '  await updateUser(userId, { viewing_user: null, viewing_mode: "browse" });\n  if (mode === "liked") await showWhoLikedCard(userId); else await showProfile(userId);\n}\n\nasync function handleSkip',
  '  await updateUser(userId, { viewing_user: null, viewing_mode: "browse" });\n  if (match) return;\n  if (mode === "liked") await showWhoLikedCard(userId); else await showProfile(userId);\n}\n\nasync function handleSkip'
);

source = source.replace(
  '  if (message === "смотреть" || message === "👀 смотреть") { if(user.step!=="done")',
  '  if (message === "смотреть" || message === "👀 смотреть" || message === "👀 смотреть дальше" || message === "смотреть дальше") { if(user.step!=="done")'
);

source = source.replace(
  '  if (user.step === "photo") { const photo=getPhotoAttachment(vkMessage); if(!photo){await sendMessage(userId,"Отправь именно фото 📸");return;} await updateUser(userId,{photo,step:"done",age_min:user.age_min||18,age_max:user.age_max||80,viewing_mode:"browse"}); await sendMessage(userId,"🔥 Анкета готова! Теперь нажми «👀 Смотреть» ❤️",mainKeyboard()); return; }',
  '  if (user.step === "photo") { const photo=getPhotoAttachment(vkMessage); if(!photo){await sendMessage(userId,"📸 Фото обязательно. Отправь именно фотографию, чтобы завершить анкету.");return;} await updateUser(userId,{photo,step:"done",age_min:user.age_min||18,age_max:user.age_max||80,viewing_mode:"browse",last_active_at:new Date().toISOString()}); await sendMessage(userId,"🔥 Анкета готова! Теперь нажми «👀 Смотреть» ❤️",mainKeyboard()); const freshProfile = await getUser(userId); notifyAboutNewProfile(freshProfile).catch(e=>console.log("NOTIFY ERROR:",e.message)); return; }'
);

source = source.replace(
  /function getPhotoAttachment\(vkMessage\) \{[\s\S]*?\n\}/,
  'function getPhotoAttachment(vkMessage) {\n  const photoAttachment = (vkMessage.attachments || []).find(item => item.type === "photo");\n  if (!photoAttachment) return null;\n  const photo = photoAttachment.photo;\n  return "photo" + photo.owner_id + "_" + photo.id + (photo.access_key ? "_" + photo.access_key : "");\n}'
);

source = source.replaceAll("💘 У ВАС ВЗАИМНАЯ СИМПАТИЯ!", "💘 Взаимная симпатия!");
source = source.replaceAll("Нажми «💌 Написать» — и начинай знакомство 😊", "Вы понравились друг другу ❤️\n\nСамое время написать и познакомиться поближе 😉");
source = source.replace(
  '    await sendMessage(targetId, "❤️ Тебя кто-то лайкнул!\\n\\nНажми «👑 Кто лайкнул», чтобы посмотреть.", mainKeyboard());',
  '    await sendMessage(targetId, isVipActive(await normalizeVip(await getUser(targetId))) ? "❤️ Тебя лайкнули! Можешь сразу открыть «👑 Кто лайкнул» 👀" : "❤️ Кому-то понравилась твоя анкета 👀 С VIP можно сразу увидеть, кто это.", mainKeyboard());'
);
source = source.replaceAll("👑 VIP — 199₽ / месяц", "👑 Vector Love VIP — 199 ₽ / месяц");
source = source.replaceAll("• «Кто лайкнул» карточками", "• сразу видно, кто тебя лайкнул");
source = source.replaceAll("• приоритет в выдаче", "• анкета показывается чаще");

source = source.replace(
  'async function processMessage(vkMessage) {',
  'async function resumeFlow(userId, user) {\n  if (!user) return;\n  const step = user.step;\n  if (step === "done") {\n    if (user.viewing_user) {\n      const target = await getUser(user.viewing_user);\n      if (target) {\n        const badges = profileBadges(target);\n        const text = "💫 " + (target.name || "Без имени") + ", " + (target.age || "?") + "\\n📍 " + (target.city || "Город не указан") + (badges ? "\\n" + badges : "") + "\\n\\n" + (target.about || "О себе пока ничего не рассказано");\n        await sendMessage(userId, text, mainKeyboard(), target.photo || null);\n        return;\n      }\n      await updateUser(userId, { viewing_user: null, viewing_mode: "browse" });\n    }\n    await sendMessage(userId, "❤️ Анкета готова. Можем продолжить знакомства 👀", mainKeyboard());\n    return;\n  }\n  if (step === "edit_menu") { await sendMessage(userId, "✏️ Продолжаем редактирование. Что хочешь изменить?", editKeyboard()); return; }\n  if (step === "edit_name") { await sendMessage(userId, "Ты менял имя. Напиши новое имя 👇"); return; }\n  if (step === "edit_age") { await sendMessage(userId, "Ты менял возраст. Напиши новый возраст 👇"); return; }\n  if (step === "edit_city") { await sendMessage(userId, "Ты менял город. Напиши новый город 👇"); return; }\n  if (step === "edit_about") { await sendMessage(userId, "Ты менял описание. Напиши новый текст о себе 👇"); return; }\n  if (step === "edit_photo") { await sendMessage(userId, "Ты менял фото. Отправь новую фотографию 📸"); return; }\n  if (step === "edit_looking_for") { await sendMessage(userId, "Продолжаем настройку поиска. Кого хочешь найти?", lookingKeyboard()); return; }\n  if (step === "filter_age_min") { await sendMessage(userId, "Продолжаем настройку возраста. Напиши минимальный возраст 👇"); return; }\n  if (step === "filter_age_max") { await sendMessage(userId, "Теперь напиши максимальный возраст 👇"); return; }\n  if (step === "delete_confirm") { await sendMessage(userId, "⚠️ Ты остановился на удалении анкеты. Точно удалить?", deleteConfirmKeyboard()); return; }\n  if (step === "name") { await sendMessage(userId, "Продолжаем создание анкеты ❤️\\n\\nНапиши своё имя 👇"); return; }\n  if (step === "age") { await sendMessage(userId, "Продолжаем создание анкеты. Сколько тебе лет? 🔞"); return; }\n  if (step === "city") { await sendMessage(userId, "Продолжаем создание анкеты. Из какого ты города? 🏙"); return; }\n  if (step === "gender") { await sendMessage(userId, "Продолжаем создание анкеты. Кто ты?", genderKeyboard()); return; }\n  if (step === "looking_for") { await sendMessage(userId, "Продолжаем создание анкеты. Кого хочешь найти?", lookingKeyboard()); return; }\n  if (step === "about") { await sendMessage(userId, "Продолжаем создание анкеты. Расскажи коротко о себе ✨"); return; }\n  if (step === "photo") { await sendMessage(userId, "Остался последний шаг — отправь фото 📸"); return; }\n  await sendMessage(userId, "Продолжаем с того места, где остановились 👇", mainKeyboard());\n}\n\nasync function processMessage(vkMessage) {'
);

source = source.replace(
  '  if (await processActionState(userId,user,message)) return;\n  if (await processEditStep(userId,user,message,text,vkMessage)) return;',
  '  if (message === "продолжить" || message === "↩️ продолжить" || message === "старт" || message === "начать") { await resumeFlow(userId, user); return; }\n  if (await processActionState(userId,user,message)) return;\n  if (await processEditStep(userId,user,message,text,vkMessage)) return;'
);

const patched = new Module(sourcePath, module.parent);
patched.filename = sourcePath;
patched.paths = module.paths;
patched._compile(source, sourcePath);
