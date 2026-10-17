# Hariom AI

A modern, personal AI chatbot (like ChatGPT) built with **Python Flask**, **HTML/CSS/JS**, and **SQLite** for persistent chat history. Supports **Hindi and English** conversations using the **Google Gemini AI** API.

---

## Features

- ChatGPT-style chat interface with message bubbles
- Hindi + English support (AI replies in the language you write in)
- Enter to send, Shift+Enter for new line
- New Chat, Clear Chat, chat history sidebar
- Copy response and Regenerate response buttons
- Loading animation while AI thinks
- Responsive design (mobile + desktop)
- Persistent chat history (SQLite database — survives restarts)
- Friendly error messages for all failure cases
- API key stays on the server (never exposed in browser)
- One-click Windows setup (`run_windows.bat`)

---

## Quick Start (Windows) — Hindi Instructions

### Step 1: Python install karein

Agar Python installed nahi hai:

1. **https://www.python.org/downloads/** par jayein
2. Latest Python version download karein
3. Installer chalate waqt **"Add Python to PATH"** zaroor tick karein (bahut zaruri hai)
4. Install kar dein

### Step 2: ZIP file extract karein

1. `hariom-ai.zip` file ko apne computer mein download karein
2. Zip par right-click karein → **"Extract All..."** chunein
3. Jis folder mein extract kiya, wahan `hariom-ai` naam ka folder hoga

### Step 3: API key set karein

1. **https://aistudio.google.com/app/apikey** par jayein (Google account se login karein)
2. **"Create API Key"** par click karein aur ek free key banayein
3. `hariom-ai` folder ke andar `.env.example` file dikhegi
4. Uski copy bana kar naam rakhein `.env` (naam mein dot hai, koi extension nahi)
5. `.env` file ko **Notepad** mein kholein
6. `GEMINI_API_KEY=your_api_key_here` wali line mein `your_api_key_here` hata kar apni key paste karein

   Example:
   ```
   GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```
7. File **Save** karein (Ctrl+S)

### Step 4: App chalayein

1. `hariom-ai` folder mein jayein
2. **`run_windows.bat`** par double-click karein
3. Pehli baar mein ye khud:
   - Virtual environment banayega
   - Dependencies install karega
   - Server start karega
   - Browser mein chatbot khol dega
4. Bas! Ab aap AI se Hindi ya English mein baat kar sakte hain

### Band karna ho to?

Jis black window (command prompt) mein server chal raha hai, usme **Ctrl+C** dabayein ya window band kar dein.

---

## Quick Start (macOS / Linux)

```bash
# Terminal mein folder par jayein
cd hariom-ai

# Script ko executable banayein (sirf ek baar)
chmod +x run_mac_linux.sh

# Script chalayein
./run_mac_linux.sh
```

Baaki steps (API key set karna etc.) Windows jaise same hain.

---

## Deploy to Vercel

The Vercel deployment uses Neon PostgreSQL for persistent chat history and password protection for this personal, single-user app.

1. Create a project at [Neon](https://neon.tech/) and copy its **pooled** PostgreSQL connection string. Keep it private.
2. In [Vercel](https://vercel.com/), import the `HARIOM45-67/hariom-ai` GitHub repository and set **Root Directory** to `hariom-ai`.
3. Before deploying, add these environment variables in the Vercel project settings for **Production** (and Preview too, if you enable preview deployments):
   - `DATABASE_URL` — the pooled Neon connection string.
   - `GEMINI_API_KEY` — your Google Gemini API key.
   - `SITE_PASSWORD` — a long, private password for your personal chatbot.
4. Deploy the project. Open its Vercel URL and enter `hariom` as the username and your `SITE_PASSWORD` when the browser asks for authentication.

Do not publish or share these secrets. Chat history is kept in the Neon database and is shared by anyone you give the password to. Changing `SITE_PASSWORD` does not create separate user accounts or separate chat histories.

---

## Manual Setup (agar script na chale)

Agar koi reason se batch/script file na chale, to ye commands manually chala sakte hain:

```bash
# 1. Virtual environment banao
python -m venv venv

# 2. Activate karo
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 3. Dependencies install karo
pip install -r requirements.txt

# 4. .env file banao aur API key set karo
# .env.example ko copy karke .env banao, phir key paste karo

# 5. App chalao
python app.py
```

Phir browser mein **http://127.0.0.1:5000** kholin.

---

## Project Structure

```
hariom-ai/
├── app.py                # Flask backend (server, AI integration, database)
├── api/
│   └── index.py          # Vercel Flask entry point
├── templates/
│   └── index.html        # Chat UI page
├── static/
│   ├── style.css         # All styling (responsive, modern)
│   └── script.js         # Frontend logic (chat, history, copy, regenerate)
├── requirements.txt      # Python dependencies
├── vercel.json           # Vercel routing and asset configuration
├── .env.example          # Template for API key config
├── .gitignore            # Files to exclude from version control
├── run_windows.bat       # One-click Windows setup & run
├── run_mac_linux.sh      # One-click macOS/Linux setup & run
└── README.md             # This file
```

After running once, these are also created (gitignored):
```
├── .env                  # Your API key (never share this!)
├── venv/                 # Python virtual environment
└── chat_history.db       # SQLite chat history database
```

---

## Configuration

| Variable | Where | Description |
|----------|-------|-------------|
| `GEMINI_API_KEY` | `.env` file | Your Google Gemini API key. Get one free at https://aistudio.google.com/app/apikey |

---

## API Key Missing?

Agar API key set nahi hai to:

- App chalega lekin AI jawab nahi dega
- Browser mein ek banner dikhega jaise setup karna hai
- Error message clearly batayega ki `.env` file mein key set karni hai

---

## Security Notes

- API key sirf server par hoti hai, browser mein kabhi expose nahi hoti
- Debug mode hamesha OFF rehta hai (detailed errors public nahi hote)
- User input server par validate hota hai (length limit: 4000 characters)
- Chat content safe DOM methods se display hota hai (XSS protection)
- App sirf `127.0.0.1` par chalta hai (localhost, network par exposed nahi)

---

## Dependencies

```
Flask==3.0.3
python-dotenv==1.0.1
requests==2.32.3
```

Sab stable aur compatible versions hain.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Python not found" | Python install karein, "Add to PATH" tick karein |
| "pip not found" | Virtual environment activate karein (script khud karta hai) |
| AI jawab nahi de raha | `.env` file mein API key check karein |
| "Access denied" error | API key invalid hai, nayi key banayein |
| "Too many requests" | Thoda wait karein (rate limit), phir try karein |
| Port 5000 busy | `app.py` mein port change karein (last line) |
| Browser nahi khulta | Manually http://127.0.0.1:5000 kholin |

---

## License

Free to use for personal and educational purposes.
