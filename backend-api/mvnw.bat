@REM Licensed to the Apache Software Foundation (ASF) under one
@REM or more contributor license agreements.  See the NOTICE file
@REM distributed with this work for additional information
@REM regarding copyright ownership.  The ASF licenses this file
@REM to you under the Apache License, Version 2.0 (the
@REM "License"); you may not use this file except in compliance
@REM with the License.  You may obtain a copy of the License at
@REM
@REM    http://www.apache.org/licenses/LICENSE-2.0
@REM
@REM Unless required by applicable law or agreed to in writing,
@REM software distributed under the License is distributed on an
@REM "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
@REM KIND, either express or implied.  See the License for the
@REM specific language governing permissions and limitations
@REM under the License.
@REM

@if "%DEBUG%" == "" @echo off
@setlocal

set DIRNAME=%~dp0
if "%DIRNAME%" == "" set DIRNAME=.
set APP_BASE_NAME=%~n0
set APP_HOME=%DIRNAME%

@REM Find java.exe
if defined JAVA_HOME goto findJavaFromJavaHome

set JAVA_EXE=java.exe
%JAVA_EXE% -version >NUL 2>&1
if not "%ERRORLEVEL%" == "0" (
  echo.
  echo ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH.
  echo.
  echo Please set the JAVA_HOME variable in your environment to match the
  echo location of your Java installation.
  endlocal
  exit /b 1
)

goto fail

:findJavaFromJavaHome
set JAVA_HOME=%JAVA_HOME:"=%
set JAVA_EXE=%JAVA_HOME%\bin\java.exe

if exist "%JAVA_EXE%" goto init

echo.
echo ERROR: JAVA_HOME is set to an invalid directory: %JAVA_HOME%
echo.
echo Please set the JAVA_HOME variable in your environment to match the
echo location of your Java installation.
endlocal
exit /b 1

:init
@REM Find the project base dir, i.e. the directory that contains the folder ".mvn".
@REM Fallback to current working directory if not found.

set MAVEN_PROJECTBASEDIR=%MAVEN_BASEDIR%
IF "%MAVEN_PROJECTBASEDIR%"=="" (
set MAVEN_PROJECTBASEDIR=%CD%
)

set EXEC_DIR=%CD%
set CMD_LINE_ARGS=%*
goto endInit

@REM Reach the target folder by following the links firstly.
%JAVA_EXE% "-classpath" "%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.jar" "-Dmaven.multiModuleProjectDirectory=%MAVEN_PROJECTBASEDIR%" %MAVEN_CONFIG% %*
if not "%OS%"=="Windows_NT" endlocal

if %ERRORLEVEL% equ 0 goto mainEnd

:fail
rem Set variable MAVEN_EXIT_ERROR_CODE if you need the exit code (instead of the ERRORLEVEL)
set MAVEN_EXIT_ERROR_CODE=%ERRORLEVEL%

:endInit
@endlocal & set ERROR_CODE=%MAVEN_EXIT_ERROR_CODE%

if not "%FORK_MODE%"=="true" (
  exit /b %ERROR_CODE%
)

exit /b %ERROR_CODE%

:mainEnd
if "%OS%"=="Windows_NT" endlocal

exit /b %ERRORLEVEL%
