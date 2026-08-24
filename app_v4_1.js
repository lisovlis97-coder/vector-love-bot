const fs = require("fs");
const path = require("path");
const Module = require("module");

const sourcePath = path.join(__dirname, "app_v4.js");
let source = fs.readFileSync(sourcePath, "utf8");

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
