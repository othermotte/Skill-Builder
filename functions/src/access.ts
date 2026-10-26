import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHash } from "crypto";
import { normaliseEmail } from "./emailRoster";
import { activeGrant, selectScenario } from "./accessDomain";
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
  const email = normaliseEmail(String(request.auth.token.email || ""));
  const approval = await getFirestore()
    .collection("organisationApprovals")
    .doc(emailHash(email))
    .get();
  // Membership comes only from an administrator-approved exact address.
  // Legacy code memberships and domain rules never grant access.
  const orgIds: string[] =
    approval.data()?.email === email &&
    Array.isArray(approval.data()?.organisationIds)
      ? approval.data()!.organisationIds.slice(0, 20)
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
      "This scenario is not included in your free account.",
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
function emailHash(email: string) {
  return createHash("sha256").update(email).digest("hex");
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
  if (data.action)
    throw new HttpsError(
      "invalid-argument",
      "Unsupported organisation action.",
    );
  const name = String(data.name || "").trim();
  if (!name || name.length > 100)
    throw new HttpsError(
      "invalid-argument",
      "Provide an organisation name of up to 100 characters.",
    );
  const memberLimit =
    data.memberLimit == null ? null : Number(data.memberLimit);
  if (
    memberLimit !== null &&
    (!Number.isSafeInteger(memberLimit) ||
      memberLimit < 1 ||
      memberLimit > 5000)
  )
    throw new HttpsError(
      "invalid-argument",
      "Set a member limit between 1 and 5,000 or leave it unlimited.",
    );
  const expiresAt = expiry(data.expiresAt);
  await db.runTransaction(async (tx) => {
    const old = await tx.get(ref);
    if (data.id && !old.exists)
      throw new HttpsError("not-found", "Organisation not found.");
    if (
      memberLimit !== null &&
      memberLimit < Number(old.data()?.approvedCount || 0)
    )
      throw new HttpsError(
        "failed-precondition",
        "Remove approved addresses before lowering the member limit below the current list size.",
      );
    if (old.data()?.codeHash)
      tx.delete(db.collection("organisationCodes").doc(old.data()!.codeHash));
    tx.set(
      ref,
      {
        name,
        memberLimit,
        expiresAt,
        revokedAt: null,
        domains: [],
        codeHash: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(old.exists
          ? {}
          : {
              approvedCount: 0,
              createdAt: FieldValue.serverTimestamp(),
              createdBy: request.auth!.uid,
            }),
      },
      { merge: true },
    );
  });
  return { id };
});
function organisationId(value: unknown): string {
  const id = String(value || "");
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id))
    throw new HttpsError("invalid-argument", "Choose an organisation.");
  return id;
}
export const listApprovedMembers = onCall(options, async (request) => {
  admin(request);
  const ref = getFirestore()
    .collection("organisations")
    .doc(organisationId(request.data?.organisationId));
  if (!(await ref.get()).exists)
    throw new HttpsError("not-found", "Organisation not found.");
  const snap = await ref
    .collection("approvedMembers")
    .orderBy("email")
    .limit(5000)
    .get();
  return snap.docs.map((doc) => ({ email: doc.data().email }));
});
export const updateApprovedMembers = onCall(options, async (request) => {
  admin(request);
  const id = organisationId(request.data?.organisationId),
    action = request.data?.action;
  if (action !== "add" && action !== "remove")
    throw new HttpsError("invalid-argument", "Choose add or remove.");
  const input = request.data?.emails;
  if (!Array.isArray(input) || input.length < 1 || input.length > 200)
    throw new HttpsError(
      "invalid-argument",
      "Supply between 1 and 200 addresses per batch.",
    );
  let emails: string[];
  try {
    emails = [...new Set(input.map(normaliseEmail))];
  } catch {
    throw new HttpsError(
      "invalid-argument",
      "Every address must be a valid email address.",
    );
  }
  const db = getFirestore(),
    orgRef = db.collection("organisations").doc(id);
  return db.runTransaction(async (tx) => {
    const org = await tx.get(orgRef);
    if (!org.exists)
      throw new HttpsError("not-found", "Organisation not found.");
    const refs = emails.map((email) =>
      orgRef.collection("approvedMembers").doc(emailHash(email)),
    );
    const indexRefs = emails.map((email) =>
      db.collection("organisationApprovals").doc(emailHash(email)),
    );
    const records = await tx.getAll(...refs, ...indexRefs);
    const members = records.slice(0, emails.length),
      indexes = records.slice(emails.length);
    const changed = emails.filter((_, i) =>
      action === "add" ? !members[i].exists : members[i].exists,
    );
    const count =
      Math.max(0, Number(org.data()?.approvedCount || 0)) +
      (action === "add" ? changed.length : -changed.length);
    const limit = Math.min(5000, org.data()?.memberLimit ?? 5000);
    if (action === "add" && count > limit)
      throw new HttpsError(
        "resource-exhausted",
        "This list exceeds the organisation member limit. Increase the limit or reduce the list before adding these addresses.",
      );
    emails.forEach((email, i) => {
      if (!changed.includes(email)) return;
      const ids = indexes[i].data()?.organisationIds || [];
      if (action === "add") {
        if (!ids.includes(id) && ids.length >= 20)
          throw new HttpsError(
            "resource-exhausted",
            "An address is already approved for 20 organisations.",
          );
        tx.set(refs[i], {
          email,
          addedAt: FieldValue.serverTimestamp(),
          addedBy: request.auth!.uid,
        });
        tx.set(
          indexRefs[i],
          { email, organisationIds: FieldValue.arrayUnion(id) },
          { merge: true },
        );
      } else {
        tx.delete(refs[i]);
        const remaining = ids.filter((existing: string) => existing !== id);
        if (remaining.length)
          tx.set(indexRefs[i], { email, organisationIds: remaining });
        else tx.delete(indexRefs[i]);
      }
    });
    tx.update(orgRef, {
      approvedCount: Math.max(0, count),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      changed: changed.length,
      unchanged: emails.length - changed.length,
      approvedCount: Math.max(0, count),
    };
  });
});
// Keep a disabled endpoint so every previously issued code fails, including old clients.
export const redeemOrganisationCode = onCall(options, async (request) => {
  user(request);
  throw new HttpsError(
    "failed-precondition",
    "Organisation access now uses approved email addresses. Sign in with the address approved by your organisation.",
  );
});
