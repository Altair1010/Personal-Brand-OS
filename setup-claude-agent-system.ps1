<#
.SYNOPSIS
    Unified Claude Code agent-system installer.

.DESCRIPTION
    Cai + wire mot he thong agent hoan chinh vao bat ky repo nao:
      - Token pipeline 4 lop: headroom (cache+context) -> rtk (CLI output) ->
        codebase-memory-mcp/token-optimizer-mcp (file-read/grep) -> caveman (response prose)
      - Foundation files: CLAUDE/AGENTS/MEMORY/SPEC/RULES/STATE/LOOP/plan/todo.md
      - Hooks: PreToolUse(rtk, cbm) / PostToolUse(context-counter) / SessionEnd(headroom learn)
      - Skills auto vs manual mapping; MCP servers; index khoi tao
    Idempotent: chay lai an toan. Pause-on-fail: buoc nao loi -> hoi [F]ix/[S]kip/[A]bort.

.PARAMETER ProjectPath  Repo can setup. Mac dinh = thu muc chua chinh file script ($PSScriptRoot).
.PARAMETER SkipGlobal   Bo qua cai global tool, chi sinh foundation files + settings.
.PARAMETER SkipPython   Bo qua python tool (headroom).
.PARAMETER SkipPlugins  Bo qua Claude Code plugins.
.PARAMETER Auto         Khong pause khi fail (CI mode) -> ghi [FAIL] va di tiep.
.PARAMETER Force        Ghi de foundation files + hooks da ton tai (regenerate). settings.json/.mcp.json van merge.
.PARAMETER ResumeFrom   Ten step de resume sau khi fix thu cong.
#>
[CmdletBinding()]
param(
    [string]$ProjectPath = $(if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }),
    [switch]$SkipGlobal,
    [switch]$SkipPython,
    [switch]$SkipPlugins,
    [switch]$Auto,
    [switch]$Force,
    [string]$ResumeFrom,
    # Secret cho context7. KHONG bao gio hardcode trong file tracked (script nay committed).
    # Nguon DUY NHAT = $env:CONTEXT7_API_KEY (user-scope, ngoai repo). Init se ghi no vao
    # .claude/settings.local.json (gitignored); .mcp.json chi giu placeholder ${CONTEXT7_API_KEY}.
    # Set 1 lan:  setx CONTEXT7_API_KEY "ctx7sk-..."   (hoac truyen -Context7ApiKey khi chay).
    [string]$Context7ApiKey = $env:CONTEXT7_API_KEY
)

$ErrorActionPreference = 'Continue'
$script:Successes = @()
$script:Failures  = @()
$script:Skips     = @()
$script:Started   = $false   # cho ResumeFrom gate

# ============================================================
# INFRA HELPERS
# ============================================================
function Write-Step { param([string]$M) Write-Host "==> $M" -ForegroundColor Cyan }
function Write-Ok   { param([string]$M) Write-Host "    [OK]   $M" -ForegroundColor Green;  $script:Successes += $M }
function Write-Skip { param([string]$M) Write-Host "    [SKIP] $M" -ForegroundColor Yellow; $script:Skips     += $M }
function Write-Fail { param([string]$M) Write-Host "    [FAIL] $M" -ForegroundColor Red;    $script:Failures  += $M }
function Write-Info { param([string]$M) Write-Host "    $M" -ForegroundColor Gray }

function Test-CommandExists { param([string]$Name) return [bool](Get-Command $Name -ErrorAction SilentlyContinue) }

# caveman cai nhu skill (khong luon co CLI). True neu co CLI hoac plugin/skill caveman.
function Test-CavemanInstalled {
    if (Test-CommandExists 'caveman') { return $true }
    $userHome = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
    foreach ($p in @(
        (Join-Path $userHome '.claude/skills/caveman'),
        (Join-Path $userHome '.claude/plugins/cache/caveman'),
        (Join-Path $userHome '.claude/plugins/marketplaces/caveman')
    )) { if (Test-Path $p) { return $true } }
    return $false
}

# codebase-memory-mcp: npm global package. Full path neu PATH chua refresh (session vua npm i -g), else ten lenh.
function Get-CbmCmd {
    $c = Get-Command 'codebase-memory-mcp' -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    # npm global bin: Win -> %APPDATA%\npm\*.cmd ; mac/linux -> prefix/bin
    if ($script:IsWin -and $env:APPDATA) {
        $cmd = Join-Path $env:APPDATA 'npm\codebase-memory-mcp.cmd'
        if (Test-Path $cmd) { return $cmd }
    }
    try {
        $prefix = (& npm prefix -g 2>$null)
        if ($prefix) {
            foreach ($p in @(
                (Join-Path $prefix 'codebase-memory-mcp.cmd'),
                (Join-Path $prefix 'bin/codebase-memory-mcp')
            )) { if (Test-Path $p) { return $p } }
        }
    } catch {}
    return $null
}
function Test-CbmInstalled { return [bool](Get-CbmCmd) }

# rtk binary: uu tien full path cargo bin (hook chay duoc ngay ca khi PATH chua refresh),
# fallback ve lenh tren PATH. Dung cho PreToolUse hook `rtk hook claude`.
# Path tra ve DUNG forward-slash: hook command chay qua bash (/usr/bin/bash), bash nuot
# backslash cua path Windows -> `C:\Users\...` thanh `C:Users...` = command not found.
function Get-RtkCmd {
    $userHome = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
    $cargoExe = if ($script:IsWin) { Join-Path $userHome '.cargo\bin\rtk.exe' }
                else                { Join-Path $userHome '.cargo/bin/rtk' }
    if (Test-Path $cargoExe) { return ($cargoExe -replace '\\','/') }
    $c = Get-Command 'rtk' -ErrorAction SilentlyContinue
    if ($c) { return ($c.Source -replace '\\','/') }
    return $null
}

# OS detection robust cho ca Windows PowerShell 5.1 ($IsWindows khong ton tai) lan pwsh 7+
if ($PSVersionTable.PSEdition -eq 'Desktop') { $script:OS = 'Windows' }
elseif ($IsWindows) { $script:OS = 'Windows' }
elseif ($IsMacOS)   { $script:OS = 'macOS' }
elseif ($IsLinux)   { $script:OS = 'Linux' }
else                { $script:OS = 'Windows' }
$script:IsWin = ($script:OS -eq 'Windows')

# Xac thuc python that su chay duoc (khong phai Microsoft Store stub).
# Windows: 'python'/'python3' thuong la app execution alias -> Get-Command thay nhung chay bao loi.
function Test-PythonRuns {
    param([string]$Exe, [string[]]$PreArgs = @())
    if (-not (Test-CommandExists $Exe)) { return $false }
    try {
        $out = & $Exe @PreArgs '--version' 2>&1
        return ($LASTEXITCODE -eq 0 -and "$out" -match 'Python \d')
    } catch { return $false }
}

