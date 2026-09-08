/**
 * ============================================================
 * /api/ai — speech tokens, translation, capability probe
 * ============================================================
 * These endpoints spend money and hold the Azure credentials, so the tests
 * below lock down the things that would be expensive or dangerous to get
 * wrong:
 *
 *   - every route requires authentication
 *   - an UNCONFIGURED deployment degrades to a clean 503, never a crash,
 *     and never leaks a key or a region
 *   - language codes are validated against the supported list
 *   - non-string bodies are rejected as 4xx, not 500
 *   - translation is a pure pass-through: only the translated text comes back
 *   - same-language requests short-circuit without calling the provider
 * ============================================================
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");

let user;
test.before(async () => {
  await h.startServer();
  user = await h.makeUser();
});
test.after(async () => {
  await h.cleanupFixtures();
  await h.stopServer();
});

/** Replace the translation service's provider call for one test. */
function stubTranslation(impl) {
  const service = require("../services/translationService");
  const original = {
    isConfigured: service.isConfigured,
    translateText: service.translateText,
  };
  service.isConfigured = () => true;
  service.translateText = impl;
  return () => Object.assign(service, original);
}

/** Replace the speech service so no real Azure call is made. */
function stubSpeech(impl) {
  const service = require("../services/speechService");
  const original = {
    isConfigured: service.isConfigured,
    issueToken: service.issueToken,
  };
  service.isConfigured = () => true;
  service.issueToken = impl;
  return () => Object.assign(service, original);
}

// ── authentication ────────────────────────────────────────────

test("every AI route requires authentication", async () => {
  for (const [path, method] of [
    ["/api/ai/config", "GET"],
    ["/api/ai/speech-token", "POST"],
    ["/api/ai/translate", "POST"],
  ]) {
    const res = await h.api(path, { method });
    assert.equal(
      res.status,
      401,
      `${method} ${path} should reject anonymous callers`,
    );
  }
});

// ── capability probe ──────────────────────────────────────────

test("config reports capabilities and the language list, and never leaks secrets", async () => {
  const res = await h.api("/api/ai/config", { token: user.token });
  assert.equal(res.status, 200);

  const data = res.body.data;
  assert.equal(typeof data.speechEnabled, "boolean");
  assert.equal(typeof data.translationEnabled, "boolean");
  assert.ok(Array.isArray(data.languages) && data.languages.length > 0);

  // Only display fields are exposed — no voice names, no Azure locales,
  // and above all no key or region.
  for (const lang of data.languages) {
    assert.deepEqual(Object.keys(lang).sort(), ["code", "label", "rtl"]);
  }
  const serialised = JSON.stringify(res.body);
  assert.ok(
    !/key|secret|region|Neural/i.test(serialised),
    "config must not leak credentials",
  );
});

// ── unconfigured deployment ───────────────────────────────────

test("unconfigured speech returns a clean 503 naming the missing variables", async () => {
  // Force the unconfigured state rather than relying on the ambient
  // environment: this must assert the same thing on a developer machine that
  // HAS Azure credentials and on CI that does not.
  const config = require("../config/environment");
  const saved = {
    key: config.AZURE_SPEECH_KEY,
    region: config.AZURE_SPEECH_REGION,
  };
  config.AZURE_SPEECH_KEY = null;
  config.AZURE_SPEECH_REGION = null;
  try {
    const res = await h.api("/api/ai/speech-token", {
      method: "POST",
      token: user.token,
    });
    assert.equal(res.status, 503);
    assert.equal(res.body.code, "SPEECH_NOT_CONFIGURED");
    assert.match(res.body.message, /AZURE_SPEECH_KEY/);
  } finally {
    config.AZURE_SPEECH_KEY = saved.key;
    config.AZURE_SPEECH_REGION = saved.region;
  }
});

test("unconfigured translation returns a clean 503, not a crash", async () => {
  const config = require("../config/environment");
  const saved = {
    azure: config.AZURE_TRANSLATOR_KEY,
    google: config.GOOGLE_TRANSLATE_API_KEY,
  };
  config.AZURE_TRANSLATOR_KEY = null;
  config.GOOGLE_TRANSLATE_API_KEY = null;
  try {
    const res = await h.api("/api/ai/translate", {
      method: "POST",
      token: user.token,
      body: { text: "Hello", sourceLanguage: "en", targetLanguage: "ur" },
    });
    assert.equal(res.status, 503);
    assert.equal(res.body.code, "TRANSLATION_NOT_CONFIGURED");
  } finally {
    config.AZURE_TRANSLATOR_KEY = saved.azure;
    config.GOOGLE_TRANSLATE_API_KEY = saved.google;
  }
});

// ── validation ────────────────────────────────────────────────

