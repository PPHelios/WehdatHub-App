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
call pnpm install || goto :fail
cd apps\mobile\android
call gradlew.bat bundleRelease || goto :fail

echo.
echo DONE: %~dp0apps\mobile\android\app\build\outputs\bundle\release\app-release.aab
pause
exit /b 0

:fail
echo BUILD FAILED
pause
exit /b 1
