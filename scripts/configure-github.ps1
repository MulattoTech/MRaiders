#requires -Version 7
<#
.SYNOPSIS
  Idempotently provision the MRaiders repository Project, labels and branch rules.
.DESCRIPTION
  Uses your own interactive GitHub CLI authentication. Never reads, logs, exports
  or stores GitHub tokens. Defaults to a read-only preview.
.EXAMPLE
  gh auth login -h github.com --web -s repo,project,workflow
  pwsh -NoProfile -File scripts/configure-github.ps1 -Apply
#>
[CmdletBinding()]
param(
  [switch]$Apply,
  [switch]$ConfigureRules,
  [switch]$RequireCodeQL
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Repo = 'MulattoTech/MRaiders'
$Owner = 'MulattoTech'
$Title = 'MRaiders Development'
$RuleName = 'MRaiders main PR and CI gates'

function Invoke-Gh {
  param([string[]]$Arguments)
  $result = & gh @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) { throw "gh $($Arguments[0]) failed: $($result | Out-String)" }
  return ($result | Out-String).Trim()
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw 'Install GitHub CLI (gh) first. See docs/PROJECT_ADMIN.md.'
}
$auth = & gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  throw 'GitHub CLI is not authenticated. Run: gh auth login -h github.com --web -s repo,project,workflow'
}
$repository = Invoke-Gh @('api', "repos/$Repo") | ConvertFrom-Json
if ($repository.private) { throw 'MRaiders must be public before applying this configuration.' }
Write-Host "Repo: $Repo | public=$(-not $repository.private) | apply=$Apply"
if (-not $Apply) {
  Write-Host 'Preview only. Use -Apply to create/link the Project and update settings.'
  Write-Host 'Add -ConfigureRules once Native CI checks pass on the pull request.'
  return
}

# Repository features are configured before the Project link.
Invoke-Gh @('api','--method','PATCH',"repos/$Repo",
  '-F','has_projects=true','-F','has_issues=true',
  '-F','allow_auto_merge=true','-F','delete_branch_on_merge=true',
  '-F','allow_update_branch=true') | Out-Null

$all = Invoke-Gh @('project','list','--owner',$Owner,'--limit','100','--format','json') | ConvertFrom-Json
$existing = @($all.projects | Where-Object { $_.title -eq $Title } | Select-Object -First 1)
if ($existing.Count -gt 0) {
  $project = $existing[0]
} else {
  $project = Invoke-Gh @('project','create','--owner',$Owner,'--title',$Title,'--format','json') | ConvertFrom-Json
}
# Security alerts and fixes require repository Administration permissions.
foreach ($endpoint in @('vulnerability-alerts','automated-security-fixes')) {
  try {
    Invoke-Gh @('api','--method','PUT',"repos/$Repo/$endpoint") | Out-Null
    Write-Host "Enabled repository security endpoint: $endpoint"
  } catch {
    Write-Warning "Cannot enable $endpoint via this account: $($_.Exception.Message)"
  }
}
$projectNumber = [int]$project.number
if ($projectNumber -le 0) { throw 'Could not determine GitHub Project number.' }
Write-Host "Project: $($project.url) (#$projectNumber)"
Invoke-Gh @('project','edit',"$projectNumber",'--owner',$Owner,'--visibility','PUBLIC',
  '--description','MRaiders Qt development | P0/P1/P2 | Native, Maps, Data, UX, Infrastructure') | Out-Null
try {
  Invoke-Gh @('project','link',"$projectNumber",'--owner',$Owner,'--repo',$Repo) | Out-Null
} catch {
  Write-Host "Project link may already exist: $($_.Exception.Message)"
}

$fieldSet = Invoke-Gh @('project','field-list',"$projectNumber",'--owner',$Owner,'--format','json') | ConvertFrom-Json
$fieldNames = @($fieldSet.fields | ForEach-Object { $_.name })
if ('Priority' -notin $fieldNames) {
  Invoke-Gh @('project','field-create',"$projectNumber",'--owner',$Owner,
    '--name','Priority','--data-type','SINGLE_SELECT',
    '--single-select-options','P0,P1,P2') | Out-Null
}
if ('Workstream' -notin $fieldNames) {
  Invoke-Gh @('project','field-create',"$projectNumber",'--owner',$Owner,
    '--name','Workstream','--data-type','SINGLE_SELECT',
    '--single-select-options','Infrastructure,Native,Maps,Data,UX,Progression,Planning') | Out-Null
}

