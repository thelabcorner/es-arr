# Round-1 battery resume runner (benchmarker2, esarr-native-accel)
# Usage: pwsh -File resume-round1.ps1 [--sizes 2048,4096,...] [--force]
param(
  [string]$Sizes = "",
  [switch]$Force
)
$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
$node = "node"
$args = @("tests/benchmark-round1.mjs", "--dll", "ESARRArray3")
if ($Force) { $args += "--force" }
if ($Sizes -ne "") { $args += "--sizes"; $args += $Sizes }
Write-Output "[resume] $node $($args -join ' ')  ($(Get-Date -Format 'HH:mm:ss'))"
& $node $args
$code = $LASTEXITCODE
Write-Output "[resume] exit=$code  ($(Get-Date -Format 'HH:mm:ss'))"
exit $code