# Tim lenh python phu hop. Windows uu tien 'py -3' launcher; mac/linux thuong la python3.
function Get-PythonCmd {
    if ($script:IsWin) {
        if (Test-PythonRuns 'py' @('-3')) { return 'py -3' }
        if (Test-PythonRuns 'python')     { return 'python' }
        if (Test-PythonRuns 'python3')    { return 'python3' }
        return $null
    }
    foreach ($c in @('python3','python','py')) { if (Test-PythonRuns $c) { return $c } }
    return $null
}

function Read-JsonOrEmpty {
    param([string]$Path)
    if (Test-Path $Path) {
        try { return (Get-Content $Path -Raw -Encoding UTF8 | ConvertFrom-Json) }
        catch { return [PSCustomObject]@{} }
    }
    return [PSCustomObject]@{}
}

function Write-JsonFile {
    param([string]$Path, $Obj)
    $json = $Obj | ConvertTo-Json -Depth 30
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $json, $utf8NoBom)
}

function Add-IfMissing {
    param($Parent, [string]$Key, $Value)
    if (-not $Parent.PSObject.Properties[$Key]) {
        $Parent | Add-Member -NotePropertyName $Key -NotePropertyValue $Value -Force
    }
}

# Ghi file text neu thieu. Voi -Force -> ghi de file co san. Tra $true neu da ghi.
function Write-Template {
    param([string]$Path, [string]$Content)
    $exists = Test-Path $Path
    if ($exists -and -not $Force) { Write-Skip "$([System.IO.Path]::GetFileName($Path)) exists (preserved)"; return }
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
    Write-Ok ("{0} {1}" -f $(if ($exists) { 'Overwrote' } else { 'Wrote' }), [System.IO.Path]::GetFileName($Path))
}

# ============================================================
# WSL2 HELPERS
# ============================================================
function Test-WslAvailable {
    if (-not $script:IsWin) { return $false }   # WSL chi co nghia tren Windows
    if (-not (Test-CommandExists 'wsl')) { return $false }
    try { $null = & wsl -e bash -lc 'echo ok' 2>$null; return ($LASTEXITCODE -eq 0) }
    catch { return $false }
}

function Invoke-InWsl {
    param([string]$BashCommand)
    return (& wsl -e bash -lc $BashCommand)
}

# ============================================================
# CHECKPOINT ENGINE  (cot loi: pause-on-fail)
# ============================================================
# Chay scriptblock. Thanh cong -> Write-Ok. Loi -> theo -Auto thi ghi [FAIL] di tiep,
# nguoc lai hoi [F]ix (in huong dan, cho Enter, retry) / [S]kip / [A]bort.
function Invoke-StepWithCheckpoint {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][scriptblock]$Action,
        [string]$FixHint,
        [scriptblock]$Verify   # optional: tra $true neu thanh cong
    )

    # ResumeFrom gate: bo qua moi step truoc step duoc chi dinh
    if ($ResumeFrom -and -not $script:Started) {
        if ($Name -eq $ResumeFrom) { $script:Started = $true }
        else { Write-Skip "$Name (skipped tới ResumeFrom=$ResumeFrom)"; return }
    }

    while ($true) {
        Write-Step $Name
        $ok = $false
        try {
            & $Action
            if ($Verify) { $ok = [bool](& $Verify) } else { $ok = $true }
        } catch {
            Write-Host "    ERROR: $_" -ForegroundColor Red
            $ok = $false
        }

        if ($ok) { Write-Ok $Name; return }

        Write-Fail $Name
        if ($Auto) { Write-Info "(-Auto) bo qua va di tiep"; return }
        if ($FixHint) { Write-Info "FIX: $FixHint" }

        $choice = Read-Host "    [F]ix rồi thử lại / [S]kip / [A]bort (F/S/A)"
        switch ($choice.ToUpper()) {
            'F' { Write-Info "Sau khi fix thu cong, nhan Enter de retry..."; [void](Read-Host); continue }
            'S' { Write-Skip "$Name (user skip)"; return }
            default {
                Write-Host "Abort. Resume bang: .\setup-claude-agent-system.ps1 -ResumeFrom '$Name'" -ForegroundColor Red
                exit 2
            }
        }
    }
}

# ============================================================
# PHASE 1 — PREREQUISITES & COMPATIBILITY
# ============================================================
function Test-Prerequisites {
    Write-Step "Phase 1: Prerequisites"
    $missing = @()
    if (-not (Test-CommandExists 'node'))   { $missing += 'node (>=18)' }
    if (-not (Get-PythonCmd))               { $missing += 'python (>=3.10)' }
    if (-not (Test-CommandExists 'git'))    { $missing += 'git' }
    if (-not (Test-CommandExists 'claude')) { $missing += 'claude (Claude Code CLI)' }
    if ($missing.Count -gt 0) {
        Write-Host "Missing prerequisites:" -ForegroundColor Red
        $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
        exit 1
    }
    Write-Ok "node, python ($(Get-PythonCmd)), git, claude"
}

function Show-CompatibilityReport {
    Write-Step "Compatibility matrix"
    $wsl = Test-WslAvailable
    $nativeBash = (-not $script:IsWin)   # mac/linux cai truc tiep, khong can WSL
    $rows = @(
        @{ Tool='rtk';                  Env=$(if($script:IsWin){'WSL2 (full hook)'}else{'cargo native'});      Have=(Test-CommandExists 'rtk') }
        @{ Tool='headroom';             Env='cross (pipx)';     Have=(Test-CommandExists 'headroom') }
        @{ Tool='codebase-memory-mcp';  Env='cross (npm -g)';    Have=(Test-CbmInstalled) }
        @{ Tool='token-optimizer-mcp';  Env='cross (npm -g)';   Have=(Test-CommandExists 'token-optimizer-mcp') }
        @{ Tool='caveman (skill)';      Env='CC skill (auto-on)'; Have=(Test-CavemanInstalled) }
        @{ Tool='codegraph (giu)';      Env='native';           Have=(Test-CommandExists 'codegraph') }
    )
    Write-Info ("OS: {0}  |  PowerShell: {1}" -f $script:OS, $PSVersionTable.PSVersion)
    if ($script:IsWin) {
        Write-Info ("WSL2 available: {0}" -f $(if ($wsl) { 'YES' } else { 'NO -> tool WSL2-only se bi skip/pause' }))
    } else {
        Write-Info "Native bash: YES (mac/linux cai tool truc tiep, bo qua WSL)"
    }
    foreach ($r in $rows) {
        Write-Info ("  {0,-22} {1,-18} installed={2}" -f $r.Tool, $r.Env, $r.Have)
    }
    return $wsl
}

