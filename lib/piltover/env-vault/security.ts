import crypto from "node:crypto";

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const SESSION_MS = 5 * 60 * 1000;
const sessions = new Map<string,{brandId:string;expiresAt:number}>();

function scrypt(pin:string,salt:string) {
  return crypto.scryptSync(pin,salt,32).toString("base64");
}
export function validatePinFormat(pin:string) {
  return /^\d{6,12}$/.test(pin);
}
export function createPinRecord(pin:string) {
  if(!validatePinFormat(pin)) throw new Error("ENV_PIN_FORMAT_INVALID");
  const salt=crypto.randomBytes(16).toString("base64");
  return {salt,hash:scrypt(pin,salt)};
}
export function verifyPin(pin:string,salt:string,hash:string) {
  const actual=Buffer.from(scrypt(pin,salt));
  const expected=Buffer.from(hash);
  return actual.length===expected.length && crypto.timingSafeEqual(actual,expected);
}
export function nextFailure(failedAttempts:number) {
  const n=failedAttempts+1;
  return {failedAttempts:n,lockedUntil:n>=MAX_ATTEMPTS?new Date(Date.now()+LOCK_MS):null};
}
export function createRevealSession(brandId:string) {
  const token=crypto.randomBytes(32).toString("base64url");
  const expiresAt=Date.now()+SESSION_MS;
  sessions.set(token,{brandId,expiresAt});
  return {token,expiresAt:new Date(expiresAt).toISOString()};
}
export function assertRevealSession(token:string|undefined,brandId:string) {
  if(!token) throw new Error("ENV_REAUTH_REQUIRED");
  const session=sessions.get(token);
  if(!session || session.brandId!==brandId || session.expiresAt<Date.now()) {
    if(token) sessions.delete(token);
    throw new Error("ENV_REAUTH_REQUIRED");
  }
}
