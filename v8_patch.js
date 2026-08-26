function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) {
    throw new Error(`Vector Love v8 patch failed: ${label}`);
  }

  return source.replace(needle, replacement);
}

module.exports = function applyV8(source) {
  source = replaceRequired(
    source,
    '[{ action: { type: "text", label: "📋 Чёрный список" }, color: "secondary" }, { action: { type: "text", label: "💘 Мои матчи" }, color: "positive" }, { action: { type: "text", label: "🎁 Пригласить" }, color: "positive" }, { action: { type: "text", label: "🆘 Поддержка" }, color: "secondary" }]',
    '[{ action: { type: "text", label: "📋 Чёрный список" }, color: "secondary" }, { action: { type: "text", label: "💘 Мои матчи" }, color: "positive" }, { action: { type: "text", label: "🎁 Пригласить" }, color: "positive" }, { action: { type: "text", label: "🆘 Поддержка" }, color: "secondary" }],\n    [{ action: { type: "text", label: "✓ Подтверждение" }, color: "positive" }]','verification keyboard button'
  );

  source = replaceRequired(
    source,
    '  const badges = [];\n  if (isBoostActive(user)) badges.push("🔥 Буст");',
    '  const badges = [];\n  if (user?.is_verified) badges.push("✓ Подтверждена");\n  if (isBoostActive(user)) badges.push("🔥 Буст");',
    'verified profile badge'
  );

  const helpers = String.raw`
function verificationRequestKeyboard() {
  return JSON.stringify({ one_time: false, buttons: [
    [{ action: { type: "text", label: "📨 Отправить заявку" }, color: "positive" }],
    [{ action: { type: "text", label: "👀 Смотреть" }, color: "primary" }]
  ] });
}

async function showVerificationStatus(userId) {
  const user = await getUser(userId);
  if (!user || user.step !== "done") {
    await sendMessage(userId, "Сначала закончи анкету — после этого её можно будет отправить на подтверждение.", mainKeyboard());
    return;
  }

  const status = user.verification_status || "unverified";
  if (user.is_verified || status === "verified") {
    const date = user.verified_at ? " с " + formatDateRu(user.verified_at) : "";
    await sendMessage(userId, "✓ Анкета подтверждена" + date + ".\n\nЗначок уже показывается другим пользователям рядом с твоей анкетой.", mainKeyboard());
    return;
  }

  if (status === "pending") {
    await sendMessage(userId, "⏳ Заявка на подтверждение уже отправлена.\n\nМодератор посмотрит анкету и сообщит результат здесь.", mainKeyboard());
    return;
  }

  const rejected = status === "rejected"
    ? "Предыдущую заявку отклонили. Проверь фото и данные — после этого можно отправить её повторно.\n\n"
    : "";

  await sendMessage(
    userId,
    "✓ Подтверждение анкеты\n\n" + rejected +
      "Модератор проверит фото и заполнение анкеты. После одобрения появится значок «✓ Подтверждена».\n\n" +
      "Документы сейчас не требуются. Значок не является гарантией личности — он означает только ручную проверку анкеты.",
    verificationRequestKeyboard()
  );
}

async function requestVerification(userId) {
  const user = await getUser(userId);
  if (!user || user.step !== "done" || !hasPhoto(user)) {
    await sendMessage(userId, "Чтобы отправить заявку, сначала полностью заполни анкету и добавь фото.", mainKeyboard());
    return;
  }

  const status = user.verification_status || "unverified";
  if (user.is_verified || status === "verified") {
    await showVerificationStatus(userId);
    return;
  }
  if (status === "pending") {
    await sendMessage(userId, "⏳ Заявка уже находится на проверке.", mainKeyboard());
    return;
  }

  const requestedAt = new Date().toISOString();
  const error = await updateUser(userId, {
    is_verified: false,
    verification_status: "pending",
    verification_requested_at: requestedAt,
    verified_at: null,
    verified_by: null
  });

  if (error) {
    await sendMessage(userId, "Не получилось отправить заявку. Попробуй ещё раз чуть позже.", mainKeyboard());
    return;
  }

  await sendMessage(userId, "📨 Заявка отправлена!\n\nПосле проверки я напишу результат здесь.", mainKeyboard());

  for (const adminId of ADMIN_IDS) {
    const text = "🆕 Заявка на подтверждение\n\n" +
      "ID: " + user.id + "\n" +
      (user.name || "Без имени") + ", " + (user.age || "?") + "\n" +
      (user.city || "Город не указан") + "\n\n" +
      (user.about || "О себе не указано") + "\n\n" +
      "Подтвердить: подтвердить " + user.id + "\n" +
      "Отклонить: отклонить подтверждение " + user.id;
    await sendMessage(adminId, text, null, user.photo || null);
  }
}

async function reviewVerification(adminId, targetId, approve) {
  if (!isAdmin(adminId)) {
    await sendMessage(adminId, "Нет доступа.");
    return;
  }

  const user = await getUser(targetId);
  if (!user) {
    await sendMessage(adminId, "Пользователь не найден.");
    return;
  }
  if (approve && (user.step !== "done" || !hasPhoto(user))) {
    await sendMessage(adminId, "Нельзя подтвердить незаполненную анкету или анкету без фото.");
    return;
  }

  const fields = approve
    ? {
        is_verified: true,
        verification_status: "verified",
        verified_at: new Date().toISOString(),
        verified_by: adminId
      }
    : {
        is_verified: false,
        verification_status: "rejected",
        verified_at: null,
        verified_by: null
      };

  const error = await updateUser(targetId, fields);
  if (error) {
    await sendMessage(adminId, "Не получилось изменить статус подтверждения.");
    return;
  }

  if (approve) {
    await sendMessage(adminId, "✓ Анкета " + targetId + " подтверждена.");
    await sendMessage(targetId, "✓ Твоя анкета подтверждена!\n\nТеперь рядом с ней показывается специальный значок.", mainKeyboard());
  } else {
    await sendMessage(adminId, "Заявка пользователя " + targetId + " отклонена.");
    await sendMessage(targetId, "Заявку на подтверждение пока не одобрили.\n\nПроверь фото и данные анкеты, затем отправь заявку повторно.", mainKeyboard());
  }
}

async function showPendingVerifications(adminId) {
  if (!isAdmin(adminId)) {
    await sendMessage(adminId, "Нет доступа.");
    return;
  }

  const { data: users, error } = await supabase
    .from("users")
    .select("id,name,age,city,about,photo,verification_requested_at")
    .eq("verification_status", "pending")
    .order("verification_requested_at", { ascending: true })
    .limit(20);

  if (error) {
    console.log("VERIFICATION LIST ERROR:", error);
    await sendMessage(adminId, "Не получилось загрузить заявки.");
    return;
  }
  if (!users || users.length === 0) {
    await sendMessage(adminId, "✓ Новых заявок на подтверждение нет.");
    return;
  }

  await sendMessage(adminId, "📨 Заявок на подтверждение: " + users.length);
  for (const user of users) {
    const text = "ID: " + user.id + "\n" +
      (user.name || "Без имени") + ", " + (user.age || "?") + "\n" +
      (user.city || "Город не указан") + "\n\n" +
      (user.about || "О себе не указано") + "\n\n" +
      "Подтвердить: подтвердить " + user.id + "\n" +
      "Отклонить: отклонить подтверждение " + user.id;
    await sendMessage(adminId, text, null, user.photo || null);
  }
}
`;

  source = replaceRequired(
    source,
    'async function processMessage(vkMessage) {',
    helpers + '\nasync function processMessage(vkMessage) {',
    'verification helpers'
  );

  source = replaceRequired(
    source,
    '  if (message === "админ" || message === "статистика") { await showAdminPanel(userId); return; }',
    '  if (message === "админ" || message === "статистика") { await showAdminPanel(userId); return; }\n' +
      '  if (message === "подтверждения" || message === "заявки на подтверждение") { await showPendingVerifications(userId); return; }\n' +
      '  if (message.startsWith("подтвердить ")) { const id=Number(message.replace("подтвердить ","").trim()); if(id) await reviewVerification(userId,id,true); else await sendMessage(userId,"Формат: подтвердить ID"); return; }\n' +
      '  if (message.startsWith("отклонить подтверждение ")) { const id=Number(message.replace("отклонить подтверждение ","").trim()); if(id) await reviewVerification(userId,id,false); else await sendMessage(userId,"Формат: отклонить подтверждение ID"); return; }',
    'verification admin commands'
  );

  source = replaceRequired(
    source,
    '  if (message === "пригласить" || message === "🎁 пригласить" || message === "реферал") { await showReferral(userId); return; }',
    '  if (message === "пригласить" || message === "🎁 пригласить" || message === "реферал") { await showReferral(userId); return; }\n' +
      '  if (message === "подтверждение" || message === "✓ подтверждение" || message === "✅ подтверждение") { await showVerificationStatus(userId); return; }\n' +
      '  if (message === "отправить заявку" || message === "📨 отправить заявку") { await requestVerification(userId); return; }',
    'verification user commands'
  );

  source = replaceRequired(
    source,
    'код VIP-XXX";\n  await sendMessage(userId,text);',
    'код VIP-XXX\\nподтверждения\\nподтвердить ID\\nотклонить подтверждение ID";\n  await sendMessage(userId,text);',
    'verification commands in admin panel'
  );

  source = replaceRequired(
    source,
    'VIP: ${isVipActive(user)?"Да":"Нет"}\\nБуст:',
    'Подтверждена: ${user.is_verified?"Да":"Нет"}\\nVIP: ${isVipActive(user)?"Да":"Нет"}\\nБуст:',
    'verification status in admin search'
  );

  const resetVerification = 'is_verified:false,verification_status:"unverified",verification_requested_at:null,verified_at:null,verified_by:null';
  source = replaceRequired(
    source,
    'await updateUser(userId, { name: text, step: "done" });',
    'await updateUser(userId, { name: text, step: "done", ' + resetVerification + ' });',
    'reset verification after name edit'
  );
  source = replaceRequired(
    source,
    'await updateUser(userId,{age,step:"done"});',
    'await updateUser(userId,{age,step:"done",' + resetVerification + '});',
    'reset verification after age edit'
  );
  source = replaceRequired(
    source,
    'await updateUser(userId,{photo,step:"done"});',
    'await updateUser(userId,{photo,step:"done",' + resetVerification + '});',
    'reset verification after photo edit'
  );

  return source;
};
