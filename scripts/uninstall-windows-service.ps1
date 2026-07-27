param(
  [string]$TaskName = 'MAUCAFE Queue Server',
  [string]$BackupTaskName = 'MAUCAFE Database Backup'
)

foreach ($currentTaskName in @($TaskName, $BackupTaskName)) {
  $task = Get-ScheduledTask -TaskName $currentTaskName -ErrorAction SilentlyContinue
  if ($null -eq $task) {
    Write-Output "Scheduled Task tidak ditemukan: $currentTaskName"
    continue
  }
  Unregister-ScheduledTask -TaskName $currentTaskName -Confirm:$false
  Write-Output "Scheduled Task dihapus: $currentTaskName"
}
