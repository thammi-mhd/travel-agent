# app.py (Flask backend)
import os
import re
import sqlite3
import smtplib
import uuid
from datetime import datetime, timedelta
from email.message import EmailMessage
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from threading import Lock

# ----------------------------
# Config
# ----------------------------
OTP_EXPIRY_MINUTES = 5
VERIFICATION_TOKEN_EXPIRY_MINUTES = 15

SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT") or 587)
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASS = os.environ.get("SMTP_PASS")
FROM_EMAIL = os.environ.get("FROM_EMAIL")

# Allow specifying allowed frontend origin, default to localhost:5500 for local dev
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5500")

DB_PATH = os.environ.get("DB_PATH", "users.db")

# ----------------------------
# App init
# ----------------------------
app = Flask(__name__)
CORS(app, origins=[FRONTEND_ORIGIN])
bcrypt = Bcrypt(app)

# ----------------------------
# DB helpers
# ----------------------------
def get_conn():
    return sqlite3.connect(DB_PATH, check_same_thread=False)

def init_db():
    conn = get_conn()
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS otps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            otp TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            token TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()

init_db()

# ----------------------------
# Simple in-memory rate limiter for send_otp (email -> (count, first_ts))
# Note: This is ephemeral (process memory). Use Redis for production.
# ----------------------------
_rate_lock = Lock()
_rate_store = {}  # email -> (count, first_ts)
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 5      # max calls per window per email

def check_rate_limit(email):
    now = datetime.utcnow().timestamp()
    with _rate_lock:
        rec = _rate_store.get(email)
        if not rec:
            _rate_store[email] = [1, now]
            return True
        count, first_ts = rec
        if now - first_ts > RATE_LIMIT_WINDOW:
            _rate_store[email] = [1, now]
            return True
        if count >= RATE_LIMIT_MAX:
            return False
        rec[0] += 1
        return True

# ----------------------------
# Utility: simple email validation
# ----------------------------
EMAIL_RE = re.compile(r"^[^@ \t\r\n]+@[^@ \t\r\n]+\.[^@ \t\r\n]+$")

def is_valid_email(email: str):
    return bool(EMAIL_RE.match(email))

# ----------------------------
# Utility: send email (falls back to printing)
# ----------------------------
def send_email(to_email: str, subject: str, body: str):
    if SMTP_HOST and SMTP_USER and SMTP_PASS and FROM_EMAIL:
        try:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = FROM_EMAIL
            msg["To"] = to_email
            msg.set_content(body)

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
                smtp.starttls()
                smtp.login(SMTP_USER, SMTP_PASS)
                smtp.send_message(msg)
            app.logger.info(f"Sent email to {to_email}")
            return True
        except Exception:
            app.logger.exception("SMTP send failed, falling back to console.")
    # Fallback (dev): print the OTP in server logs
    app.logger.info(f"(DEV) Email to {to_email} -- {subject}\n\n{body}")
    return True

# ----------------------------
# Endpoint: send OTP
# ----------------------------
@app.route("/api/send-otp", methods=["POST"])
def send_otp():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()

    if not email or not is_valid_email(email):
        return jsonify({"message": "Valid email is required"}), 400

    if not check_rate_limit(email):
        return jsonify({"message": "Too many OTP requests. Try again later."}), 429

    # generate a 6-digit OTP
    otp = f"{uuid.uuid4().int % 1000000:06d}"
    expires_at = (datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)).isoformat()

    conn = get_conn()
    c = conn.cursor()
    c.execute("INSERT INTO otps (email, otp, expires_at, used) VALUES (?, ?, ?, 0)", (email, otp, expires_at))
    conn.commit()
    conn.close()

    subject = "Your signup OTP"
    body = f"Your OTP is: {otp}\nThis code will expire in {OTP_EXPIRY_MINUTES} minutes."

    send_email(email, subject, body)
    return jsonify({"message": "OTP sent (if configured, check email)."}), 200

