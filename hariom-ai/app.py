"""
Hariom AI - Flask Backend
---------------------------------
Serves the chat UI, stores chat history in SQLite, and proxies
conversation requests to the Google Gemini API so the API key
stays on the server (never exposed to the browser).
"""

import os
import sqlite3
import datetime
import requests
from flask import Flask, render_template, request, jsonify, g
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "chat_history.db")
ENV_PATH = os.path.join(BASE_DIR, ".env")

load_dotenv(ENV_PATH)

app = Flask(__name__)
# debug is always False so detailed errors are never exposed publicly
app.config["DEBUG"] = False

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = "gemini-3.8-flash"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
)

# Safety limits
MAX_MESSAGE_LENGTH = 4000          # single user message
MAX_HISTORY_MESSAGES = 50          # messages sent to the model as context
REQUEST_TIMEOUT = 30               # seconds


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------
def get_db():
    """Return a SQLite connection for the current request."""
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """Create tables on first run."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
        )
        """
    )
    conn.commit()
    conn.close()


init_db()


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------
def now_iso():
    return datetime.datetime.now(datetime.UTC).isoformat()


def get_or_create_chat(chat_id):
    """Return an existing chat row or create a new one."""
    db = get_db()
    if chat_id:
        row = db.execute("SELECT * FROM chats WHERE id = ?", (chat_id,)).fetchone()
        if row:
            return row["id"]
    # create a fresh chat
    cur = db.execute(
        "INSERT INTO chats (title, created_at) VALUES (?, ?)",
        ("New Chat", now_iso()),
    )
    db.commit()
    return cur.lastrowid


def save_message(chat_id, role, content):
    db = get_db()
    cur = db.execute(
        "INSERT INTO messages (chat_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (chat_id, role, content, now_iso()),
    )
    db.commit()
    return cur.lastrowid


def update_chat_title(chat_id, first_message):
    """Set a chat title from the first user message (trimmed)."""
    title = first_message.strip().split("\n")[0][:40]
    if not title:
        title = "New Chat"
    db = get_db()
    db.execute("UPDATE chats SET title = ? WHERE id = ?", (title, chat_id))
    db.commit()


def build_gemini_history(chat_id, new_user_text):
    """Fetch recent stored messages and format them for the Gemini API."""
    db = get_db()
    rows = db.execute(
        "SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT ?",
        (chat_id, MAX_HISTORY_MESSAGES),
    ).fetchall()
    # reverse so oldest is first
    history = list(reversed(rows))
    contents = []
    for r in history:
        contents.append({"role": r["role"], "parts": [{"text": r["content"]}]})
    # ensure the latest user message is included (it was saved just before)
    if not history or history[-1]["content"] != new_user_text:
        contents.append({"role": "user", "parts": [{"text": new_user_text}]})
    return contents


def call_gemini(contents):
    """Call the Gemini API and return the assistant reply text.

    Raises RuntimeError with a friendly message on any failure.
    """
    if not GEMINI_API_KEY:
        raise RuntimeError(
            "API key not configured. Please add your GEMINI_API_KEY to the .env file. "
            "See .env.example for instructions."
        )

    system_instruction = (
        "You are Hariom AI, a friendly and helpful assistant that speaks both Hindi "
        "(Devanagari and Roman/Hinglish) and English. Reply in the same language the "
        "user writes in. Be concise, clear, and polite."
    )

    payload = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 2048,
            "topP": 0.95,
        },
    }

    try:
        resp = requests.post(
            GEMINI_URL,
            json=payload,
            timeout=REQUEST_TIMEOUT,
            headers={"Content-Type": "application/json"},
        )
    except requests.Timeout:
        raise RuntimeError("The AI service took too long to respond. Please try again.")
    except requests.ConnectionError:
        raise RuntimeError(
            "Could not connect to the AI service. Please check your internet connection."
        )
    except requests.RequestException as exc:
        raise RuntimeError(f"Network error while contacting AI service: {exc}")

    if resp.status_code == 400:
        raise RuntimeError(
            "The AI service rejected the request. Please check that your API key is valid."
        )
    if resp.status_code == 403:
        raise RuntimeError(
            "Access denied by the AI service. Your API key may be invalid or revoked."
        )
    if resp.status_code == 429:
        raise RuntimeError(
            "You have sent too many requests. Please wait a moment and try again."
        )
    if not resp.ok:
        raise RuntimeError(
            f"The AI service returned an error (status {resp.status_code}). Please try again."
        )

    try:
        data = resp.json()
    except ValueError:
        raise RuntimeError("Received an unreadable response from the AI service.")

    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        # Sometimes the model refuses and returns no candidates
        finish = data.get("candidates", [{}])[0].get("finishReason", "")
        if finish == "SAFETY":
            raise RuntimeError("The AI declined to answer for safety reasons. Try rephrasing.")
        raise RuntimeError("The AI did not return a valid reply. Please try again.")

    return (text or "").strip() or "I don't have a response for that. Could you rephrase?"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/chats")
