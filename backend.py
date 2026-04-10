from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import sqlite3
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import uuid
import csv
import io

DB_FILE = "luminopass.db"
app = Flask(__name__)
CORS(app)

# ═══════════════════════════════════════════
#  EMAIL CONFIGURATION
# ═══════════════════════════════════════════
EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", 587))
EMAIL_USER = os.environ.get("EMAIL_USER", "photodpp38@gmail.com")
EMAIL_PASS = os.environ.get("EMAIL_PASS", "aofm hbsg ihhi brwa")
EMAIL_FROM_NAME = "LuminoPass"

pending_payment = {
    "active": False,
    "amount": 0,
    "service": "",
    "timestamp": ""
}

ALLOWED_ROLES = ["ALLOW", "VIP", "BLOCK"]


def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def today_str():
    return datetime.now().strftime("%Y-%m-%d")


def init_db():
    con = get_db()
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            uid TEXT PRIMARY KEY,
            name TEXT,
            role TEXT DEFAULT 'ALLOW',
            balance INTEGER DEFAULT 0,
            email TEXT DEFAULT ''
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS access_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT,
            uid TEXT,
            name TEXT,
            decision TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT,
            uid TEXT,
            event TEXT,
            amount INTEGER,
            status TEXT
        )
    """)
    
    # ✅ ADDED THIS NEW PAYMENTS TABLE
    cur.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            ts          TEXT,
            uid         TEXT,
            name        TEXT,
            amount      INTEGER,
            service     TEXT,
            status      TEXT,
            receipt_id  TEXT,
            balance_after INTEGER
        )
    """)

    try:
        cur.execute("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''")
        print("✅ Added 'email' column to users table")
    except:
        pass

    con.commit()
    con.close()


def log_event(uid, event, amount, status):
    con = get_db()
    con.execute(
        "INSERT INTO logs(ts, uid, event, amount, status) VALUES(?,?,?,?,?)",
        (now(), uid, event, amount, status)
    )
    con.commit()
    con.close()


