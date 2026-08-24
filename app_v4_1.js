const fs = require("fs");
const path = require("path");
const Module = require("module");

const sourcePath = path.join(__dirname, "app_v4.js");
let source = fs.readFileSync(sourcePath, "utf8");

// Показываем даты и время пользователю по московскому времени (МСК, UTC+3).
source = source.replace(
  'function formatDateTimeRu(value) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU"); }',
  'function formatDateTimeRu(value) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }'
);

source = source.replace(
  '    [{ action: { type: "text", label: "👀 Смотреть" }, color: "primary" }]\n  ]});\n}\n\nasync function sendMessage',
  '    [{ action: { type: "text", label: "👀 Смотреть дальше" }, color: "primary" }]\n  ]});\n}\n\nasync function sendMessage'
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
