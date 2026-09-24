import { Bot, GitBranch, ShieldCheck, Workflow, Gauge, Coins } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AgentHistoryPanels } from "@/components/agents/AgentHistoryPanels";
import { resolveLocalTenant } from "@/lib/piltover/modules/marketing/infrastructure/local-tenant";

export const dynamic = "force-dynamic";

function totalTokens(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const total = (value as Record<string, unknown>).totalTokens;
  return typeof total === "number" ? total : null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export default async function AgentsPage() {
  const tenant = await resolveLocalTenant(db);
  const [threads, runs, prompts, skills, grants, approvals, evals] = await Promise.all([
    db.agentThread.findMany({ where: { brandId: tenant.brandId }, orderBy: { updatedAt: "desc" }, take: 60 }),
    db.agentRun.findMany({ where: { brandId: tenant.brandId }, orderBy: { createdAt: "desc" }, take: 90 }),
    db.promptDefinition.count(),
    db.skillDefinition.count(),
    db.toolGrant.count({ where: { organizationId: tenant.organizationId, status: "ACTIVE" } }),
    db.approvalRequest.count({ where: { organizationId: tenant.organizationId, status: "PENDING" } }),
    db.evaluationRun.findMany({
      where: { organizationId: tenant.organizationId, OR: [{ brandId: tenant.brandId }, { brandId: null }] },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const stats = [
    ["Active threads", threads.filter((item) => item.status === "ACTIVE").length, GitBranch],
    ["Prompt registry", prompts, Workflow],
    ["Skill registry", skills, Bot],
    ["Pending approvals", approvals, ShieldCheck],
  ] as const;

  const tokenTotal = runs.reduce((sum, run) => sum + (totalTokens(run.tokenUsage) ?? 0), 0);
  const costMinor = runs.reduce((sum, run) => sum + (run.costMinor ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Agents"
        description="Luồng Agent bền vững, version pin, usage telemetry, tool policy, approval, trace và evaluation."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, Icon]) => (
          <Card key={label}>
            <CardContent className="py-4">
              <Icon className="size-4 text-muted-foreground" />
              <div className="mt-4 font-mono text-2xl">{value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <div className="text-xs text-muted-foreground">Recent run tokens</div>
              <div className="mt-1 font-mono text-xl">{tokenTotal.toLocaleString()}</div>
            </div>
            <Gauge className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <div className="text-xs text-muted-foreground">Reported model cost</div>
              <div className="mt-1 font-mono text-xl">{"$" + (costMinor / 100).toFixed(2)}</div>
            </div>
            <Coins className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <AgentHistoryPanels
        grants={grants}
        threads={threads.map((thread) => ({
          id: thread.id,
          status: thread.status,
          activeCheckpointId: thread.activeCheckpointId,
          updatedAt: thread.updatedAt.toISOString(),
        }))}
        runs={runs.map((run) => ({
          id: run.id,
          status: run.status,
          agentVersionId: run.agentVersionId,
          roleRef: run.roleRef,
          promptVersionId: run.promptVersionId,
          requiredCapabilities: stringList(run.requiredCapabilities),
          modelRef: run.modelRef,
          totalTokens: totalTokens(run.tokenUsage),
          costMinor: run.costMinor,
          createdAt: run.createdAt.toISOString(),
        }))}
      />

      <Card className="mt-4">
        <CardContent className="py-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold tracking-tight">Evaluation Runs</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Regression gates cho agent, prompt, skill, model và engine candidate.
              </p>
            </div>
            <Badge variant="outline">{evals.length} recent</Badge>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/20">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-[rgba(12,79,84,.07)] text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--neu-teal)]">
                <tr>
                  <th className="px-3 py-3">Subject</th>
                  <th className="px-3 py-3">Candidate</th>
                  <th className="px-3 py-3">Score</th>
                  <th className="px-3 py-3">Delta</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {evals.map((row) => (
                  <tr key={row.id} className="border-t border-[rgba(154,139,115,.18)]">
                    <td className="px-3 py-3">
                      {row.subjectType}
                      <div className="font-mono text-[10px] text-muted-foreground">{row.subjectRef}</div>
                    </td>
                    <td className="px-3 py-3 font-mono text-[10px]">{row.candidateRef ?? "—"}</td>
                    <td className="px-3 py-3 font-mono">{row.score.toFixed(3)}</td>
                    <td className="px-3 py-3 font-mono">{row.delta == null ? "—" : row.delta.toFixed(3)}</td>
                    <td className="px-3 py-3"><Badge variant={row.status === "PASSED" ? "default" : "destructive"}>{row.status}</Badge></td>
                    <td className="px-3 py-3 font-mono text-[10px]">{row.createdAt.toLocaleString()}</td>
                  </tr>
                ))}
                {evals.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No persisted evaluation run yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
