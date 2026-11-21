#requires -Version 7
<#
.SYNOPSIS
  Adjust MRaiders' main-branch required checks without weakening PR/no-force-push rules.
.DESCRIPTION
  Only applies when the checks proposed for a transition have actually passed on a PR.
  Requires owner-authenticated gh CLI, uses no stored secrets, and preserves the
  existing pull_request, deletion, non_fast_forward rules unchanged.
#>
[CmdletBinding()]
param([switch]$Apply,[ValidateSet('Transitional','Native')] [string]$Stage='Transitional')
$ErrorActionPreference='Stop'
$repo='MulattoTech/MRaiders'
$ruleId=24902119
$checks=@('MRaiders Quality Gate','Validate AI provenance','Feature Control tests')
if($Stage -eq 'Native'){ $checks+=@('Validate data','Qt/Linux build and CTest','Qt 6.12/Windows package','analyze-cpp') }
$pr=if($Stage -eq 'Native'){1}else{17}
$prData=gh api "repos/$repo/pulls/$pr"|ConvertFrom-Json
if($LASTEXITCODE -ne 0){throw "Cannot inspect PR #$pr"}
$runData=gh api "repos/$repo/commits/$($prData.head.sha)/check-runs" | ConvertFrom-Json
if($LASTEXITCODE -ne 0){throw 'Cannot inspect check runs'}
$missing=@($checks | Where-Object{
  $checkName=$_
  -not @($runData.check_runs | Where-Object {$_.name -eq $checkName -and $_.conclusion -eq 'success'}).Count
})
if($missing.Count){throw ('Cannot require checks without PASS on exact PR head: '+($missing -join ', '))}
$old=gh api "repos/$repo/rulesets/$ruleId"|ConvertFrom-Json
if($LASTEXITCODE -ne 0){throw 'Could not read existing ruleset'}
$updated=@($old.rules | ForEach-Object{
  if($_.type -eq 'required_status_checks'){
    $param=$_.parameters
    $param.required_status_checks=@($checks | ForEach-Object{@{context=$_}})
    @{type=$_.type;parameters=$param}
  } elseif($_.parameters) {
    @{type=$_.type;parameters=$_.parameters}
  } else {
    @{type=$_.type}
  }
})
if(-not @($updated | Where-Object{$_.type -eq 'pull_request'}).Count){throw 'Cannot lose PR protection'}
if(-not @($updated | Where-Object{$_.type -eq 'deletion'}).Count){throw 'Cannot lose deletion protection'}
if(-not @($updated | Where-Object{$_.type -eq 'non_fast_forward'}).Count){throw 'Cannot lose force-push protection'}
$payload=@{
  name=$old.name
  target=$old.target
  enforcement=$old.enforcement
  bypass_actors=@($old.bypass_actors)
  conditions=$old.conditions
  rules=$updated
}
Write-Output ("Proposed $Stage required checks for $($old.name): $($checks -join ', ')")
if(-not $Apply){Write-Output 'DRY RUN: pass -Apply only after reviewing the proposed policy.';return}
$temp=Join-Path ([IO.Path]::GetTempPath()) ("mraiders-rules-"+[guid]::NewGuid()+".json")
try{
  [IO.File]::WriteAllText($temp,($payload|ConvertTo-Json -Depth 24),[Text.UTF8Encoding]::new($false))
  gh api --method PUT "repos/$repo/rulesets/$ruleId" --input $temp | Out-Null
  if($LASTEXITCODE -ne 0){throw 'GitHub rejected policy update'}
}finally{Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}
$verified=gh api "repos/$repo/rulesets/$ruleId"|ConvertFrom-Json
$contexts=@($verified.rules | Where-Object type -eq required_status_checks | ForEach-Object {$_.parameters.required_status_checks.context})
if((Compare-Object $checks $contexts)){throw 'Ruleset readback does not match request'}
Write-Output 'PROTECTED MAIN RULESET VERIFIED: '+($contexts -join ', ')
