param([switch]$SkipWebBuild)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$studioJava = 'C:\Program Files\Android\Android Studio\jbr'
# Use the known Java 21 toolchain; newer Studio bundles may exceed Gradle support.
$portableJava = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'CampusBuildTools\jdk21') -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName 'bin\java.exe') } | Select-Object -First 1
if ($portableJava) { $env:JAVA_HOME = $portableJava.FullName }
elseif (Test-Path (Join-Path $studioJava 'bin\java.exe')) { $env:JAVA_HOME = $studioJava }
if (-not $env:JAVA_HOME) { throw 'Install Android Studio first (Java 21 or newer is required).' }
$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path (Join-Path $sdkRoot 'platforms\android-36\android.jar'))) {
    throw 'Android SDK Platform 36 is missing. Install it using Android Studio SDK Manager.'
}
$env:ANDROID_HOME = $sdkRoot
Push-Location $projectRoot
try {
    if (-not $SkipWebBuild) {
        & node node_modules/typescript/bin/tsc --noEmit
        if ($LASTEXITCODE -ne 0) { throw 'TypeScript check failed.' }
        & node node_modules/vite/bin/vite.js build
        if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
    }
    & node node_modules/@capacitor/cli/bin/capacitor sync android
    if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }
    Push-Location android
    try {
        & .\gradlew.bat --no-daemon assembleDebug
        if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
    } finally { Pop-Location }
    $releaseDir = Join-Path $projectRoot 'releases'
    New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
    $appVersion = (Get-Content (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
    $apk = Join-Path $releaseDir "Campus-finden-$appVersion-debug.apk"
    Copy-Item -LiteralPath 'android/app/build/outputs/apk/debug/app-debug.apk' -Destination $apk -Force
    Get-FileHash -LiteralPath $apk -Algorithm SHA256
    Write-Output "Installable test APK: $apk"
} finally { Pop-Location }
