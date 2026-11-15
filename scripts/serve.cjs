const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
const server = http.createServer((request, response) => {
  let file;
  try {
    file = path.resolve(root, `.${decodeURIComponent(new URL(request.url, "http://localhost").pathname)}`);
    if (file !== root && !file.startsWith(root + path.sep)) throw new Error("outside root");
    if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    const data = fs.readFileSync(file);
    response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(data);
  } catch { response.writeHead(404); response.end("Not found"); }
});
server.listen(8765, "127.0.0.1", () => console.log("Trang kiểm thử: http://127.0.0.1:8765/demo/"));
