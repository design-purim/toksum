import http.server, socketserver, os

# 프로젝트 루트 기준으로 서빙 (이 스크립트가 있는 폴더)
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # ES 모듈 캐시 함정 방지: 항상 no-store
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", 8777), H) as httpd:
    print("no-store dev server → http://localhost:8777/index.html")
    httpd.serve_forever()
