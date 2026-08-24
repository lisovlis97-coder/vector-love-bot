const fs = require("fs");
const path = require("path");
const Module = require("module");

const wrapperPath = path.join(__dirname, "app_v4_1.js");
let wrapperSource = fs.readFileSync(wrapperPath, "utf8");

const injection = `
source = source.replace(
  'function getPhotoAttachment(vkMessage) {\\n  const photoAttachment = (vkMessage.attachments || []).find(item => item.type === "photo");\\n  if (!photoAttachment) return null;\\n  const photo = photoAttachment.photo;\\n  return \\`photo\\${photo.owner_id}_\\${photo.id}\\`;\\n}',
  'function getPhotoAttachment(vkMessage) {\\n  const photoAttachment = (vkMessage.attachments || []).find(item => item.type === "photo");\\n  if (!photoAttachment) return null;\\n  const photo = photoAttachment.photo;\\n  const access = photo.access_key ? \\`_\\${photo.access_key}\\` : "";\\n  return \\`photo\\${photo.owner_id}_\\${photo.id}\\${access}\\`;\\n}'
);
`;

wrapperSource = wrapperSource.replace(
  'const patched = new Module(sourcePath, module.parent);',
  injection + '\nconst patched = new Module(sourcePath, module.parent);'
);

const patchedWrapper = new Module(wrapperPath, module.parent);
patchedWrapper.filename = wrapperPath;
patchedWrapper.paths = module.paths;
patchedWrapper._compile(wrapperSource, wrapperPath);
