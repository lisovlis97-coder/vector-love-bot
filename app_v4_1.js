const fs = require("fs");
const path = require("path");
const Module = require("module");

const sourcePath = path.join(__dirname, "app_v4.js");
let source = fs.readFileSync(sourcePath, "utf8");

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
  'function weightedPick(profiles) {\n  if (!profiles.length) return null;\n  const now = Date.now();\n  const weighted = [];\n  for (const profile of profiles) {\n    let weight = 2;\n    if (isVipActive(profile)) weight += 2;\n    if (isBoostActive(profile)) weight += 7;\n\n    const activityValue = profile.last_active_at || profile.created_at;\n    const activeAt = activityValue ? new Date(activityValue).getTime() : 0;\n    const activeDays = activeAt ? (now - activeAt) / 86400000 : Infinity;\n\n    if (activeDays <= 1) weight += 5;\n    else if (activeDays <= 3) weight += 3;\n    else if (activeDays <= 7) weight += 1;\n    else if (activeDays > 60) weight = Math.min(weight, 1);\n    else if (activeDays > 30) weight = Math.max(1, Math.floor(weight / 2));\n\n    const createdAt = profile.created_at ? new Date(profile.created_at).getTime() : 0;\n    const ageDays = createdAt ? (now - createdAt) / 86400000 : Infinity;\n    if (ageDays <= 3) weight += 3;\n    else if (ageDays <= 14) weight += 1;\n\n    if (isBoostActive(profile)) weight = Math.max(weight, 9);\n    for (let i = 0; i < weight; i += 1) weighted.push(profile);\n  }\n  return weighted[Math.floor(Math.random() * weighted.length)];\n}'
);

source = source.replace(
  '  const sameCity = profiles.filter(p => p.city && currentUser.city && p.city.trim().toLowerCase() === currentUser.city.trim().toLowerCase());',
  '  const sameCity = profiles.filter(p => p.city && currentUser.city && normalizeCity(p.city) === normalizeCity(currentUser.city));'
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
  '  let user = await getUser(userId);\n  if (user) {\n    const lastActive = user.last_active_at ? new Date(user.last_active_at).getTime() : 0;\n    if (!lastActive || Date.now() - lastActive > 5 * 60 * 1000) {\n      await updateUser(userId, { last_active_at: new Date().toISOString() });\n      user.last_active_at = new Date().toISOString();\n    }\n  }\n\n  if (message === "админ" || message === "статистика")'
);

source = source.replace(
  '  await updateUser(userId, { viewing_user: null, viewing_mode: "browse" });\n  if (mode === "liked") await showWhoLikedCard(userId); else await showProfile(userId);\n}\n\nasync function handleSkip',
  '  await updateUser(userId, { viewing_user: null, viewing_mode: "browse" });\n  if (match) return;\n  if (mode === "liked") await showWhoLikedCard(userId); else await showProfile(userId);\n}\n\nasync function handleSkip'
);

source = source.replace(
  '  if (message === "смотреть" || message === "👀 смотреть") { if(user.step!=="done")',
  '  if (message === "смотреть" || message === "👀 смотреть" || message === "👀 смотреть дальше" || message === "смотреть дальше") { if(user.step!=="done")'
);

const patched = new Module(sourcePath, module.parent);
patched.filename = sourcePath;
patched.paths = module.paths;
patched._compile(source, sourcePath);