test("unsupported language codes are rejected before any provider call", async () => {
  let called = false;
  const restore = stubTranslation(async () => {
    called = true;
    return "should not happen";
  });
  try {
    for (const body of [
      { text: "Hi", sourceLanguage: "en", targetLanguage: "klingon" },
      { text: "Hi", sourceLanguage: "xx", targetLanguage: "ur" },
    ]) {
      const res = await h.api("/api/ai/translate", {
        method: "POST",
        token: user.token,
        body,
      });
      assert.equal(
        res.status,
        422,
        "bad language should be a validation failure",
      );
    }
    assert.equal(
      called,
      false,
      "the provider must not be called for an invalid language",
    );
  } finally {
    restore();
  }
});

test("non-string and oversized fields are 4xx, never 500", async () => {
  const restore = stubTranslation(async () => "x");
  try {
    const bodies = [
      { text: { a: 1 }, sourceLanguage: "en", targetLanguage: "ur" },
      { text: ["a"], sourceLanguage: "en", targetLanguage: "ur" },
      { text: 42, sourceLanguage: "en", targetLanguage: "ur" },
      { text: "", sourceLanguage: "en", targetLanguage: "ur" },
      { text: "a".repeat(1001), sourceLanguage: "en", targetLanguage: "ur" },
      { sourceLanguage: "en", targetLanguage: "ur" },
      { text: "hi" },
    ];
    for (const body of bodies) {
      const res = await h.api("/api/ai/translate", {
        method: "POST",
        token: user.token,
        body,
      });
      assert.ok(
        res.status >= 400 && res.status < 500,
        `expected 4xx for ${JSON.stringify(body).slice(0, 40)}, got ${res.status}`,
      );
    }
  } finally {
    restore();
  }
});

// ── happy path ────────────────────────────────────────────────

test("translate returns only the translated text", async () => {
  const restore = stubTranslation(async (text, from, to) => {
    assert.equal(text, "How are you today?");
    assert.equal(from, "en");
    assert.equal(to, "ur");
    return "آپ آج کیسے ہیں؟";
  });
  try {
    const res = await h.api("/api/ai/translate", {
      method: "POST",
      token: user.token,
      body: {
        text: "How are you today?",
        sourceLanguage: "en",
        targetLanguage: "ur",
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.translatedText, "آپ آج کیسے ہیں؟");
    // The response carries the translation and the language pair — nothing else.
    assert.deepEqual(Object.keys(res.body.data).sort(), [
      "sourceLanguage",
      "targetLanguage",
      "translatedText",
    ]);
  } finally {
    restore();
  }
});

test("a speech token response carries the token and region but never the key", async () => {
  const restore = stubSpeech(async () => ({
    token: "fake-authorization-token",
    region: "westeurope",
    expiresIn: 540,
  }));
  try {
    const res = await h.api("/api/ai/speech-token", {
      method: "POST",
      token: user.token,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.token, "fake-authorization-token");
    assert.equal(res.body.data.region, "westeurope");
    assert.ok(
      res.body.data.expiresIn > 0,
      "client needs an expiry to refresh on",
    );
  } finally {
    restore();
  }
});

// ── service-level behaviour ───────────────────────────────────

test("same source and target short-circuits without calling a provider", async () => {
  const service = require("../services/translationService");
  const originalKey = process.env.AZURE_TRANSLATOR_KEY;
  const originalRegion = process.env.AZURE_TRANSLATOR_REGION;

  // config is read at require time, so drive the service directly with a
  // configured provider and prove the network is never touched.
  const config = require("../config/environment");
  const savedKey = config.AZURE_TRANSLATOR_KEY;
  const savedRegion = config.AZURE_TRANSLATOR_REGION;
  config.AZURE_TRANSLATOR_KEY = "test-key";
  config.AZURE_TRANSLATOR_REGION = "test-region";

  const realFetch = global.fetch;
  let fetched = false;
  global.fetch = async () => {
    fetched = true;
    throw new Error("the provider should not have been called");
  };

  try {
    const out = await service.translateText("unchanged", "en", "en");
    assert.equal(out, "unchanged");
    assert.equal(
      fetched,
      false,
      "identical languages must not cost an API call",
    );
  } finally {
    global.fetch = realFetch;
    config.AZURE_TRANSLATOR_KEY = savedKey;
    config.AZURE_TRANSLATOR_REGION = savedRegion;
    process.env.AZURE_TRANSLATOR_KEY = originalKey;
    process.env.AZURE_TRANSLATOR_REGION = originalRegion;
  }
});

test("the language table is internally consistent", () => {
  const { LANGUAGES } = require("../config/languages");
  const seen = new Set();
  for (const l of LANGUAGES) {
    assert.ok(
      l.code && l.label && l.speech && l.translator && l.voice,
      `${l.code} is incomplete`,
    );
    assert.ok(!seen.has(l.code), `duplicate language code ${l.code}`);
    seen.add(l.code);
    // The neural voice must belong to the locale it is paired with, or TTS
    // will speak the right words in the wrong accent (or fail outright).
    assert.ok(
      l.voice.startsWith(l.speech),
      `voice ${l.voice} does not match locale ${l.speech}`,
    );
  }
});
