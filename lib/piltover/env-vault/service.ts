import crypto from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { decryptString, encryptString } from "@/lib/ai/keystore";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { ENV_FIELDS, dynamicField, isAllowedEnvKey, isSecretKey } from "./catalog";
import { assertRevealSession, createPinRecord, createRevealSession, nextFailure, validatePinFormat, verifyPin } from "./security";

type Db=PrismaClient|Prisma.TransactionClient;
const MASK="••••••••••••";

function dto(row:{key:string;value:string|null;secretCiphertext:string|null;isSecret:boolean;updatedAt:Date},reveal=false){
  const field=ENV_FIELDS.find(f=>f.key===row.key) ?? dynamicField(row.key);
  return {...field,isSecret:row.isSecret,configured:!!(row.value||row.secretCiphertext),value:row.isSecret?(reveal&&row.secretCiphertext?decryptString(row.secretCiphertext):row.secretCiphertext?MASK:""):(row.value??""),updatedAt:row.updatedAt.toISOString()};
}
export async function getEnvVault(db:Db,revealToken?:string){
  const tenant=await resolveLocalTenant(db);
  let reveal=false;
  if(revealToken){assertRevealSession(revealToken,tenant.brandId);reveal=true;}
  const [rows,security]=await Promise.all([
    db.envVaultEntry.findMany({where:{organizationId:tenant.organizationId,workspaceId:tenant.workspaceId,brandId:tenant.brandId},orderBy:{key:"asc"}}),
    db.envVaultSecurity.findUnique({where:{brandId:tenant.brandId}})
  ]);
  const byKey=new Map(rows.map(r=>[r.key,r]));
  const fields=ENV_FIELDS.map(field=>{
    const row=byKey.get(field.key);
    return row?dto(row,reveal):{...field,isSecret:!!field.secret,configured:false,value:field.defaultValue??"",updatedAt:null};
  });
  for(const row of rows) if(!ENV_FIELDS.some(f=>f.key===row.key)) fields.push(dto(row,reveal));
  return {tenant,fields,pinConfigured:!!security,revealExpiresAt:null};
}
export async function saveEnvValues(db:PrismaClient,values:Record<string,string>){
  const tenant=await resolveLocalTenant(db);
  const entries=Object.entries(values).filter(([key])=>isAllowedEnvKey(key));
  await db.$transaction(async (tx: Prisma.TransactionClient)=>{
    for(const [key,raw] of entries){
      const value=String(raw??"").trim();
      const secret=isSecretKey(key);
      const existing=await tx.envVaultEntry.findUnique({where:{brandId_key:{brandId:tenant.brandId,key}}});
      if(secret && value===MASK) continue;
      if(!value){
        if(existing) await tx.envVaultEntry.delete({where:{id:existing.id}});
        continue;
      }
      const data={organizationId:tenant.organizationId,workspaceId:tenant.workspaceId,brandId:tenant.brandId,key,isSecret:secret,value:secret?null:value,secretCiphertext:secret?encryptString(value):null};
      await tx.envVaultEntry.upsert({where:{brandId_key:{brandId:tenant.brandId,key}},create:{id:`env_${crypto.randomUUID()}`,...data},update:data});
    }
    await tx.auditEntry.create({data:{id:`audit_${crypto.randomUUID()}`,organizationId:tenant.organizationId,actorType:"USER",actorId:"local",action:"ENV_VAULT_UPDATED",targetType:"BRAND_ENV",targetId:tenant.brandId,correlationId:`env_${crypto.randomUUID()}`,metadata:{keys:entries.map(([k])=>k),secretValuesLogged:false},occurredAt:new Date()}});
  });
  return getEnvVault(db);
}
export async function configureEnvPin(db:Db,pin:string){
  if(!validatePinFormat(pin)) throw new Error("ENV_PIN_FORMAT_INVALID");
  const tenant=await resolveLocalTenant(db); const rec=createPinRecord(pin);
  await db.envVaultSecurity.upsert({where:{brandId:tenant.brandId},create:{id:`envsec_${crypto.randomUUID()}`,organizationId:tenant.organizationId,workspaceId:tenant.workspaceId,brandId:tenant.brandId,pinSalt:rec.salt,pinHash:rec.hash},update:{pinSalt:rec.salt,pinHash:rec.hash,failedAttempts:0,lockedUntil:null}});
  return {configured:true};
}
export async function verifyEnvPinAndCreateSession(db:Db,pin:string){
  const tenant=await resolveLocalTenant(db);
  const sec=await db.envVaultSecurity.findUnique({where:{brandId:tenant.brandId}});
  if(!sec) throw new Error("ENV_PIN_NOT_CONFIGURED");
  if(sec.lockedUntil && sec.lockedUntil.getTime()>Date.now()) throw new Error("ENV_PIN_LOCKED");
  if(!verifyPin(pin,sec.pinSalt,sec.pinHash)){
    const failure=nextFailure(sec.failedAttempts);
    await db.envVaultSecurity.update({where:{id:sec.id},data:failure});
    throw new Error(failure.lockedUntil?"ENV_PIN_LOCKED":"ENV_PIN_INVALID");
  }
  await db.envVaultSecurity.update({where:{id:sec.id},data:{failedAttempts:0,lockedUntil:null}});
  return createRevealSession(tenant.brandId);
}
export async function resolveEnvForAgent(db:Db,keys:string[]){
  const tenant=await resolveLocalTenant(db);
  const allowed=keys.filter(isAllowedEnvKey);
  const rows=await db.envVaultEntry.findMany({where:{brandId:tenant.brandId,key:{in:allowed}}});
  return Object.fromEntries(rows.map(r=>[r.key,r.isSecret&&r.secretCiphertext?decryptString(r.secretCiphertext):(r.value??"")]));
}
