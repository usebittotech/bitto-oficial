export const PLAN_MONTHS = { monthly: 1, quarterly: 3, annual: 12 };
export function asDate(value) {
  if (!value) return null;
  const date = typeof value.toDate === 'function' ? value.toDate() : value.seconds != null ? new Date(value.seconds * 1000) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
export function addMonths(date, months) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}
export function effectiveAccess(user = {}, now = new Date()) {
  const paid = Object.prototype.hasOwnProperty.call(user, 'paidAccess') ? user.paidAccess : {plan:user.plan, end:user.subscriptionEnd, status:user.subscriptionStatus};
  const candidates = [{...paid, source:'payment'}, {...user.manualGrant, source:'manual'}]
    .filter(x => (PLAN_MONTHS[x.plan] || x.plan === 'embaixador') && !['revoked','refunded','chargeback'].includes(x.status) && asDate(x.end) > now)
    .sort((a,b) => asDate(b.end) - asDate(a.end));
  return candidates.length ? {plan:candidates[0].plan,end:asDate(candidates[0].end),source:candidates[0].source,isActive:true} : {plan:'free',end:null,source:null,isActive:false};
}
export const FREE_LIMITS = {flashcards:10, quiz:3, review:3};