def save_payment(uid, name, amount, service, status, balance_after):
    """Save every payment attempt to the payments table"""
    receipt_id = "LP-" + str(uuid.uuid4()).upper().replace("-", "")[:8]
    con = get_db()
    con.execute("""
        INSERT INTO payments (ts, uid, name, amount, service, status, receipt_id, balance_after)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (now(), uid, name, amount, service, status, receipt_id, balance_after))
    con.commit()
    con.close()
    print(f"💾 Payment saved: {name} | ₹{amount} | {service} | {status}")


def generate_receipt_html(receipt_data):
    status_color = "#4caf50" if receipt_data.get("status") == "APPROVED" else "#ef5350"
    status_icon = "✅" if receipt_data.get("status") == "APPROVED" else "❌"
    status_text = receipt_data.get("status", "UNKNOWN")

    balance_section = ""
    if receipt_data.get("balance") is not None:
        balance_section = f"""
        <tr>
          <td style="padding:12px 20px; color:#aaa; font-size:14px;">Balance After</td>
          <td style="padding:12px 20px; text-align:right; font-weight:700; color:#ffd700; font-size:14px;">₹{receipt_data['balance']}</td>
        </tr>
        """

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; background:#0a0a1a; font-family:'Segoe UI',Arial,sans-serif;">
      <div style="max-width:480px; margin:30px auto; background:#12122a; border-radius:16px; overflow:hidden; border:1px solid #2a2a4a; box-shadow:0 8px 40px rgba(0,0,0,0.5);">
        <div style="background:linear-gradient(135deg, #1a1a3a 0%, #0d0d25 100%); padding:30px; text-align:center; border-bottom:2px solid #ffd700;">
          <div style="font-size:32px; margin-bottom:5px;">⚡</div>
          <div style="color:#ffd700; font-size:24px; font-weight:800; letter-spacing:1px;">LuminoPass</div>
          <div style="color:#666; font-size:12px; margin-top:4px; text-transform:uppercase; letter-spacing:2px;">Payment Receipt</div>
        </div>
        <div style="padding:20px; text-align:center; background:#0f0f25; border-bottom:1px solid #1a1a3a;">
          <div style="color:#ffd700; font-size:13px; font-weight:700; letter-spacing:1px;">RECEIPT #{receipt_data.get('receipt_id', 'N/A')}</div>
          <div style="color:#555; font-size:12px; margin-top:4px;">{receipt_data.get('timestamp', '')}</div>
        </div>
        <div style="padding:30px; text-align:center; background:linear-gradient(135deg, #1a1a35 0%, #151528 100%);">
          <div style="color:#888; font-size:12px; text-transform:uppercase; letter-spacing:2px; margin-bottom:8px;">Amount</div>
          <div style="color:#ffd700; font-size:42px; font-weight:800;">₹{receipt_data.get('amount', 0)}</div>
          <div style="margin-top:12px;">
            <span style="background:{status_color}22; color:{status_color}; padding:6px 18px; border-radius:20px; font-size:13px; font-weight:700; border:1px solid {status_color}44;">
              {status_icon} {status_text}
            </span>
          </div>
        </div>
        <div style="padding:5px 0; background:#12122a;">
          <table style="width:100%; border-collapse:collapse;">
            <tr style="border-bottom:1px solid #1a1a3a;">
              <td style="padding:12px 20px; color:#aaa; font-size:14px;">Customer</td>
              <td style="padding:12px 20px; text-align:right; font-weight:700; color:#fff; font-size:14px;">{receipt_data.get('name', 'Unknown')}</td>
            </tr>
            <tr style="border-bottom:1px solid #1a1a3a;">
              <td style="padding:12px 20px; color:#aaa; font-size:14px;">Card UID</td>
              <td style="padding:12px 20px; text-align:right; font-weight:700; color:#81c784; font-size:14px; font-family:monospace;">{receipt_data.get('uid', 'N/A')}</td>
            </tr>
            <tr style="border-bottom:1px solid #1a1a3a;">
              <td style="padding:12px 20px; color:#aaa; font-size:14px;">Service / Stall</td>
              <td style="padding:12px 20px; text-align:right; font-weight:700; color:#fff; font-size:14px;">{receipt_data.get('service', 'General')}</td>
            </tr>
            {balance_section}
          </table>
        </div>
        <div style="padding:25px; text-align:center; background:#0a0a1a; border-top:1px solid #1a1a3a;">
          <div style="color:#ffd700; font-size:16px; font-weight:700; margin-bottom:8px;">Thank You! 🎉</div>
          <div style="color:#555; font-size:11px; line-height:1.6;">
            This is a computer-generated receipt.<br>
            Powered by LuminoPass RFID System<br>
            For support, contact event admin.
          </div>
        </div>
      </div>
    </body>
    </html>
    """


def send_receipt_email(to_email, receipt_data):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"⚡ LuminoPass Receipt — ₹{receipt_data.get('amount', 0)} | {receipt_data.get('receipt_id', '')}"
        msg["From"] = f"{EMAIL_FROM_NAME} <{EMAIL_USER}>"
        msg["To"] = to_email

        plain_text = f"""
LuminoPass Payment Receipt
===========================
Receipt: {receipt_data.get('receipt_id', 'N/A')}
Date: {receipt_data.get('timestamp', '')}
Customer: {receipt_data.get('name', 'Unknown')}
Card UID: {receipt_data.get('uid', 'N/A')}
Service: {receipt_data.get('service', 'General')}
Amount: ₹{receipt_data.get('amount', 0)}
Status: {receipt_data.get('status', 'UNKNOWN')}
Balance After: ₹{receipt_data.get('balance', 'N/A')}
===========================
Thank you! Powered by LuminoPass.
        """

        html_content = generate_receipt_html(receipt_data)
        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            server.starttls()
            server.login(EMAIL_USER, EMAIL_PASS)
            server.sendmail(EMAIL_USER, to_email, msg.as_string())

        print(f"📧 Receipt sent to {to_email}")
        return True, "Email sent successfully"

    except Exception as e:
        print(f"❌ Email error: {str(e)}")
        return False, str(e)


@app.route("/")
def index():
    return jsonify({"status": "LuminoPass API running!", "time": now()})


@app.route("/api/health")
def health():
    return jsonify({"ok": True, "time": now()})


@app.route("/api/stats")
def stats():
    con = get_db()
    data = {
        "total_users": con.execute("SELECT COUNT(*) FROM users").fetchone()[0],
        "blocked_users": con.execute("SELECT COUNT(*) FROM users WHERE role='BLOCK'").fetchone()[0],
        "total_access": con.execute("SELECT COUNT(*) FROM access_log").fetchone()[0],
        "total_transactions": con.execute(
            "SELECT COUNT(*) FROM logs WHERE event LIKE 'PAY:%' OR event = 'TOPUP'"
        ).fetchone()[0],
        "denied_count": con.execute(
            "SELECT COUNT(*) FROM access_log WHERE decision='DENY'"
        ).fetchone()[0],
        "total_balance": con.execute(
            "SELECT COALESCE(SUM(balance), 0) FROM users"
        ).fetchone()[0],
        "approved_payments": con.execute(
            "SELECT COUNT(*) FROM logs WHERE event LIKE 'PAY:%' AND status='APPROVED'"
        ).fetchone()[0],
        "declined_payments": con.execute(
            "SELECT COUNT(*) FROM logs WHERE event LIKE 'PAY:%' AND (status LIKE 'DECLINED%' OR status LIKE 'DENY%' OR status LIKE 'BLOCKED%')"
        ).fetchone()[0],
    }
    con.close()
    return jsonify(data)


# ─────────────────────────────────────────
# 🆕 TODAY'S WALLET STATS API
# ─────────────────────────────────────────

@app.route("/api/stats/today")
def stats_today():
    con = get_db()
    today = today_str()

    total_revenue = con.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM logs WHERE event LIKE 'PAY:%' AND status='APPROVED' AND ts LIKE ?",
        (f"{today}%",)
    ).fetchone()[0]

    success_count = con.execute(
        "SELECT COUNT(*) FROM logs WHERE event LIKE 'PAY:%' AND status='APPROVED' AND ts LIKE ?",
        (f"{today}%",)
    ).fetchone()[0]

    failed_count = con.execute(
        "SELECT COUNT(*) FROM logs WHERE event LIKE 'PAY:%' AND status != 'APPROVED' AND ts LIKE ?",
        (f"{today}%",)
    ).fetchone()[0]

    avg_amount = con.execute(
        "SELECT COALESCE(AVG(amount), 0) FROM logs WHERE event LIKE 'PAY:%' AND status='APPROVED' AND ts LIKE ?",
        (f"{today}%",)
    ).fetchone()[0]

    total_topup = con.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM logs WHERE event='TOPUP' AND status='OK' AND ts LIKE ?",
        (f"{today}%",)
    ).fetchone()[0]

    total_txns = con.execute(
        "SELECT COUNT(*) FROM logs WHERE (event LIKE 'PAY:%' OR event = 'TOPUP') AND ts LIKE ?",
        (f"{today}%",)
    ).fetchone()[0]

    con.close()

    return jsonify({
        "date": today,
        "total_revenue": total_revenue,
        "success_count": success_count,
        "failed_count": failed_count,
        "avg_amount": round(avg_amount),
        "total_topup": total_topup,
        "total_txns": total_txns
    })


