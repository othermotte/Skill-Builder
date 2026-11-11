const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  normaliseEmail,
  parseEmailImport,
} = require("../functions/lib/emailRoster.js");
test("email lists normalise case and preserve exact addresses including plus aliases", () => {
  assert.equal(
    normaliseEmail(" Person+class@UNC.EDU "),
    "person+class@unc.edu",
  );
  for (const value of [
    "person@unc.edu.attacker",
    "a..b@unc.edu",
    ".a@unc.edu",
    "a@-unc.edu",
    "a@unc..edu",
    "a@unc",
    "not an email",
  ]) {
    if (value === "person@unc.edu.attacker")
      assert.equal(normaliseEmail(value), value);
    else assert.throws(() => normaliseEmail(value));
  }
});
test("paste imports accept comma, semicolon and newline separators and show duplicates and invalid entries", () => {
  const result = parseEmailImport(
    "ONE@unc.edu; two@unc.edu\nOne@unc.edu,broken@;\r\nthree@unc.edu",
  );
  assert.deepEqual(result.emails, [
    "one@unc.edu",
    "two@unc.edu",
    "three@unc.edu",
  ]);
  assert.deepEqual(result.duplicates, ["one@unc.edu"]);
  assert.deepEqual(result.invalid, ["broken@"]);
});
test("CSV header selects email column and preserves quoted names with commas", () => {
  const result = parseEmailImport(
    '\uFEFF"Name","Email Address","Class"\r\n"Lloyd, Gary","GARY@unc.edu","A"\r\n"Another Person","bad-email","B"',
  );
  assert.deepEqual(result.emails, ["gary@unc.edu"]);
  assert.deepEqual(result.invalid, ["bad-email"]);
  assert.equal(result.hasHeader, true);
});
test("quoted semicolon CSV and display addresses import without executing spreadsheet formulas", () => {
  const result = parseEmailImport(
    'Name;Email\n"A; B";"someone@unc.edu"\n"=CMD()";"Gary <another@unc.edu>"',
  );
  assert.deepEqual(result.emails, ["someone@unc.edu", "another@unc.edu"]);
  assert.deepEqual(result.invalid, []);
});
test("unclosed CSV quotes and oversized files fail before any import can be applied", () => {
  assert.throws(() => parseEmailImport('"email@example.org'));
  assert.throws(() => parseEmailImport("a".repeat(1000001)));
});

test("CSV rows missing an address are reported rather than silently dropped", () => {
  const result = parseEmailImport(
    "Name,Email\nSomeone,\nAnother,valid@example.org",
  );
  assert.deepEqual(result.emails, ["valid@example.org"]);
  assert.deepEqual(result.invalid, ["Row 2: missing email address"]);
});
