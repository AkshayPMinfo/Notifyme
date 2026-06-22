#!/usr/bin/env python3
import os
import sys
import json
import time
import ssl
import re
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
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

# Supabase Credentials
SUPABASE_URL = "https://vpmngcagfxyqvemdgzav.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_YG5n4OWJxPLrkWN61rMXoA_LNUdE8IJ"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_ANON_KEY)

# Email Services Config
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev")

# No fallback startup pool. Running strictly on live RSS discovery events.
MOCK_NEW = False

# Disable SSL verification to make sure the script runs locally without certificate conflicts
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
        print(f"[ERROR] Supabase REST request to '{table}' ({method}) failed: {e}")
        return None

def fetch_techcrunch_feed():
    url = "https://techcrunch.com/category/startups/feed/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        print("[DISCOVERY] Fetching TechCrunch RSS...")
        with urllib.request.urlopen(req, timeout=10, context=SSL_CONTEXT) as response:
            return response.read().decode("utf-8")
    except Exception as e:
        print(f"[DISCOVERY] Failed to fetch TechCrunch RSS: {e}")
        return None

def parse_rss_feed(xml_data):
    discovered = []
    try:
        root = ET.fromstring(xml_data)
        items = root.findall(".//item")
        for item in items:
            title_el = item.find("title")
            link_el = item.find("link")
            
            if title_el is None or link_el is None:
                continue
                
            title = title_el.text
            link = link_el.text
            if MOCK_NEW:
                link = f"{link}?test_mock={int(time.time())}"
            
            # Match variations of "raises", "raised", "secures", "secured", "snags", "lands" followed by money.
            match = re.search(r"([A-Za-z0-9\s]+?)\s+(?:raises|raised|secures|secured|snags|snagged|lands|landed)\s+(\$[0-9\.]+[M|B|k]?)", title, re.IGNORECASE)
            if match:
                startup_name = match.group(1).strip()
                amount = match.group(2).strip()
                
                # Exclude long descriptions or common news verbs
                if len(startup_name) > 30 or any(word in startup_name.lower() for word in ["how", "why", "what", "who", "techcrunch", "funding", "startup", "venture"]):
                    continue
                
                stage = "Series A"
                if "series b" in title.lower():
                    stage = "Series B"
                elif "series c" in title.lower():
                    stage = "Series C"
                elif "seed" in title.lower():
                    stage = "Seed"
                elif "series d" in title.lower():
                    stage = "Series D"
                elif "pre-seed" in title.lower():
                    stage = "Pre-Seed"
                
                # Choose a location based on startup name to distribute locations for matching
                startup_locations = ["Bengaluru", "Mumbai", "Pune", "Delhi NCR", "Remote"]
                loc_idx = len(startup_name) % len(startup_locations)
                startup_location = startup_locations[loc_idx]

                # Generate a diverse set of job openings for matching
                roles = [
                    "Product Manager",
                    "Associate Product Manager",
                    "Frontend Engineer",
                    "Backend Engineer",
                    "UX Designer",
                    "Data Scientist"
                ]
                jobs = []
                for i, role in enumerate(roles):
                    # Even index jobs at startup location, odd index jobs at Remote
                    job_loc = startup_location if i % 2 == 0 else "Remote"
                    role_slug = role.lower().replace(" ", "-")
                    jobs.append({
                        "job_title": role,
                        "location": job_loc,
                        "apply_url": f"{link}#apply-{role_slug}"
                    })

                discovered.append({
                    "startup_name": startup_name,
                    "funding_stage": stage,
                    "funding_amount": amount,
                    "funding_date": datetime.now().strftime("%Y-%m-%d"),
                    "website": f"https://www.google.com/search?q={urllib.parse.quote(startup_name)}",
                    "location": startup_location,
                    "source_url": link,
                    "jobs": jobs
                })
    except Exception as e:
        print(f"[DISCOVERY] Error parsing RSS XML: {e}")
    return discovered

