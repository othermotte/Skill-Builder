import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chooseHomepageVariant,
  homepageCopy,
} from "../utils/homepageExperiment.ts";
test("homepage previews override the session assignment while returning visitors keep their variant", () => {
  assert.equal(chooseHomepageVariant("?homepage=b", "a", 0), "b");
  assert.equal(chooseHomepageVariant("", "b", 0), "b");
  assert.equal(chooseHomepageVariant("?homepage=unknown", null, 0), "a");
  assert.equal(chooseHomepageVariant("", null, 0.9), "b");
});
test("both variants describe the same free allocation and the assessment proposition", () => {
  for (const copy of Object.values(homepageCopy)) {
    assert.match(copy.detail, /five/);
    assert.match(copy.detail, /assessment|Assess/);
  }
});
