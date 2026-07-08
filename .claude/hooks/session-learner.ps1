# session-learner.ps1 — SessionEnd: mine failures -> CLAUDE.md/MEMORY.md
if (Get-Command headroom -ErrorAction SilentlyContinue) { headroom learn --apply 2>$null }