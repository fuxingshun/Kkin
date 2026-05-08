param(
  [string] $BackupRoot = '',
  [string] $MysqlUrl = $env:SPRING_DATASOURCE_URL,
  [string] $MysqlUser = $env:SPRING_DATASOURCE_USERNAME,
  [string] $MysqlPassword = $env:SPRING_DATASOURCE_PASSWORD,
  [string] $UploadDir = $env:KINECHO_UPLOAD_DIR
)

$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
  $BackupRoot = Join-Path $Root '.backups'
}
if ([string]::IsNullOrWhiteSpace($UploadDir)) {
  $UploadDir = Join-Path $Root 'server\uploads'
}

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Target = Join-Path $BackupRoot "kinecho-pilot-$Stamp"
$ManifestPath = Join-Path $Target 'manifest.json'
$DatabaseDumpPath = Join-Path $Target 'database.sql'
$UploadsArchivePath = Join-Path $Target 'uploads.zip'
$NotesPath = Join-Path $Target 'MANUAL_ACTIONS.txt'

New-Item -ItemType Directory -Force -Path $Target | Out-Null

function Parse-JdbcMysqlUrl {
  param([string] $Url)
  if ([string]::IsNullOrWhiteSpace($Url)) {
    return $null
  }
  $Match = [regex]::Match($Url, '^jdbc:mysql://([^:/?#]+)(?::(\d+))?/([^?#]+)')
  if (-not $Match.Success) {
    return $null
  }
  return [pscustomobject]@{
    Host = $Match.Groups[1].Value
    Port = if ($Match.Groups[2].Success) { $Match.Groups[2].Value } else { '3306' }
    Database = $Match.Groups[3].Value
  }
}

$Database = Parse-JdbcMysqlUrl -Url $MysqlUrl
$MysqlDump = Get-Command mysqldump -ErrorAction SilentlyContinue
$DatabaseBackedUp = $false
$ManualActions = New-Object System.Collections.Generic.List[string]

if ($null -ne $Database -and $null -ne $MysqlDump -and -not [string]::IsNullOrWhiteSpace($MysqlUser)) {
  $env:MYSQL_PWD = $MysqlPassword
  try {
    & $MysqlDump.Source `
      --host=$($Database.Host) `
      --port=$($Database.Port) `
      --user=$MysqlUser `
      --single-transaction `
      --routines `
      --triggers `
      --databases $Database.Database |
      Set-Content -Encoding UTF8 -Path $DatabaseDumpPath
    if ($LASTEXITCODE -ne 0) {
      throw "mysqldump failed with exit code $LASTEXITCODE"
    }
    $DatabaseBackedUp = $true
  } finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
  }
} else {
  $ManualActions.Add('MySQL dump was not created. Provide SPRING_DATASOURCE_URL, SPRING_DATASOURCE_USERNAME, SPRING_DATASOURCE_PASSWORD and ensure mysqldump is on PATH.')
}

$UploadsBackedUp = $false
if (Test-Path -LiteralPath $UploadDir) {
  Compress-Archive -Path (Join-Path $UploadDir '*') -DestinationPath $UploadsArchivePath -Force
  $UploadsBackedUp = $true
} else {
  $ManualActions.Add("Upload directory was not found: $UploadDir")
}

$Manifest = [ordered]@{
  created_at = (Get-Date).ToString('o')
  backup_path = $Target
  database = [ordered]@{
    backed_up = $DatabaseBackedUp
    dump_path = if ($DatabaseBackedUp) { $DatabaseDumpPath } else { '' }
    jdbc_url = if ([string]::IsNullOrWhiteSpace($MysqlUrl)) { '' } else { $MysqlUrl }
    user = if ([string]::IsNullOrWhiteSpace($MysqlUser)) { '' } else { $MysqlUser }
  }
  uploads = [ordered]@{
    backed_up = $UploadsBackedUp
    source_path = $UploadDir
    archive_path = if ($UploadsBackedUp) { $UploadsArchivePath } else { '' }
  }
  manual_actions = $ManualActions
}

$Manifest | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -Path $ManifestPath
if ($ManualActions.Count -gt 0) {
  $ManualActions | Set-Content -Encoding UTF8 -Path $NotesPath
}

Write-Host "KinEcho pilot backup created: $Target"
Write-Host "Manifest: $ManifestPath"
if ($ManualActions.Count -gt 0) {
  Write-Host "Manual actions required: $NotesPath"
}
