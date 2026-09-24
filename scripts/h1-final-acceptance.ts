import { db } from "@/lib/db";
import { AgentExecutionGateway } from "@/lib/piltover/modules/agents/application/agent-execution-gateway";
import { PrismaJobQueue } from "@/lib/piltover/modules/agents/infrastructure/prisma-job-queue";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";
import { resolveCanonicalAgentBinding } from "@/lib/piltover/vnext/canonical-agent-binding";
import { stableHash } from "@/lib/piltover/shared/contracts/stable-json";
import { RunResultSchema } from "@/lib/piltover/shared/contracts/control-plane";
import { strategyOutputSchema } from "@/lib/prompts/strategy";
import { weeklyPlanOutputSchema } from "@/lib/prompts/weekly-plan";
import { normalizeRecordTo100 } from "@/lib/strategy-engine/normalizeRatio";
import { assembleStrategy, DAYS_PER_WEEK } from "@/lib/strategy-engine/assembleStrategy";
import { createStrategyVersion } from "@/lib/strategy-engine/versioning";
import { ensureImcPlanFromStrategy } from "@/lib/piltover/vnext/imc-service";
import { z } from "zod";

const sleep = (ms:number) => new Promise((r)=>setTimeout(r,ms));
const USER_ID="local";
const APPSTATE_ID="singleton";