# ============================================================
# PHASE 2 — GLOBAL INSTALL
# ============================================================
function Install-GlobalTools {
    param([bool]$Wsl)
    if ($SkipGlobal) { Write-Skip "Global install (-SkipGlobal)"; return }

    # rtk (Windows: WSL2 | mac/linux: cargo native)
    Invoke-StepWithCheckpoint -Name 'global:rtk' `
        -FixHint 'rtk (Rust Token Killer): Windows -> WSL2; mac/linux -> cargo install rtk. Verify: rtk gain' `
        -Action {
            if (Test-CommandExists 'rtk') { Write-Info 'rtk da co'; return }
            if ($script:IsWin) {
                if (-not $Wsl) { throw 'WSL2 khong san sang cho rtk' }
                Invoke-InWsl 'command -v rtk >/dev/null 2>&1 || (cargo install rtk 2>/dev/null || true)'
            } else {
                if (-not (Test-CommandExists 'cargo')) { throw 'Can cargo de cai rtk (brew install rust / rustup)' }
                & cargo install rtk
            }
        } `
        -Verify { (Test-CommandExists 'rtk') -or ($script:IsWin -and $Wsl -and ((Invoke-InWsl 'command -v rtk >/dev/null 2>&1 && echo y') -match 'y')) }

    # headroom (pipx)
    if (-not $SkipPython) {
        Invoke-StepWithCheckpoint -Name 'global:headroom' `
            -FixHint 'pipx install headroom-ai[all]  (hoac uv tool install). Verify: headroom --version' `
            -Action {
                if (Test-CommandExists 'headroom') { Write-Info 'headroom da co'; return }
                if (Test-CommandExists 'pipx') { & pipx install 'headroom-ai[all]' }
                elseif (Test-CommandExists 'uv') { & uv tool install 'headroom-ai' }
                else { throw 'Khong co pipx/uv de cai headroom' }
            } `
            -Verify { Test-CommandExists 'headroom' }
    } else { Write-Skip 'headroom (-SkipPython)' }

    # codebase-memory-mcp — npm global package (bin: codebase-memory-mcp -> bin.js)
    Invoke-StepWithCheckpoint -Name 'global:codebase-memory-mcp' `
        -FixHint 'npm i -g codebase-memory-mcp  (bin lands: Win %APPDATA%\npm\codebase-memory-mcp.cmd). Verify: codebase-memory-mcp --help' `
        -Action {
            if (Test-CbmInstalled) { Write-Info 'codebase-memory-mcp da co'; return }
            & npm install -g codebase-memory-mcp
            if ($LASTEXITCODE -ne 0) { throw "npm install exit $LASTEXITCODE" }
        } `
        -Verify { Test-CbmInstalled }

    # token-optimizer-mcp (npm -g)
    Invoke-StepWithCheckpoint -Name 'global:token-optimizer-mcp' `
        -FixHint 'npm i -g token-optimizer-mcp  (xac nhan ten package dung).' `
        -Action {
            if (Test-CommandExists 'token-optimizer-mcp') { return }
            & npm install -g token-optimizer-mcp
            if ($LASTEXITCODE -ne 0) { throw "npm install exit $LASTEXITCODE" }
        } `
        -Verify { Test-CommandExists 'token-optimizer-mcp' }

    # caveman — Claude Code SKILL (auto-on, in-agent), KHONG phai CLI. Official installer.
    Invoke-StepWithCheckpoint -Name 'global:caveman' `
        -FixHint 'caveman (JuliusBrussee/caveman) la skill. Win: irm https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.ps1 | iex. mac/linux: curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh | bash.' `
        -Action {
            if (Test-CavemanInstalled) { Write-Info 'caveman skill da co'; return }
            if ($script:IsWin) {
                Invoke-Expression (Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.ps1' -UseBasicParsing).Content
            } else {
                & bash -lc 'curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh | bash'
            }
        } `
        -Verify { Test-CavemanInstalled }

    # loop tools
    Invoke-StepWithCheckpoint -Name 'global:loop-tools' `
        -FixHint 'npm i -g @mindfold-ai/trellis claude-loop  (xac nhan ten package).' `
        -Action {
            if (-not (Test-CommandExists 'trellis')) { & npm install -g trellis 2>$null }
            if (-not (Test-CommandExists 'claude-loop')) { & npm install -g claude-loop 2>$null }
            if (-not (Test-CommandExists 'trellis') -and -not (Test-CommandExists 'claude-loop')) {
                throw 'Khong cai duoc trellis/claude-loop'
            }
        }

    # plugins
    if (-not $SkipPlugins) {
        Invoke-StepWithCheckpoint -Name 'global:plugins' `
            -FixHint 'Trong Claude Code: /plugin install <slug>' `
            -Action {
                $plugins = @(
                    @{ Mkt='forrestchang/andrej-karpathy-skills'; Slug='andrej-karpathy-skills@karpathy-skills' },
                    @{ Mkt='revfactory/harness';                  Slug='harness@harness-marketplace' }
                )
                foreach ($p in $plugins) {
                    $null = & claude plugin marketplace add $p.Mkt 2>$null
                    $null = & claude plugin install $p.Slug 2>$null
                }
            }
    } else { Write-Skip 'plugins (-SkipPlugins)' }
}

# ============================================================
# PHASE 3 — PER-PROJECT
# ============================================================
# Doc thu muc de tro dung path: liet ke *.md top-level + folder tai lieu -> markdown bullets cho SPEC.md.
function Get-ProjectDocRefs {
    param([string]$Root)
    $skip = @('CLAUDE.md','AGENTS.md','MEMORY.md','SPEC.md','RULES.md','STATE.md','LOOP.md','plan.md','todo.md','README.md')
    $bullets = @()
    Get-ChildItem -Path $Root -Filter '*.md' -File -ErrorAction SilentlyContinue |
        Where-Object { $skip -notcontains $_.Name } |
        ForEach-Object { $bullets += "- ``$($_.Name)``" }
    Get-ChildItem -Path $Root -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notmatch '^\.' -and $_.Name -notin @('node_modules','.git') } |
        Where-Object { @(Get-ChildItem $_.FullName -Filter '*.md' -File -ErrorAction SilentlyContinue).Count -gt 0 } |
        ForEach-Object { $bullets += "- ``$($_.Name)/`` (doc folder)" }
    if ($bullets.Count -eq 0) { return '- (no source docs detected yet — add spec/reference files to project root)' }
    return ($bullets -join "`n")
}

function Get-ProjectType {
    param([string]$Root)
    if (Test-Path (Join-Path $Root 'package.json'))     { return 'Node' }
    if (Test-Path (Join-Path $Root 'pyproject.toml'))   { return 'Python' }
    if (Test-Path (Join-Path $Root 'go.mod'))           { return 'Go' }
    if (Test-Path (Join-Path $Root 'Cargo.toml'))       { return 'Rust' }
    return 'Other'
}

