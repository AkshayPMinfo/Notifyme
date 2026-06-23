import http.server
import json
import os
import urllib.request
import ssl
import sys

# Add root folder to sys.path so we can import server and discovery_service
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import server
import discovery_service

class handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/cron-discovery":
            try:
                print("[CRON] Starting discovery cycle via Vercel Serverless Function...")
                discovery_service.run_discovery()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "message": "Discovery run completed"}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

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
                startups = server.make_supabase_request("GET", "fj_funded_startups", query_params="limit=1")
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
                
                success, status = server.send_email(user_email, subject, html_content)
                
                # Create a notification record in fj_notifications
                startup_id = test_startup.get("id")
                db_user_id = None if user_id == "00000000-0000-0000-0000-000000000000" else user_id
                
                notification_record = {
                    "user_id": db_user_id,
                    "startup_id": startup_id,
                    "job_title": "Product Manager",
                    "email_sent": success
                }
                server.make_supabase_request("POST", "fj_notifications", data=notification_record)
                
                try:
                    status_json = json.loads(status)
                except Exception:
                    status_json = {"raw": status}

                self.send_response(200 if success else 400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": success, "status": status_json}).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
        elif self.path == "/api/test-email":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            try:
                data = json.loads(post_data)
                to_email = data.get("to_email")
                
                if not to_email:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"success": False, "error": "Missing to_email"}).encode('utf-8'))
                    return
                
                print(f"[TEST EMAIL] Request received for recipient: {to_email}")
                subject = "Resend Diagnostic Endpoint Test"
                html_content = """
                <html>
                    <body>
                        <h2>Resend Diagnostic Test</h2>
                        <p>This is a diagnostic email sent from the <code>/api/test-email</code> endpoint.</p>
                        <p>If you received this, your Resend API connection is fully working.</p>
                    </body>
                </html>
                """
                
                success, response_body = server.send_email(to_email, subject, html_content)
                
                try:
                    res_json = json.loads(response_body)
                except Exception:
                    res_json = {"raw_response": response_body}
                
                self.send_response(200 if success else 403)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": success,
                    "resend_response": res_json
                }).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
