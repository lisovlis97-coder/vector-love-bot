const fs = require("fs");
const path = require("path");
const Module = require("module");

const wrapperPath = path.join(__dirname, "app_v5.js");
let wrapperSource = fs.readFileSync(wrapperPath, "utf8");

const marker = '`;\n\nwrapperSource = wrapperSource.replace(marker, injection + "\\n" + marker);';
const extra = String.raw`

source = source.replace(
  '  if (message.startsWith("vip ") && isAdmin(userId)) { const id=Number(message.replace("vip ","").trim()); if(id) await giveVip(userId,id); else await sendMessage(userId,"Формат: vip ID"); return; }',
  '  if (message.startsWith("vip ") && isAdmin(userId)) { const id=Number(message.replace("vip ","").trim()); if(id) await givePaidVip(userId,id); else await sendMessage(userId,"Формат: vip ID"); return; }'
);

source = source.replace(
  'async function processMessage(vkMessage) {',
  'async function givePaidVip(adminId,targetId) {\n  if (!isAdmin(adminId)) return;\n  let u = await normalizeVip(await getUser(targetId));\n  if (!u) { await sendMessage(adminId,"Пользователь не найден."); return; }\n  const base = isVipActive(u) && u.vip_until ? new Date(u.vip_until) : new Date();\n  const until = addDays(base,VIP_DAYS).toISOString();\n  await updateUser(targetId,{is_vip:true,vip_until:until});\n  const { error: saleError } = await supabase.from("vip_sales").insert([{user_id:targetId,granted_by:adminId,amount_rub:199,payment_method:"sbp",vip_until:until}]);\n  if (saleError) console.log("VIP SALE LOG ERROR:",saleError);\n  await sendMessage(adminId,"💳 VIP по СБП выдан " + targetId + " до " + formatDateRu(until) + ". Продажа записана: 199 ₽.");\n  await sendMessage(targetId,"👑 VIP активирован до " + formatDateRu(until) + "! ❤️",mainKeyboard());\n}\n\nasync function processMessage(vkMessage) {'
);

source = source.replace(
  /async function showMatches\(userId\) \{[\s\S]*?\n\}/,
  'function matchListKeyboard(targetId) {\n  return JSON.stringify({ one_time:false, buttons:[[{action:{type:"open_link",link:"https://vk.com/im?sel="+targetId,label:"💌 Написать"}}],[{action:{type:"text",label:"➡️ Следующий матч"},color:"primary"}],[{action:{type:"text",label:"👀 Смотреть"},color:"secondary"}]] });\n}\n\nasync function showMatches(userId, nextMatch = false) {\n  const current = await getUser(userId);\n  const { data: matches, error } = await supabase.from("matches").select("user1,user2,matched_at").or("user1.eq." + userId + ",user2.eq." + userId).order("matched_at", { ascending: false }).limit(50);\n  if (error) { console.log("MATCH LIST ERROR:", error); await sendMessage(userId,"Не получилось загрузить матчи 😔",mainKeyboard()); return; }\n  if (!matches || !matches.length) { await updateUser(userId,{viewing_user:null,viewing_mode:"browse"}); await sendMessage(userId,"💘 Взаимных симпатий пока нет. Продолжай смотреть анкеты — всё ещё впереди ❤️",mainKeyboard()); return; }\n  const ids = matches.map(function(m){ return m.user1 === userId ? m.user2 : m.user1; });\n  const { data: users } = await supabase.from("users").select("*").in("id",ids);\n  const byId = new Map((users || []).map(function(u){ return [u.id,u]; }));\n  const available = ids.filter(function(id){ const u=byId.get(id); return u && !u.is_banned && !u.is_hidden; });\n  if (!available.length) { await sendMessage(userId,"💘 Активных матчей сейчас нет.",mainKeyboard()); return; }\n  let index = 0;\n  if (nextMatch && current && current.viewing_mode === "matches" && current.viewing_user) { const pos=available.indexOf(current.viewing_user); index = pos >= 0 ? (pos + 1) % available.length : 0; }\n  const targetId = available[index];\n  const u = byId.get(targetId);\n  await updateUser(userId,{viewing_user:targetId,viewing_mode:"matches"});\n  const badges = profileBadges(u);\n  const text = "💘 Матч " + (index+1) + " из " + available.length + "\\n\\n💫 " + (u.name || "Пользователь") + ", " + (u.age || "?") + "\\n📍 " + (u.city || "Город не указан") + (badges ? "\\n" + badges : "") + "\\n\\n" + (u.about || "О себе пока ничего не рассказано") + "\\n\\nВы уже понравились друг другу ❤️";\n  await sendMessage(userId,text,matchListKeyboard(targetId),u.photo || null);\n}'
);

source = source.replace(
  '  if (message === "мои матчи" || message === "💘 мои матчи" || message === "матчи") { await showMatches(userId); return; }',
  '  if (message === "мои матчи" || message === "💘 мои матчи" || message === "матчи") { await showMatches(userId,false); return; }\n  if (message === "➡️ следующий матч" || message === "следующий матч") { await showMatches(userId,true); return; }'
);

source = source.replace(
  /async function showAdminPanel\(userId\) \{[\s\S]*?\n\}\n\nasync function showAdminList/,
  'async function showAdminPanel(userId) {\n  if (!isAdmin(userId)) { await sendMessage(userId,"Нет доступа."); return; }\n  const now = Date.now();\n  const since24 = new Date(now - 24*3600000).toISOString();\n  const since7d = new Date(now - 7*86400000).toISOString();\n  const today = todayDate();\n  const startToday = new Date(new Date().setUTCHours(0,0,0,0)).toISOString();\n  const [total,ready,vip,banned,reports,active24,active7,limitHit,daily,salesToday,salesAll] = await Promise.all([\n    supabase.from("users").select("*",{count:"exact",head:true}),\n    supabase.from("users").select("*",{count:"exact",head:true}).eq("step","done"),\n    supabase.from("users").select("*",{count:"exact",head:true}).eq("is_vip",true),\n    supabase.from("users").select("*",{count:"exact",head:true}).eq("is_banned",true),\n    supabase.from("reports").select("*",{count:"exact",head:true}),\n    supabase.from("users").select("*",{count:"exact",head:true}).gte("last_active_at",since24),\n    supabase.from("users").select("*",{count:"exact",head:true}).gte("last_active_at",since7d),\n    supabase.from("users").select("*",{count:"exact",head:true}).eq("last_view_date",today).gte("daily_views",FREE_DAILY_LIMIT),\n    adminDailyStats(),\n    supabase.from("vip_sales").select("amount_rub").gte("granted_at",startToday),\n    supabase.from("vip_sales").select("amount_rub")\n  ]);\n  const todaySales = (salesToday.data || []).length;\n  const todayRevenue = (salesToday.data || []).reduce(function(s,x){ return s + (x.amount_rub || 0); },0);\n  const allSales = (salesAll.data || []).length;\n  const allRevenue = (salesAll.data || []).reduce(function(s,x){ return s + (x.amount_rub || 0); },0);\n  let text = "🛠 Админка Vector Love\\n\\n";\n  text += "👥 Всего анкет: " + (total.count||0) + "\\n";\n  text += "✅ Готовых: " + (ready.count||0) + "\\n";\n  text += "🟢 Активны 24ч: " + (active24.count||0) + "\\n";\n  text += "📅 Активны 7 дней: " + (active7.count||0) + "\\n";\n  text += "👑 VIP сейчас: " + (vip.count||0) + "\\n";\n  text += "🚫 Забанено: " + (banned.count||0) + "\\n";\n  text += "⚠️ Жалоб всего: " + (reports.count||0) + "\\n";\n  text += "⛔ Уперлись в лимит сегодня: " + (limitHit.count||0) + "\\n\\n";\n  text += "📅 Сегодня\\n🆕 Регистраций: " + daily.users + "\\n❤️ Лайков: " + daily.likes + "\\n💘 Матчей: " + daily.matches + "\\n🚫 Жалоб: " + daily.reports + "\\n💳 VIP продаж: " + todaySales + " на " + todayRevenue + " ₽\\n\\n";\n  text += "💰 VIP за всё время: " + allSales + " на " + allRevenue + " ₽\\n\\nКоманды:\\nжалобы\\nновые анкеты\\nvip список\\nбан список\\nпоиск ID\\nудалить ID\\nvip ID — оплаченный VIP по СБП\\nвыдать vip ID — ручная выдача без продажи\\nбан ID\\nразбан ID\\nкод VIP-XXX";\n  await sendMessage(userId,text);\n}\n\nasync function showAdminList'
);
`;

wrapperSource = wrapperSource.replace(marker, extra + "\n" + marker);

const patched = new Module(wrapperPath, module.parent);
patched.filename = wrapperPath;
patched.paths = module.paths;
patched._compile(wrapperSource, wrapperPath);
