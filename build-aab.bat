@echo off
setlocal

rem ---- EDIT THESE TWO LINES ----
set "UPLOAD_KEYSTORE=D:\code\upload.jks"
set "UPLOAD_KEY_ALIAS=upload"
rem ------------------------------

rem Version code: stored in .versioncode, +1 on every build.
set /a VC=0
if exist "%~dp0.versioncode" set /p VC=<"%~dp0.versioncode"
set /a VC=VC+1
echo %VC%>"%~dp0.versioncode"
set "VERSION_CODE=%VC%"
set "VERSION_NAME=1.0.%VC%"

set /p UPLOAD_STORE_PASSWORD=Keystore password:
set "UPLOAD_KEY_PASSWORD=%UPLOAD_STORE_PASSWORD%"

echo Building versionCode %VERSION_CODE% ...
cd /d "%~dp0"
rem Stamp the version shown in More (same as the GitHub release workflow). Original is restored after the build.
copy /y apps\mobile\src\config.ts "%TEMP%\config.ts.orig" >nul
powershell -NoProfile -Command "$f='apps\mobile\src\config.ts'; (Get-Content $f) -replace '^export const APP_VERSION = .*',\"export const APP_VERSION = '%VERSION_NAME%';\" -replace '^export const APP_BUILD = .*',\"export const APP_BUILD = '%VERSION_CODE%';\" | Set-Content $f" || goto :fail
call pnpm install || goto :fail
cd apps\mobile\android
call gradlew.bat bundleRelease || goto :fail
cd /d "%~dp0"
copy /y "%TEMP%\config.ts.orig" apps\mobile\src\config.ts >nul

echo.
echo DONE: %~dp0apps\mobile\android\app\build\outputs\bundle\release\app-release.aab
pause
exit /b 0

:fail
if exist "%TEMP%\config.ts.orig" copy /y "%TEMP%\config.ts.orig" "%~dp0apps\mobile\src\config.ts" >nul
echo BUILD FAILED
pause
exit /b 1
