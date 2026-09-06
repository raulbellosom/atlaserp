import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  resolveAppBaseUrl,
  renderAtlasEmailLayout,
  buildCallInviteEmail,
} from "../email-templates.js";

describe("escapeHtml", () => {
  it("escapes the dangerous five", () => {
    assert.equal(escapeHtml(`<b>"a"&'x'`), "&lt;b&gt;&quot;a&quot;&amp;&#39;x&#39;");
  });
});

describe("resolveAppBaseUrl", () => {
  it("honours PUBLIC_APP_URL first, then APP_URL / ATLAS_APP_URL / WEB_APP_URL", () => {
    assert.equal(resolveAppBaseUrl({ PUBLIC_APP_URL: "https://a.test/" }), "https://a.test");
    assert.equal(resolveAppBaseUrl({ ATLAS_APP_URL: "https://b.test" }), "https://b.test");
    assert.equal(resolveAppBaseUrl({ WEB_APP_URL: "https://c.test/app" }), "https://c.test");
  });
  it("rejects non-http junk and falls back only outside production", () => {
    assert.equal(resolveAppBaseUrl({ PUBLIC_APP_URL: "not a url", NODE_ENV: "production" }), null);
    assert.equal(resolveAppBaseUrl({ NODE_ENV: "development" }), "http://localhost:5173");
  });
});

describe("renderAtlasEmailLayout", () => {
  it("escapes the heading and renders the CTA with the raw url", () => {
    const html = renderAtlasEmailLayout({
      heading: "Hola <script>",
      cta: { label: "Ir", url: "https://x.test/p/call/abc?i=1" },
      env: {},
    });
    assert.match(html, /Hola &lt;script&gt;/);
    assert.match(html, /href="https:\/\/x\.test\/p\/call\/abc\?i=1"/);
    assert.doesNotMatch(html, /<script>/);
  });
  it("omits the logo img when no api base url resolves", () => {
    const html = renderAtlasEmailLayout({ heading: "x", env: { NODE_ENV: "production" } });
    assert.doesNotMatch(html, /atlas-logo-horizontal/);
  });
});

describe("buildCallInviteEmail", () => {
  it("puts the join url in both html and text, and names the inviter", () => {
    const out = buildCallInviteEmail({
      joinUrl: "https://x.test/p/call/tok?i=inv",
      inviterName: "Raul",
      conversationTitle: "#general",
      env: {},
    });
    assert.equal(out.subject, "Te invitaron a una llamada");
    assert.match(out.text, /Raul te invitó/);
    assert.match(out.text, /https:\/\/x\.test\/p\/call\/tok\?i=inv/);
    assert.match(out.html, /Raul te invitó/);
    assert.match(out.html, /href="https:\/\/x\.test\/p\/call\/tok\?i=inv"/);
    assert.match(out.html, /#general/);
  });
  it("falls back to generic wording without an inviter", () => {
    const out = buildCallInviteEmail({ joinUrl: "https://x.test/p/call/tok", env: {} });
    assert.match(out.text, /Te invitaron a una videollamada\./);
  });
  it("escapes a malicious inviter name in the html", () => {
    const out = buildCallInviteEmail({
      joinUrl: "https://x.test/p/call/tok",
      inviterName: '<img src=x onerror=alert(1)>',
      env: {},
    });
    assert.doesNotMatch(out.html, /<img src=x/);
    assert.match(out.html, /&lt;img src=x/);
  });
});
