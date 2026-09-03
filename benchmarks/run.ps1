param(
  [int]$Operations = 1000000,
  [int]$BatchSize = 1000,
  [int]$Trials = 5
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$cmake = Get-Command cmake -ErrorAction SilentlyContinue
if ($null -eq $cmake) {
  $cmakePath = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
} else {
  $cmakePath = $cmake.Source
}
if (-not (Test-Path -LiteralPath $cmakePath)) {
  throw "CMake was not found"
}

$buildDirectory = Join-Path $repoRoot "cpp\build-release"
& $cmakePath -S (Join-Path $repoRoot "cpp") -B $buildDirectory -G "Visual Studio 17 2022" -A x64
& $cmakePath --build $buildDirectory --config Release
$ctestPath = Join-Path (Split-Path -Parent $cmakePath) "ctest.exe"
& $ctestPath --test-dir $buildDirectory -C Release --output-on-failure
cmd /c npm run build | Out-Host

$cppExecutable = Join-Path $buildDirectory "Release\quotient_cpp_benchmark.exe"
$typescriptExecutable = Join-Path $repoRoot "dist\benchmarks\matchingEngine.bench.js"
$trialResults = @()
for ($trial = 1; $trial -le $Trials; $trial++) {
  if ($trial % 2 -eq 1) {
    $cppResult = (& $cppExecutable $Operations $BatchSize | Out-String) | ConvertFrom-Json
    $typescriptResult = (& node $typescriptExecutable $Operations $BatchSize | Out-String) | ConvertFrom-Json
    $runOrder = @("cpp", "typescript")
  } else {
    $typescriptResult = (& node $typescriptExecutable $Operations $BatchSize | Out-String) | ConvertFrom-Json
    $cppResult = (& $cppExecutable $Operations $BatchSize | Out-String) | ConvertFrom-Json
    $runOrder = @("typescript", "cpp")
  }

  $trialResults += [ordered]@{
    trial = $trial
    run_order = $runOrder
    results = @($cppResult, $typescriptResult)
  }
}

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$fileTimestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$gitCommit = (git -C $repoRoot rev-parse HEAD).Trim()
$gitDirty = -not [string]::IsNullOrWhiteSpace((git -C $repoRoot status --porcelain | Out-String))
$cpuRegistryPath = "HKLM:\HARDWARE\DESCRIPTION\System\CentralProcessor\0"
$cpuRegistry = Get-ItemProperty -LiteralPath $cpuRegistryPath -ErrorAction SilentlyContinue
$cpu = if ($null -ne $cpuRegistry -and -not [string]::IsNullOrWhiteSpace($cpuRegistry.ProcessorNameString)) {
  $cpuRegistry.ProcessorNameString.Trim()
} elseif (-not [string]::IsNullOrWhiteSpace($env:PROCESSOR_IDENTIFIER)) {
  $env:PROCESSOR_IDENTIFIER
} else {
  "unknown"
}
$os = [System.Environment]::OSVersion.VersionString
$command = "powershell -NoProfile -ExecutionPolicy Bypass -File benchmarks/run.ps1 -Operations $Operations -BatchSize $BatchSize -Trials $Trials"

$report = [ordered]@{
  schema_version = 2
  timestamp_utc = $timestamp
  git_commit = $gitCommit
  git_dirty = $gitDirty
  command = $command
  system = [ordered]@{
    os = $os
    cpu = $cpu
    node = (node --version)
    cpp_build = "MSVC Release"
  }
  workload = [ordered]@{
    operations = $Operations
    batch_size = $BatchSize
    trials = $Trials
    warmup_operations = 10000
  }
  trials = $trialResults
}

$resultDirectory = Join-Path $repoRoot "benchmarks\results"
New-Item -ItemType Directory -Force -Path $resultDirectory | Out-Null
$resultPath = Join-Path $resultDirectory "benchmark-$fileTimestamp.json"
$report | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 $resultPath
Write-Output $resultPath
