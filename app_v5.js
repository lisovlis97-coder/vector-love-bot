const fs = require("fs");
const path = require("path");
const Module = require("module");

const wrapperPath = path.join(__dirname, "app_v4_1.js");
let wrapperSource = fs.readFileSync(wrapperPath, "utf8");

const marker = 'const patched = new Module(sourcePath, module.parent);';
const injection = String.raw`
source = source.replace(
  '[{ action: { type: "text", label: "📋 Чёрный список" }, color: "secondary" }]',
  '[{ action: { type: "text", label: "📋 Чёрный список" }, color: "secondary" }, { action: { type: "text", label: "💘 Мои матчи" }, color: "positive" }, { action: { type: "text", label: "🆘 Поддержка" }, color: "secondary" }]'
);

const extraHelpers = [
  'function supportKeyboard() {',
  '  return JSON.stringify({ one_time: false, buttons: [[{ action: { type: "open_link", link: "https://vk.com/im?sel=302920827", label: "💳 Оплатить VIP" } }], [{ action: { type: "text", label: "👀 Смотреть" }, color: "primary" }]] });',
  '}',
  '',
  'async function showSupport(userId) {',
  '  await sendMessage(userId, "🆘 Поддержка Vector Love\\n\\nЕсли хочешь подключить VIP — нажми «💳 Оплатить VIP» и напиши: «Хочу VIP».\\n\\nТебе пришлют реквизиты для оплаты по СБП. После оплаты отправь чек — VIP активируем вручную.\\n\\nПо другим вопросам тоже можешь писать туда же.", supportKeyboard());',
  '}',
  '',
  'async function showVipInfo(userId) {',
  '  const user = await normalizeVip(await getUser(userId));',
  '  if (!user) return;',
  '  if (isVipActive(user)) {',
  '    const until = user.vip_until ? " до " + formatDateRu(user.vip_until) : " без срока";',
  '    await sendMessage(userId, "👑 VIP активен" + until + ".\\n\\n• безлимитный просмотр\\n• видно, кто тебя лайкнул\\n• анкета показывается чаще\\n• 🔥 буст раз в сутки", mainKeyboard());',
  '    return;',
  '  }',
  '  await sendMessage(userId, "👑 VIP — 199 ₽ / месяц\\n\\n• безлимитный просмотр\\n• «Кто лайкнул» карточками\\n• приоритет в выдаче\\n• 🔥 буст раз в сутки\\n\\nОплата пока вручную по СБП через поддержку. После оплаты отправь чек — VIP активируем вручную.", supportKeyboard());',
  '}',
  '',
  'async function showMatches(userId) {',
  '  const { data: matches, error } = await supabase.from("matches").select("user1,user2,matched_at").or("user1.eq." + userId + ",user2.eq." + userId).order("matched_at", { ascending: false }).limit(20);',
  '  if (error) { console.log("MATCH LIST ERROR:", error); await sendMessage(userId, "Не получилось загрузить матчи 😔", mainKeyboard()); return; }',
  '  if (!matches || !matches.length) { await sendMessage(userId, "💘 Взаимных симпатий пока нет. Продолжай смотреть анкеты — всё ещё впереди ❤️", mainKeyboard()); return; }',
  '  const ids = matches.map(function(m) { return m.user1 === userId ? m.user2 : m.user1; });',
  '  const { data: users } = await supabase.from("users").select("id,name,age,city,is_banned").in("id", ids);',
  '  const byId = new Map((users || []).map(function(u) { return [u.id, u]; }));',
  '  let text = "💘 Мои матчи\\n\\n";',
  '  let shown = 0;',
  '  for (const m of matches) {',
  '    const otherId = m.user1 === userId ? m.user2 : m.user1;',
  '    const u = byId.get(otherId);',
  '    if (!u || u.is_banned) continue;',
  '    shown += 1;',
  '    text += shown + ". ❤️ " + (u.name || "Пользователь") + ", " + (u.age || "?") + (u.city ? " — " + u.city : "") + "\\n💌 https://vk.com/im?sel=" + otherId + "\\n\\n";',
  '  }',
  '  if (!shown) text = "💘 Взаимных симпатий пока нет.";',
  '  await sendMessage(userId, text, mainKeyboard());',
  '}'
].join('\n');

source = source.replace(
  'async function processMessage(vkMessage) {',
  extraHelpers + '\n\nasync function processMessage(vkMessage) {'
);

source = source.replace(
  '  if (message === "чёрный список" || message === "📋 чёрный список") { await showBlockList(userId); return; }',
  '  if (message === "чёрный список" || message === "📋 чёрный список") { await showBlockList(userId); return; }\n  if (message === "мои матчи" || message === "💘 мои матчи" || message === "матчи") { await showMatches(userId); return; }\n  if (message === "поддержка" || message === "🆘 поддержка") { await showSupport(userId); return; }'
);

source = source.replace(
  /  if \(message === "vip" \|\| message === "👑 vip"\) \{[^\n]*\}\n/,
  '  if (message === "vip" || message === "👑 vip") { await showVipInfo(userId); return; }\n'
);

source = source.replace(
  '  if (message.startsWith("выдать vip ")) { const id=Number(message.replace("выдать vip ","").trim()); if(id) await giveVip(userId,id); return; }',
  '  if (message.startsWith("выдать vip ")) { const id=Number(message.replace("выдать vip ","").trim()); if(id) await giveVip(userId,id); return; }\n  if (message.startsWith("vip ") && isAdmin(userId)) { const id=Number(message.replace("vip ","").trim()); if(id) await giveVip(userId,id); else await sendMessage(userId,"Формат: vip ID"); return; }'
);

source = source.replace(
  '    await sendMessage(targetId, isVipActive(await normalizeVip(await getUser(targetId))) ? "❤️ Тебя лайкнули! Можешь сразу открыть «👑 Кто лайкнул» 👀" : "❤️ Кому-то понравилась твоя анкета 👀 С VIP можно сразу увидеть, кто это.", mainKeyboard());',
  '    const likedTarget = await normalizeVip(await getUser(targetId));\n    await sendMessage(targetId, isVipActive(likedTarget) ? "❤️ Тебя лайкнули! Открой «👑 Кто лайкнул» и посмотри, кто это 👀" : "❤️ Кому-то понравилась твоя анкета 👀", mainKeyboard());'
);

source = source.replace(
  '  const { error } = await supabase.from("likes").upsert([{ from_user: userId, to_user: targetId }], { onConflict: "from_user,to_user", ignoreDuplicates: true });',
  '  const { data: existingLike } = await supabase.from("likes").select("from_user").eq("from_user", userId).eq("to_user", targetId).maybeSingle();\n  if (existingLike) { await sendMessage(userId, "❤️ Ты уже ставил лайк этой анкете.", mainKeyboard()); await updateUser(userId, { viewing_user: null, viewing_mode: "browse" }); return; }\n  const { error } = await supabase.from("likes").upsert([{ from_user: userId, to_user: targetId }], { onConflict: "from_user,to_user", ignoreDuplicates: true });'
);

source = source.replace(
  '    await sendMessage(userId, \`👑 Лимит просмотров закончился.\\n\\nБесплатно доступно \${FREE_DAILY_LIMIT} анкет в сутки.\`, mainKeyboard());',
  '    await sendMessage(userId, \`👀 Лимит просмотров на сегодня закончился.\\n\\nБесплатно доступно \${FREE_DAILY_LIMIT} анкет в сутки. Возвращайся завтра ❤️\\n\\nХочешь безлимит — открой «👑 VIP».\`, mainKeyboard());'
);

source = source.replace(
  '  if (!isVipActive(user)) { await sendMessage(userId, "👑 Это VIP-функция. С VIP ты увидишь тех, кто поставил тебе лайк ❤️", mainKeyboard()); return; }',
  '  if (!isVipActive(user)) { await sendMessage(userId, "👑 Это VIP-функция. С VIP ты увидишь тех, кто поставил тебе лайк ❤️\\n\\nОткрой «👑 VIP», чтобы подключить его через поддержку по СБП.", mainKeyboard()); return; }'
);
`;

wrapperSource = wrapperSource.replace(marker, injection + "\n" + marker);

const patchedWrapper = new Module(wrapperPath, module.parent);
patchedWrapper.filename = wrapperPath;
patchedWrapper.paths = module.paths;
patchedWrapper._compile(wrapperSource, wrapperPath);
