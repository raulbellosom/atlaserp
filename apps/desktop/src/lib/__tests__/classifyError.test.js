import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyError } from "../classifyError.js";

describe("classifyError", () => {
  it("a render-time TypeError is NOT a network error (regression: full-screen 'SIN CONEXION' on a code bug)", () => {
    const err = new TypeError("null is not an object (evaluating 'a(e).then')");
    assert.equal(classifyError(err).type, "unknown");
  });

  it("a plain TypeError with no network-ish message → unknown", () => {
    assert.equal(classifyError(new TypeError("x is not a function")).type, "unknown");
  });

  it("still classifies a real failed fetch as network", () => {
    assert.equal(classifyError(new TypeError("Failed to fetch")).type, "network");
    assert.equal(classifyError(new TypeError("Load failed")).type, "network"); // Safari
    assert.equal(classifyError({ message: "NetworkError when attempting to fetch resource." }).type, "network");
  });

  it("maps HTTP status codes", () => {
    assert.equal(classifyError({ message: "boom", status: 500 }).type, "server_error");
    assert.equal(classifyError({ message: "boom", status: 503 }).type, "unavailable");
    assert.equal(classifyError({ message: "Atlas API error 401" }).type, "unauthorized");
  });

  it("null / undefined → unknown", () => {
    assert.equal(classifyError(null).type, "unknown");
    assert.equal(classifyError(undefined).type, "unknown");
  });
});
