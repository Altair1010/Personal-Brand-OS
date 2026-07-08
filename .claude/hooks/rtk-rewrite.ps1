# rtk-rewrite.ps1 — PreToolUse(Bash): nen CLI output 60-91%
$in = $input | Out-String
if (Get-Command rtk -ErrorAction SilentlyContinue) { $in | rtk rewrite } else { $in }