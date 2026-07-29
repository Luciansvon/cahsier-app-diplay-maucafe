param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$NodePath = (Get-Command node -ErrorAction Stop).Source,
  [string]$TaskName = 'MAUCAFE Queue Server',
  [string]$BackupTaskName = 'MAUCAFE Database Backup'
)

$serverPath = Join-Path $ProjectRoot 'src\server.js'
if (-not (Test-Path -LiteralPath $serverPath -PathType Leaf)) {
  throw "Server tidak ditemukan: $serverPath"
}

$action = New-ScheduledTaskAction `
  -Execute $NodePath `
  -Argument "`"$serverPath`" --production" `
  -WorkingDirectory $ProjectRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -RestartCount 5 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Days 3650) `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'MAUCAFE SQLite queue and franchise operations server' `
  -Force | Out-Null

Write-Output "Scheduled Task terpasang: $TaskName"

$backupScriptPath = Join-Path $ProjectRoot 'scripts\backup-database.mjs'
$backupAction = New-ScheduledTaskAction `
  -Execute $NodePath `
  -Argument "`"$backupScriptPath`"" `
  -WorkingDirectory $ProjectRoot
$backupTrigger = New-ScheduledTaskTrigger -Daily -At '02:00'

Register-ScheduledTask `
  -TaskName $BackupTaskName `
  -Action $backupAction `
  -Trigger $backupTrigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Backup harian SQLite MAUCAFE memakai VACUUM INTO' `
  -Force | Out-Null

Write-Output "Scheduled Task backup terpasang: $BackupTaskName"
