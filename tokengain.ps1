<#
.SYNOPSIS
    tokengain - bao cao hieu suat tiet kiem token cua toan he thong agent
    (tuong tu 'rtk gain --history' nhung gop CA 4 lop pipeline).

.DESCRIPTION
    Gop so lieu 4 lop nen token do setup-claude-agent-system.ps1 cai:
      1. headroom        - proxy cache+context   (headroom perf --format json)
      2. rtk             - nen CLI output         (rtk gain --format json)
      3. token-optimizer - file-read/grep cache   (~/.token-optimizer-cache/cache.db)
      4. caveman         - nen prose in-agent      (mode log; khong co so tich luy)
    Moi lan chay ghi 1 snapshot vao ~/.claude/tokengain-history.jsonl ->
    -History in lich su + delta (tiet kiem tinh rieng cho phien nay).

.PARAMETER History   In lich su session da luu (khong ghi snapshot moi).
.PARAMETER Project   Loc rtk ve project hien tai (rtk gain -p).
.PARAMETER Last      -History: so snapshot gan nhat can in (mac dinh 15).
.PARAMETER NoLog     Chay bao cao nhung KHONG ghi snapshot moi.
#>
[CmdletBinding()]
param(
    [switch]$History,
    [switch]$Project,
    [int]$Last = 15,
    [switch]$NoLog
)

$ErrorActionPreference = 'Continue'
$userHome  = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
$histPath  = Join-Path $userHome '.claude\tokengain-history.jsonl'
$toCache   = Join-Path $userHome '.token-optimizer-cache\cache.db'
$modeLog   = Join-Path $userHome '.claude\.caveman-mode-log.jsonl'

function Test-Cmd { param([string]$N) return [bool](Get-Command $N -ErrorAction SilentlyContinue) }
function Get-Py {
    foreach ($c in @(@('py','-3'),@('python3'),@('python'))) {
        if (Test-Cmd $c[0]) { return $c }
    }
    return $null
}
# rut gon 12345 -> 12.3K / 1200000 -> 1.2M
function Fmt-N { param([double]$n)
    if ([math]::Abs($n) -ge 1e6) { return ('{0:0.0}M' -f ($n/1e6)) }
    if ([math]::Abs($n) -ge 1e3) { return ('{0:0.0}K' -f ($n/1e3)) }
    return ('{0:0}' -f $n)
}
function Bar { param([double]$pct)
    $f = [int]([math]::Round(($pct/100)*24)); if ($f -lt 0) { $f = 0 }; if ($f -gt 24) { $f = 24 }
    return (('#' * $f) + ('.' * (24 - $f)))
}

# ============================================================
# COLLECTORS - moi lop tra hashtable; loi -> $null (n/a)
# ============================================================
function Get-Rtk {
    if (-not (Test-Cmd 'rtk')) { return $null }
    $ga = @('gain','--format','json'); if ($Project) { $ga += '-p' }
    try {
        $raw = & rtk @ga 2>$null
        $j = ($raw | Out-String | ConvertFrom-Json).summary
        return @{
            saved = [double]$j.total_saved
            input = [double]$j.total_input
            pct   = [double]$j.avg_savings_pct
            cmds  = [int]$j.total_commands
        }
    } catch { return $null }
}

function Get-Headroom {
    if (-not (Test-Cmd 'headroom')) { return $null }
    try {
        $j = (& headroom perf --format json 2>$null | Out-String | ConvertFrom-Json)
        return @{
            saved = [double]$j.tokens_saved
            pct   = [double]$j.savings_pct
            cache = [double]$j.cache_hit_pct
            reqs  = [int]$j.total_requests
        }
    } catch { return $null }
}