# ─────────────────────────────────────────
# USERS
# ─────────────────────────────────────────

@app.route("/api/users", methods=["GET"])
def list_users():
    con = get_db()
    rows = con.execute("SELECT uid, name, role, balance, email FROM users ORDER BY name").fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/users", methods=["POST"])
def upsert_user():
    data = request.get_json(force=True)
    uid = data.get("uid", "").strip().upper()
    name = data.get("name", "").strip()
    role = data.get("role", "ALLOW").strip().upper()
    balance = int(data.get("balance", 0))
    email = data.get("email", "").strip().lower()

    if not uid or not name:
        return jsonify({"error": "UID and Name required"}), 400

    if role not in ALLOWED_ROLES:
        role = "ALLOW"

    con = get_db()
    cur = con.cursor()
    cur.execute("SELECT balance FROM users WHERE uid=?", (uid,))
    existing = cur.fetchone()

    if existing:
        cur.execute("UPDATE users SET name=?, role=?, email=? WHERE uid=?", (name, role, email, uid))
    else:
        cur.execute(
            "INSERT INTO users(uid, name, role, balance, email) VALUES(?,?,?,?,?)",
            (uid, name, role, balance, email)
        )

    con.commit()
    con.close()
    return jsonify({"ok": True, "message": f"{name} saved"})


