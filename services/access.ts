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
  domains: string[];
  memberLimit: number | null;
  memberCount: number;
}
const call = async <T>(name: string, data: unknown = {}): Promise<T> =>
  (await httpsCallable<unknown, T>(functions, name)(data)).data;
export const getAccessAccount = () => call<AccessAccount>("getAccessAccount");
export const chooseFreeScenario = (scenarioId: string) =>
  call<AccessAccount>("chooseFreeScenario", { scenarioId });
export const redeemOrganisationCode = (code: string) =>
  call<AccessAccount>("redeemOrganisationCode", { code });
export const listOrganisations = () =>
  call<Organisation[]>("listOrganisations");
export const saveOrganisation = (data: unknown) =>
  call<{ id: string; code?: string }>("saveOrganisation", data);
