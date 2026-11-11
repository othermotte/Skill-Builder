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
    assert.match(copy.freeCopy.join(" "), /three/);
    assert.match(JSON.stringify(copy), /assessment|feedback/);
  }
});

test("50/50 boundary and explicit QA alias do not change the supplied saved assignment",()=>{assert.equal(chooseHomepageVariant("?variant=a","b",0.9),"a");for(let i=0;i<1000;i++)assert.equal(chooseHomepageVariant("",null,i/1000),i<500?"a":"b");});
