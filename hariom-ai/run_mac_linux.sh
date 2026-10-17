#!/bin/bash
# ============================================================
#  Hariom AI - One-click setup & run (macOS / Linux)
#  - Checks Python is installed
#  - Creates a virtual environment if needed
#  - Installs dependencies
#  - Checks for .env / API key
#  - Starts the Flask server and opens the browser
#  - Never deletes user data or overwrites existing config
# ============================================================

set -e
cd "$(dirname "$0")"

echo ""
echo "========================================"
echo "  Hariom AI - Setup & Run"
echo "========================================"
echo ""

# ---- Check Python ----
echo "[1/5] Checking Python..."
if command -v python3 &>/dev/null; then
    PY=python3
elif command -v python &>/dev/null; then
    PY=python
else
    echo ""
    echo "ERROR: Python is not installed!"
    echo ""
    echo "Install Python 3:"
    echo "  macOS:   brew install python3"
    echo "  Ubuntu:  sudo apt install python3 python3-venv"
    echo "  Fedora:  sudo dnf install python3"
    echo ""
    exit 1
fi
echo "OK - $($PY --version)"
echo ""

# ---- Create virtual environment ----
echo "[2/5] Checking virtual environment..."
if [ ! -d "venv" ]; then
    echo "Creating virtual environment (first time may take a moment)..."
    $PY -m venv venv
    echo "Virtual environment created."
else
    echo "Virtual environment already exists. Good!"
fi
echo ""

# ---- Activate venv ----
if [ "$(uname)" = "Darwin" ] || [ "$(uname -s)" = "Linux" ]; then
    source venv/bin/activate
fi

# ---- Install dependencies ----
echo "[3/5] Installing dependencies..."
pip install --quiet --upgrade pip
pip install -r requirements.txt
echo "Dependencies ready."
echo ""

# ---- Check .env file ----
echo "[4/5] Checking configuration..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo ".env not found. Creating from .env.example..."
        cp ".env.example" ".env"
        echo ".env file created."
    else
        echo "ERROR: .env.example not found!"
        exit 1
    fi
fi

# Check if API key is set
API_KEY=$(grep "^GEMINI_API_KEY=" .env 2>/dev/null | cut -d'=' -f2-)
if [ -z "$API_KEY" ] || [ "$API_KEY" = "your_api_key_here" ]; then
    echo ""
    echo "========================================"
    echo "  ATTENTION: API Key is not set!"
    echo "========================================"
    echo ""
    echo "A Gemini API key is required for real AI responses."
    echo ""
    echo "Steps:"
    echo "  1. Go to https://aistudio.google.com/app/apikey"
    echo "     and create a free API key."
    echo "  2. Open the .env file in this folder."
    echo "  3. Paste your key after GEMINI_API_KEY= like:"
    echo "     GEMINI_API_KEY=AIzaSyXXXXXXX..."
    echo "  4. Save the file and run this script again."
    echo ""
    echo "The app will start but AI won't respond until the key is set."
    echo ""
fi
echo "Configuration check complete."
echo ""

# ---- Start server ----
echo "[5/5] Starting server..."
echo ""
echo "========================================"
echo "  Hariom AI is running!"
echo "========================================"
echo ""
echo "Open http://127.0.0.1:5000 in your browser."
echo "Press Ctrl+C to stop."
echo ""

# Open browser after short delay
(
    sleep 3
    if command -v open &>/dev/null; then
        open "http://127.0.0.1:5000"
    elif command -v xdg-open &>/dev/null; then
        xdg-open "http://127.0.0.1:5000"
    fi
) &

python app.py