function New-ClaudeDirTree {
    param([string]$Root)
    $dirs = @(
        '.claude','.claude/skills','.claude/commands','.claude/agents','.claude/hooks',
        '.trellis','.trellis/spec','.trellis/tasks','.trellis/workspace','.claude-loop'
    )
    foreach ($d in $dirs) {
        $p = Join-Path $Root $d
        if (-not (Test-Path $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
    }
    Write-Ok "Cay thu muc .claude/ .trellis/ .claude-loop/"
}

function Write-FoundationFiles {
    param([string]$Root, [string]$ProjType)

    Write-Template (Join-Path $Root 'CLAUDE.md') @'
# CLAUDE.md — master instructions

> **Language policy** (three separate rules — do not conflate):
> 1. **Replies to the user: ALWAYS Vietnamese**, unconditionally, with full
>    diacritics — every message you send the user, regardless of what language the
>    surrounding files are in. Only literal code identifiers, commands, and
>    verbatim quotes stay in their original form.
> 2. **Bootstrap scaffold files** — THIS file and AGENTS / MEMORY / SPEC / RULES /
>    STATE / LOOP / plan / todo — are authored in **English** for precision and to
>    match tool/agent prompts.
> 3. **Work-product files you create later** during tasks (notes, docs, commit
>    messages) default to **Vietnamese**, unless English is required: code
>    identifiers, external API field names, verbatim quotes, or when the user
>    explicitly asks for English.

---

# PHẦN A — DỰ ÁN (project-specific)

> **Empty on a fresh scaffold.** Merge the project's `CLAUDE.project.md` (output of the
> Idea->Docs master prompt) into this part, then run the scaffold-customizer master prompt
> to restructure it. Everything project-specific lives here: onboarding / read order for
> the project docs, locked constraints (scope, enum source, AI call pattern, versioning &
> attribution), code conventions, seed/domain, and the per-milestone Definition of Done.
> The MVP docs are the single source of truth — this part points to them, it does not
> re-state them.

(chưa có nội dung — điền từ `CLAUDE.project.md`)

---

# PHẦN B — PHƯƠNG PHÁP LÀM VIỆC (engine, mọi dự án)

## 0. Prime directives
- Answer briefly. No restating the prompt, no filler prose (the caveman skill is auto-on).
- Think before coding (see the verbatim Karpathy Guidelines in §4). Make surgical changes only.
- Define a verifiable success criterion before you start; loop until it is met.

## 1. Codebase analysis priority
- Query the graph FIRST: `codegraph` / `codebase-memory-mcp`. They return verbatim
  source grouped by symbol — Read-equivalent and sub-millisecond.
- Fall back to `grep`/`glob` ONLY when the graph cannot answer. Never read
  file-by-file if the graph suffices.

## 2. Token budget
- Target: context window **< 50%**. When exceeded, compress or archive to MEMORY.md.
- 4-layer compression pipeline (ordering + anti-conflict rules live in RULES.md):
  `headroom` (cache+context) -> `rtk` (CLI output) ->
  `token-optimizer` / `codebase-memory` (file-read/graph) -> `caveman` (in-agent prose).

## 3. Continuous work loop (plan.md + todo.md)
- Every task session: read STATE.md, plan.md and todo.md BEFORE acting; pick the
  highest-priority open item.
- Keep plan.md and todo.md updated LIVE as you work: check items off, append
  checkpoints in the form `[HH:MM] step -> verify result`.
- When a goal is fully verified done: delete plan.md and todo.md (or archive the
  decision into MEMORY.md). Never leave them stale.
- Full lifecycle rules: RULES.md > "plan.md & todo.md lifecycle".

## 3a. Scaffold file maintenance (live protocol — keep these current, never stale)
Files live in the project root.

### Read order (every session start — read BEFORE acting, in this order)
1. **`STATE.md`** — sprint view: where we are, what's next, what's blocked.
2. **`plan.md`** + **`todo.md`** — the active task's live "how" + checklist (skip if empty).
3. **`MEMORY.md`** — lasting decisions/patterns/bug-workarounds so you don't relitigate.
4. **`RULES.md`** — hard rules (project + engine) that gate every change.
5. **`SPEC.md`** — Goal/Scope/Acceptance contract; re-read when scope is in question.
6. **`LOOP.md`** — pick which loop to run (milestone loop vs triage loop).
7. **`AGENTS.md`** — only when delegating/orchestrating sub-agents.
> Then, for project work, read ONLY the current milestone's section (per PHẦN A onboarding).
> Stop reading once you have enough to act (Prime directive §0).

### Update triggers — each file has one job; update the right one at the right moment:
- **`LOOP.md`** — whenever a task appears that needs a repeatable, effective *thinking
  journey* (a reusable loop worth naming), define or refine that loop here.
- **`MEMORY.md`** — after **every** task is done: distill the lasting decision/pattern
  here *before* clearing plan.md/todo.md. One entry = one fact.
- **`plan.md`** — when a new plan forms. In **plan mode**, write the plan to `plan.md`
  and reference its path — do NOT paste hundreds of plan lines into CLAUDE.md or the chat.
- **`todo.md`** — add the checklist for the active task; tick items as you go.
- **`RULES.md`** — append a project rule the moment a new hard constraint surfaces.
- **`SPEC.md`** — keep the Trellis spec (Goal / Scope / Acceptance) in sync when scope changes.
- **`STATE.md`** — sprint-level view; agent-managed. Update at session start/end.

## 4. Karpathy Guidelines (VERBATIM — do not summarize)

> Behavioral guidelines to reduce common LLM coding mistakes, derived from Andrej
> Karpathy's observations on LLM coding pitfalls.
> **Tradeoff:** these guidelines bias toward caution over speed. For trivial
> tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" -> "Write tests for invalid inputs, then make them pass"
- "Fix the bug" -> "Write a test that reproduces it, then make it pass"
- "Refactor X" -> "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work")
require constant clarification.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer
rewrites due to overcomplication, and clarifying questions come before
implementation rather than after mistakes.

## 5. Skills
- **Auto:** codebase-memory, token-optimizer, headroom, rtk, caveman, context-monitor, harness, karpathy.
- **Manual:** playwright, context7, evolver, claude-loop batch, docx/pdf/pptx/xlsx, GSD spec.
'@

    Write-Template (Join-Path $Root 'AGENTS.md') @'
# AGENTS.md — agent definitions & orchestration

## Roles

| Agent | Responsibility | Boundary |
|---|---|---|
| triage      | Read STATE.md + plan.md + todo.md; pick the highest-priority task. | Coordinates only. Writes no code. |
| researcher  | context7 + web + graph queries; synthesize findings into plan.md. | Read-only. Never edits code. |
| implementer | Apply the code change for one task item. | Isolated worktree. Surgical changes (Karpathy §3). |
| verifier    | Run tests + lint + type-checks against the Done criteria. | Isolated worktree. Reports pass/fail; does not "fix" silently. |

## Orchestration flow
1. **triage** -> selects the next open item, updates todo.md `## Now`.
2. **researcher** -> gathers context (graph first, grep fallback), records assumptions + plan in plan.md.
3. **implementer** -> makes the minimal change; appends a checkpoint to plan.md.
4. **verifier** -> checks the Done criteria; on pass, triage moves the item to `## Done`
   and records any lasting decision in MEMORY.md.

## Project sub-agents (spawnable — `.claude/agents/<proj>-*.md`)
> Empty on a fresh scaffold. The scaffold-customizer master prompt fills this from the
> project docs — one specialized agent per hard-constrained layer (e.g. scope-guard,
> prompt-engineer, data-modeler, milestone-verifier). Register each as a table row here.

| Agent | Use when | Mode |
|---|---|---|
| (none yet) | | |

## Escalate to the user when
- A hard stop in RULES.md is hit.
- The change is irreversible (delete/overwrite/push) and not yet authorized.
- The same step fails twice in a row (see RULES.md > Agent escalation).
'@

    Write-Template (Join-Path $Root 'MEMORY.md') @'
# MEMORY.md — persistent decisions & patterns

> Long-lived knowledge. When a plan.md/todo.md goal is done, distill any lasting
> decision here before deleting those files. One entry = one fact; keep it terse.

## Architecture decisions log
<!-- [YYYY-MM-DD] Decision — why — alternatives rejected -->
- (none yet)

## Convention tracker
<!-- naming, structure, style rules discovered in this repo -->
- (none yet)

## Bug workaround registry
<!-- symptom -> root cause -> workaround -> permanent fix ref -->
- (none yet)

## headroom learn output
<!-- `headroom learn --apply` (SessionEnd hook) appends mined patterns here -->
'@

    $docRefs = Get-ProjectDocRefs -Root $Root
    Write-Template (Join-Path $Root 'SPEC.md') @"
# SPEC.md — project spec (Trellis-compatible)

> Project type: $ProjType
> This is a stub. Flesh out Goal / Scope / Acceptance from the source docs below.

## Source docs (auto-detected in project root)
$docRefs

## Goal
- (describe the objective)

## Scope
- In scope: (…)
- Out of scope: (…)

## Acceptance criteria
- (verifiable conditions — each should map to a check the verifier can run)
"@

    Write-Template (Join-Path $Root 'RULES.md') @'
# RULES.md — hard rules

## Hard stops (never do these without explicit user authorization)
- Do NOT delete or overwrite files you did not create without confirming first.
- Do NOT push straight to `main`; always branch + PR.
- Do NOT skip hooks or bypass signing (`--no-verify`, `--no-gpg-sign`).
- Do NOT send project content to external services without authorization.

## Secrets & API keys (never leak on push)
- NEVER put a real secret/API key in a tracked file (`.mcp.json`, `settings.json`,
  source, docs). Tracked files reference secrets ONLY via `${ENV_VAR}` placeholders.
- Real secrets live in `.claude/settings.local.json` under the `env` block — this file
  is gitignored (`.claude/.gitignore`). Claude Code injects `env` and expands the
  `${ENV_VAR}` placeholders in `.mcp.json` at MCP launch.
- Example: `.mcp.json` has `"CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}"`; the real value
  sits in `settings.local.json` → `env.CONTEXT7_API_KEY`.
- Before any commit/push: verify no raw key (`ctx7sk-`, `sk-`, tokens) appears in
  `git diff --cached`. If found, move it to `settings.local.json` and re-placeholder.

## Code style
- Match the existing style. Surgical changes only (Karpathy §3). No out-of-scope refactors.
- Every changed line must trace directly to the user's request.

## Commit format
- Conventional-ish, concise. Commit body may be Vietnamese (per CLAUDE.md language policy).

## Compression order (ANTI-CONFLICT — the 4 layers are order-locked)
1. **headroom** CacheAligner: stabilize the prefix for cache hits. Runs earliest.
2. **rtk**: compress ONLY the OUTPUT of Bash/Grep/Glob (CLI). Never for file-read.
3. **token-optimizer-mcp / codebase-memory-mcp**: replace file-read/grep with smart_read + graph.
4. **caveman**: in-agent skill (auto-on). Trims PROSE in the RESPONSE only — never code/JSON.
> Each layer handles a DIFFERENT payload type -> never compress the same payload twice.

## plan.md & todo.md lifecycle
- **Create** at task start (or reuse the existing files); do not start real work without them.
- **Update after every step**: tick todo.md items, append a plan.md checkpoint
  `[HH:MM] step -> verify result`.
- **Keep in sync**: plan.md (the how) <-> todo.md (the checklist) <-> STATE.md (the sprint view).
- **Never leave stale**: if you paused mid-task, the files must reflect reality.
- **Delete when done**: once the Done criteria are verified, remove plan.md and todo.md;
  promote any lasting decision into MEMORY.md.

## Agent escalation
- Same step fails twice in a row -> stop and ask the user.

## Project hard rules (fill per project docs — non-negotiable)
> Empty on a fresh scaffold. The scaffold-customizer master prompt appends >=5 rules here,
> derived from the MVP docs' locked constraints (scope lock, enum source, AI call pattern,
> versioning & attribution, review gate, per-milestone Done). Point to the docs; do not
> re-state them at length.
- (none yet)
'@

    Write-Template (Join-Path $Root 'STATE.md') @'
