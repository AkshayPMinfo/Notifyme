import json
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from http.server import BaseHTTPRequestHandler
import server as email_server

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')

        try:
            data = json.loads(post_data)
            user_email = data.get("email")
            user_id = data.get("user_id")
            first_name = data.get("first_name", "User")
            startup_id = data.get("startup_id")  # Optional: specific startup to resend

            if not user_email or not user_id:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": "Missing email or user_id"}).encode())
                return

            # If startup_id provided, fetch that specific startup; otherwise use the latest
            if startup_id:
                startups = email_server.make_supabase_request(
                    "GET", "fj_funded_startups",
                    query_params=f"id=eq.{startup_id}&limit=1"
                )
            else:
                startups = email_server.make_supabase_request("GET", "fj_funded_startups", query_params="limit=1")

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
                    "source_url": "https://techcrunch.com/2026/06/17/pramaana-labs-raises-27-million-seed-round/"
                }

            subject = f"Funded Startup: {test_startup['startup_name']} raised {test_startup.get('funding_amount', '')}"
            funding_date_str = test_startup.get('funding_date', '')
            website_btn = ""
            if test_startup.get('website'):
                website_btn = f'<a href="{test_startup["website"]}" target="_blank" style="display:inline-block;background-color:#111827;color:white;padding:10px 18px;text-decoration:none;border-radius:6px;font-weight:600;font-size:0.875rem;margin-right:10px;">Visit Website</a>'

            html_content = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #111827; margin-top: 0;">Newly Funded Startup Alert</h2>
                    <p>Hi {first_name},</p>
                    <p>A startup has recently raised funding that may interest you:</p>
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                        <h3 style="margin-top: 0; color: #111827;">{test_startup['startup_name']}</h3>
                        <p style="margin: 0; font-size: 0.95rem;">
                            <strong>Funding Stage:</strong> {test_startup['funding_stage']}<br>
                            <strong>Funding Amount:</strong> {test_startup.get('funding_amount', 'N/A')}<br>
                            <strong>Funding Date:</strong> {funding_date_str}
                        </p>
                    </div>
                    <div style="margin-top: 25px;">
                        {website_btn}
                        <a href="{test_startup.get('source_url', '#')}" target="_blank" style="display:inline-block;background-color:#3b82f6;color:white;padding:10px 18px;text-decoration:none;border-radius:6px;font-weight:600;font-size:0.875rem;">View Funding News</a>
                    </div>
                    <p style="margin-top: 30px; font-size: 0.8rem; color: #6b7280;">You're receiving this because you signed up for FundedJobs AI alerts.</p>
                </body>
            </html>
            """

            success, status = email_server.send_email(user_email, subject, html_content)

            db_user_id = None if user_id == "00000000-0000-0000-0000-000000000000" else user_id
            notification_record = {
                "user_id": db_user_id,
                "startup_id": test_startup.get("id"),
                "job_title": "General Interest",
                "email_sent": success
            }
            email_server.make_supabase_request("POST", "fj_notifications", data=notification_record)

            try:
                status_json = json.loads(status)
            except Exception:
                status_json = {"raw": status}

            self.send_response(200 if success else 400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": success, "status": status_json}).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode())

    def log_message(self, format, *args):
        pass
