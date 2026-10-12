# check_files.ps1 — お手元のゲームフォルダと最新版（tools/MANIFEST.txt）を比べ、足りない・古いファイルを一覧にする
# 使い方: ゲームフォルダの CHECK_FILES.bat をダブルクリック。結果は check_result.txt に出て、メモ帳で開きます
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$list = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'MANIFEST.txt') -Encoding UTF8
$missing = @(); $diff = @(); $ok = 0
foreach ($line in $list) {
  if (-not $line.Trim()) { continue }
  $p = $line.Split("`t")
  $file = Join-Path $root ($p[0] -replace '/', '\')
  if (-not (Test-Path -LiteralPath $file)) { $missing += $p[0]; continue }
  $h = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
  if ($h -ne $p[2]) { $diff += $p[0] } else { $ok++ }
}
$out = @()
$out += "MIKA ファイルチェック  " + (Get-Date -Format 'yyyy-MM-dd HH:mm')
$out += "OK: $ok   足りない: $($missing.Count)   中身が違う: $($diff.Count)"
$out += ""
$out += "[足りないファイル]"; $out += $missing
$out += ""
$out += "[中身が違うファイル（古い可能性）]"; $out += $diff
$res = Join-Path $root 'check_result.txt'
$out | Out-File -LiteralPath $res -Encoding UTF8
Start-Process notepad.exe $res