function Get-TokenOptimizer {
    if (-not (Test-Path $toCache)) { return $null }
    $py = Get-Py; if (-not $py) { return $null }
    # sum original/compressed/hits tren bang cache. Saved = original - compressed (nen)
    #                                     + reuse = sum(original*hit_count) (tranh doc lai)
    $code = @"
import sqlite3,json
c=sqlite3.connect(r'$toCache')
try:
    o,z,h,n=c.execute('select coalesce(sum(original_size),0),coalesce(sum(compressed_size),0),coalesce(sum(hit_count),0),count(*) from cache').fetchone()
    reuse=c.execute('select coalesce(sum(original_size*hit_count),0) from cache').fetchone()[0]
    print(json.dumps({'orig':o,'comp':z,'hits':h,'entries':n,'reuse':reuse}))
except Exception:
    print('{}')
"@
    try {
        $out = ($code | & $py[0] @($py[1..($py.Count-1)]) -) 2>$null
        $j = $out | Out-String | ConvertFrom-Json
        if (-not $j.PSObject.Properties['entries']) { return $null }
        # cache token-optimizer luu BYTE. ~4 char/token -> chia 4 uoc token.
        $savedTok = ([double]$j.orig - [double]$j.comp) / 4.0
        $reuseTok = [double]$j.reuse / 4.0
        return @{
            saved   = $savedTok
            reuse   = $reuseTok
            entries = [int]$j.entries
            hits    = [int]$j.hits
        }
    } catch { return $null }
}

function Get-Caveman {
    # caveman = nen prose in-agent, KHONG co so tich luy CLI. Bao trang thai + so lan doi mode.
    $active = Test-Path (Join-Path $userHome '.claude\.caveman-active')
    $switches = 0; $mode = 'unknown'
    if (Test-Path $modeLog) {
        try {
            $lines = Get-Content $modeLog -ErrorAction SilentlyContinue
            $switches = $lines.Count
            $lastL = $lines | Select-Object -Last 1 | ConvertFrom-Json
            $mode = $lastL.mode
        } catch {}
    }
    return @{ active = $active; mode = $mode; switches = $switches }
}

# ============================================================
# HISTORY
# ============================================================
function Read-Hist {
    if (-not (Test-Path $histPath)) { return @() }
    return @(Get-Content $histPath -ErrorAction SilentlyContinue |
        Where-Object { $_.Trim() } |
        ForEach-Object { try { $_ | ConvertFrom-Json } catch {} })
}

function Append-Snapshot { param($rtk,$hr,$to)
    $snap = [ordered]@{
        ts         = (Get-Date).ToString('o')
        rtk_saved  = if ($rtk) { [long]$rtk.saved } else { $null }
        rtk_pct    = if ($rtk) { [math]::Round($rtk.pct,1) } else { $null }
        rtk_cmds   = if ($rtk) { $rtk.cmds } else { $null }
        hr_saved   = if ($hr)  { [long]$hr.saved } else { $null }
        to_saved   = if ($to)  { [long]$to.saved } else { $null }
        to_entries = if ($to)  { $to.entries } else { $null }
    }
    $dir = Split-Path -Parent $histPath
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $line = ($snap | ConvertTo-Json -Compress)
    Add-Content -Path $histPath -Value $line -Encoding UTF8
    return $snap
}

# ============================================================
# RENDER - -History
# ============================================================
if ($History) {
    $h = Read-Hist
    if ($h.Count -eq 0) { Write-Host "Chua co lich su. Chay .\tokengain.ps1 truoc." -ForegroundColor Yellow; exit 0 }
    Write-Host ""
    Write-Host "tokengain - Lich su session (rtk = so cung tich luy)" -ForegroundColor Cyan
    Write-Host ("=" * 74) -ForegroundColor DarkGray
    Write-Host ("{0,-19} {1,10} {2,7} {3,8} {4,10}" -f 'Time','rtk_saved','pct','cmds','d_saved') -ForegroundColor Gray
    Write-Host ("-" * 74) -ForegroundColor DarkGray
    $show = $h | Select-Object -Last $Last
    $prev = $null
    foreach ($s in $show) {
        $delta = if ($prev -and $s.rtk_saved -ne $null -and $prev.rtk_saved -ne $null) { $s.rtk_saved - $prev.rtk_saved } else { $null }
        $t = try { ([datetime]$s.ts).ToString('MM-dd HH:mm') } catch { $s.ts }
        Write-Host ("{0,-19} {1,10} {2,6}% {3,8} {4,10}" -f `
            $t, (Fmt-N ([double]$s.rtk_saved)), ('{0:0.0}' -f [double]$s.rtk_pct), `
            $s.rtk_cmds, $(if ($delta -ne $null) { '+' + (Fmt-N $delta) } else { '-' }))
        $prev = $s
    }
    Write-Host ("-" * 74) -ForegroundColor DarkGray
    Write-Host "d_saved = token rtk tiet kiem GIUA 2 lan chay (uoc luong tiet kiem/phien)." -ForegroundColor DarkGray
    exit 0
}

