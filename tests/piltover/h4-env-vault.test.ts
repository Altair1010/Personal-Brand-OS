import {describe,expect,it} from "vitest";
import {ENV_FIELDS,isAllowedEnvKey,isSecretKey} from "../../lib/piltover/env-vault/catalog";
import {createPinRecord,createRevealSession,assertRevealSession,nextFailure,validatePinFormat,verifyPin} from "../../lib/piltover/env-vault/security";

describe("H4.1 .ENV vault contract",()=>{
 it("keeps all catalog fields optional while retaining supplied defaults",()=>{
   expect(ENV_FIELDS.length).toBeGreaterThan(30);
   expect(ENV_FIELDS.every(f=>!("required" in f))).toBe(true);
   expect(ENV_FIELDS.find(f=>f.key==="META_API_VERSION")?.defaultValue).toBe("v23.0");
   expect(ENV_FIELDS.find(f=>f.key==="ADS_REQUIRE_APPROVAL")?.defaultValue).toBe("true");
 });
 it("classifies secrets and numbered page/ad keys",()=>{
   expect(isSecretKey("META_APP_SECRET")).toBe(true);
   expect(isSecretKey("META_PAGE_01_ACCESS_TOKEN")).toBe(true);
   expect(isSecretKey("META_PAGE_NAME")).toBe(false);
   expect(isAllowedEnvKey("META_PAGE_09_ACCESS_TOKEN")).toBe(true);
   expect(isAllowedEnvKey("META_AD_ACCOUNT_12_ID")).toBe(true);
   expect(isAllowedEnvKey("UNSAFE_ARBITRARY_ENV")).toBe(false);
 });
 it("hashes PIN and verifies without storing plaintext",()=>{
   expect(validatePinFormat("123456")).toBe(true);
   expect(validatePinFormat("abc123")).toBe(false);
   const r=createPinRecord("123456");
   expect(r.hash).not.toContain("123456");
   expect(verifyPin("123456",r.salt,r.hash)).toBe(true);
   expect(verifyPin("654321",r.salt,r.hash)).toBe(false);
 });
 it("locks after five failed attempts",()=>{
   let state={failedAttempts:0,lockedUntil:null as Date|null};
   for(let i=0;i<5;i++) state=nextFailure(state.failedAttempts);
   expect(state.failedAttempts).toBe(5); expect(state.lockedUntil).toBeInstanceOf(Date);
 });
 it("creates brand-bound short-lived reveal sessions",()=>{
   const s=createRevealSession("brand-a");
   expect(()=>assertRevealSession(s.token,"brand-a")).not.toThrow();
   expect(()=>assertRevealSession(s.token,"brand-b")).toThrow("ENV_REAUTH_REQUIRED");
 });
});
