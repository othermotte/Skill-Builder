const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  activeGrant,
  selectScenario,
  freeSkills,
} = require("../functions/lib/accessDomain.js");
test("organisation grants expire at the boundary and revocation overrides never-expiring access", () => {
  const g = { expiresAt: 100, revokedAt: null };
  assert.equal(activeGrant(g, 99), true);
  assert.equal(activeGrant(g, 100), false);
  assert.equal(activeGrant({ ...g, expiresAt: null }, 1000), true);
  assert.equal(
    activeGrant({ ...g, expiresAt: null, revokedAt: 1 }, 1000),
    false,
  );
});
test("free scenario selection is permanent but idempotent", () => {
  assert.equal(selectScenario(null, "a"), "a");
  assert.equal(selectScenario("a", "a"), "a");
  assert.throws(() => selectScenario("a", "b"));
});
test("recommendations retain model order and assessment reasons, reject invented IDs and deduplicate", () => {
  const library = {
    skill_groups: [
      {
        id: "g",
        label: "Group",
        skills: [
          {
            id: "s",
            name: "Skill",
            micro_skills: Array.from({ length: 7 }, (_, i) => ({
              id: "m" + i,
              label: "Micro " + i,
            })),
          },
        ],
      },
    ],
  };
  const suggestions = [
    { microSkillId: "invented" },
    ...Array.from({ length: 7 }, (_, i) => ({
      microSkillId: "m" + i,
      reason: "Evidence " + i,
      groupLabel: "Forged label",
    })),
    { microSkillId: "m0" },
  ];
  const result = freeSkills(suggestions, library);
  assert.equal(result.length, 5);
  assert.equal(result[0].reason, "Evidence 0");
  assert.equal(result[0].groupLabel, "Group");
  assert.equal(result[4].microSkillId, "m4");
});
