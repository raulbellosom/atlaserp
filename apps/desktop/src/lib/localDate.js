// Local (browser-zone) calendar helpers. `toISOString()` is UTC and must never
// be used to derive a local date/month — see @runly/core/time.
export { toLocalIso, toLocalMonth, nowLocalParts } from "@runly/core";
