const fs = require("fs");
const path = require("path");
const Module = require("module");

const wrapperPath = path.join(__dirname, "app_v4_1.js");
let wrapperSource = fs.readFileSync(wrapperPath, "utf8");

const marker = 'const patched = new Module(sourcePath, module.parent);';
const injection = String.raw`
source = source.replace(
  '[{ action: { type: "text", label: "📋 Чёрный список" }, color: "secondary" }]',
  '[{ action: { type: "text", label: "📋 Чёрный список" }, color: "secondary" }, { action: { type: "text", label: "💘 Мои матчи" }, color: "positive" }]'
);

const extraHelpers = [
  'async function showVipInfo(userId) {',
  '  const user = await normalizeVip(await getUser(userId));',
  '  if (!user) return;',
  '  if (isVipActive(user)) {',
  '    const until = user.vip_until ? " до " + formatDateRu(user.vip_until) : " без срока";',
  '    await sendMessage(userId, "👑 VIP активен" + until + ".\\n\\n• безлимитный просмотр\\n• видно, кто тебя лайкнул\\n• анкета показывается чаще\\n• 🔥 буст раз в сутки", mainKeyboard());',
  '    return;',
  '  }',
  '  await sendMessage(userId, "👑 Vector Love VIP\\n\\n• безлимитный просмотр\\n• видно, кто тебя лайкнул\\n• анкета показывается чаще\\n• 🔥 буст раз в сутки\\n\\nСейчас подключение VIP через оплату временно недоступно. Если у тебя есть VIP-код — просто отправь его сообщением.", mainKeyboard());',
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
  '  if (message === "чёрный список" || message === "📋 чёрный список") { await showBlockList(userId); return; }\n  if (message === "мои матчи" || message === "💘 мои матчи" || message === "матчи") { await showMatches(userId); return; }'
);

source = source.replace(
  /  if \(message === "vip" \|\| message === "👑 vip"\) \{[^\n]*\}\n/,
  '  if (message === "vip" || message === "👑 vip") { await showVipInfo(userId); return; }\n'
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
  '    await sendMessage(userId, \`👑 Лимит просмотров закончился.\n\nБесплатно доступно \${FREE_DAILY_LIMIT} анкет в сутки.\`, mainKeyboard());',
  '    await sendMessage(userId, \`👀 Лимит просмотров на сегодня закончился.\n\nБесплатно доступно \${FREE_DAILY_LIMIT} анкет в сутки. Возвращайся завтра ❤️\n\nЕсли у тебя есть VIP-код — можешь отправить его сообщением.\`, mainKeyboard());'
);

source = source.replace(
  '  if (!isVipActive(user)) { await sendMessage(userId, "👑 Это VIP-функция. С VIP ты увидишь тех, кто поставил тебе лайк ❤️", mainKeyboard()); return; }',
  '  if (!isVipActive(user)) { await sendMessage(userId, "👑 «Кто лайкнул» доступно при активном VIP.\n\nЕсли у тебя есть VIP-код — отправь его сообщением.", mainKeyboard()); return; }'
);
`;

wrapperSource = wrapperSource.replace(marker, injection + "\n" + marker);

const patchedWrapper = new Module(wrapperPath, module.parent);
patchedWrapper.filename = wrapperPath;
patchedWrapper.paths = module.paths;
patchedWrapper._compile(wrapperSource, wrapperPath);
