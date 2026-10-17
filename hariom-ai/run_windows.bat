@echo off
chcp 65001 >nul 2>&1
title Hariom AI - Setup %26 Run
setlocal EnableDelayedExpansion

REM ============================================================
REM  Hariom AI - One-click Windows setup %26 run script
REM  - Checks Python is installed
REM  - Creates a virtual environment if needed
REM  - Installs dependencies
REM  - Checks for .env / API key
REM  - Starts the Flask server and opens the browser
REM  - Never deletes user data or overwrites existing config
REM ============================================================

cd /d "%~dp0"

echo.
echo ========================================
echo   Hariom AI - Setup %26 Run
echo ========================================
echo.

REM ---- Check Python ----
echo [1/5] Python check kar rahe hain...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Python installed nahi mila!
    echo.
    echo Python install karne ke liye:
    echo   1. https://www.python.org/downloads/ par jayein
    echo   2. Latest Python download karein
    echo   3. Installer chalate waqt "Add Python to PATH" zaroor tick karein
    echo   4. Install ke baad ye file dobara chalayein
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo OK - !PYVAR! detected.
python --version 2>nul | findstr /R "[3-9]\." >nul 2>&1
echo Python version: !PYVER!
echo Done.
echo.

REM ---- Create virtual environment ----
echo [2/5] Virtual environment check kar rahe hain...
if not exist "venv\Scripts\activate.bat" (
    echo Virtual environment bana rahe hain (pehli baar mein thoda time lagega)...
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Virtual environment nahi ban paya.
        pause
        exit /b 1
    )
    echo Virtual environment ban gaya.
) else (
    echo Virtual environment pehle se maujood hai. Achha!
)
echo.

REM ---- Activate venv ----
call "venv\Scripts\activate.bat"

REM ---- Install dependencies ----
echo [3/5] Dependencies install kar rahe hain...
pip install --quiet --upgrade pip >nul 2>&1
pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo ERROR: Dependencies install nahi ho payin.
    echo Internet connection check karein aur dobara try karein.
    pause
    exit /b 1
)
echo Dependencies ready.
echo.

REM ---- Check .env file ----
echo [4/5] Configuration check kar rahe hain...
if not exist ".env" (
    if exist ".env.example" (
        echo .env file nahi mili. .env.example ki copy bana rahe hain...
        copy ".env.example" ".env" >nul
        echo .env file ban gayi.
    ) else (
        echo ERROR: .env.example file bhi nahi mili!
        pause
        exit /b 1
    )
)

REM Check if API key is set (non-placeholder)
set API_KEY_SET=0
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    set "key=%%a"
    set "val=%%b"
    if /i "!key!"=="GEMINI_API_KEY" (
        if not "!val!"=="" if not "!val!"=="your_api_key_here" (
            set API_KEY_SET=1
        )
    )
)

if !API_KEY_SET!==0 (
    echo.
    echo ========================================
    echo   ATTENTION: API Key set nahi hai!
    echo ========================================
    echo.
    echo Asli AI jawab dene ke liye Gemini API key zaruri hai.
    echo.
    echo Steps:
    echo   1. https://aistudio.google.com/app/apikey par jayein
    echo      aur free API key banayein.
    echo   2. ".env" file ko Notepad mein kholein
    echo      (ye folder mein hai).
    echo   3. GEMINI_API_KEY= ke baad apni key paste karein,
    echo      jaise:  GEMINI_API_KEY=AIzaSyXXXXXXX...
    echo   4. File save karein aur ye script dobara chalayein.
    echo.
    echo App chalega lekin AI jawab nahi dega jab tak key set na ho.
    echo.
    echo .env file abhi kholna chahte hain? (Y/N)
    set /p OPENENV=
    if /i "!OPENENV!"=="Y" notepad ".env"
    echo.
)
echo Configuration check complete.
echo.

REM ---- Start server ----
echo [5/5] Server start kar rahe hain...
echo.
echo ========================================
echo   Hariom AI chal raha hai!
echo ========================================
echo.
echo Browser mein http://127.0.0.1:5000 khulega.
echo Band karne ke liye ye window band karein ya Ctrl+C dabayein.
echo.

REM Open browser after short delay (in background)
start "" timeout /t 3 /nobreak >nul ^&^& start "" "http://127.0.0.1:5000"

REM Run Flask (blocking — keeps server alive)
python app.py

echo.
echo Server band ho gaya.
pause
endlocal
