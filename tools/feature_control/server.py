"""Loopback-only Feature Control. Python standard library + existing GitHub CLI."""
from __future__ import annotations
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import secrets
from urllib.parse import urlsplit

from .core import Feature, suggest_priority
from . import github

STATIC = Path(__file__).parent / "static"
MAX_BODY = 16 * 1024

class FeatureControlServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self,port):
        super().__init__(("127.0.0.1",port),FeatureHandler)
        self.csrf_token=secrets.token_urlsafe(32)

class FeatureHandler(BaseHTTPRequestHandler):
    server: FeatureControlServer

    def _headers(self,code,content_type,length):
        self.send_response(code)
        self.send_header("Content-Type",content_type)
        self.send_header("Content-Length",str(length))
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.send_header("X-Frame-Options","DENY")
        self.send_header("Referrer-Policy","no-referrer")
        self.send_header("Content-Security-Policy",
            "default-src 'none'; style-src 'self'; script-src 'self'; "
            "connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()

    def send_json(self,code,data):
        raw=json.dumps(data,ensure_ascii=False).encode("utf-8")
        self._headers(code,"application/json; charset=utf-8",len(raw))
        self.wfile.write(raw)

    def send_file(self,name,mime):
        file=STATIC / name
        raw=file.read_bytes()
        if name=="index.html":
            raw=raw.replace(b"__MR_CSRF_TOKEN__",
                            self.server.csrf_token.encode("ascii"))
        self._headers(200,mime,len(raw))
        self.wfile.write(raw)

    def _host_allowed(self):
        host=self.headers.get("Host","")
        return host in (f"127.0.0.1:{self.server.server_port}",
                        f"localhost:{self.server.server_port}")

    def do_GET(self):
        if not self._host_allowed(): return self.send_json(403,{"error":"Invalid host"})
        url=urlsplit(self.path).path
        if url in ("/","/index.html"): return self.send_file("index.html","text/html; charset=utf-8")
        if url=="/app.js": return self.send_file("app.js","text/javascript; charset=utf-8")
        if url=="/styles.css": return self.send_file("styles.css","text/css; charset=utf-8")
        if url=="/api/health":
            try: return self.send_json(200,github.health())
            except Exception as e: return self.send_json(503,{"error":str(e)})
        if url=="/api/audit-health":
            try: return self.send_json(200,github.audit_health())
            except Exception as e: return self.send_json(503,{"error":str(e)})
        if url=="/api/orchestration":
            try: return self.send_json(200,github.execution_plan())
            except Exception as e: return self.send_json(503,{"error":str(e)})
        if url=="/api/board":
            try: return self.send_json(200,{"items":github.board()})
            except Exception as e: return self.send_json(503,{"error":str(e)})
        return self.send_json(404,{"error":"Not found"})

    def do_POST(self):
        if not self._host_allowed(): return self.send_json(403,{"error":"Invalid host"})
        origin=self.headers.get("Origin","")
        if origin and origin not in (
            f"http://127.0.0.1:{self.server.server_port}",
            f"http://localhost:{self.server.server_port}"
        ): return self.send_json(403,{"error":"Invalid origin"})
        if self.headers.get("X-MRaiders-CSRF","")!=self.server.csrf_token:
            return self.send_json(403,{"error":"Invalid request token"})
        if self.headers.get("Content-Type","").split(";")[0]!="application/json":
            return self.send_json(415,{"error":"Expected application/json"})
        try: length=int(self.headers.get("Content-Length","0"))
        except ValueError: length=0
        if not 0<length<=MAX_BODY:
            return self.send_json(413,{"error":"Request must contain at most 16 KiB"})
        try:
            data=json.loads(self.rfile.read(length))
            path=urlsplit(self.path).path
            if path=="/api/preview":
                impact=data.get("impact","Medium")
                urgency=data.get("urgency","Medium")
                effort=data.get("effort","Medium")
                risk=data.get("risk","Medium")
                category=data.get("category","Feature")
                from .core import LEVELS,SIZES,CATEGORIES
                if impact not in LEVELS or urgency not in LEVELS or risk not in LEVELS or effort not in SIZES or category not in CATEGORIES:
                    raise ValueError("Invalid planning field")
                priority,rationale=suggest_priority(impact,urgency,effort,risk,category)
                return self.send_json(200,{"suggested_priority":priority,"rationale":rationale})
            if path=="/api/features":
                return self.send_json(201,github.create_feature(Feature.parse(data)))
            return self.send_json(404,{"error":"Not found"})
        except (ValueError,UnicodeDecodeError) as e:
            return self.send_json(400,{"error":str(e)})
        except Exception as e:
            return self.send_json(503,{"error":str(e)})

    def log_message(self,fmt,*args):
        # Only local status/request path; never log JSON payloads, auth headers or tokens.
        print(f"Feature Control {self.address_string()}: {fmt % args}")

def main():
    ap=argparse.ArgumentParser(description="MRaiders Project-first feature intake UI")
    ap.add_argument("--port",type=int,default=8765)
    args=ap.parse_args()
    if not 1024<=args.port<=65535: ap.error("port must be 1024..65535")
    server=FeatureControlServer(args.port)
    print(f"MRaiders Feature Control: http://127.0.0.1:{args.port}/")
    print("Use an existing GitHub CLI login. Local loopback only; Ctrl+C to stop.")
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__=="__main__": main()
