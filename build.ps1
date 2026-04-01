#!/usr/bin/env pwsh
# Script to build backend-api with Maven or Maven Wrapper

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   Backend API Build Script" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Change to project directory
$projectDir = Join-Path $PSScriptRoot "backend-api"
if (-not (Test-Path $projectDir)) {
    Write-Host "ERROR: backend-api directory not found at $projectDir" -ForegroundColor Red
    exit 1
}

Set-Location $projectDir

# Try to run Maven
$mavnExists = $null -ne (Get-Command mvn -ErrorAction SilentlyContinue)

if (-not $mavnExists) {
    Write-Host ""
    Write-Host "WARNING: Maven executable 'mvn' not found in PATH" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To fix this, do ONE of the following:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Install Maven" -ForegroundColor Green
    Write-Host "  1. Download from: https://maven.apache.org/download.cgi"
    Write-Host "  2. Extract to: C:\Maven"
    Write-Host "  3. Set environment variable: MAVEN_HOME=C:\Maven\apache-maven-3.9.6"
    Write-Host "  4. Add to PATH: %MAVEN_HOME%\bin"
    Write-Host ""
    Write-Host "Option 2: Use Maven Wrapper" -ForegroundColor Green
    
    $mvnwExists = Test-Path "mvnw.bat"
    if ($mvnwExists) {
        Write-Host "  Maven Wrapper found! Running build..."
        Write-Host ""
        & .\mvnw.bat clean compile -e
        $exitCode = $LASTEXITCODE
    } else {
        Write-Host "  Maven Wrapper not found at mvnw.bat" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Maven found at: $(Get-Command mvn | Select-Object -ExpandProperty Source)" -ForegroundColor Green
    Write-Host "Running: mvn clean compile" -ForegroundColor Cyan
    Write-Host ""
    
    & mvn clean compile -e
    $exitCode = $LASTEXITCODE
}

if ($exitCode -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Build failed with exit code $exitCode" -ForegroundColor Red
    exit $exitCode
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "   Build successful!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run: mvn spring-boot:run (or ./mvnw.bat spring-boot:run)"
Write-Host "  2. Access API at: http://localhost:8080"
Write-Host "  3. Swagger UI: http://localhost:8080/swagger-ui.html"
Write-Host ""

exit 0
