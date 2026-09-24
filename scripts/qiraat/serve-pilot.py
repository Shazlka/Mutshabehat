import http.server
import socketserver
import os

PORT = 8085
DIRECTORY = "/Users/amrelshazly/Projects/mutshabehat-qiraat-db-v2"

class PilotHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self.path = "/REVIEW_PILOT.html"
        return super().do_GET()

    def do_HEAD(self):
        if self.path in ("/", "/index.html"):
            self.path = "/REVIEW_PILOT.html"
        return super().do_HEAD()

if __name__ == "__main__":
    # Allow address reuse so quick restarts don't fail with TIME_WAIT
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), PilotHandler) as httpd:
        print(f"Serving at http://0.0.0.0:{PORT}")
        httpd.serve_forever()