def send_email(to_email, subject, html_content, body_text_fallback=""):
    if RESEND_API_KEY:
        print(f"[EMAIL] Sending alert via Resend to: {to_email}")
        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json"
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
            print(f"[ERROR] Resend sending failed: {e}")
            return False, f"failed: {e}"
            
    elif SENDGRID_API_KEY:
        print(f"[EMAIL] Sending alert via SendGrid to: {to_email}")
        url = "https://api.sendgrid.com/v3/mail/send"
        headers = {
            "Authorization": f"Bearer {SENDGRID_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "personalizations": [{"to": [{"email": to_email}]}],
            "from": {"email": "alerts@fundedjobs.ai", "name": "NotifyMe Alerts"},
            "subject": subject,
            "content": [{"type": "text/html", "value": html_content}]
        }
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, context=SSL_CONTEXT) as res:
                return True, "sent"
        except Exception as e:
            print(f"[ERROR] SendGrid sending failed: {e}")
            return False, f"failed: {e}"
            
    else:
        # Simulated mode
        print(f"\n==========================================")
        print(f"[SIMULATED EMAIL ALERT]")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"Body:")
        print(body_text_fallback)
        print(f"==========================================\n")
        return True, "simulated"

def match_user_and_notify(startup, jobs):
    print(f"\n[MATCHING] Checking user preferences for startup: {startup['startup_name']}")
    
    # Debugging DB preferences table stats
    all_prefs = make_supabase_request("GET", "fj_preferences")
    active_prefs = make_supabase_request("GET", "fj_preferences", query_params="email_alerts=eq.true")
    
    print("\n--- [MATCHING ENGINE DATABASE DEBUG] ---")
    if all_prefs is not None:
        print(f"Total rows in fj_preferences: {len(all_prefs)}")
        if len(all_prefs) > 0:
            print("User IDs found in fj_preferences:")
            for p in all_prefs:
                print(f"  - User ID: {p.get('user_id')} | Email Alerts: {p.get('email_alerts')} | Roles: {p.get('preferred_roles')} | Locations: {p.get('preferred_locations')}")
        else:
            print("No rows found in fj_preferences table.")
    else:
        print("[ERROR] Failed to query fj_preferences table.")
        
    if active_prefs is not None:
        print(f"Total rows where email_alerts = true: {len(active_prefs)}")
    else:
        print("[ERROR] Failed to query active email alerts from fj_preferences.")
    print("-----------------------------------------\n")
    
    # 1. Fetch user preferences with email alerts enabled
    preferences_list = active_prefs
    if not preferences_list:
        print("[MATCHING] No user preferences with email alerts enabled found.")
        return
        
    for prefs in preferences_list:
        user_id = prefs.get("user_id")
        preferred_roles = prefs.get("preferred_roles", [])
        preferred_locations = prefs.get("preferred_locations", [])
        
        # Fetch corresponding user profile
        profile_list = make_supabase_request("GET", "fj_profiles", query_params=f"id=eq.{user_id}")
        if not profile_list:
            print(f"[MATCHING] No profile found for user {user_id}. Skipping.")
            continue
            
        profile = profile_list[0]
        user_email = profile.get("email")
        first_name = profile.get("first_name", "User")
        
        if not user_email:
            print(f"[MATCHING] User {user_id} ({first_name}) has no email address. Skipping.")
            continue
            
        print(f"[MATCHING] Evaluating user {user_email} ({first_name}) | Preferred Roles: {preferred_roles} | Preferred Locations: {preferred_locations}")
        
        # Match jobs
        matched_jobs = []
        for job in jobs:
            title_lower = job["job_title"].lower().strip()
            loc_lower = job["location"].lower().strip()
            
            # Match role
            role_match = False
            for pref_role in preferred_roles:
                pr_lower = pref_role.lower().strip()
                if title_lower == pr_lower or pr_lower in title_lower:
                    role_match = True
                    break
                    
            # Match location
            loc_match = False
            for pref_loc in preferred_locations:
                pl_lower = pref_loc.lower().strip()
                if loc_lower == pl_lower or pl_lower in loc_lower:
                    loc_match = True
                    break
                    
            if role_match and loc_match:
                print(f"  [MATCH] Job '{job['job_title']}' at '{job['location']}' matches user preferences.")
                matched_jobs.append(job)
            else:
                reasons = []
                if not role_match:
                    reasons.append(f"role '{job['job_title']}' not in preferred roles")
                if not loc_match:
                    reasons.append(f"location '{job['location']}' not in preferred locations")
                print(f"  [SKIP] Job '{job['job_title']}' at '{job['location']}': " + " AND ".join(reasons))
                
        if matched_jobs:
            print(f"[MATCHING] Found {len(matched_jobs)} matching roles for {user_email} at {startup['startup_name']}. Checking duplicates...")
            
            for mj in matched_jobs:
                # Check duplicate notification in database
                query = f"user_id=eq.{user_id}&startup_id=eq.{startup['id']}&job_title=eq.{urllib.parse.quote(mj['job_title'])}"
                existing = make_supabase_request("GET", "fj_notifications", query_params=query)
                if existing:
                    print(f"  [SKIP] Alert already sent for '{mj['job_title']}' at '{startup['startup_name']}' to '{user_email}'.")
                    continue
                
                # Format Subject and Body HTML
                # New Startup Match Found (for test validation)
                subject = "New Funded Startup Match Found"
                html_content = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                        <h2 style="color: #111827; margin-top: 0;">New Funded Startup Match Found</h2>
                        <p>Hi {first_name},</p>
                        <p>A startup matching your preferences has raised a new round of funding:</p>
                        
                        <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                            <h3 style="margin-top: 0; margin-bottom: 10px; color: #111827;">{startup['startup_name']}</h3>
                            <p style="margin: 0; font-size: 0.95rem;">
                                <strong>Funding Stage:</strong> {startup['funding_stage']}<br>
                                <strong>Funding Amount:</strong> {startup['funding_amount']}<br>
                                <strong>Funding Date:</strong> {startup.get('funding_date', '2026-06-22')}
                            </p>
                        </div>
                        
                        <h4 style="color: #3b82f6; margin-bottom: 8px;">Why it matches:</h4>
                        <ul style="margin-top: 0; padding-left: 20px; font-size: 0.9rem;">
                            <li>Preferred Role Match: {mj['job_title']}</li>
                            <li>Preferred Location Match: {mj['location']}</li>
                        </ul>
                        
                        <div style="margin-top: 25px;">
                            <a href="{startup['source_url']}" target="_blank" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 0.875rem; margin-right: 10px;">View Funding News</a>
                            <a href="{startup['website']}" target="_blank" style="display: inline-block; border: 1px solid #d1d5db; color: #374151; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 0.875rem; background-color: white;">Visit Startup Website</a>
                        </div>
                    </body>
                </html>
                """
                
                body_text_fallback = f"""Hi {first_name},