# ============================================================
# RENDER - dashboard mac dinh
# ============================================================
$rtk = Get-Rtk; $hr = Get-Headroom; $to = Get-TokenOptimizer; $cv = Get-Caveman

Write-Host ""
Write-Host "tokengain - Hieu suat he thong tiet kiem token" -ForegroundColor Cyan
if ($Project) { Write-Host "  scope: project hien tai" -ForegroundColor DarkGray }
Write-Host ("=" * 62) -ForegroundColor DarkGray

$grand = 0
# --- Layer 2: rtk (chinh) ---
if ($rtk) {
    $grand += $rtk.saved
    Write-Host ("rtk             {0,7} saved  [{1}] {2:0.0}%" -f (Fmt-N $rtk.saved), (Bar $rtk.pct), $rtk.pct) -ForegroundColor Green
    Write-Host ("                {0} lenh | nen CLI output (Bash/grep/ls/git)" -f $rtk.cmds) -ForegroundColor DarkGray
} else { Write-Host "rtk             n/a (chua cai / khong doc duoc gain)" -ForegroundColor DarkGray }

# --- Layer 3: token-optimizer ---
if ($to) {
    $grand += $to.saved
    Write-Host ("token-optimizer {0,7} saved  (nen file-read) | {1} entry cache" -f (Fmt-N $to.saved), $to.entries) -ForegroundColor Green
    if ($to.reuse -gt 0) { Write-Host ("                + ~{0} token tranh doc lai ({1} cache hit)" -f (Fmt-N $to.reuse), $to.hits) -ForegroundColor DarkGray }
} else { Write-Host "token-optimizer n/a (cache.db trong / chua cai)" -ForegroundColor DarkGray }

# --- Layer 1: headroom ---
if ($hr) {
    $grand += $hr.saved
    if ($hr.reqs -gt 0) {
        Write-Host ("headroom        {0,7} saved  {1:0.0}% | cache hit {2:0.0}%" -f (Fmt-N $hr.saved), $hr.pct, $hr.cache) -ForegroundColor Green
    } else {
        Write-Host "headroom        0 (proxy chua co log - chay qua 'headroom proxy' de kich hoat)" -ForegroundColor DarkGray
    }
} else { Write-Host "headroom        n/a (chua cai)" -ForegroundColor DarkGray }

# --- Layer 4: caveman ---
$cvTxt = if ($cv.active) { "ACTIVE (mode=$($cv.mode))" } else { "off" }
Write-Host ("caveman         {0} | nen prose ~65% (in-agent, khong tich luy CLI) | {1} lan doi mode" -f $cvTxt, $cv.switches) -ForegroundColor Gray

Write-Host ("-" * 62) -ForegroundColor DarkGray
Write-Host ("TONG (so cung, khong tinh caveman)  ~{0} token tiet kiem" -f (Fmt-N $grand)) -ForegroundColor Cyan

# --- ghi snapshot + delta phien ---
if (-not $NoLog) {
    $prevList = Read-Hist
    $prev = $prevList | Select-Object -Last 1
    $null = Append-Snapshot -rtk $rtk -hr $hr -to $to
    if ($prev -and $rtk -and $prev.rtk_saved -ne $null) {
        $d = $rtk.saved - [double]$prev.rtk_saved
        $dt = try { ([datetime]$prev.ts).ToString('MM-dd HH:mm') } catch { '?' }
        Write-Host ("Phien nay (tu {0}): rtk +{1} token" -f $dt, (Fmt-N $d)) -ForegroundColor Yellow
    } else {
        Write-Host "Snapshot dau tien da luu. Chay lai sau de thay tiet kiem/phien." -ForegroundColor DarkGray
    }
    Write-Host "Lich su: .\tokengain.ps1 -History" -ForegroundColor DarkGray
}
Write-Host ""
