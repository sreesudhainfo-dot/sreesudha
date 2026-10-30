// Shared UI calculation helpers. Supabase numeric RPCs remain authoritative.
export function roundRupees(value) {
  if (!Number.isFinite(value)) throw new Error('Enter a valid financial number');
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
export function plotValue(areaSqYd, ratePerSqYd) {
  if (!Number.isFinite(areaSqYd) || !Number.isFinite(ratePerSqYd) || areaSqYd < 0 || ratePerSqYd < 0)
    throw new Error('Area and rate must be non-negative');
  return roundRupees(areaSqYd * ratePerSqYd);
}
export function sellingAgentCommission(total, percentage) {
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(percentage) || percentage < 0 || percentage > 20)
    throw new Error('Commission percentage must be between 0 and 20');
  return roundRupees(total * percentage / 100);
}
export function remainingBalance(total, received) {
  if (!Number.isFinite(total) || !Number.isFinite(received) || received < 0 || total < 0)
    throw new Error('Invalid balance calculation');
  return roundRupees(Math.max(0,total-received));
}
export function isHierarchyEmployeeCode(value) {
  return /^EMP\d{4}(?:\d{2})*$/.test(value);
}
export function referralLevelsAbove(value) {
  if (!isHierarchyEmployeeCode(value)) throw new Error('Invalid hierarchy Employee ID');
  return (value.length-7)/2;
}
export function immediateReferrerCode(value) {
  const levels=referralLevelsAbove(value);
  return levels === 0 ? null : value.slice(0,-2);
}