# STATE.md — loop state tracker

> Sprint-level view. Read this first each session, then drill into plan.md (the how)
> and todo.md (the checklist). Keep all three in sync (see RULES.md).

## Sprint goals
- (none yet)

## In-progress
- (empty)

## Blocked
- (empty — record blockers with the reason and what would unblock them)

## Completed this session
- (empty)
'@

    Write-Template (Join-Path $Root 'LOOP.md') @'
# LOOP.md — loop definitions

## Daily triage loop
1. Read STATE.md + plan.md + todo.md.
2. Pick the highest-priority open item (triage).
3. Implement it (surgical change) -> update plan.md/todo.md.
4. Verify against the Done criteria.
5. On pass: move item to Done, sync STATE.md, distill decisions to MEMORY.md.

## Milestone execution loop (the thinking journey for a spec-driven Mx task)
> One milestone per `/clear` session. Default loop for project (milestone) work.
1. `/clear`, then read ONLY the milestone's section of the execution doc (+ files it
   lists). Do not read the whole doc — protect context.
2. Write plan.md (Context/Goal/Assumptions/Steps/Done) + todo.md checklist for this Mx.
3. Implement per-step, surgical. After each step append `[HH:MM] step -> verify` to
   plan.md and tick todo.md. When context >70%: commit, `/clear`, resume from plan.md.
4. VERIFY: build clean + the milestone VERIFY block + feature-spec acceptance + seed
   idempotent. Fail -> fix, re-run; same step fails twice -> escalate (RULES.md).
5. On pass: commit `Mx: <goal>`, distill the lasting decision to MEMORY.md, delete
   plan.md/todo.md, update STATE.md (move Mx to Completed, set Next = M(x+1)).

## Goal conditions (/goal syntax)
- /goal: tests pass && lint clean && build ok

## Verifier
- agent: verifier (tests + lint + type-checks, isolated worktree).
- Verifier checks the "Done criteria" section of plan.md — not a vague "make it work".

## Cost caps per run
- max_iterations: 10 | max_tokens: 200k | max_duration: 30m | max_cost: $5
'@

    Write-Template (Join-Path $Root 'plan.md') @'
# plan.md — live execution plan

> LIVE FILE. Continuously updated while a task is in flight. Read it (with todo.md
> and STATE.md) before acting. DELETE it once the Done criteria are verified — then
> promote any lasting decision into MEMORY.md. See RULES.md > "plan.md & todo.md lifecycle".

## Context
- (why this task exists; the problem/need it addresses)

## Goal
- (one verifiable success criterion — Karpathy §4)

