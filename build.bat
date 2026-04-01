@echo off
REM Script to build backend-api with Maven

setlocal enabledelayedexpansion

echo.
echo ============================================================
echo   Backend API Build Script
echo ============================================================
echo.

REM Change to project directory
cd /d "%~dp0backend-api"
if errorlevel 1 (
    echo ERROR: Could not change to backend-api directory
    exit /b 1
)

REM Check if Maven is available
where mvn >nul 2>&1
if errorlevel 1 (
    echo.
    echo WARNING: Maven executable 'mvn' not found in PATH
    echo.
    echo To fix this:
    echo 1. Install Maven 3.9.6+ from https://maven.apache.org/download.cgi
    echo 2. Set MAVEN_HOME environment variable to your Maven installation
    echo 3. Add %%MAVEN_HOME%%\bin to your PATH
    echo.
    echo Alternative: Use Maven Wrapper
    if exist "mvnw.bat" (
        echo   Running: mvnw.bat clean compile
        call mvnw.bat clean compile
        exit /b !errorlevel!
    )
    exit /b 1
)

echo Maven found. Running: mvn clean compile
echo.

REM Run Maven
mvn clean compile -e

if errorlevel 1 (
    echo.
    echo ERROR: Build failed!
    exit /b 1
)

echo.
echo ============================================================
echo   Build successful!
echo ============================================================
echo.
echo Next steps:
echo 1. Run: mvn spring-boot:run
echo 2. Access API at: http://localhost:8080
echo 3. Swagger UI: http://localhost:8080/swagger-ui.html
echo.

endlocal
exit /b 0
