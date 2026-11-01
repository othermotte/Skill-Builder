import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { transform } from "esbuild";
const project = process.argv[2];
if (project !== "leadership-skill-builder-stg")
  throw new Error("Refusing a non-staging seed target.");
const token = execFileSync("gcloud", ["auth", "print-access-token"], {
  encoding: "utf8",
}).trim();
const code = (
  await transform(
    readFileSync(new URL("../constants.ts", import.meta.url), "utf8"),
    { loader: "ts", format: "esm" },
  )
).code;
const data = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
function value(v) {
  if (v === null) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
  if (typeof v === "object") return { mapValue: { fields: fields(v) } };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return { doubleValue: v };
  return { stringValue: String(v) };
}
function fields(object) {
  return Object.fromEntries(
    Object.entries(object).map(([k, v]) => [k, value(v)]),
  );
}
const writes = [];
for (const [collection, rows] of [
  ["skills", data.INITIAL_SKILLS],
  ["scenarios", data.INITIAL_SCENARIOS],
])
  for (const row of rows)
    writes.push({
      update: {
        name: `projects/${project}/databases/(default)/documents/${collection}/${row.id}`,
        fields: fields(row),
      },
    });
for (const [id, v] of Object.entries({
  skillLibrary: data.MICRO_SKILLS_LIBRARY_V2,
  globalFacilitator: { content: data.GLOBAL_FACILITATOR_CONTRACT },
  globalAssessor: { content: data.GLOBAL_ASSESSMENT_PROTOCOL },
  microSkillTutor: { content: data.MICRO_SKILL_TUTOR_INSTRUCTION },
}))
  writes.push({
    update: {
      name: `projects/${project}/databases/(default)/documents/system_logic/${id}`,
      fields: fields(v),
    },
  });
const response = await fetch(
  `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:commit`,
  {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ writes }),
  },
);
if (!response.ok)
  throw new Error(
    `Staging seed failed: ${response.status} ${await response.text()}`,
  );
console.log(
  "Seeded bundled scenarios, skills and instructions. No production users or activity copied.",
);
