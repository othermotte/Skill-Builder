export interface OrganisationGrant {
  id?: string;
  name: string;
  expiresAt: number | null;
  revokedAt: number | null;
  domains: string[];
  memberLimit: number | null;
  memberCount: number;
}
export function activeGrant(
  grant: OrganisationGrant,
  now = Date.now(),
): boolean {
  return (
    !grant.revokedAt && (grant.expiresAt === null || grant.expiresAt > now)
  );
}
export function normaliseDomains(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20)
    throw new Error("Provide up to 20 email domains.");
  const domains = [
    ...new Set(
      value.map((v) => String(v).trim().toLowerCase()).filter(Boolean),
    ),
  ];
  if (
    domains.some(
      (d) => !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(d),
    )
  )
    throw new Error("Use email domains such as unc.edu, without @.");
  return domains;
}
export function emailAllowed(email: string, domains: string[]): boolean {
  const domain = email.toLowerCase().split("@")[1];
  return domains.length === 0 || domains.includes(domain);
}
export function selectScenario(
  existing: string | null,
  requested: string,
): string {
  if (existing && existing !== requested)
    throw new Error("Your free scenario has already been chosen.");
  return requested;
}
export function freeSkills(options: any[], library: any): any[] {
  const canonical = new Map<string, any>();
  for (const group of library.skill_groups || [])
    for (const skill of group.skills || [])
      for (const micro of skill.micro_skills || []) {
        canonical.set(micro.id, {
          groupId: group.id,
          groupLabel: group.label,
          skillId: skill.id,
          skillLabel: skill.name || skill.label,
          microSkillId: micro.id,
          microSkillLabel: micro.label,
        });
      }
  const seen = new Set<string>();
  return options
    .filter(
      (o) =>
        canonical.has(o.microSkillId) &&
        !seen.has(o.microSkillId) &&
        seen.add(o.microSkillId),
    )
    .slice(0, 5)
    .map((o) => ({
      ...canonical.get(o.microSkillId),
      reason: String(o.reason || "").slice(0, 4000),
    }));
}