def list_chats():
    db = get_db()
    rows = db.execute(
        "SELECT id, title, created_at FROM chats ORDER BY id DESC"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/chats/<int:chat_id>")
def get_chat(chat_id):
    db = get_db()
    chat = db.execute("SELECT * FROM chats WHERE id = ?", (chat_id,)).fetchone()
    if not chat:
        return jsonify({"error": "Chat not found."}), 404
    msgs = db.execute(
        "SELECT id, role, content, created_at FROM messages WHERE chat_id = ? ORDER BY id ASC",
        (chat_id,),
    ).fetchall()
    return jsonify({"id": chat["id"], "title": chat["title"], "messages": [dict(m) for m in msgs]})


@app.route("/api/chats", methods=["POST"])
def create_chat():
    db = get_db()
    cur = db.execute(
        "INSERT INTO chats (title, created_at) VALUES (?, ?)",
        ("New Chat", now_iso()),
    )
    db.commit()
    return jsonify({"id": cur.lastrowid, "title": "New Chat"}), 201


@app.route("/api/chats/<int:chat_id>", methods=["DELETE"])
def delete_chat(chat_id):
    db = get_db()
    db.execute("DELETE FROM messages WHERE chat_id = ?", (chat_id,))
    db.execute("DELETE FROM chats WHERE id = ?", (chat_id,))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/chats/clear_all", methods=["DELETE"])
def clear_all_chats():
    db = get_db()
    db.execute("DELETE FROM messages")
    db.execute("DELETE FROM chats")
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Invalid request."}), 400

    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Message cannot be empty."}), 400
    if len(message) > MAX_MESSAGE_LENGTH:
        return jsonify({"error": f"Message is too long (max {MAX_MESSAGE_LENGTH} characters)."}), 400

    chat_id = data.get("chat_id")
    try:
        chat_id = int(chat_id) if chat_id else None
    except (TypeError, ValueError):
        chat_id = None

    chat_id = get_or_create_chat(chat_id)

    # Save the user message
    save_message(chat_id, "user", message)
    # Update chat title if this looks like the first message
    db = get_db()
    count = db.execute(
        "SELECT COUNT(*) AS c FROM messages WHERE chat_id = ?", (chat_id,)
    ).fetchone()["c"]
    if count == 1:
        update_chat_title(chat_id, message)

    # Build context and call the AI
    contents = build_gemini_history(chat_id, message)
    try:
        reply = call_gemini(contents)
    except RuntimeError as exc:
        return jsonify({"error": str(exc), "chat_id": chat_id}), 502

    save_message(chat_id, "model", reply)

    title = db.execute("SELECT title FROM chats WHERE id = ?", (chat_id,)).fetchone()["title"]
    return jsonify({"chat_id": chat_id, "title": title, "reply": reply})


@app.route("/api/regenerate", methods=["POST"])
def regenerate():
    """Re-run the AI for the last user message in a chat (drops the previous model reply)."""
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Invalid request."}), 400

    chat_id = data.get("chat_id")
    try:
        chat_id = int(chat_id) if chat_id else None
    except (TypeError, ValueError):
        chat_id = None
    if not chat_id:
        return jsonify({"error": "A chat id is required to regenerate."}), 400

    db = get_db()
    chat = db.execute("SELECT * FROM chats WHERE id = ?", (chat_id,)).fetchone()
    if not chat:
        return jsonify({"error": "Chat not found."}), 404

    # Remove the most recent model message, then find the last user message
    last_model = db.execute(
        "SELECT id FROM messages WHERE chat_id = ? AND role = 'model' ORDER BY id DESC LIMIT 1",
        (chat_id,),
    ).fetchone()
    if last_model:
        db.execute("DELETE FROM messages WHERE id = ?", (last_model["id"],))
        db.commit()

    last_user = db.execute(
        "SELECT content FROM messages WHERE chat_id = ? AND role = 'user' ORDER BY id DESC LIMIT 1",
        (chat_id,),
    ).fetchone()
    if not last_user:
        return jsonify({"error": "No user message found to regenerate from."}), 400

    contents = build_gemini_history(chat_id, last_user["content"])
    try:
        reply = call_gemini(contents)
    except RuntimeError as exc:
        return jsonify({"error": str(exc), "chat_id": chat_id}), 502

    save_message(chat_id, "model", reply)
    return jsonify({"chat_id": chat_id, "reply": reply})


@app.route("/api/status")
def status():
    """Let the frontend know whether the API key is configured."""
    return jsonify({"api_key_configured": bool(GEMINI_API_KEY)})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # host 127.0.0.1 keeps it off network interfaces; debug is always False
    app.run(host="127.0.0.1", port=5000, debug=False)