async function main(){
  const tenant = await resolveLocalTenant(db);
  const appState = await db.appState.findUnique({where:{id:APPSTATE_ID}});
  if(!appState?.audienceApprovedAt || !appState.activeGoalId) throw new Error("H1_CONTEXT_NOT_READY");
  const goalId=appState.activeGoalId;
  const [brandDna,goal,personas,pillars]=await Promise.all([
    db.brandDNA.findUnique({where:{userId:USER_ID}}),
    db.goal.findUnique({where:{id:goalId}}),
    db.audienceSegment.findMany({where:{userId:USER_ID,goalId},orderBy:{createdAt:"asc"}}),
    db.contentPillar.findMany({where:{userId:USER_ID,goalId,status:"active"},orderBy:{createdAt:"asc"}}),
  ]);
  if(!goal || !personas.length || !pillars.length) throw new Error("H1_CONTEXT_INCOMPLETE");

  const freshAfter=new Date(Date.now()-120_000);
  const workers=await db.worker.findMany({
    where:{status:"ACTIVE",lastSeenAt:{gt:freshAfter}},
    include:{capabilities:true},
    orderBy:{lastSeenAt:"desc"},
  });
  const worker=workers.find(w=>w.capabilities.some(c=>c.capability==="agent.execute.openclaw")&&w.capabilities.some(c=>c.capability==="strategy.plan"));
  if(!worker) throw new Error("NO_FRESH_OPENCLAW_STRATEGY_WORKER");

  const context={
    goalId,
    frameworkSlug:null,
    frameworkName:null,
    brandDna:{
      whoAmI:brandDna?.whoAmI??undefined,
      field:brandDna?.field??undefined,
      positioning:brandDna?.aiPositioning??undefined,
      threeWords:Array.isArray(brandDna?.threeWords)?(brandDna!.threeWords as unknown[]).filter((w):w is string=>typeof w==="string"):undefined,
      differentiationSharpened:brandDna?.differentiation??undefined,
      summary:brandDna?.usp??undefined,
    },
    goal:{name:goal.name,goalType:goal.goalType,targetAudience:goal.targetAudience??undefined,mainOffer:goal.mainOffer??undefined},
    personas:personas.map(p=>({name:p.name})),
    pillars:pillars.map(p=>({id:p.id,name:p.name,description:p.description??undefined})),
    daysPerWeek:[...DAYS_PER_WEEK],
  };
  const binding=await resolveCanonicalAgentBinding(db,"strategy-planner");
  const contextHash=stableHash(context);
  const nonce=Date.now().toString(36);
  const dispatched=await new AgentExecutionGateway(new PrismaJobQueue(db)).dispatch({
    organizationId:tenant.organizationId,
    workspaceId:tenant.workspaceId,
    brandId:tenant.brandId,
    ...binding,
    repositoryAlias:"personal-brand-os",
    roleRef:"role:strategy-planner@h1",
    taskType:"STRATEGY_PLAN_30D",
    instruction:"Create a 30-day strategy from the supplied Brand, Goal, Persona and Pillar context. Return ONLY the canonical StrategyPlanResult/v2 JSON contract described in contractGuidance. Do not add alternate architecture fields and do not mutate Piltover state directly.",
    contextRef:{id:`h1-final:${tenant.brandId}:${contextHash}:${nonce}`,hash:contextHash},
    permissionManifestRef:"permission:h1-strategy-planner",
    route:{kind:"OPENCLAW",controller:"openclaw",support:{
      termius:worker.capabilities.some(c=>c.capability==="openclaw.support.termius"),
      router9:worker.capabilities.some(c=>c.capability==="openclaw.support.9router"),
    }},
    taskPayload:{
      context,
      resultContract:"StrategyPlanResult/v2",
      contractGuidance:"Return exactly {tier1,weeklyOutputs}. tier1 must contain contentRatio with exactly seo,educate,trust,conversion,story,community; weeklyThemes exactly 5 items with weekIndex,theme,focusPillar,objectivesMix using those same six keys; ctaPlan[{stage,cta,when}]; topicMap[{pillar,topics[]}]; recommendedTemplates[]; kpiToTrack[]; doNotList[]; assumptions[]. weeklyOutputs must be exactly 5 items; each item is {weekIndex,dailyPlans,notes}; weekIndex 1..5; dailyPlans count must be 7,7,7,7,2; every daily item is {dayIndex,objective,pillar,suggestedTopic,suggestedCta}; objective must be one of seo,educate,trust,conversion,story,community; pillar/focusPillar must exactly match one supplied pillar name.",
    },
    idempotencyKey:`h1-final-acceptance:${tenant.brandId}:${nonce}`,
    requiredCapabilities:["strategy.plan"],
    priority:90,
  });

  console.log(JSON.stringify({stage:"DISPATCHED",runId:dispatched.runId,jobId:dispatched.jobId,workerId:worker.id,binding},null,2));

  let run:any=null;
  const deadline=Date.now()+12*60_000;
  while(Date.now()<deadline){
    run=await db.agentRun.findUnique({where:{id:dispatched.runId},include:{jobs:{include:{leases:true},orderBy:{createdAt:"desc"}}}});
    if(run && ["COMPLETED","FAILED","CANCELLED"].includes(run.status)) break;
    await sleep(2000);
  }
  if(!run || run.status!=="COMPLETED") throw new Error(`H1_AGENT_RUN_NOT_COMPLETED:${run?.status??"TIMEOUT"}`);

  const terminal=RunResultSchema.parse(run.terminalResult);
  const artifact=terminal.artifacts?.find((a:any)=>a.kind==="strategy-plan-result");
  if(!artifact?.payload || typeof artifact.payload!=="object") throw new Error("H1_STRATEGY_ARTIFACT_MISSING");
  const canonical=z.object({tier1:strategyOutputSchema,weeklyOutputs:z.array(weeklyPlanOutputSchema).length(5)}).parse(artifact.payload);
  const tier1={...canonical.tier1,contentRatio:normalizeRecordTo100(canonical.tier1.contentRatio),weeklyThemes:canonical.tier1.weeklyThemes.map(w=>({...w,objectivesMix:normalizeRecordTo100(w.objectivesMix)}))};
  canonical.weeklyOutputs.forEach((w,i)=>{if(w.weekIndex!==i+1||w.dailyPlans.length!==DAYS_PER_WEEK[i]) throw new Error("H1_WEEK_SHAPE_INVALID");});
  const pillarNameToId=Object.fromEntries(pillars.map(p=>[p.name,p.id]));
  const assembledWeeks=assembleStrategy(tier1,canonical.weeklyOutputs,pillarNameToId);
  const structuredPlan={
    schemaVersion:"piltover.marketing-strategy/v1",
    diagnosis:{assumptions:tier1.assumptions,guardrails:tier1.doNotList},
    marketContext:{timeframeDays:30,frameworkSlug:null,sourceAgentRunId:run.id},
    audiences:personas.map(p=>({name:p.name})),
    positioning:{targetAudience:goal.targetAudience,offer:goal.mainOffer},
    strategicThesis:tier1.weeklyThemes.map(w=>w.theme).filter(Boolean).join(" → ")||`Execute a 30-day content strategy to achieve ${goal.name}.`,
    objectives:[{key:goal.goalType,name:goal.name,contentRatio:tier1.contentRatio}],
    funnel:{ctaPlan:tier1.ctaPlan},
    channels:[],
    contentPillars:tier1.topicMap,
    kpis:tier1.kpiToTrack.map(key=>({key})),
    assumptions:tier1.assumptions,
    risks:tier1.doNotList.map(description=>({type:"guardrail",description})),
    experiments:[],
  };
  let persisted=await db.strategyVersion.findUnique({where:{sourceAgentRunId:run.id},select:{id:true,strategyId:true}});
  if(!persisted){
    const created=await createStrategyVersion({
      goalId,
      name:`Chiến lược 30 ngày — ${goal.name}`,
      tier1,
      assembledWeeks,
      sourceAgentRunId:run.id,
      structuredPlan,
      reason:`H1 final acceptance live Strategy Agent run ${run.id}`,
    });
    persisted={id:created.versionId,strategyId:created.strategyId};
  }
  await ensureImcPlanFromStrategy(db,persisted.id);
  const audit=await db.auditEntry.findFirst({where:{action:"AGENT_RUN_TERMINAL",targetType:"AGENT_RUN",targetId:run.id},orderBy:{createdAt:"desc"}});
  if(!audit) throw new Error("H1_TERMINAL_AUDIT_MISSING");
  const verified=await db.strategyVersion.findUnique({where:{id:persisted.id},select:{id:true,sourceAgentRunId:true,structuredPlan:true}});
  if(!verified) throw new Error("H1_PERSISTED_STRATEGY_MISSING");
  if(verified.sourceAgentRunId!==run.id) throw new Error("H1_PROVENANCE_MISMATCH");

  const job=run.jobs[0];
  console.log(JSON.stringify({
    stage:"H1_FINAL_ACCEPTANCE_PASS",
    runId:run.id,
    jobId:job?.id,
    runStatus:run.status,
    jobStatus:job?.status,
    workerId:job?.workerId??job?.leases?.[0]?.workerId??worker.id,
    artifactKind:artifact.kind,
    agentVersionId:run.agentVersionId,
    promptVersionId:run.promptVersionId,
    skillVersionRefs:run.skillVersionRefs,
    modelRef:run.modelRef,
    tokenUsage:run.tokenUsage,
    strategyVersionId:persisted.id,
    strategyId:persisted.strategyId,
    sourceAgentRunId:verified.sourceAgentRunId,
    auditId:audit.id,
    completedAt:run.completedAt,
  },null,2));
}

main().catch((error)=>{console.error("H1_FINAL_ACCEPTANCE_FAIL",error);process.exitCode=1;}).finally(async()=>{await db.$disconnect();});
