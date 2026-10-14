// Minimal zero-dependency static file server for the replica.
// Usage: node tools/serve.js [port]
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const port = parseInt(process.argv[2] || "3081", 10);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

http
  .createServer(function (req, res) {
    var urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath.endsWith("/")) urlPath += "index.html";
    var file = path.normalize(path.join(root, urlPath));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    fs.readFile(file, function (err, data) {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 " + urlPath);
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    });
  })
  .listen(port, function () {
    console.log("replica served at http://127.0.0.1:" + port + "/");
  });
