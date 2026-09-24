"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { visibleSlice } from "@/lib/piltover/agent-chat/ui-contract";

type ThreadRow = { id:string; status:string; activeCheckpointId:string|null; updatedAt:string };
type RunRow = {
  id:string; status:string; agentVersionId:string|null; roleRef:string; promptVersionId:string|null;
  requiredCapabilities:string[]; modelRef:string|null; totalTokens:number|null; costMinor:number|null; createdAt:string;
};

function Pager({page,pages,onPage}:{page:number;pages:number;onPage:(next:number)=>void}) {
  if (pages <= 1) return null;
  return <div className="flex items-center justify-end gap-2 border-t border-white/20 pt-3">
    <Button type="button" size="sm" variant="ghost" disabled={page<=1} onClick={()=>onPage(page-1)}><ChevronLeft className="size-3.5"/></Button>
    <span className="text-[11px] font-medium text-muted-foreground">Page {page} / {pages}</span>
    <Button type="button" size="sm" variant="ghost" disabled={page>=pages} onClick={()=>onPage(page+1)}><ChevronRight className="size-3.5"/></Button>
  </div>;
}

export function AgentHistoryPanels({threads,runs,grants}:{threads:ThreadRow[];runs:RunRow[];grants:number}) {
  const [threadsExpanded,setThreadsExpanded]=useState(false);
  const [runsExpanded,setRunsExpanded]=useState(false);
  const [threadPage,setThreadPage]=useState(1);
  const [runPage,setRunPage]=useState(1);
  const threadSlice=useMemo(()=>visibleSlice(threads.length,threadsExpanded,threadPage),[threads.length,threadsExpanded,threadPage]);
  const runSlice=useMemo(()=>visibleSlice(runs.length,runsExpanded,runPage),[runs.length,runsExpanded,runPage]);
  const visibleThreads=threads.slice(threadSlice.start,threadSlice.end);
  const visibleRuns=runs.slice(runSlice.start,runSlice.end);

  return <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1.65fr]">
    <Card><CardContent className="py-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><h2 className="text-base font-bold tracking-tight">Threads</h2><p className="mt-1 text-xs text-muted-foreground">5 mục gần nhất; mở rộng tối đa 15 mục mỗi trang.</p></div>
        <Badge variant="outline">{grants} tool grants</Badge>
      </div>
      <div className="space-y-2">
        {visibleThreads.map(thread=><div key={thread.id} className="rounded-xl border border-white/20 bg-[var(--neu-inset)] p-3 [box-shadow:var(--shadow-inset)]">
          <div className="flex items-center justify-between gap-3"><span className="truncate font-mono text-xs font-semibold">{thread.id}</span><Badge variant={thread.status==="ACTIVE"?"default":"secondary"}>{thread.status}</Badge></div>
          <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground/70">Checkpoint</span><span className="truncate font-mono">{thread.activeCheckpointId?.slice(0,12)??"—"}</span>
            <span className="font-semibold text-foreground/70">Updated</span><span>{new Date(thread.updatedAt).toLocaleString()}</span>
          </div>
        </div>)}
        {threads.length===0&&<p className="text-sm text-muted-foreground">No agent thread yet.</p>}
      </div>
      {threads.length>5&&<><Button type="button" size="sm" variant="ghost" className="mt-3 w-full" onClick={()=>{setThreadsExpanded(v=>!v);setThreadPage(1)}}>
        {threadsExpanded?<ChevronUp className="size-4"/>:<ChevronDown className="size-4"/>}{threadsExpanded?"Collapse":"Show more ("+threads.length+")"}
      </Button>{threadsExpanded&&<Pager page={threadPage} pages={threadSlice.pages} onPage={setThreadPage}/>}</>}
    </CardContent></Card>

    <Card><CardContent className="py-5">
      <div className="mb-4"><h2 className="text-base font-bold tracking-tight">Recent Runs</h2><p className="mt-1 text-xs text-muted-foreground">Hiển thị 5 lượt gần nhất; mở rộng tối đa 15 lượt mỗi trang.</p></div>
      <div className="overflow-x-auto rounded-xl border border-white/20">
        <table className="w-full min-w-[980px] table-fixed text-left text-xs">
          <thead className="bg-[rgba(12,79,84,.07)] text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--neu-teal)]"><tr>
            <th className="w-[96px] px-3 py-3">Run</th><th className="w-[105px] px-3 py-3">Status</th><th className="w-[150px] px-3 py-3">Created</th>
            <th className="w-[145px] px-3 py-3">Agent</th><th className="w-[130px] px-3 py-3">Prompt</th><th className="w-[180px] px-3 py-3">Capabilities</th>
            <th className="w-[105px] px-3 py-3">Model</th><th className="w-[90px] px-3 py-3 text-right">Tokens</th><th className="w-[75px] px-3 py-3 text-right">Cost</th>
          </tr></thead>
          <tbody>
            {visibleRuns.map(run=><tr key={run.id} className="border-t border-[rgba(154,139,115,.18)] align-top">
              <td className="px-3 py-3 font-mono font-semibold">{run.id.slice(-10)}</td>
              <td className="px-3 py-3"><Badge variant="outline">{run.status}</Badge></td>
              <td className="px-3 py-3 text-[11px]">{new Date(run.createdAt).toLocaleString()}</td>
              <td className="truncate px-3 py-3 font-mono text-[10px]" title={run.agentVersionId??run.roleRef}>{run.agentVersionId??run.roleRef}</td>
              <td className="truncate px-3 py-3 font-mono text-[10px]" title={run.promptVersionId??"—"}>{run.promptVersionId??"—"}</td>
              <td className="truncate px-3 py-3 text-[10px]" title={run.requiredCapabilities.join(", ")}>{run.requiredCapabilities.join(", ")||"—"}</td>
              <td className="truncate px-3 py-3">{run.modelRef??"configured"}</td>
              <td className="px-3 py-3 text-right font-mono">{run.totalTokens?.toLocaleString()??"—"}</td>
              <td className="px-3 py-3 text-right font-mono">{run.costMinor==null?"—":"$"+(run.costMinor/100).toFixed(2)}</td>
            </tr>)}
            {runs.length===0&&<tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No recent run.</td></tr>}
          </tbody>
        </table>
      </div>
      {runs.length>5&&<><Button type="button" size="sm" variant="ghost" className="mt-3 w-full" onClick={()=>{setRunsExpanded(v=>!v);setRunPage(1)}}>
        {runsExpanded?<ChevronUp className="size-4"/>:<ChevronDown className="size-4"/>}{runsExpanded?"Collapse":"Show more ("+runs.length+")"}
      </Button>{runsExpanded&&<Pager page={runPage} pages={runSlice.pages} onPage={setRunPage}/>}</>}
    </CardContent></Card>
  </div>;
}
