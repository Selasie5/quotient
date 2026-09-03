param(
  [int]$Operations = 200000,
  [int]$BatchSize = 1000
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
$cppResult = (& $cppExecutable $Operations $BatchSize | Out-String) | ConvertFrom-Json
$typescriptResult = (& node (Join-Path $repoRoot "dist\benchmarks\matchingEngine.bench.js") $Operations $BatchSize | Out-String) | ConvertFrom-Json

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$fileTimestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$gitCommit = (git -C $repoRoot rev-parse HEAD).Trim()
$gitDirty = -not [string]::IsNullOrWhiteSpace((git -C $repoRoot status --porcelain | Out-String))
$cpu = if ([string]::IsNullOrWhiteSpace($env:PROCESSOR_IDENTIFIER)) {
  "unknown"
} else {
  $env:PROCESSOR_IDENTIFIER
}
$os = [System.Environment]::OSVersion.VersionString

$report = [ordered]@{
  schema_version = 1
  timestamp_utc = $timestamp
  git_commit = $gitCommit
  git_dirty = $gitDirty
  system = [ordered]@{
    os = $os
    cpu = $cpu
    node = (node --version)
    cpp_build = "MSVC Release"
  }
  workload = [ordered]@{
    operations = $Operations
    batch_size = $BatchSize
    warmup_operations = 10000
  }
  results = @($cppResult, $typescriptResult)
}

$resultDirectory = Join-Path $repoRoot "benchmarks\results"
New-Item -ItemType Directory -Force -Path $resultDirectory | Out-Null
$resultPath = Join-Path $resultDirectory "benchmark-$fileTimestamp.json"
$report | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 $resultPath
Write-Output $resultPath