# ----------------------------
# Endpoint: verify OTP -> returns verification token
# ----------------------------
@app.route("/api/verify-otp", methods=["POST"])
def verify_otp():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    otp = (data.get("otp") or "").strip()

    if not email or not otp:
        return jsonify({"message": "Email and otp required"}), 400

    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id, otp, expires_at, used FROM otps WHERE email=? ORDER BY id DESC LIMIT 1", (email,))
    row = c.fetchone()

    if not row:
        conn.close()
        return jsonify({"message": "OTP not found"}), 404

    otp_id, stored_otp, expires_at_str, used = row
    try:
        expires_at = datetime.fromisoformat(expires_at_str)
    except Exception:
        conn.close()
        return jsonify({"message": "Server: invalid OTP record"}), 500

    if used:
        conn.close()
        return jsonify({"message": "OTP already used"}), 400

    if datetime.utcnow() > expires_at:
        conn.close()
        return jsonify({"message": "OTP expired"}), 400

    if otp != stored_otp:
        conn.close()
        return jsonify({"message": "OTP invalid"}), 401

    # mark the otp as used
    c.execute("UPDATE otps SET used=1 WHERE id=?", (otp_id,))

    # create verification token
    token = uuid.uuid4().hex
    token_expires_at = (datetime.utcnow() + timedelta(minutes=VERIFICATION_TOKEN_EXPIRY_MINUTES)).isoformat()
    c.execute("INSERT INTO verifications (email, token, expires_at, used) VALUES (?, ?, ?, 0)",
              (email, token, token_expires_at))
    conn.commit()
    conn.close()

    return jsonify({"message": "OTP verified", "verification_token": token, "expires_in_minutes": VERIFICATION_TOKEN_EXPIRY_MINUTES}), 200

# ----------------------------
# Endpoint: signup (requires verification_token)
# ----------------------------
@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    verification_token = data.get("verification_token") or ""

    if not email or not password or not verification_token:
        return jsonify({"message": "Email, password and verification token required"}), 400

    if not is_valid_email(email):
        return jsonify({"message": "Invalid email"}), 400

    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id, expires_at, used FROM verifications WHERE email=? AND token=? ORDER BY id DESC LIMIT 1",
              (email, verification_token))
    row = c.fetchone()

    if not row:
        conn.close()
        return jsonify({"message": "Invalid verification token"}), 401

    ver_id, expires_at_str, used = row
    try:
        expires_at = datetime.fromisoformat(expires_at_str)
    except Exception:
        conn.close()
        return jsonify({"message": "Server: invalid verification record"}), 500

    if used:
        conn.close()
        return jsonify({"message": "Verification token already used"}), 400
    if datetime.utcnow() > expires_at:
        conn.close()
        return jsonify({"message": "Verification token expired"}), 400

    # check if user already exists
    c.execute("SELECT id FROM users WHERE email=?", (email,))
    if c.fetchone():
        conn.close()
        return jsonify({"message": "Email already registered"}), 409

    # hash password and create user
    hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")
    now = datetime.utcnow().isoformat()
    c.execute("INSERT INTO users (email, password, created_at) VALUES (?, ?, ?)", (email, hashed_password, now))

    # mark verification token used
    c.execute("UPDATE verifications SET used=1 WHERE id=?", (ver_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "Signup successful"}), 201

# ----------------------------
# Endpoint: login
# ----------------------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT password FROM users WHERE email = ?", (email,))
    row = c.fetchone()
    conn.close()

    if row and bcrypt.check_password_hash(row[0], password):
        return jsonify({"message": "Login successful", "token": "example_token_12345"}), 200
    else:
        return jsonify({"message": "Invalid email or password"}), 401

# ----------------------------
# Run
# ----------------------------
if __name__ == "__main__":
    # In production, run via gunicorn/uvicorn + TLS (nginx)
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