# Include the refactor PR and issues; item-add is skipped for already-linked URLs.
$itemSet = Invoke-Gh @('project','item-list',"$projectNumber",'--owner',$Owner,
  '--limit','200','--format','json') | ConvertFrom-Json
$existingUrls = @($itemSet.items | ForEach-Object { $_.content.url })
$urls = @('https://github.com/MulattoTech/MRaiders/pull/1')
$urls += 2..8 | ForEach-Object { "https://github.com/$Repo/issues/$_" }
foreach ($url in $urls) {
  if ($url -notin $existingUrls) {
    Invoke-Gh @('project','item-add',"$projectNumber",'--owner',$Owner,'--url',$url) | Out-Null
  }
}
$classification = @{
  2=@('P0','Infrastructure');3=@('P0','Native');4=@('P0','Maps');
  5=@('P1','Data');6=@('P1','UX');7=@('P1','Progression');8=@('P1','Planning')
}
foreach ($number in $classification.Keys) {
  $url = "https://github.com/$Repo/issues/$number"
  Invoke-Gh @('project','item-edit',"$projectNumber",'--owner',$Owner,'--url',$url,
    '--field','Priority','--value',$classification[$number][0]) | Out-Null
  Invoke-Gh @('project','item-edit',"$projectNumber",'--owner',$Owner,'--url',$url,
    '--field','Workstream','--value',$classification[$number][1]) | Out-Null
}
Write-Host 'Project created/linked, priority fields created, and issues populated.'

if ($ConfigureRules) {
  $statuses = @('Validate data','Qt/Linux build and CTest','Qt 6.12/Windows package')
  if ($RequireCodeQL) { $statuses += 'analyze-cpp' }
  # First ensure required checks have actually succeeded on the candidate PR.
  $pull = Invoke-Gh @('api',"repos/$Repo/pulls/1") | ConvertFrom-Json
  $checks = Invoke-Gh @('api',"repos/$Repo/commits/$($pull.head.sha)/check-runs") | ConvertFrom-Json
  $checkRuns = @($checks.check_runs)
  $missing = @($statuses | Where-Object {
      $context = $_
      -not @($checkRuns | Where-Object { $_.name -eq $context -and $_.conclusion -eq 'success' }).Count
    })
  if ($missing.Count -gt 0) { throw "Cannot enforce unverified checks: $($missing -join ', ')" }
  $found = Invoke-Gh @('api',"repos/$Repo/rulesets") | ConvertFrom-Json
  if (@($found | Where-Object { $_.name -eq $RuleName }).Count -eq 0) {
    $payload = @{
      name=$RuleName; target='branch'; enforcement='active'
      conditions=@{ref_name=@{include=@('refs/heads/main');exclude=@()}}
      rules=@(
        @{type='deletion'},
        @{type='non_fast_forward'},
        @{type='pull_request';parameters=@{
          dismiss_stale_reviews_on_push=$false; require_code_owner_review=$false
          require_last_push_approval=$false; required_approving_review_count=0
          required_review_thread_resolution=$true
        }},
        @{type='required_status_checks';parameters=@{
          strict_required_status_checks_policy=$true
          do_not_enforce_on_create=$false
          required_status_checks=@($statuses | ForEach-Object { @{context=$_} })
        }}
      )
    }
    $tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ("mraiders-rules-" + [guid]::NewGuid() + ".json")
    try {
      $payload | ConvertTo-Json -Depth 14 | Set-Content -Path $tempFile -Encoding utf8
      Invoke-Gh @('api','--method','POST',"repos/$Repo/rulesets",'--input',$tempFile) | Out-Null
    } finally {
      Remove-Item -LiteralPath $tempFile -ErrorAction SilentlyContinue
    }
  }
  Write-Host "Branch ruleset verified: $RuleName"
} else {
  Write-Host 'Branch rules intentionally unchanged. Run with -Apply -ConfigureRules after CI is green.'
}
Write-Host 'Read back the project, repo settings, and branch rules at docs/PROJECT_ADMIN.md.'