## Assumptions
- (state assumptions explicitly; if uncertain, ask before coding — Karpathy §1)

## Steps
1. [step] -> verify: [check]
2. [step] -> verify: [check]
3. [step] -> verify: [check]

## Checkpoints (append-only log)
- [HH:MM] (step) -> (verify result)

## Done criteria
- (the exact conditions the verifier must confirm before this task is closed)
'@

    Write-Template (Join-Path $Root 'todo.md') @'
# todo.md — live checklist

> LIVE FILE. Keep in sync with plan.md (the how) and STATE.md (the sprint view).
> Tick items as you go; DELETE this file when the task is fully done (see RULES.md).

## Now
- [ ] (the single item currently in progress)

## Next
- [ ] (queued items, highest priority first)

## Blocked
- [ ] (item) — blocked by: (reason) — unblocks when: (condition)

## Done
- [x] (completed items — cleared when the task closes)
'@
}

function Write-HookWrappers {
    param([string]$Root, [bool]$Wsl)
    $hooks = Join-Path $Root '.claude/hooks'

    # context-counter.py dung chung ca 2 OS (Claude se goi bang python/python3 o settings)
    Write-Template (Join-Path $hooks 'context-counter.py') @'
#!/usr/bin/env python3
# context-counter.py — PostToolUse: uoc luong % context window (placeholder)
import sys
data = sys.stdin.read()
# TODO: noi vao headroom stats neu co. Hien chi pass-through, khong chan.
print(data, end="")
'@ | Out-Null

    if ($script:IsWin) {
        # ---- Windows: wrapper .ps1 (co the bao wsl) ----
        $rtkInWsl = $Wsl -and -not (Test-CommandExists 'rtk')
        $rtkBody = if ($rtkInWsl) {
@'
# rtk-rewrite.ps1 — PreToolUse(Bash): nen CLI output 60-91%
$in = $input | Out-String
$in | wsl -e bash -lc 'rtk rewrite' 2>$null
if ($LASTEXITCODE -ne 0) { $in }
'@
        } else {
@'
# rtk-rewrite.ps1 — PreToolUse(Bash): nen CLI output 60-91%
$in = $input | Out-String
if (Get-Command rtk -ErrorAction SilentlyContinue) { $in | rtk rewrite } else { $in }
'@
        }
        Write-Template (Join-Path $hooks 'rtk-rewrite.ps1') $rtkBody | Out-Null

        Write-Template (Join-Path $hooks 'cbm-discovery.ps1') @'
# cbm-discovery.ps1 — PreToolUse(Grep|Glob): goi y dung graph query thay grep
$in = $input | Out-String
$in  # passthrough; gate logic o settings matcher
'@ | Out-Null

        $learnBody = if ($Wsl -and -not (Test-CommandExists 'headroom')) {
@'
# session-learner.ps1 — SessionEnd: mine failures -> CLAUDE.md/MEMORY.md
wsl -e bash -lc 'headroom learn --apply' 2>$null
'@
        } else {
@'
# session-learner.ps1 — SessionEnd: mine failures -> CLAUDE.md/MEMORY.md
if (Get-Command headroom -ErrorAction SilentlyContinue) { headroom learn --apply 2>$null }
'@
        }
        Write-Template (Join-Path $hooks 'session-learner.ps1') $learnBody | Out-Null

    } else {
        # ---- mac/linux: wrapper .sh native + chmod +x ----
        $rtkSh = Join-Path $hooks 'rtk-rewrite.sh'
        Write-Template $rtkSh @'
#!/usr/bin/env bash
# rtk-rewrite.sh — PreToolUse(Bash): nen CLI output 60-91%
input=$(cat)
if command -v rtk >/dev/null 2>&1; then printf '%s' "$input" | rtk rewrite; else printf '%s' "$input"; fi
'@ | Out-Null

        $cbmSh = Join-Path $hooks 'cbm-discovery.sh'
        Write-Template $cbmSh @'
#!/usr/bin/env bash
# cbm-discovery.sh — PreToolUse(Grep|Glob): passthrough (gate o settings matcher)
cat
'@ | Out-Null

        $learnSh = Join-Path $hooks 'session-learner.sh'
        Write-Template $learnSh @'
#!/usr/bin/env bash
# session-learner.sh — SessionEnd: mine failures -> CLAUDE.md/MEMORY.md
command -v headroom >/dev/null 2>&1 && headroom learn --apply 2>/dev/null || true
'@ | Out-Null

        foreach ($f in @($rtkSh,$cbmSh,$learnSh,(Join-Path $hooks 'context-counter.py'))) {
            if (Test-Path $f) { & chmod +x $f 2>$null }
        }
    }
}

