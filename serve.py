# Servidor local para desarrollo: igual que `python -m http.server`, pero le dice al navegador
# que NO guarde copias (Cache-Control: no-store). Así cada recarga normal (F5) trae los cambios.
# Uso:  python serve.py        → http://localhost:5500
import http.server
import os
import socketserver

PORT = int(os.environ.get("PORT", 5500))
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
# 127.0.0.1: solo responde en esta notebook, no a otros equipos de la misma red wifi.
with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
    print(f"Sirviendo en http://localhost:{PORT} (sin caché). Ctrl+C para cortar.")
    httpd.serve_forever()
