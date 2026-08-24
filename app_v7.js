const fs = require("fs");
const path = require("path");
const Module = require("module");

const wrapperPath = path.join(__dirname, "app_v6.js");
let wrapperSource = fs.readFileSync(wrapperPath, "utf8");

const compileMarker = 'const patched = new Module(wrapperPath, module.parent);';
const patchLoader = `
wrapperSource = wrapperSource.replace(
  marker,
  'source = require("./v7_patch")(source);\\n' + marker
);
`;

wrapperSource = wrapperSource.replace(compileMarker, patchLoader + "\n" + compileMarker);

const patched = new Module(wrapperPath, module.parent);
patched.filename = wrapperPath;
patched.paths = module.paths;
patched._compile(wrapperSource, wrapperPath);
