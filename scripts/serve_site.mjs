import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] || "_site");
const port = Number.parseInt(process.argv[3] || "4173", 10);
const mimeTypes = new Map([
  [".avif", "image/avif"],
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".mp4", "video/mp4"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json"],
  [".webp", "image/webp"],
  [".xml", "application/xml; charset=utf-8"]
]);

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  const relativePath = pathname.replace(/^\/+/, "");
  let filePath = path.resolve(root, relativePath);

  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) return null;

  try {
    if (statSync(filePath).isDirectory()) filePath = path.join(filePath, "index.html");
    if (statSync(filePath).isFile()) return { filePath, status: 200 };
  } catch (_) {
    // A missing route falls through to the generated 404 page.
  }

  const notFoundPath = path.join(root, "404.html");
  try {
    if (statSync(notFoundPath).isFile()) return { filePath: notFoundPath, status: 404 };
  } catch (_) {
    return null;
  }

  return null;
}

function parseRange(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || "");
  if (!match) return null;

  let start = match[1] ? Number.parseInt(match[1], 10) : null;
  let end = match[2] ? Number.parseInt(match[2], 10) : null;

  if (start === null && end !== null) {
    start = Math.max(0, size - end);
    end = size - 1;
  } else {
    start ??= 0;
    end = Math.min(end ?? size - 1, size - 1);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= size) return null;
  return { start, end };
}

const server = createServer((request, response) => {
  const resolved = resolveRequestPath(request.url || "/");

  if (!resolved) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const fileStat = statSync(resolved.filePath);
  const contentType = mimeTypes.get(path.extname(resolved.filePath).toLowerCase()) || "application/octet-stream";
  const range = parseRange(request.headers.range, fileStat.size);
  const headers = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Type": contentType
  };

  if (request.headers.range && !range) {
    response.writeHead(416, { ...headers, "Content-Range": `bytes */${fileStat.size}` });
    response.end();
    return;
  }

  if (range) {
    const contentLength = range.end - range.start + 1;
    response.writeHead(206, {
      ...headers,
      "Content-Length": contentLength,
      "Content-Range": `bytes ${range.start}-${range.end}/${fileStat.size}`
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(resolved.filePath, range).pipe(response);
    return;
  }

  response.writeHead(resolved.status, { ...headers, "Content-Length": fileStat.size });
  if (request.method === "HEAD") response.end();
  else createReadStream(resolved.filePath).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[site-server] Serving ${root} at http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