function Write-ProjectSettings {
    param([string]$Root)
    $claudeDir = Join-Path $Root '.claude'
    $settingsPath = Join-Path $claudeDir 'settings.json'
    $settings = Read-JsonOrEmpty $settingsPath

    # 1. Permissions (giu cu + them). rtk mirror: moi lenh nguy hiem co ca ban goc lan
    #    ban prefix 'rtk ' vi hook rewrite `git push` -> `rtk git push` -> rule phai khop ca hai.
    Add-IfMissing $settings 'permissions' ([PSCustomObject]@{ allow = @() })
    Add-IfMissing $settings.permissions 'allow' @()
    $defaultAllow = @(
        'Bash(rtk:*)',
        'mcp__codegraph__*','mcp__context7__*','mcp__playwright__*',
        'mcp__codebase-memory-mcp__*','mcp__token-optimizer-mcp__*','mcp__headroom__*'
    )
    $existing = @($settings.permissions.allow)
    $toAdd = $defaultAllow | Where-Object { $existing -notcontains $_ }
    if ($toAdd.Count -gt 0) { $settings.permissions.allow = @($existing + $toAdd) }

    # deny/ask: destructive commands mirror (goc + 'rtk ' prefix). Merge, khong ghi de.
    $defaultDeny = @(
        'Bash(rm -rf /:*)','Bash(rm -fr /:*)','Bash(rm -rf ~:*)',
        'Bash(rtk rm -rf /:*)','Bash(rtk rm -fr /:*)','Bash(rtk rm -rf ~:*)',
        'Bash(dd:*)','Bash(rtk dd:*)','Bash(mkfs:*)','Bash(rtk mkfs:*)',
        'Bash(sudo:*)','Bash(rtk sudo:*)',
        'Bash(shutdown:*)','Bash(reboot:*)','Bash(rtk shutdown:*)','Bash(rtk reboot:*)',
        'Bash(mkfs.ext4:*)','Bash(mkfs.xfs:*)',
        'Bash(halt:*)','Bash(poweroff:*)','Bash(init 0:*)','Bash(init 6:*)',
        'PowerShell(Format-Volume:*)','PowerShell(Format-Disk:*)','PowerShell(Clear-Disk:*)',
        'PowerShell(Initialize-Disk:*)','PowerShell(diskpart:*)','PowerShell(Stop-Computer:*)',
        'PowerShell(Restart-Computer:*)','PowerShell(Remove-Item C:\ *)',
        'PowerShell(Remove-Item -Path C:\ *)','PowerShell(rd /s /q C:\ *)'
    )
    $defaultAsk = @(
        'Bash(rm:*)','Bash(rtk rm:*)','Bash(rmdir:*)','Bash(rtk rmdir:*)',
        'Bash(git push --force:*)','Bash(git push -f:*)','Bash(rtk git push --force:*)','Bash(rtk git push -f:*)',
        'Bash(git reset --hard:*)','Bash(rtk git reset --hard:*)',
        'Bash(git clean:*)','Bash(rtk git clean:*)',
        'Bash(chmod -R:*)','Bash(rtk chmod -R:*)','Bash(chmod 777:*)','Bash(rtk chmod 777:*)',
        'Bash(git checkout --:*)','Bash(rtk git checkout --:*)',
        'Bash(git push:*)','Bash(rtk git push:*)',
        'Bash(curl * | sh)','Bash(curl * | bash)','Bash(wget * | sh)','Bash(wget * | bash)',
        'Bash(chown -R:*)','Bash(rtk chown -R:*)','Bash(mv:*)','Bash(rtk mv:*)',
        'Bash(truncate:*)','Bash(rtk truncate:*)',
        'PowerShell(Remove-Item:*)','PowerShell(rm:*)','PowerShell(del:*)','PowerShell(rmdir:*)',
        'PowerShell(rd:*)','PowerShell(erase:*)','PowerShell(Clear-Content:*)','PowerShell(Clear-Item:*)',
        'PowerShell(Stop-Process:*)','PowerShell(Set-ExecutionPolicy:*)','PowerShell(Remove-ItemProperty:*)',
        'PowerShell(git push:*)','PowerShell(git reset --hard:*)','PowerShell(git clean:*)',
        'PowerShell(git checkout --:*)','PowerShell(Move-Item:*)','PowerShell(Invoke-Expression:*)','PowerShell(iex:*)'
    )
    foreach ($pair in @(@('deny',$defaultDeny), @('ask',$defaultAsk))) {
        $key = $pair[0]; $vals = $pair[1]
        Add-IfMissing $settings.permissions $key @()
        $ex = @($settings.permissions.$key)
        $add = $vals | Where-Object { $ex -notcontains $_ }
        if ($add.Count -gt 0) { $settings.permissions.$key = @($ex + $add) }
    }

    # 2. Hooks (event HOP LE: PostSession -> SessionEnd). Command theo OS.
    $hookDir = '.claude/hooks'
    $py = Get-PythonCmd; if (-not $py) { $py = if ($script:IsWin) { 'py -3' } else { 'python3' } }
    if ($script:IsWin) {
        $cbmCmd   = "powershell -NoProfile -File $hookDir/cbm-discovery.ps1"
        $learnCmd = "powershell -NoProfile -File $hookDir/session-learner.ps1"
    } else {
        $cbmCmd   = "bash $hookDir/cbm-discovery.sh"
        $learnCmd = "bash $hookDir/session-learner.sh"
    }

    # rtk PreToolUse: goi binary that `rtk hook claude` (rewrite engine compile trong binary:
    # git status -> rtk git status, grep/status... filter). Full path -> chay ngay ca khi PATH
    # chua refresh. Khong tim thay -> fallback wrapper shim rtk-rewrite (giu tuong thich cu).
    $rtk = Get-RtkCmd
    if ($rtk) {
        $rtkCmd = "$rtk hook claude"; $rtkMatcher = 'Bash|PowerShell'; $rtkTimeout = $null
    } elseif ($script:IsWin) {
        $rtkCmd = "powershell -NoProfile -File $hookDir/rtk-rewrite.ps1"; $rtkMatcher = 'Bash'; $rtkTimeout = 5
    } else {
        $rtkCmd = "bash $hookDir/rtk-rewrite.sh"; $rtkMatcher = 'Bash'; $rtkTimeout = 5
    }
    $rtkHook = if ($null -ne $rtkTimeout) { [PSCustomObject]@{ type='command'; command=$rtkCmd; timeout=$rtkTimeout } }
               else                       { [PSCustomObject]@{ type='command'; command=$rtkCmd } }

    $ctxCmd = "$py `"$hookDir/context-counter.py`""
    $hooksObj = [PSCustomObject]@{
        PreToolUse = @(
            [PSCustomObject]@{ matcher=$rtkMatcher;  hooks=@($rtkHook) }
            [PSCustomObject]@{ matcher='Grep|Glob'; hooks=@([PSCustomObject]@{ type='command'; command=$cbmCmd; timeout=3 }) }
        )
        PostToolUse = @(
            [PSCustomObject]@{ matcher='Bash|Agent|Write'; hooks=@([PSCustomObject]@{ type='command'; command=$ctxCmd; timeout=3 }) }
        )
        SessionEnd = @(
            [PSCustomObject]@{ hooks=@([PSCustomObject]@{ type='command'; command=$learnCmd; timeout=30 }) }
        )
    }
    $settings | Add-Member -NotePropertyName 'hooks' -NotePropertyValue $hooksObj -Force

    # 3. enabledMcpjsonServers  (headroom KHONG o day: no la user-scope, endpoint = full path .exe.
    #    Neu them vao project .mcp.json se sinh xung dot 2-scope khac endpoint -> OAuth token khong dung chung.)
    $servers = @('codegraph','context7','playwright','codebase-memory-mcp','token-optimizer-mcp')
    if (-not $settings.PSObject.Properties['enabledMcpjsonServers']) {
        Add-IfMissing $settings 'enabledMcpjsonServers' $servers
    } else {
        $ex = @($settings.enabledMcpjsonServers)
        $add = $servers | Where-Object { $ex -notcontains $_ }
        if ($add.Count -gt 0) { $settings.enabledMcpjsonServers = @($ex + $add) }
    }

    Write-JsonFile $settingsPath $settings
    Write-Ok ".claude/settings.json merged (hooks + mcp + permissions)"

    # 4. .mcp.json — them server moi, giu cu
    $mcpPath = Join-Path $Root '.mcp.json'
    $mcp = Read-JsonOrEmpty $mcpPath
    Add-IfMissing $mcp 'mcpServers' ([PSCustomObject]@{})
    $defs = [ordered]@{
        codegraph             = [PSCustomObject]@{ type='stdio'; command='codegraph'; args=@('serve','--mcp') }
        context7              = [PSCustomObject]@{ type='http'; url='https://mcp.context7.com/mcp'; headers=[PSCustomObject]@{ CONTEXT7_API_KEY='${CONTEXT7_API_KEY}' } }
        playwright            = [PSCustomObject]@{ command='npx'; args=@('@playwright/mcp@latest') }
        'codebase-memory-mcp' = [PSCustomObject]@{ command='codebase-memory-mcp'; args=@() }
        'token-optimizer-mcp' = [PSCustomObject]@{ command='npx'; args=@('token-optimizer-mcp') }
        # headroom KHONG khai bao trong .mcp.json: cai user-scope (endpoint = full path .exe).
        # Trung 2-scope khac endpoint -> Claude Code canh bao, OAuth token khong dung chung.
    }
    foreach ($k in $defs.Keys) {
        if (-not $mcp.mcpServers.PSObject.Properties[$k]) {
            $mcp.mcpServers | Add-Member -NotePropertyName $k -NotePropertyValue $defs[$k] -Force
        }
    }
    Write-JsonFile $mcpPath $mcp
    Write-Ok ".mcp.json written (secret giu o placeholder \${CONTEXT7_API_KEY})"

    # 5. Secret -> .claude/settings.local.json (GITIGNORED). .mcp.json chi giu placeholder;
    #    Claude Code doc env tu settings.local.json va expand ${CONTEXT7_API_KEY} luc launch MCP.
    #    => push git khong lo key. Merge, khong ghi de env cu.
    if ($Context7ApiKey) {
        $localPath = Join-Path $claudeDir 'settings.local.json'
        $local = Read-JsonOrEmpty $localPath
        Add-IfMissing $local 'env' ([PSCustomObject]@{})
        if (-not $local.env.PSObject.Properties['CONTEXT7_API_KEY']) {
            $local.env | Add-Member -NotePropertyName 'CONTEXT7_API_KEY' -NotePropertyValue $Context7ApiKey -Force
            Write-JsonFile $localPath $local
            Write-Ok ".claude/settings.local.json <- CONTEXT7_API_KEY (gitignored)"
        } else { Write-Skip "settings.local.json da co CONTEXT7_API_KEY" }
    } else {
        Write-Skip "CONTEXT7_API_KEY chua set -> context7 se thieu key. Set: setx CONTEXT7_API_KEY ""ctx7sk-..."""
    }

    # 6. .claude/.gitignore
    $gi = Join-Path $claudeDir '.gitignore'
    if (-not (Test-Path $gi)) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($gi, "settings.local.json`n", $utf8NoBom)
        Write-Ok ".claude/.gitignore"
    } else { Write-Skip ".claude/.gitignore exists" }
}

