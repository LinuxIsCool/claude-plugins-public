#!/usr/bin/env python3
"""Simple HTTP upload server for receiving files from mobile devices."""

import http.server
import cgi
import os

UPLOAD_DIR = os.path.expanduser("~/signal-backup")
os.makedirs(UPLOAD_DIR, exist_ok=True)

class UploadHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(b'''
<!DOCTYPE html>
<html>
<head><title>Signal Backup Upload</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body { font-family: sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
h1 { color: #3a76f0; }
input[type=file] { margin: 20px 0; }
button { background: #3a76f0; color: white; padding: 15px 30px; border: none; font-size: 18px; cursor: pointer; }
</style>
</head>
<body>
<h1>Signal Backup Upload</h1>
<p>Select your Signal backup file (.backup)</p>
<form action="/" method="post" enctype="multipart/form-data">
<input type="file" name="file" accept=".backup"><br>
<button type="submit">Upload</button>
</form>
</body>
</html>
        ''')

    def do_POST(self):
        ctype, pdict = cgi.parse_header(self.headers['Content-Type'])
        if ctype == 'multipart/form-data':
            pdict['boundary'] = bytes(pdict['boundary'], 'utf-8')
            fields = cgi.parse_multipart(self.rfile, pdict)
            file_data = fields.get('file')
            if file_data:
                # Find the backup filename
                filename = "signal-backup.backup"
                filepath = os.path.join(UPLOAD_DIR, filename)
                with open(filepath, 'wb') as f:
                    f.write(file_data[0])
                print(f"Saved: {filepath} ({len(file_data[0])} bytes)")

                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(f'''
<!DOCTYPE html>
<html>
<head><title>Upload Complete</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body {{ font-family: sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }}</style>
</head>
<body>
<h1 style="color: green;">Upload Complete!</h1>
<p>File saved: {filename}</p>
<p>Size: {len(file_data[0]):,} bytes</p>
<p>You can close this page.</p>
</body>
</html>
                '''.encode())
                return

        self.send_response(400)
        self.end_headers()

if __name__ == '__main__':
    PORT = 8888
    print(f"Upload server running at http://192.168.1.96:{PORT}")
    print(f"Files will be saved to: {UPLOAD_DIR}")
    server = http.server.HTTPServer(('0.0.0.0', PORT), UploadHandler)
    server.serve_forever()
