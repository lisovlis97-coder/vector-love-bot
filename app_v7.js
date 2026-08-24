const fs = require("fs");
const path = require("path");
const Module = require("module");

const wrapperPath = path.join(__dirname, "app_v6.js");
let wrapperSource = fs.readFileSync(wrapperPath, "utf8");

const compileMarker = 'const patched = new Module(wrapperPath, module.parent);';
const injected = String.raw`
const v7Marker = '\`;\\n\\nwrapperSource = wrapperSource.replace(marker, injection + "\\\\n" + marker);';
const v7Extra = String.raw\`

source = source.replace(
  '[{ action: { type: "text", label: "📋 Чёрный список" }, color: "secondary" }, { action: { type: "text", label: "💘 Мои матчи" }, color: "positive" }, { action: { type: "text", label: "🆘 Поддержка" }, color: "secondary" }]',
  '[{ action: { type: "text", label: "📋 Чёрный список" }, color: "secondary" }, { action: { type: "text", label: "💘 Мои матчи" }, color: "positive" }, { action: { type: "text", label: "🎁 Пригласить" }, color: "positive" }, { action: { type: "text", label: "🆘 Поддержка" }, color: "secondary" }]'
);

const referralHelpers = [
  'function referralCodeFor(userId) { return "VL" + userId; }',
  'function hasForbiddenProfileContent(value) {',
  '  const s = String(value || "").toLowerCase();',
  '  return /(https?:\\/\\/|www\\.|vk\\.com\\/|t\\.me\\/|wa\\.me\\/|telegram|телеграм|whatsapp|ватсап|@[a-z0-9_]{3,}|\\+?\\d[\\d\\s\\-()]{8,})/i.test(s);',
  '}',
  'async function logModeration(userId, reason, details) {',
  '  try { await supabase.from("moderation_events").insert([{user_id:userId,reason:reason,details:details || null}]); } catch (e) {}',
  '}',
  'async function showReferral(userId) {',
  '  const code = referralCodeFor(userId);',
  '  const [{ count: total }, { count: qualified }] = await Promise.all([',
  '    supabase.from("referrals").select("*",{count:"exact",head:true}).eq("referrer_id",userId),',
  '    supabase.from("referrals").select("*",{count:"exact",head:true}).eq("referrer_id",userId).not("qualified_at","is",null)',
  '  ]);',
  '  const q = qualified || 0;',
  '  const left = q % 5 === 0 ? 5 : 5 - (q % 5);',
  '  let text = "🎁 Приглашай друзей в Vector Love\\n\\n";',
  '  text += "За каждые 5 друзей, которые создадут нормальную анкету и начнут пользоваться ботом, ты получишь 👑 VIP на 30 дней.\\n\\n";',
  '  text += "Твой код: " + code + "\\n";',
  '  text += "Ссылка на бот: https://vk.me/vectorloveclub\\n\\n";',
  '  text += "Другу нужно открыть бот и отправить код " + code + " до завершения анкеты.\\n\\n";',
  '  text += "Приглашено: " + (total || 0) + "\\nЗасчитано: " + q + "\\nДо следующего VIP: " + left + ".";',
  '  await sendMessage(userId,text,mainKeyboard());',
  '}',
  'async function bindReferralCode(inviteeId, code) {',
  '  const match = String(code || "").trim().toUpperCase().match(/^VL(\\d+)$/);',
  '  if (!match) return false;',
  '  const referrerId = Number(match[1]);',
  '  if (!referrerId || referrerId === inviteeId) { await sendMessage(inviteeId,"Этот код использовать нельзя.",mainKeyboard()); return true; }',
  '  const invitee = await getUser(inviteeId);',
  '  if (!invitee) return true;',
  '  if (invitee.referrer_id || invitee.step === "done") { await sendMessage(inviteeId,"🎁 Реферальный код можно привязать только один раз до завершения анкеты.",mainKeyboard()); return true; }',
  '  const referrer = await getUser(referrerId);',
  '  if (!referrer || referrer.step !== "done" || referrer.is_banned) { await sendMessage(inviteeId,"Такой реферальный код не найден.",mainKeyboard()); return true; }',
  '  const { error } = await supabase.from("referrals").insert([{referrer_id:referrerId,invitee_id:inviteeId}]);',
  '  if (error) { await sendMessage(inviteeId,"Не получилось привязать код. Возможно, он уже использован.",mainKeyboard()); return true; }',
  '  await updateUser(inviteeId,{referrer_id:referrerId});',
  '  await sendMessage(inviteeId,"🎁 Код принят! Когда ты заполнишь анкету и начнёшь пользоваться ботом, приглашение засчитается ❤️",mainKeyboard());',
  '  return true;',
  '}',
  'async function tryQualifyReferral(inviteeId) {',
  '  const { data: ref } = await supabase.from("referrals").select("*").eq("invitee_id",inviteeId).maybeSingle();',
  '  if (!ref || ref.qualified_at) return;',
  '  const u = await getUser(inviteeId);',
  '  if (!u || u.step !== "done" || !u.photo || u.is_banned) return;',
  '  const created = u.created_at ? new Date(u.created_at).getTime() : 0;',
  '  if (created && Date.now() - created < 10 * 60 * 1000) return;',
  '  const { count: likesCount } = await supabase.from("likes").select("*",{count:"exact",head:true}).eq("from_user",inviteeId);',
  '  if ((likesCount || 0) < 3) return;',
  '  const nowIso = new Date().toISOString();',
  '  await supabase.from("referrals").update({qualified_at:nowIso}).eq("id",ref.id);',
  '  const { count: qualified } = await supabase.from("referrals").select("*",{count:"exact",head:true}).eq("referrer_id",ref.referrer_id).not("qualified_at","is",null);',
  '  const inviter = await getUser(ref.referrer_id);',
  '  if (!inviter) return;',
  '  const earnedRounds = Math.floor((qualified || 0) / 5);',
  '  const already = inviter.referral_reward_count || 0;',
  '  if (earnedRounds <= already) { await sendMessage(ref.referrer_id,"🎁 Ещё один приглашённый друг засчитан! Всего: " + (qualified || 0) + ".",mainKeyboard()); return; }',
  '  const addRounds = earnedRounds - already;',
  '  const base = isVipActive(inviter) && inviter.vip_until ? new Date(inviter.vip_until) : new Date();',
  '  const until = addDays(base,30 * addRounds).toISOString();',
  '  await updateUser(ref.referrer_id,{is_vip:true,vip_until:until,referral_reward_count:earnedRounds});',
  '  await sendMessage(ref.referrer_id,"🎉 Пять приглашённых друзей засчитаны! Тебе начислен 👑 VIP на 30 дней. VIP активен до " + formatDateRu(until) + ".",mainKeyboard());',
  '}'
].join("\\n");

source = source.replace(
  'async function processMessage(vkMessage) {',
  referralHelpers + '\\n\\nasync function processMessage(vkMessage) {'
);

source = source.replace(
  '  if (message === "поддержка" || message === "🆘 поддержка") { await showSupport(userId); return; }',
  '  if (message === "поддержка" || message === "🆘 поддержка") { await showSupport(userId); return; }\\n  if (message === "пригласить" || message === "🎁 пригласить" || message === "реферал") { await showReferral(userId); return; }'
);

source = source.replace(
  '  if (text.toUpperCase().startsWith("VIP-")) { await activateVipCode(userId,text); return; }',
  '  if (text.toUpperCase().startsWith("VIP-")) { await activateVipCode(userId,text); return; }\\n  if (/^VL\\d+$/i.test(text)) { if (await bindReferralCode(userId,text)) return; }'
);

source = source.replace(
  '  await recordAction(userId, "like");',
  '  await recordAction(userId, "like");\\n  tryQualifyReferral(userId).catch(function(e){ console.log("REFERRAL QUALIFY ERROR:",e.message); });'
);

source = source.replace(
  '  if (user.step === "name") { if(!text){await sendMessage(userId,"Напиши имя текстом.");return;} await updateUser(userId,{name:text,step:"age"});',
  '  if (user.step === "name") { if(!text){await sendMessage(userId,"Напиши имя текстом.");return;} if(text.length > 40 || hasForbiddenProfileContent(text)){await logModeration(userId,"profile_spam","name");await sendMessage(userId,"Имя должно быть без ссылок, телефонов и контактов, до 40 символов.");return;} await updateUser(userId,{name:text,step:"age"});'
);

source = source.replace(
  '  if (user.step === "about") { await updateUser(userId,{about:text,step:"photo"});',
  '  if (user.step === "about") { if(text.length > 500 || hasForbiddenProfileContent(text)){await logModeration(userId,"profile_spam","about");await sendMessage(userId,"В описании нельзя размещать ссылки, телефоны и контакты. Расскажи лучше немного о себе ❤️");return;} await updateUser(userId,{about:text,step:"photo"});'
);

source = source.replace(
  '  if (user.step === "edit_name") { if (!text) return true;',
  '  if (user.step === "edit_name") { if (!text) return true; if(text.length > 40 || hasForbiddenProfileContent(text)){await logModeration(userId,"profile_spam","edit_name");await sendMessage(userId,"Имя должно быть без ссылок, телефонов и контактов, до 40 символов.");return true;}'
);

source = source.replace(
  '  if (user.step === "edit_about") { await updateUser(userId,{about:text,step:"done"});',
  '  if (user.step === "edit_about") { if(text.length > 500 || hasForbiddenProfileContent(text)){await logModeration(userId,"profile_spam","edit_about");await sendMessage(userId,"В описании нельзя размещать ссылки, телефоны и контакты.");return true;} await updateUser(userId,{about:text,step:"done"});'
);
\`;

wrapperSource = wrapperSource.replace(v7Marker, v7Extra + "\\n" + v7Marker);
`;

wrapperSource = wrapperSource.replace(compileMarker, injected + "\n" + compileMarker);

const patched = new Module(wrapperPath, module.parent);
patched.filename = wrapperPath;
patched.paths = module.paths;
patched._compile(wrapperSource, wrapperPath);
