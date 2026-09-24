#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ZIMSim DB Navigator Bridge
==========================
Lokaler, leichtgewichtiger CORS- & Private-Network-Access (PNA) Proxy fuer die
DB Navigator / bahn.de Vendo APIs.

Ermoeglicht die Nutzung von Live-Wagenreihungen und DB-Navigator-Fahrplandaten
auf GitHub Pages (https://jan2903.github.io/ZIMSim) ohne Node.js/Vite/Tauri.

Zero Dependencies: Nutzt ausschliesslich die Python Standardbibliothek!
"""

import sys
import os
import json
import time
import random
import uuid
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

PORT = 8765
HOST = '127.0.0.1'
REMOTE_BASE_URL = 'https://app.services-bahn.de'

# Device-Profile fuer konsistentes Spoofing innerhalb einer Session
DEVICE_MODELS = [
    'Google Pixel 6', 'Google Pixel 7 Pro', 'Google Pixel 8',
    'Samsung Galaxy S21', 'Samsung Galaxy S22', 'Samsung Galaxy S23', 'OnePlus 9'
]
OS_VERSIONS = ['33', '34', '35']

SELECTED_DEVICE = random.choice(DEVICE_MODELS)
SELECTED_OS = random.choice(OS_VERSIONS)
APP_VERSION = '26.13.0'

# Globaler Time-Lock & Akamai-Schutz
_last_request_time = 0.0
_lock = threading.Lock()
MIN_INTERVAL = 1.2  # Mindestabstand in Sekunden

def enforce_time_lock():
    """Erzwingt einen Mindestabstand von 1.0 bis 2.0 Sekunden zwischen ausgehenden Anfragen."""
    global _last_request_time
    with _lock:
        now = time.time()
        elapsed = now - _last_request_time
        required_delay = MIN_INTERVAL + (random.uniform(-0.2, 0.6))
        
        if elapsed < required_delay:
            sleep_time = required_delay - elapsed
            time.sleep(sleep_time)
            
        _last_request_time = time.time()

def get_spoofed_headers(req_content_type=None, accept_type=None):
    """Erzeugt authentische DB Navigator Android-Header mit frischen Correlation-IDs."""
    u1 = str(uuid.uuid4())
    u2 = str(uuid.uuid4())
    instana_id = str(uuid.uuid4())

    headers = {
        'User-Agent': f'DBNavigator/Android/{APP_VERSION}',
        'X-App-Version': APP_VERSION,
        'X-Device-Os-Name': 'Android',
        'X-Device-Os-Version': SELECTED_OS,
        'X-Device-Model': SELECTED_DEVICE,
        'X-Correlation-ID': f'{u1}_{u2}',
        'X-INSTANA-ANDROID': instana_id,
        'Accept-Language': 'de'
    }
    if req_content_type:
        headers['Content-Type'] = req_content_type
    if accept_type:
        headers['Accept'] = accept_type
    return headers

class ZimSimBridgeHandler(BaseHTTPRequestHandler):
    """HTTP-Handler mit CORS- und Private-Network-Access-Unterstuetzung."""

    def _send_cors_headers(self, status=200):
        """Setzt CORS- und PNA-Header fuer den Browser."""
        self.send_response(status)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        
        # Dynamisch angeforderte Header spiegeln oder vollstaendige Whitelist senden
        req_headers = self.headers.get('Access-Control-Request-Headers') if self.headers else None
        if req_headers:
            self.send_header('Access-Control-Allow-Headers', req_headers)
        else:
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept, User-Agent, user-agent, X-App-Version, X-Device-Os-Name, X-Device-Os-Version, X-Device-Model, X-Correlation-ID, X-INSTANA-ANDROID, Accept-Language, X-Requested-With, Authorization, *')

        # Wichtig fuer Chromium & Firefox Private Network Access (PNA) Preflights von HTTPS-Websites
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Max-Age', '86400')

    def do_OPTIONS(self):
        """Behandelt Preflight-Anfragen des Browsers."""
        self._send_cors_headers(204)
        self.end_headers()

    def do_GET(self):
        """Behandelt Health-Checks und GET-Anfragen."""
        if self.path == '/health' or self.path == '/health/':
            self._send_cors_headers(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            response_data = {
                'status': 'ok',
                'service': 'zimsim-bridge',
                'version': '1.0.0',
                'device': SELECTED_DEVICE,
                'os': SELECTED_OS
            }
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
            print(f"[{time.strftime('%H:%M:%S')}] [HEALTH] Ping empfangen -> 200 OK")
            return

        if self.path.startswith('/mob/'):
            self._forward_request('GET')
            return

        self._send_cors_headers(404)
        self.end_headers()
        self.wfile.write(b'{"error": "Not Found"}')

    def do_POST(self):
        """Behandelt Weiterleitungen an die Vendo APIs."""
        if self.path.startswith('/mob/'):
            self._forward_request('POST')
            return

        self._send_cors_headers(404)
        self.end_headers()
        self.wfile.write(b'{"error": "Not Found"}')

    def _forward_request(self, method):
        """Leitet eine Anfrage an die echte DB Navigator API weiter."""
        target_url = f"{REMOTE_BASE_URL}{self.path}"
        req_content_type = self.headers.get('Content-Type')
        accept_type = self.headers.get('Accept')

        body_data = None
        if method == 'POST':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                body_data = self.rfile.read(content_length)

        spoofed_headers = get_spoofed_headers(req_content_type, accept_type)
        enforce_time_lock()

        start_time = time.time()
        print(f"[{time.strftime('%H:%M:%S')}] [{method}] -> {self.path} ...", end='', flush=True)

        req = Request(target_url, data=body_data, headers=spoofed_headers, method=method)

        try:
            with urlopen(req, timeout=12) as response:
                resp_status = response.status
                resp_body = response.read()
                resp_content_type = response.headers.get('Content-Type', 'application/json')

                duration = int((time.time() - start_time) * 1000)
                print(f" [HTTP {resp_status}] ({duration}ms)")

                self._send_cors_headers(resp_status)
                self.send_header('Content-Type', resp_content_type)
                self.end_headers()
                self.wfile.write(resp_body)

        except HTTPError as e:
            duration = int((time.time() - start_time) * 1000)
            print(f" [HTTP {e.code}] ({duration}ms)")
            error_body = e.read()
            self._send_cors_headers(e.code)
            self.send_header('Content-Type', e.headers.get('Content-Type', 'application/json'))
            self.end_headers()
            self.wfile.write(error_body)

        except URLError as e:
            duration = int((time.time() - start_time) * 1000)
            print(f" [CONN ERR: {e.reason}] ({duration}ms)")
            self._send_cors_headers(502)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            err_json = json.dumps({'error': 'Upstream connection failed', 'details': str(e.reason)})
            self.wfile.write(err_json.encode('utf-8'))

    def log_message(self, format, *args):
        # Standard-Logging von BaseHTTPRequestHandler unterdruecken fuer saubere Konsolenausgabe
        return

def main():
    server_address = (HOST, PORT)
    httpd = HTTPServer(server_address, ZimSimBridgeHandler)

    print("=" * 60)
    print("   ZIMSim DB Navigator Bridge (Local Proxy)")
    print("=" * 60)
    print(f" * Server laeuft auf : http://{HOST}:{PORT}")
    print(f" * Health-Check URL  : http://{HOST}:{PORT}/health")
    print(f" * Device-Profil     : {SELECTED_DEVICE} (Android {SELECTED_OS})")
    print(f" * Time-Lock         : 1.0s - 1.8s Mindestabstand (Akamai-Schutz)")
    print("=" * 60)
    print("Bereit fuer Anfragen aus ZIMSim (GitHub Pages oder lokal).")
    print("Druecke Strg + C zum Beenden.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[+] Bridge wird beendet...")
        httpd.server_close()
        sys.exit(0)

if __name__ == '__main__':
    main()
