# make-screenshot.ps1
# Normalizes a raw screenshot into an exactly-1280x800 PNG for a Chrome Web
# Store listing (fit-and-pad onto a dark canvas matching the dashboard bg).
#
# from apps/extension/store-assets
#   ./make-screenshot.ps1 -In "$env:USERPROFILE\Pictures\nour-raw.png"
#   ./make-screenshot.ps1 -In ".\popup-raw.png" -Out "screenshot-popup.png"
#   ./make-screenshot.ps1 -In ".\raw.png" -Pad "0x000000"

param(
    [Parameter(Mandatory = $true)][string]$In,
    [string]$Out = "screenshot-1280x800.png",
    [string]$Pad = "0x0E1512"
)

# Agent/CI shells carry a stale PATH that misses ffmpeg (installed at
# %LOCALAPPDATA%\Programs\ffmpeg\bin) — refresh from the registry first.
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + [Environment]::GetEnvironmentVariable('Path', 'Machine')

if (-not (Test-Path $In)) {
    Write-Error "Input file not found: $In"
    exit 1
}

$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
$ffprobe = Get-Command ffprobe -ErrorAction SilentlyContinue

if (-not $ffmpeg -or -not $ffprobe) {
    Write-Error "ffmpeg/ffprobe not found on PATH. Expected at %LOCALAPPDATA%\Programs\ffmpeg\bin - install ffmpeg or fix PATH."
    exit 1
}

$outputPath = Join-Path $PSScriptRoot $Out

$filter = "scale=1280:800:force_original_aspect_ratio=decrease,pad=1280:800:(ow-iw)/2:(oh-ih)/2:color=$Pad"

& ffmpeg -y -i $In -vf $filter -update 1 $outputPath

if ($LASTEXITCODE -ne 0) {
    Write-Error "ffmpeg failed to produce $outputPath (exit code $LASTEXITCODE)."
    exit 1
}

$dimensions = & ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 $outputPath
$dimensions = $dimensions.Trim() -replace "`r", "" -replace "`n", ""

if ($dimensions -eq "1280,800") {
    Write-Host "PASS: $outputPath is exactly 1280x800." -ForegroundColor Green
} else {
    Write-Host "FAIL: $outputPath is $dimensions (expected 1280,800)." -ForegroundColor Red
    exit 1
}
