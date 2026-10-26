import { httpsCallable } from "firebase/functions";
import { functions } from "../firebaseConfig";
export interface AccessAccount {
  fullAccess: boolean;
  source: string;
  freeScenarioId: string | null;
  freeMicroSkillLimit: number;
  freeMicroSkills: any[];
  organisations: { id: string; name: string; expiresAt: number | null }[];
}
export interface Organisation {
  id: string;
  name: string;
  expiresAt: number | null;
  revokedAt: number | null;
  approvedCount: number;
  memberLimit: number | null;
}
const call = async <T>(name: string, data: unknown = {}): Promise<T> =>
  (await httpsCallable<unknown, T>(functions, name)(data)).data;
export const getAccessAccount = () => call<AccessAccount>("getAccessAccount");
export const chooseFreeScenario = (scenarioId: string) =>
  call<AccessAccount>("chooseFreeScenario", { scenarioId });
export const listOrganisations = () =>
  call<Organisation[]>("listOrganisations");
export const saveOrganisation = (data: unknown) =>
  call<{ id: string }>("saveOrganisation", data);

export const listApprovedMembers = (organisationId: string) =>
  call<{ email: string }[]>("listApprovedMembers", { organisationId });
export const updateApprovedMembers = (
  organisationId: string,
  action: "add" | "remove",
  emails: string[],
) =>
  call<{ changed: number; unchanged: number; approvedCount: number }>(
    "updateApprovedMembers",
    { organisationId, action, emails },
  );