# ============================================================
# PHASE 4 — INDEX + TRELLIS + COMPRESS
# ============================================================
function Initialize-Indexes {
    param([string]$Root, [bool]$Wsl)

    # codebase-memory-mcp index — cu phap dung: cli index_repository '{"repo_path":"..."}'
    Invoke-StepWithCheckpoint -Name 'index:codebase-memory' `
        -FixHint 'codebase-memory-mcp cli index_repository ''{"repo_path":"<root>"}''' `
        -Action {
            $cbm = Get-CbmCmd
            if ($cbm) {
                # PS 5.1 nuot dau " khi truyen native -> escape thu cong tren Windows.
                if ($script:IsWin) {
                    $payload = '{\"repo_path\":\"' + ($Root -replace '\\','\\\\') + '\"}'
                } else {
                    $payload = ConvertTo-Json @{ repo_path = $Root } -Compress
                }
                & $cbm cli index_repository $payload
            } elseif ((Test-CommandExists 'codegraph') -and -not (Test-Path (Join-Path $Root '.codegraph'))) {
                Push-Location $Root; try { & codegraph init -i } finally { Pop-Location }
            } else {
                Write-Info 'Khong co indexer kha dung - skip'
            }
        }

    # trellis init: tu chay theo yeu cau. Lenh co the interactive -> feed newline (''),
    # neu treo thi checkpoint cho phep Skip/Abort. Skip neu da init (.trellis/config ton tai).
    if (Test-CommandExists 'trellis') {
        Invoke-StepWithCheckpoint -Name 'trellis:init' `
            -FixHint 'trellis init (chay tai project root). Neu treo -> Ctrl-C roi [S]kip, chay thu cong sau.' `
            -Action {
                if (Test-Path (Join-Path $Root '.trellis/config.json')) { Write-Info 'trellis da init'; return }
                Push-Location $Root
                try { '' | & trellis init } finally { Pop-Location }
            }
    } else {
        Write-Skip 'trellis chua cai'
    }

    # caveman la in-agent skill (auto-on tu message dau, khong co CLI compress) -> khong co buoc compress o day.
    Write-Info 'caveman: skill in-agent, auto-on trong Claude Code (khong can compress thu cong).'
}

# ============================================================
# PHASE 5 — VALIDATION
# ============================================================
function Test-Setup {
    param([string]$Root)
    Write-Step "Phase 5: Validation"
    $settings = Join-Path $Root '.claude/settings.json'
    if (Test-Path $settings) {
        try { Get-Content $settings -Raw | ConvertFrom-Json | Out-Null; Write-Ok 'settings.json hop le JSON' }
        catch { Write-Fail 'settings.json KHONG hop le JSON' }
    }
    $foundation = @('CLAUDE.md','AGENTS.md','MEMORY.md','SPEC.md','RULES.md','STATE.md','LOOP.md','plan.md','todo.md')
    $found = $foundation | Where-Object { Test-Path (Join-Path $Root $_) }
    Write-Ok ("Foundation files: {0}/{1}" -f $found.Count, $foundation.Count)
    Write-Info "Trong Claude Code chay /mcp de xac nhan servers; rtk gain de xem token savings."
}

# ============================================================
# MAIN
# ============================================================
if (-not (Test-Path $ProjectPath)) { Write-Fail "Project path not found: $ProjectPath"; exit 1 }
$ProjectPath = (Resolve-Path $ProjectPath).Path
Write-Host ""
Write-Host "=== setup-claude-agent-system.ps1 ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectPath" -ForegroundColor Gray

Test-Prerequisites
$wsl = Show-CompatibilityReport
$projType = Get-ProjectType -Root $ProjectPath
Write-Info "Project type: $projType"

Install-GlobalTools -Wsl $wsl

Write-Step "Phase 3: Per-project"
New-ClaudeDirTree     -Root $ProjectPath
Write-FoundationFiles -Root $ProjectPath -ProjType $projType
Write-HookWrappers    -Root $ProjectPath -Wsl $wsl
Write-ProjectSettings -Root $ProjectPath

Initialize-Indexes -Root $ProjectPath -Wsl $wsl
Test-Setup -Root $ProjectPath

# ============================================================
# SUMMARY
# ============================================================
Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "  OK:   $($script:Successes.Count)" -ForegroundColor Green
Write-Host "  Skip: $($script:Skips.Count)"     -ForegroundColor Yellow
Write-Host "  Fail: $($script:Failures.Count)"  -ForegroundColor $(if ($script:Failures.Count -eq 0) { 'Green' } else { 'Red' })
if ($script:Failures.Count -gt 0) {
    Write-Host "Failed:" -ForegroundColor Red
    $script:Failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  1. Restart Claude Code trong $ProjectPath de load MCP/hooks moi"
Write-Host "  2. /mcp de xac nhan servers; rtk gain de xem savings"
Write-Host "  3. Resume sau khi fix: .\setup-claude-agent-system.ps1 -ResumeFrom '<step>'"

# Exit code xac dinh (khong ro ri $LASTEXITCODE tu native cmd): 0 = clean, 1 = co fail.
exit $(if ($script:Failures.Count -gt 0) { 1 } else { 0 })
