param([int]$Iterations = 3, [string]$EvidenceDir = "F:\tmp\evidence AMH v0.3\runs\2026-09\AMH-20260922-PILTOVER-H2-5\evidence")
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
$results = @()
for ($i = 1; $i -le $Iterations; $i++) {
  $started = Get-Date
  $log = Join-Path $EvidenceDir ("soak-iteration-{0}.log" -f $i)
  $output = & npx vitest run tests/piltover/h2-provider-connections.test.ts tests/piltover/h2-durable-publishing.test.ts tests/piltover/h2-live-data-attribution.test.ts tests/piltover/h2-multibrand-governance.test.ts tests/piltover/h2-beta-closure.test.ts 2>&1
  $exit = $LASTEXITCODE
  $output | Set-Content -Path $log -Encoding utf8
  $results += [pscustomobject]@{ iteration=$i; startedAt=$started.ToString("o"); endedAt=(Get-Date).ToString("o"); exitCode=$exit; log=$log }
  if ($exit -ne 0) { break }
}
$incidents = @($results | Where-Object { $_.exitCode -ne 0 })
$summary = [pscustomobject]@{ kind="LOCAL_DETERMINISTIC_SOAK"; evidenceLevel="E2"; iterationsRequested=$Iterations; iterationsCompleted=$results.Count; pass=($results.Count -eq $Iterations -and $incidents.Count -eq 0); incidents=$incidents; limitation="Does not establish real-provider E3 beta soak."; results=$results }
$summary | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $EvidenceDir "soak-summary.json") -Encoding utf8
$summary | ConvertTo-Json -Depth 6
if (-not $summary.pass) { exit 1 }