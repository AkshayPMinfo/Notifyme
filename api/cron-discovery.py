import json
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from http.server import BaseHTTPRequestHandler
import discovery_service

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            print("[CRON] Starting discovery cycle via Vercel Serverless Function...")
            discovery_service.run_discovery()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": "Discovery run completed"}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode())

    def log_message(self, format, *args):
        pass