@app.route("/api/users/<uid>", methods=["PUT"])
def update_user(uid):
    uid = uid.strip().upper()
    data = request.get_json(force=True)

    name = (data.get("name") or "").strip()
    role = (data.get("role") or "ALLOW").strip().upper()
    balance = data.get("balance", None)
    email = data.get("email", None)

    if not name:
        return jsonify({"error": "Name required"}), 400

    if role not in ALLOWED_ROLES:
        role = "ALLOW"

    if balance is not None:
        try:
            balance = int(float(balance))
            if balance < 0:
                balance = 0
        except:
            return jsonify({"error": "Balance must be a number"}), 400

    con = get_db()
    cur = con.cursor()
    cur.execute("SELECT uid FROM users WHERE uid=?", (uid,))
    if not cur.fetchone():
        con.close()
        return jsonify({"error": "User not found"}), 404

    if balance is None and email is None:
        cur.execute("UPDATE users SET name=?, role=? WHERE uid=?", (name, role, uid))
    elif balance is None:
        cur.execute("UPDATE users SET name=?, role=?, email=? WHERE uid=?", (name, role, email.strip().lower(), uid))
    elif email is None:
        cur.execute("UPDATE users SET name=?, role=?, balance=? WHERE uid=?", (name, role, balance, uid))
    else:
        cur.execute("UPDATE users SET name=?, role=?, balance=?, email=? WHERE uid=?",
                     (name, role, balance, email.strip().lower(), uid))

    con.commit()
    con.close()
    return jsonify({"ok": True, "uid": uid, "name": name, "role": role, "balance": balance})


@app.route("/api/users/<uid>", methods=["DELETE"])
def delete_user(uid):
    uid = uid.strip().upper()
    con = get_db()
    con.execute("DELETE FROM users WHERE uid=?", (uid,))
    con.commit()
    con.close()
    return jsonify({"ok": True})


@app.route("/api/users/<uid>/block", methods=["POST"])
def block_user(uid):
    uid = uid.strip().upper()
    con = get_db()
    con.execute("UPDATE users SET role='BLOCK' WHERE uid=?", (uid,))
    con.commit()
    con.close()
    return jsonify({"ok": True, "uid": uid, "role": "BLOCK"})


@app.route("/api/users/<uid>/unblock", methods=["POST"])
def unblock_user(uid):
    uid = uid.strip().upper()
    con = get_db()
    con.execute("UPDATE users SET role='ALLOW' WHERE uid=?", (uid,))
    con.commit()
    con.close()
    return jsonify({"ok": True, "uid": uid, "role": "ALLOW"})


# ─────────────────────────────────────────
# SEND RECEIPT API
# ─────────────────────────────────────────

@app.route("/api/receipt/send", methods=["POST"])
def send_receipt():
    data = request.get_json(force=True)
    uid = (data.get("uid") or "").strip().upper()
    email_override = (data.get("email") or "").strip().lower()

    receipt_data = {
        "receipt_id": data.get("receipt_id", "LP-UNKNOWN"),
        "timestamp": data.get("timestamp", now()),
        "name": data.get("name", "Unknown"),
        "uid": uid,
        "service": data.get("service", "General"),
        "amount": data.get("amount", 0),
        "status": data.get("status", "UNKNOWN"),
        "balance": data.get("balance"),
    }

    to_email = email_override
    if not to_email and uid:
        con = get_db()
        row = con.execute("SELECT email FROM users WHERE uid=?", (uid,)).fetchone()
        con.close()
        if row and row["email"]:
            to_email = row["email"]

    if not to_email:
        return jsonify({"ok": False,
                         "error": "No email address found. Please provide an email or register one for this user."}), 400

    success, message = send_receipt_email(to_email, receipt_data)

    if success:
        return jsonify({"ok": True, "message": f"Receipt sent to {to_email}", "email": to_email})
    else:
        return jsonify({"ok": False, "error": f"Failed to send email: {message}"}), 500


