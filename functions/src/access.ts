import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHash, randomBytes } from "crypto";
import {
  activeGrant,
  emailAllowed,
  normaliseDomains,
  selectScenario,
} from "./accessDomain";
const options = {
  region: "europe-west1" as const,
  maxInstances: 3,
  serviceAccount:
    "skill-builder-staging-runtime@leadership-skill-builder-stg.iam.gserviceaccount.com",
};
export const freemiumEnabled = () => process.env.FREEMIUM_ENABLED === "true";
export function stagingGuard() {
  if (
    freemiumEnabled() &&
    process.env.GCLOUD_PROJECT !== "leadership-skill-builder-stg" &&
    process.env.FUNCTIONS_EMULATOR !== "true"
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Freemium is currently restricted to staging.",
    );
  }
}
function user(request: any) {
  stagingGuard();
  if (!request.auth) throw new HttpsError("unauthenticated", "Please sign in.");
  if (request.auth.token.email_verified !== true)
    throw new HttpsError(
      "permission-denied",
      "Please verify your email first.",
    );
  return request.auth.uid as string;
}
function isAdmin(request: any) {
  return (
    request.auth?.token.email_verified === true &&
    request.auth?.token.email?.toLowerCase() ===
      "gary@gardenersnotmechanics.com"
  );
}
function admin(request: any) {
  user(request);
  if (!isAdmin(request))
    throw new HttpsError(
      "permission-denied",
      "Administrator access is required.",
    );
}
const accountRef = (uid: string) =>
  getFirestore().collection("accessAccounts").doc(uid);
