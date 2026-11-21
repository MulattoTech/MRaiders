#requires -Version 7
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
git -C $root config extensions.worktreeConfig true
if($LASTEXITCODE -ne 0){throw 'Could not enable worktree-specific configuration'}
git -C $root config --worktree core.hooksPath .githooks
if($LASTEXITCODE -ne 0){throw 'Could not configure hooks for this worktree'}
Write-Output 'MRaiders audit hooks enabled in this worktree only (other worktrees unchanged).'
Write-Output 'Before coding, declare actual session via python -m tools.audit.provenance context --origin AI --agent "Codex CLI" --provider OpenAI --model ACTUAL_MODEL --reasoning high --feature MR-13 --validation NOT_RUN'