@app.route("/api/receipt/preview", methods=["POST"])
def preview_receipt():
    data = request.get_json(force=True)
    receipt_data = {
        "receipt_id": data.get("receipt_id", "LP-PREVIEW"),
        "timestamp": data.get("timestamp", now()),
        "name": data.get("name", "Unknown"),
        "uid": data.get("uid", "N/A"),
        "service": data.get("service", "General"),
        "amount": data.get("amount", 0),
        "status": data.get("status", "APPROVED"),
        "balance": data.get("balance"),
    }
    html = generate_receipt_html(receipt_data)
    return html, 200, {"Content-Type": "text/html"}


# ─────────────────────────────────────────
# WALLET: TOPUP / PAY
# ─────────────────────────────────────────

@app.route("/api/topup", methods=["POST"])
def topup():
    data = request.get_json(force=True)
    uid = data.get("uid", "").strip().upper()
    amount = int(data.get("amount", 0))

    if not uid or amount <= 0:
        return jsonify({"error": "UID and amount > 0 required"}), 400

    con = get_db()
    cur = con.cursor()
    cur.execute("SELECT name, balance, role FROM users WHERE uid=?", (uid,))
    row = cur.fetchone()

    if not row:
        con.close()
        return jsonify({"error": "User not found"}), 404

    cur.execute("UPDATE users SET balance = balance + ? WHERE uid=?", (amount, uid))
    con.commit()
    new_balance = row["balance"] + amount
    con.close()

    log_event(uid, "TOPUP", amount, "OK")
    return jsonify({"ok": True, "new_balance": new_balance, "name": row["name"], "role": row["role"]})


@app.route("/api/pay/setup", methods=["POST"])
def setup_payment():
    global pending_payment
    data = request.get_json(force=True)
    amount = int(data.get("amount", 0))
    service = (data.get("service", "General") or "General").strip()

    if amount <= 0:
        return jsonify({"error": "Amount must be > 0"}), 400

    pending_payment = {
        "active": True,
        "amount": amount,
        "service": service,
        "timestamp": now()
    }
    print(f"💳 Payment setup: ₹{amount} at {service} — waiting for card tap...")
    return jsonify({"ok": True, "message": f"Waiting for card tap... ₹{amount} at {service}"})


@app.route("/api/pay/status", methods=["GET"])
def payment_status():
    return jsonify(pending_payment)


@app.route("/api/pay/cancel", methods=["POST"])
def cancel_payment():
    global pending_payment
    pending_payment = {"active": False, "amount": 0, "service": "", "timestamp": ""}
    return jsonify({"ok": True, "message": "Payment cancelled"})


@app.route("/api/pay/execute", methods=["POST"])
def execute_payment():
    global pending_payment
    data = request.get_json(force=True)
    uid = data.get("uid", "").strip().upper()

    if not pending_payment["active"]:
        return jsonify({"ok": False, "status": "NO_PENDING_PAYMENT"}), 400

    amount  = pending_payment["amount"]
    service = pending_payment["service"]

    con = get_db()
    cur = con.cursor()
    cur.execute("SELECT name, balance, role FROM users WHERE uid=?", (uid,))
    row = cur.fetchone()

    if not row:
        con.close()
        log_event(uid, f"PAY:{service}", amount, "DENY_NO_USER")
        # ✅ Save to payments table
        save_payment(uid, "Unknown", amount, service, "DENY_NO_USER", None)
        pending_payment = {"active": False, "amount": 0, "service": "", "timestamp": ""}
        return jsonify({"ok": False, "status": "DENY_NO_USER"})

    name  = row["name"]
    bal   = int(row["balance"])
    role  = (row["role"] or "ALLOW").upper()

    if role == "BLOCK":
        con.close()
        log_event(uid, f"PAY:{service}", amount, "BLOCKED_CARD")
        # ✅ Save to payments table
        save_payment(uid, name, amount, service, "BLOCKED_CARD", bal)
        pending_payment = {"active": False, "amount": 0, "service": "", "timestamp": ""}
        return jsonify({"ok": False, "status": "BLOCKED_CARD", "name": name})

    if bal < amount:
        con.close()
        log_event(uid, f"PAY:{service}", amount, "DECLINED_LOW_BAL")
        # ✅ Save to payments table
        save_payment(uid, name, amount, service, "DECLINED_LOW_BAL", bal)
        pending_payment = {"active": False, "amount": 0, "service": "", "timestamp": ""}
        return jsonify({"ok": False, "status": "DECLINED_LOW_BAL", "balance": bal, "name": name})

    # ✅ Deduct balance
    cur.execute("UPDATE users SET balance = balance - ? WHERE uid=?", (amount, uid))
    con.commit()
    new_balance = bal - amount
    con.close()

    log_event(uid, f"PAY:{service}", amount, "APPROVED")
    # ✅ Save to payments table
    save_payment(uid, name, amount, service, "APPROVED", new_balance)
    pending_payment = {"active": False, "amount": 0, "service": "", "timestamp": ""}

    return jsonify({
        "ok"      : True,
        "status"  : "APPROVED",
        "name"    : name,
        "amount"  : amount,
        "service" : service,
        "balance" : new_balance
    })


