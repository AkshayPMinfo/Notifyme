#!/usr/bin/env python3
import http.server
import socketserver
import os
import json
import urllib.request
import urllib.parse
import ssl
from datetime import datetime

# Simple .env loader
def load_dotenv():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip().strip("'\"")

load_dotenv()

PORT = 8080
SUPABASE_URL = "https://vpmngcagfxyqvemdgzav.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_YG5n4OWJxPLrkWN61rMXoA_LNUdE8IJ"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_ANON_KEY)
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev")

SSL_CONTEXT = ssl._create_unverified_context()

def make_supabase_request(method, table, data=None, query_params=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if query_params:
        url += f"?{query_params}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation" if method in ["POST", "PATCH"] else "count=exact"
    }
    req_body = None
    if data is not None:
        req_body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=req_body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=SSL_CONTEXT) as response:
            res_body = response.read().decode("utf-8")
            if res_body:
                return json.loads(res_body)
            return []
    except Exception as e:
        print(f"[ERROR] Supabase REST request to '{table}' failed: {e}")
        return None

def send_email(to_email, subject, html_content):
    if not RESEND_API_KEY:
        print("[EMAIL] Simulated (No Resend Key):", to_email)
        return True, "simulated"
    
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }
    payload = {
        "from": RESEND_FROM_EMAIL,
        "to": to_email,
        "subject": subject,
        "html": html_content
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, context=SSL_CONTEXT) as res:
            return True, "sent"
    except Exception as e:
        print(f"[ERROR] Resend API failed: {e}")
        return False, str(e)

class APIRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/api/send-test-email":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            try:
                data = json.loads(post_data)
                user_email = data.get("email")
                user_id = data.get("user_id")
                first_name = data.get("first_name", "User")
                
                if not user_email or not user_id:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"Missing email or user_id")
                    return
                
                # Fetch a startup to base the test email on, or use mock data
                startups = make_supabase_request("GET", "fj_funded_startups", query_params="limit=1")
                if startups and len(startups) > 0:
                    test_startup = startups[0]
                else:
                    test_startup = {
                        "id": "648ee769-474c-45f0-b57f-15c9fa70e3f5",
                        "startup_name": "Pramaana Labs",
                        "funding_stage": "Seed",
                        "funding_amount": "$27M",
                        "funding_date": "2026-06-22",
                        "website": "https://www.google.com/search?q=Pramaana%20Labs",
                        "location": "Delhi NCR",
                        "source_url": "https://techcrunch.com/2026/06/17/pramaana-labs-raises-27-million-seed-round-from-khosla-ventures-to-bring-formal-verification-to-ai/"
                    }
                
                subject = "New Funded Startup Match Found"
                html_content = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                        <h2 style="color: #111827; margin-top: 0;">New Funded Startup Match Found</h2>
                        <p>Hi {first_name},</p>
                        <p>A startup matching your preferences has raised a new round of funding:</p>
                        
                        <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                            <h3 style="margin-top: 0; margin-bottom: 10px; color: #111827;">{test_startup['startup_name']}</h3>
                            <p style="margin: 0; font-size: 0.95rem;">
                                <strong>Funding Stage:</strong> {test_startup['funding_stage']}<br>
                                <strong>Funding Amount:</strong> {test_startup['funding_amount']}<br>
                                <strong>Funding Date:</strong> {test_startup.get('funding_date', '2026-06-22')}
                            </p>
                        </div>
                        
                        <h4 style="color: #3b82f6; margin-bottom: 8px;">Why it matches:</h4>
                        <ul style="margin-top: 0; padding-left: 20px; font-size: 0.9rem;">
                            <li>Preferred Role Match</li>
                            <li>Preferred Location Match</li>
                        </ul>
                        
                        <div style="margin-top: 25px;">
                            <a href="{test_startup['source_url']}" target="_blank" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 0.875rem; margin-right: 10px;">View Funding News</a>
                            <a href="{test_startup['website']}" target="_blank" style="display: inline-block; border: 1px solid #d1d5db; color: #374151; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 0.875rem; background-color: white;">Visit Startup Website</a>
                        </div>
                    </body>
                </html>
                """
                
                # Send Email via Resend
                success, status = send_email(user_email, subject, html_content)
                
                # Create a notification record in fj_notifications
                startup_id = test_startup.get("id")
                
                # If guest user, set user_id to None/null to avoid foreign key violations in Supabase auth.users
                db_user_id = None if user_id == "00000000-0000-0000-0000-000000000000" else user_id
                
                notification_record = {
                    "user_id": db_user_id,
                    "startup_id": startup_id,
                    "job_title": "Product Manager",
                    "email_sent": success
                }
                make_supabase_request("POST", "fj_notifications", data=notification_record)
                
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "status": status}).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
        else:
            # Fall back to parent SimpleHTTPRequestHandler for static files
            super().do_POST()

if __name__ == "__main__":
    print(f"Starting API Server on http://localhost:{PORT}...")
    # Allow address reuse to prevent bind errors on quick restarts
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), APIRequestHandler) as httpd:
        httpd.serve_forever()