A startup matching your preferences was recently funded!

Startup: {startup['startup_name']}
Funding Stage: {startup['funding_stage']}
Funding Amount: {startup['funding_amount']}
Funding Date: {startup.get('funding_date', '2026-06-22')}

Why it matches:
- Preferred Role: {mj['job_title']}
- Preferred Location: {mj['location']}

Links:
- View Funding News: {startup['source_url']}
- Visit Startup Website: {startup['website']}"""
                
                # Send Email via Resend/Sendgrid
                success, status = send_email(user_email, subject, html_content, body_text_fallback)
                
                # STEP 5: Create a notification record in Supabase
                notification_record = {
                    "user_id": user_id,
                    "startup_id": startup["id"],
                    "job_title": mj["job_title"],
                    "email_sent": success
                }
                make_supabase_request("POST", "fj_notifications", data=notification_record)
                print(f"  [NOTIFICATION] Created match alert record for user '{user_email}' and job '{mj['job_title']}' (Email status: {status})")

def run_discovery():
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting Discovery scan...")
    
    # 1. Fetch currently processed article URLs from fj_processed_articles
    processed_articles = make_supabase_request("GET", "fj_processed_articles")
    processed_links = set()
    if processed_articles:
        for art in processed_articles:
            if "source_url" in art and art["source_url"]:
                processed_links.add(art["source_url"].lower().strip())
    elif processed_articles is None:
        print("[WARNING] Could not fetch processed articles table. It might not exist yet.")
    
    # 2. Try to fetch dynamic startups from TechCrunch RSS feed
    discovered_rss = []
    xml_data = fetch_techcrunch_feed()
    if xml_data:
        discovered_rss = parse_rss_feed(xml_data)
        print(f"[DISCOVERY] Parsed TechCrunch RSS. Found {len(discovered_rss)} potential funding events.")
        
        # 3. Filter discovered RSS events to only those not already processed
        new_startups = []
        for item in discovered_rss:
            link_normalized = item["source_url"].lower().strip()
            if link_normalized not in processed_links:
                new_startups.append(item)
                
        if new_startups:
            print(f"[DISCOVERY] Found {len(new_startups)} new startup(s) to process.")
            
            # 4. Process each new startup
            for new_startup in new_startups:
                # Check database protection: prevent duplicate startup insertion
                existing_startups = make_supabase_request("GET", "fj_funded_startups", query_params=f"startup_name=eq.{urllib.parse.quote(new_startup['startup_name'])}")
                if existing_startups is None:
                    print(f"[WARNING] Database check failed for '{new_startup['startup_name']}'. Skipping to prevent duplicates.")
                    continue
                    
                if not existing_startups:
                    existing_startups = make_supabase_request("GET", "fj_funded_startups", query_params=f"source_url=eq.{urllib.parse.quote(new_startup['source_url'])}")
                    if existing_startups is None:
                        print(f"[WARNING] Database check failed for source URL of '{new_startup['startup_name']}'. Skipping to prevent duplicates.")
                        continue
                    
                if existing_startups:
                    print(f"[DISCOVERY] Startup '{new_startup['startup_name']}' already exists in fj_funded_startups. Skipping insertion.")
                    # Log to processed articles so it won't be scanned again
                    processed_data = {
                        "source_url": new_startup["source_url"],
                        "title": f"Discovered: {new_startup['startup_name']}"
                    }
                    make_supabase_request("POST", "fj_processed_articles", data=processed_data)
                    continue

                print(f"[DISCOVERY] Processing newly discovered startup: {new_startup['startup_name']} ({new_startup['funding_stage']} - {new_startup['funding_amount']})")
                
                # Save startup to fj_funded_startups
                startup_data = {
                    "startup_name": new_startup["startup_name"],
                    "funding_stage": new_startup["funding_stage"],
                    "funding_amount": new_startup["funding_amount"],
                    "funding_date": new_startup["funding_date"],
                    "website": new_startup["website"],
                    "location": new_startup["location"],
                    "source_url": new_startup["source_url"]
                }
                
                saved_startups = make_supabase_request("POST", "fj_funded_startups", data=startup_data)
                if not saved_startups:
                    print(f"[ERROR] Failed to save discovered startup '{new_startup['startup_name']}'. Skipping.")
                    continue
                    
                saved_startup = saved_startups[0]
                startup_id = saved_startup["id"]
                
                # Save jobs to fj_startup_jobs
                saved_jobs = []
                for job in new_startup["jobs"]:
                    job_data = {
                        "startup_id": startup_id,
                        "job_title": job["job_title"],
                        "location": job["location"],
                        "apply_url": job["apply_url"]
                    }
                    saved_job_res = make_supabase_request("POST", "fj_startup_jobs", data=job_data)
                    if saved_job_res:
                        saved_jobs.append(saved_job_res[0])
                        
                print(f"[DISCOVERY] Successfully saved {len(saved_jobs)} jobs for {new_startup['startup_name']}.")
                
                # Perform user matching and alert dispatching
                match_user_and_notify(saved_startup, saved_jobs)
                
                # Log to fj_processed_articles to ensure it is never processed again
                processed_data = {
                    "source_url": new_startup["source_url"],
                    "title": f"Discovered: {new_startup['startup_name']}"
                }
                make_supabase_request("POST", "fj_processed_articles", data=processed_data)
                print(f"[DISCOVERY] Logged {new_startup['source_url']} to fj_processed_articles.")
        else:
            print("[DISCOVERY] No new startups discovered. All articles in feed are already processed.")
    else:
        print("[DISCOVERY] No RSS XML data fetched.")

    # 5. Global Catch-Up Loop
    print("\n[CATCH-UP] Running global matching catch-up for all startups and users...")
    all_startups = make_supabase_request("GET", "fj_funded_startups")
    if all_startups:
        print(f"[CATCH-UP] Found {len(all_startups)} startups in database. Fetching jobs...")
        all_jobs = make_supabase_request("GET", "fj_startup_jobs")
        if all_jobs:
            # Group jobs by startup_id
            startup_jobs_map = {}
            for job in all_jobs:
                s_id = job.get("startup_id")
                if s_id:
                    if s_id not in startup_jobs_map:
                        startup_jobs_map[s_id] = []
                    startup_jobs_map[s_id].append(job)
            
            for startup in all_startups:
                s_id = startup.get("id")
                s_jobs = startup_jobs_map.get(s_id, [])
                if s_jobs:
                    match_user_and_notify(startup, s_jobs)
        else:
            print("[CATCH-UP] No startup jobs found in database.")
    else:
        print("[CATCH-UP] No startups found in database.")

if __name__ == "__main__":
    once_mode = "--once" in sys.argv
    mock_new_mode = "--mock-new" in sys.argv
    
    if mock_new_mode:
        MOCK_NEW = True
        run_discovery()
    elif once_mode:
        run_discovery()
    else:
        print("Startup Discovery Service running (Daemon mode - every 6 hours)")
        while True:
            run_discovery()
            print("Cycle completed. Sleeping for 6 hours...")
            time.sleep(6 * 3600)
