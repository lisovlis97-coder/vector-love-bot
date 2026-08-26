const assert = require("assert");
const path = require("path");
const Module = require("module");

const originalCompile = Module.prototype._compile;
let effectiveSource = null;

Module.prototype._compile = function captureEffectiveSource(content, filename) {
  if (path.basename(filename) === "app_v4.js") {
    effectiveSource = content;
    return undefined;
  }

  return originalCompile.call(this, content, filename);
};

try {
  require("../app_v8");
} finally {
  Module.prototype._compile = originalCompile;
}

assert(effectiveSource, "The wrapper chain did not produce the effective bot source");
assert.doesNotThrow(() => new Function(effectiveSource), "Effective bot source has invalid syntax");

const expectedFragments = [
  'label: "✓ Подтверждение"',
  'badges.push("✓ Подтверждена")',
  'verification_status: "pending"',
  'async function showVerificationStatus',
  'async function requestVerification',
  'async function reviewVerification',
  'async function showPendingVerifications',
  'message.startsWith("подтвердить ")',
  'message.startsWith("отклонить подтверждение ")',
  'verification_status:"unverified"'
];

for (const fragment of expectedFragments) {
  assert(effectiveSource.includes(fragment), `Missing v8 fragment: ${fragment}`);
}

assert.strictEqual(
  (effectiveSource.match(/async function showVerificationStatus/g) || []).length,
  1,
  "Verification helpers were injected more than once"
);

console.log("Vector Love v8 verification patch: OK");
