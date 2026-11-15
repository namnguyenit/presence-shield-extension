$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskArchive = Join-Path $taskRoot 'Presence-Shield.zip'
$taskInputs = @('manifest.json','src','build','popup','demo','scripts','tests','package.json','README.md','TESTING.md','RESEARCH.md','OBSERVATORY.md') | ForEach-Object { Join-Path $taskRoot $_ }
Compress-Archive -LiteralPath $taskInputs -DestinationPath $taskArchive -Force
Write-Output $taskArchive