# ─────────────────────────────────────────
# LOGS / ACCESS LOG / SEARCH / SUMMARY
# ─────────────────────────────────────────

@app.route("/api/logs")
def get_logs():
    con = get_db()
    rows = con.execute(
        "SELECT ts, uid, event, amount, status FROM logs WHERE event LIKE 'PAY:%' OR event = 'TOPUP' ORDER BY id DESC LIMIT 200"
    ).fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/access_log")
def get_access_log():
    con = get_db()
    rows = con.execute(
        "SELECT ts, uid, name, decision FROM access_log ORDER BY id DESC LIMIT 200"
    ).fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/search")
def search():
    q = request.args.get("q", "").strip().upper()
    if not q:
        return jsonify({"users": [], "access_logs": [], "transaction_logs": []})

    con = get_db()
    users = con.execute(
        "SELECT uid, name, role, balance, email FROM users WHERE uid LIKE ? OR UPPER(name) LIKE ?",
        (f"%{q}%", f"%{q}%")
    ).fetchall()

    access = con.execute(
        "SELECT ts, uid, name, decision FROM access_log WHERE uid LIKE ? OR UPPER(name) LIKE ? ORDER BY id DESC LIMIT 50",
        (f"%{q}%", f"%{q}%")
    ).fetchall()

    transactions = con.execute(
        "SELECT ts, uid, event, amount, status FROM logs WHERE (event LIKE 'PAY:%' OR event = 'TOPUP') AND uid LIKE ? ORDER BY id DESC LIMIT 50",
        (f"%{q}%",)
    ).fetchall()

    con.close()
    return jsonify({
        "users": [dict(u) for u in users],
        "access_logs": [dict(a) for a in access],
        "transaction_logs": [dict(t) for t in transactions],
    })


@app.route("/api/user_summary/<uid>")
def user_summary(uid):
    uid = uid.strip().upper()
    con = get_db()

    user = con.execute("SELECT uid, name, role, balance, email FROM users WHERE uid=?", (uid,)).fetchone()
    if not user:
        con.close()
        return jsonify({"error": "User not found"}), 404

    total_spent = con.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM logs WHERE uid=? AND event LIKE 'PAY:%' AND status='APPROVED'",
        (uid,)
    ).fetchone()[0]

    total_topup = con.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM logs WHERE uid=? AND event='TOPUP' AND status='OK'",
        (uid,)
    ).fetchone()[0]

    total_access = con.execute(
        "SELECT COUNT(*) FROM access_log WHERE uid=?", (uid,)
    ).fetchone()[0]

    declined_count = con.execute(
        "SELECT COUNT(*) FROM logs WHERE uid=? AND event LIKE 'PAY:%' AND (status LIKE 'DECLINED%' OR status LIKE 'DENY%' OR status LIKE 'BLOCKED%')",
        (uid,)
    ).fetchone()[0]

    approved_count = con.execute(
        "SELECT COUNT(*) FROM logs WHERE uid=? AND event LIKE 'PAY:%' AND status='APPROVED'",
        (uid,)
    ).fetchone()[0]

    last_access = con.execute(
        "SELECT ts FROM access_log WHERE uid=? ORDER BY id DESC LIMIT 1", (uid,)
    ).fetchone()

    payments = con.execute(
        "SELECT ts, event, amount, status FROM logs WHERE uid=? AND (event LIKE 'PAY:%' OR event='TOPUP') ORDER BY id DESC LIMIT 50",
        (uid,)
    ).fetchall()

    con.close()

    return jsonify({
        "uid": user["uid"],
        "name": user["name"],
        "role": user["role"],
        "balance": user["balance"],
        "email": user["email"] or "",
        "total_spent": total_spent,
        "total_topup": total_topup,
        "total_access": total_access,
        "approved_count": approved_count,
        "declined_count": declined_count,
        "last_access": last_access["ts"] if last_access else "Never",
        "payments": [dict(p) for p in payments]
    })