export async function readAccess(request: any) {
  const uid = user(request);
  const snap = await accountRef(uid).get();
  const account = snap.data() || {};
  const orgIds: string[] = Array.isArray(account.organisationIds)
    ? account.organisationIds.slice(0, 20)
    : [];
  const grants = orgIds.length
    ? await getFirestore().getAll(
        ...orgIds.map((id) =>
          getFirestore().collection("organisations").doc(id),
        ),
      )
    : [];
  const organisations = grants
    .filter((d) => d.exists && activeGrant(d.data() as any))
    .map((d) => ({
      id: d.id,
      name: d.data()!.name,
      expiresAt: d.data()!.expiresAt,
    }));
  const fullAccess = isAdmin(request) || organisations.length > 0;
  return {
    fullAccess,
    source: isAdmin(request)
      ? "admin"
      : organisations.length
        ? "organisation"
        : "free",
    organisations,
    freeScenarioId: account.freeScenarioId || null,
    freeMicroSkills: account.freeMicroSkills || [],
    freeMicroSkillLimit: 5,
  };
}
export const getAccessAccount = onCall(options, readAccess);
export const chooseFreeScenario = onCall(options, async (request) => {
  const uid = user(request);
  const scenarioId = String(request.data?.scenarioId || "");
  if (
    !/^[a-zA-Z0-9_-]{1,160}$/.test(scenarioId) ||
    !(await getFirestore().collection("scenarios").doc(scenarioId).get()).exists
  )
    throw new HttpsError("invalid-argument", "Choose an available scenario.");
  await getFirestore().runTransaction(async (tx) => {
    const ref = accountRef(uid),
      snap = await tx.get(ref);
    try {
      selectScenario(snap.data()?.freeScenarioId || null, scenarioId);
    } catch (e: any) {
      throw new HttpsError("failed-precondition", e.message);
    }
    tx.set(
      ref,
      { freeScenarioId: scenarioId, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  });
  return readAccess(request);
});
export async function checkPracticeAccess(
  request: any,
  context = request.data,
) {
  if (!freemiumEnabled()) return null;
  const access = await readAccess(request);
  const scenarioId = String(context?.scenarioId || context?.scenario?.id || "");
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(scenarioId))
    throw new HttpsError("invalid-argument", "The scenario is missing.");
  const scenario = await getFirestore()
    .collection("scenarios")
    .doc(scenarioId)
    .get();
  if (!scenario.exists)
    throw new HttpsError("not-found", "This scenario is no longer available.");
  if (!access.fullAccess && access.freeScenarioId !== scenarioId)
    throw new HttpsError(
      "permission-denied",
      "Choose your free scenario, or redeem organisation access.",
    );
  const microSkillId = String(context?.microSkillId || "");
  if (
    (context?.mode === "tutorial" || context?.requiresMicroSkill) &&
    !microSkillId
  )
    throw new HttpsError("invalid-argument", "The micro skill is missing.");
  const lib = await getFirestore()
    .collection("system_logic")
    .doc("skillLibrary")
    .get();
  const micro = (lib.data()?.skill_groups || [])
    .flatMap((g: any) => g.skills.flatMap((s: any) => s.micro_skills))
    .find((m: any) => m.id === microSkillId);
  if (
    microSkillId &&
    (!micro ||
      (!access.fullAccess &&
        !access.freeMicroSkills.some(
          (m: any) => m.microSkillId === microSkillId,
        )))
  )
    throw new HttpsError(
      "permission-denied",
      "This micro skill is outside your free allocation.",
    );
  return {
    access,
    scenario: { ...scenario.data(), id: scenario.id } as any,
    micro,
    library: lib.data(),
  };
}
export async function trustedPracticeInstruction(
  request: any,
  medium: "voice" | "text",
) {
  const context = await checkPracticeAccess(request);
  if (!context) return String(request.data?.systemInstruction || "");
  const { scenario, micro } = context;
  const db = getFirestore();
  const tutorial = request.data?.mode === "tutorial";
  const logic = await db
    .collection("system_logic")
    .doc(tutorial ? "microSkillTutor" : "globalFacilitator")
    .get();
  const instruction = tutorial
    ? `${String(logic.data()?.content || "").replace("[micro-skill label]", micro.label)}\nMicro skill: ${micro.label}\nSuccess cue: ${micro.cue || ""}\nCommon trap: ${micro.trap || ""}\nCriteria: ${(micro.criteria || []).join(", ")}\nPractise this skill in the context of ${scenario.title}: ${scenario.description}`
    : `${logic.data()?.content || ""}\nFacilitate exactly this leadership diagnostic scenario. Do not invent a different case.\nTitle: ${scenario.title}\nDescription: ${scenario.description}\nProbing guidance: ${scenario.instruction || ""}\nRubric: ${scenario.rubric || ""}\nProbe the participant's reasoning, judgement, assumptions, stakeholders and trade-offs. Ask one neutral question at a time.`;
  return (
    instruction +
    (medium === "text"
      ? "\nThis is a silent text conversation. Use concise natural text and one question or practice challenge per turn."
      : "\nThis is a voice conversation. Ask one question or practice challenge per turn.") +
    (tutorial
      ? "\nWelcome the learner briefly and begin one short practice challenge. When complete end with: You are ready to apply this in the field."
      : "\nYour first response must be exactly: How would you tackle this scenario?")
  );
}
export async function saveFreeRecommendations(
  request: any,
  suggestions: any[],
) {
  const uid = user(request);
  return getFirestore().runTransaction(async (tx) => {
    const ref = accountRef(uid);
    const snap = await tx.get(ref);
    const saved = snap.data()?.freeMicroSkills;
    if (saved?.length) return saved;
    if (suggestions.length !== 5)
      throw new HttpsError(
        "internal",
        "Five distinct recommendations could not be generated. Please try again.",
      );
    tx.set(
      ref,
      { freeMicroSkills: suggestions, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return suggestions;
  });
}
function codeHash(code: string) {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}
function expiry(value: unknown) {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= Date.now()
  )
    throw new HttpsError(
      "invalid-argument",
      "Choose a future expiry date or no expiry.",
    );
  return value;
}
export const listOrganisations = onCall(options, async (request) => {
  admin(request);
  const snap = await getFirestore()
    .collection("organisations")
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();
  return snap.docs.map((d) => {
    const { codeHash: _codeHash, ...data } = d.data();
    return { ...data, id: d.id };
  });
});
export const saveOrganisation = onCall(options, async (request) => {
  admin(request);
  const data = request.data || {},
    db = getFirestore();
  const id = data.id
    ? String(data.id)
    : db.collection("organisations").doc().id;
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id))
    throw new HttpsError("invalid-argument", "Invalid organisation.");
  const ref = db.collection("organisations").doc(id);
  if (data.action === "revoke") {
    await ref.update({ revokedAt: Date.now() });
    return { id };
  }
  if (data.action === "rotate") {
    const code = randomBytes(12).toString("hex").toUpperCase();
    const hash = codeHash(code);
    await db.runTransaction(async (tx) => {
      const old = await tx.get(ref);
      if (!old.exists)
        throw new HttpsError("not-found", "Organisation not found.");
      if (old.data()?.codeHash)
        tx.delete(db.collection("organisationCodes").doc(old.data()!.codeHash));
      tx.update(ref, { codeHash: hash });
      tx.set(db.collection("organisationCodes").doc(hash), {
        organisationId: id,
      });
    });
    return { id, code };
  }
  const name = String(data.name || "").trim();
  if (!name || name.length > 100)
    throw new HttpsError(
      "invalid-argument",
      "Provide an organisation name of up to 100 characters.",
    );
  let domains: string[];
  try {
    domains = normaliseDomains(data.domains || []);
  } catch (e: any) {
    throw new HttpsError("invalid-argument", e.message);
  }
  const memberLimit =
    data.memberLimit === null ? null : Number(data.memberLimit);
  if (
    memberLimit !== null &&
    (!Number.isSafeInteger(memberLimit) ||
      memberLimit < 1 ||
      memberLimit > 100000)
  )
    throw new HttpsError(
      "invalid-argument",
      "Set a member limit between 1 and 100,000 or leave it unlimited.",
    );
  const expiresAt = expiry(data.expiresAt);
  const code = data.id ? null : randomBytes(12).toString("hex").toUpperCase();
  await db.runTransaction(async (tx) => {
    const old = await tx.get(ref);
    if (data.id && !old.exists)
      throw new HttpsError("not-found", "Organisation not found.");
    tx.set(
      ref,
      {
        name,
        domains,
        memberLimit,
        expiresAt,
        revokedAt: null,
        updatedAt: FieldValue.serverTimestamp(),
        ...(old.exists
          ? {}
          : {
              memberCount: 0,
              createdAt: FieldValue.serverTimestamp(),
              createdBy: request.auth!.uid,
              codeHash: codeHash(code!),
            }),
      },
      { merge: true },
    );
    if (code)
      tx.set(db.collection("organisationCodes").doc(codeHash(code)), {
        organisationId: id,
      });
  });
  return { id, ...(code ? { code } : {}) };
});
export const redeemOrganisationCode = onCall(options, async (request) => {
  const uid = user(request);
  const code = String(request.data?.code || "")
    .trim()
    .toUpperCase();
  if (!/^[A-F0-9]{24}$/.test(code))
    throw new HttpsError(
      "invalid-argument",
      "Enter a valid organisation code.",
    );
  const db = getFirestore();
  await db.runTransaction(async (tx) => {
    const codeSnap = await tx.get(
      db.collection("organisationCodes").doc(codeHash(code)),
    );
    if (!codeSnap.exists)
      throw new HttpsError("not-found", "This code is no longer available.");
    const ref = db
      .collection("organisations")
      .doc(codeSnap.data()!.organisationId);
    const org = await tx.get(ref);
    const membership = db
      .collection("organisationMemberships")
      .doc(`${ref.id}_${uid}`);
    const member = await tx.get(membership);
    const account = await tx.get(accountRef(uid));
    const grant = org.data() as any;
    if (!org.exists || !activeGrant(grant) || grant.codeHash !== codeHash(code))
      throw new HttpsError(
        "failed-precondition",
        "This organisation grant has expired or been revoked.",
      );
    if (!emailAllowed(String(request.auth!.token.email || ""), grant.domains))
      throw new HttpsError(
        "permission-denied",
        "Your verified email does not match this organisation.",
      );
    if (member.exists) return;
    if ((account.data()?.organisationIds || []).length >= 20)
      throw new HttpsError(
        "resource-exhausted",
        "Your organisation membership limit has been reached.",
      );
    if (grant.memberLimit !== null && grant.memberCount >= grant.memberLimit)
      throw new HttpsError(
        "resource-exhausted",
        "This organisation has no remaining places.",
      );
    tx.set(membership, {
      uid,
      organisationId: ref.id,
      joinedAt: FieldValue.serverTimestamp(),
    });
    tx.update(ref, { memberCount: grant.memberCount + 1 });
    tx.set(
      accountRef(uid),
      { organisationIds: FieldValue.arrayUnion(ref.id) },
      { merge: true },
    );
  });
  return readAccess(request);
});
