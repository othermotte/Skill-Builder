export type PaidPlan = 'month_pass' | 'monthly' | 'annual';
export type Plan = 'free' | PaidPlan;
export const OFFER = {
  month_pass: { amount: 1499, interval: null, label: 'One month' },
  monthly: { amount: 999, interval: 'month', label: 'Monthly subscription' },
  annual: { amount: 9900, interval: 'year', label: 'Annual subscription' },
} as const;
export interface BillingAccount {
  uid: string;
  customerId?: string;
  passUntil?: number;
  subscriptionId?: string;
  subscriptionPlan?: 'monthly' | 'annual';
  subscriptionStatus?: string;
  subscriptionStartsAt?: number;
  paidThrough?: number;
  periodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  createdAt: number;
  lastSeenAt?: number;
}
export const monthKey = (now: number) => new Date(now).toISOString().slice(0, 7);
export function nextMonth(now: number): number {
  const date = new Date(now);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.getTime();
}
export function accessFor(account: BillingAccount, now: number) {
  const subscriptionUntil = ['unpaid', 'incomplete', 'incomplete_expired'].includes(account.subscriptionStatus || '')
    ? 0 : account.paidThrough || 0;
  const passUntil = account.passUntil || 0;
  const accessUntil = Math.max(passUntil, subscriptionUntil);
  const plan: Plan = accessUntil <= now ? 'free' : subscriptionUntil >= passUntil
    ? account.subscriptionPlan || 'monthly' : 'month_pass';
  return { plan, unlimited: plan !== 'free', accessUntil: accessUntil || null,
    cancelAtPeriodEnd: !!account.cancelAtPeriodEnd || account.subscriptionStatus === 'canceled',
    renewalDate: plan !== 'free' && plan !== 'month_pass' && !account.cancelAtPeriodEnd
      && ['active', 'past_due'].includes(account.subscriptionStatus || '') ? account.periodEnd || null : null };
}
export function validPlan(value: unknown): value is PaidPlan {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(OFFER, value);
}