# ─────────────────────────────────────────
# PAYMENTS TABLE API
# ─────────────────────────────────────────

@app.route("/api/payments", methods=["GET"])
def get_payments():
    """Get all payments from payments table"""
    con = get_db()
    rows = con.execute("""
        SELECT id, ts, uid, name, amount, service,
               status, receipt_id, balance_after
        FROM payments 
        ORDER BY id DESC 
        LIMIT 500
    """).fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/payments/stats", methods=["GET"])
def payments_stats():
    """Stats specifically from payments table"""
    con = get_db()
    total_revenue = con.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status='APPROVED'"
    ).fetchone()[0]

    total_count = con.execute(
        "SELECT COUNT(*) FROM payments"
    ).fetchone()[0]

    approved = con.execute(
        "SELECT COUNT(*) FROM payments WHERE status='APPROVED'"
    ).fetchone()[0]

    declined = con.execute(
        "SELECT COUNT(*) FROM payments WHERE status != 'APPROVED'"
    ).fetchone()[0]

    today = today_str()
    today_revenue = con.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status='APPROVED' AND ts LIKE ?",
        (f"{today}%",)
    ).fetchone()[0]

    today_count = con.execute(
        "SELECT COUNT(*) FROM payments WHERE ts LIKE ?",
        (f"{today}%",)
    ).fetchone()[0]

    # Revenue by service/stall
    by_stall = con.execute("""
        SELECT service, 
               SUM(amount) as revenue, 
               COUNT(*) as count
        FROM payments 
        WHERE status='APPROVED'
        GROUP BY service 
        ORDER BY revenue DESC
    """).fetchall()

    con.close()

    return jsonify({
        "total_revenue" : total_revenue,
        "total_count"   : total_count,
        "approved"      : approved,
        "declined"      : declined,
        "today_revenue" : today_revenue,
        "today_count"   : today_count,
        "by_stall"      : [dict(r) for r in by_stall]
    })


@app.route("/api/payments/export", methods=["GET"])
def export_payments():
    """Export payments as CSV"""
    con = get_db()
    rows = con.execute("""
        SELECT id, ts, uid, name, amount, service,
               status, receipt_id, balance_after
        FROM payments ORDER BY id DESC
    """).fetchall()
    con.close()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "ID", "Timestamp", "UID", "Name", 
        "Amount", "Service", "Status", 
        "Receipt ID", "Balance After"
    ])

    # Data
    for row in rows:
        writer.writerow(list(row))

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=payments.csv"}
    )


if __name__ == "__main__":
    init_db()
    print("=" * 50)
    print("🌐 LuminoPass API running!")
    print("   http://localhost:5000")
    print("   http://localhost:5000/api/stats")
    print("   http://localhost:5000/api/stats/today  🆕")
    print("   http://localhost:5000/api/users")
    print("=" * 50)
    print()
    print("📧 Email Config:")
    print(f"   HOST: {EMAIL_HOST}")
    print(f"   USER: {EMAIL_USER}")
    print(f"   (Set EMAIL_USER & EMAIL_PASS env vars or edit backend.py)")
    print("=" * 50)
    app.run(port=5000, debug=True)