import time
import sqlite3
import serial
import requests
from datetime import datetime
from serial.tools import list_ports

BAUD = 9600
DB_FILE = "luminopass.db"
API_URL = "http://localhost:5000/api"


def find_arduino_port():
    ports = list(list_ports.comports())
    for p in ports:
        desc = (p.description or "").lower()
        if any(kw in desc for kw in ["arduino", "ch340", "usb-serial", "usb serial"]):
            return p.device
    if len(ports) == 1:
        return ports[0].device
    return None


def init_db():
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            uid TEXT PRIMARY KEY,
            name TEXT,
            role TEXT DEFAULT 'ALLOW',
            balance INTEGER DEFAULT 0
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
    conn.commit()
    conn.close()


def seed_demo_users():
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM users")
    if cur.fetchone()[0] > 0:
        conn.close()
        return

    demo = [
        ("A015FA0E", "Guest A", "ALLOW", 500),
        ("E9534065", "Guest B", "VIP", 1000),
        ("D3FCB4C9", "Guest C", "ALLOW", 250),
    ]
    for uid, name, role, balance in demo:
        cur.execute(
            "INSERT INTO users(uid, name, role, balance) VALUES(?,?,?,?)",
            (uid, name, role, balance)
        )
    conn.commit()
    conn.close()


def ts():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def ts_short():
    return datetime.now().strftime("%H:%M:%S")


def check_uid(uid):
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("SELECT role, name, balance FROM users WHERE uid=?", (uid,))
    row = cur.fetchone()
    conn.close()

    if row:
        role, name, balance = row
        role = (role or "").upper()

        if role == "VIP":
            return "VIP", name, int(balance or 0)
        elif role == "ALLOW":
            return "ALLOW", name, int(balance or 0)
        elif role == "BLOCK":
            return "DENY", name, int(balance or 0)
        else:
            return "DENY", name, int(balance or 0)

    return "DENY", None, 0


def log_access(uid, name, decision):
    conn = sqlite3.connect(DB_FILE)
    conn.execute(
        "INSERT INTO access_log(ts, uid, name, decision) VALUES(?,?,?,?)",
        (ts(), uid, name or "Unknown", decision)
    )
    conn.commit()
    conn.close()


def log_event(uid, event, amount, status):
    conn = sqlite3.connect(DB_FILE)
    conn.execute(
        "INSERT INTO logs(ts, uid, event, amount, status) VALUES(?,?,?,?,?)",
        (ts(), uid, event, amount, status)
    )
    conn.commit()
    conn.close()


def check_pending_payment():
    try:
        res = requests.get(f"{API_URL}/pay/status", timeout=1)
        data = res.json()
        return data.get("active", False)
    except Exception:
        return False


def execute_payment(uid):
    try:
        res = requests.post(f"{API_URL}/pay/execute", json={"uid": uid}, timeout=3)
        return res.json()
    except Exception as e:
        print(f"  ❌ Payment API error: {e}")
        return {"ok": False, "status": "API_ERROR"}


def open_serial():
    while True:
        port = find_arduino_port()
        if not port:
            print("⚠️ Arduino port not found. Retrying in 2 seconds...")
            time.sleep(2)
            continue

        try:
            print(f"🔌 Connecting to {port} ...")
            ser = serial.Serial(
                port=port,
                baudrate=BAUD,
                timeout=1,
                write_timeout=1
            )
            time.sleep(2)  # allow Arduino reset to finish
            print(f"✅ Serial connected on {port}")
            print("✅ LuminoPass Bridge running. Tap cards...\n")
            print("=" * 55)
            return ser
        except Exception as e:
            print(f"❌ Serial open failed on {port}: {e}")
            print("Retrying in 2 seconds...")
            time.sleep(2)


def safe_readline(ser):
    try:
        raw = ser.readline()
        if not raw:
            return ""
        return raw.decode(errors="ignore").strip()
    except (serial.SerialException, OSError) as e:
        print(f"⚠️ Serial read error: {e}")
        return None


def safe_write(ser, msg):
    try:
        ser.write((msg + "\n").encode())
        return True
    except (serial.SerialException, OSError) as e:
        print(f"⚠️ Serial write error: {e}")
        return False


def main():
    init_db()
    seed_demo_users()
    print("✅ Database ready")

    ser = open_serial()

    try:
        while True:
            line = safe_readline(ser)

            # serial died -> reconnect
            if line is None:
                try:
                    ser.close()
                except Exception:
                    pass
                print("🔄 Serial disconnected. Reconnecting...\n")
                ser = open_serial()
                continue

            if not line:
                continue

            if line.startswith("UID:"):
                uid = line.split("UID:")[1].strip().upper()
                t = ts_short()

                # PAYMENT MODE
                if check_pending_payment():
                    decision, name, balance = check_uid(uid)

                    if decision == "DENY" and name:
                        print(f"[{t}] ⛔ BLOCKED CARD tapped: {name} ({uid})")
                        log_event(uid, "PAY:PENDING", 0, "BLOCKED_LOCAL")
                        if not safe_write(ser, "DENY"):
                            ser.close()
                            ser = open_serial()
                        print("-" * 55)
                        continue

                    print(f"[{t}] 💳 PAYMENT MODE — Card tapped: {uid}")
                    result = execute_payment(uid)

                    if result.get("ok"):
                        print(f"  ✅ APPROVED: {result.get('name')} | Balance: ₹{result.get('balance')}")
                        if not safe_write(ser, "ALLOW"):
                            ser.close()
                            ser = open_serial()
                    else:
                        print(f"  ❌ PAYMENT FAILED: {result.get('status')}")
                        if not safe_write(ser, "DENY"):
                            ser.close()
                            ser = open_serial()

                    print("-" * 55)
                    continue

                # ACCESS MODE
                decision, name, balance = check_uid(uid)
                log_access(uid, name, decision)
                log_event(uid, "ACCESS", 0, decision)

                if name:
                    if decision == "DENY":
                        print(f"[{t}] 🪪 {name} ({uid}) | ⛔ DENY/BLOCK | ₹{balance}")
                    else:
                        print(f"[{t}] 🪪 {name} ({uid}) | {decision} | ₹{balance}")
                else:
                    print(f"[{t}] 🪪 Unknown ({uid}) | {decision}")

                print("-" * 55)

                if not safe_write(ser, decision):
                    ser.close()
                    ser = open_serial()

    except KeyboardInterrupt:
        print("\n🛑 Bridge stopped by user.")
    finally:
        try:
            ser.close()
        except Exception:
            pass
        print("✅ Port closed.")


if __name__ == "__main__":
    main()