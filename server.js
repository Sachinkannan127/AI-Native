const express = require("express");
const multer = require("multer");
const mammoth = require("mammoth");
const sanitizeHtml = require("sanitize-html");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const USERS = [
  { email: "alice@ajaia.test", name: "Alice" },
  { email: "bob@ajaia.test", name: "Bob" },
  { email: "carol@ajaia.test", name: "Carol" }
];
const userEmails = new Set(USERS.map((u) => u.email));
const cleanOptions = { allowedTags: ["h1", "h2", "h3", "p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "div"], allowedAttributes: {} };

function loadStore(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return { documents: Array.isArray(parsed.documents) ? parsed.documents : [] };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { documents: [] };
  }
}
function saveStore(file, store) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, file);
}
function sanitize(content) {
  return sanitizeHtml(typeof content === "string" ? content : "", cleanOptions);
}
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function markdownToHtml(text) {
  return text.split(/\r?\n/).map((line) => {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) return `<h${match[1].length}>${escapeHtml(match[2])}</h${match[1].length}>`;
    return line.trim() ? `<p>${escapeHtml(line)}</p>` : "";
  }).join("");
}
function publicDoc(doc, user) {
  const own = doc.owner === user;
  const share = doc.shares.find((s) => s.email === user);
  return { id: doc.id, title: doc.title, content: doc.content, owner: doc.owner, role: own ? "owner" : share.role, updatedAt: doc.updatedAt };
}
function createApp(options = {}) {
  const dataFile = options.dataFile || process.env.DATA_FILE || path.join(__dirname, "data.json");
  const store = loadStore(dataFile);
  const app = express();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
  app.use(express.json({ limit: "2mb" }));
  app.use(express.static(path.join(__dirname, "public")));
  app.use("/api", (req, res, next) => {
    if (req.path === "/users") return next();
    const user = req.get("x-user");
    if (!userEmails.has(user)) return res.status(401).json({ error: "Unknown user" });
    req.user = user;
    next();
  });
  app.get("/api/users", (req, res) => res.json(USERS));
  app.get("/api/docs", (req, res) => {
    res.json(store.documents.filter((d) => d.owner === req.user || d.shares.some((s) => s.email === req.user)).map((d) => publicDoc(d, req.user)));
  });
  app.post("/api/docs", (req, res) => {
    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    if (!title) return res.status(400).json({ error: "Title is required" });
    if (title.length > 120) return res.status(400).json({ error: "Title must be 120 characters or fewer" });
    const doc = { id: crypto.randomUUID(), title, content: sanitize(req.body.content || ""), owner: req.user, shares: [], updatedAt: new Date().toISOString() };
    store.documents.push(doc); saveStore(dataFile, store); res.status(201).json(publicDoc(doc, req.user));
  });
  function findAccessible(req, res) {
    const doc = store.documents.find((d) => d.id === req.params.id);
    if (!doc || (doc.owner !== req.user && !doc.shares.some((s) => s.email === req.user))) { res.status(404).json({ error: "Document not found" }); return null; }
    return doc;
  }
  app.get("/api/docs/:id", (req, res) => { const doc = findAccessible(req, res); if (doc) res.json(publicDoc(doc, req.user)); });
  app.put("/api/docs/:id", (req, res) => {
    const doc = findAccessible(req, res); if (!doc) return;
    if (doc.owner !== req.user && doc.shares.find((s) => s.email === req.user)?.role !== "edit") return res.status(403).json({ error: "View-only access cannot edit" });
    if (req.body.title !== undefined) {
      if (typeof req.body.title !== "string" || !req.body.title.trim()) return res.status(400).json({ error: "Title is required" });
      if (req.body.title.trim().length > 120) return res.status(400).json({ error: "Title must be 120 characters or fewer" });
      doc.title = req.body.title.trim();
    }
    if (req.body.content !== undefined) doc.content = sanitize(req.body.content);
    doc.updatedAt = new Date().toISOString(); saveStore(dataFile, store); res.json(publicDoc(doc, req.user));
  });
  app.delete("/api/docs/:id", (req, res) => {
    const doc = store.documents.find((d) => d.id === req.params.id);
    if (!doc || (doc.owner !== req.user && !doc.shares.some((s) => s.email === req.user))) return res.status(404).json({ error: "Document not found" });
    if (doc.owner !== req.user) return res.status(403).json({ error: "Only the owner can delete this document" });
    store.documents = store.documents.filter((item) => item.id !== doc.id);
    saveStore(dataFile, store);
    res.status(204).end();
  });
  app.post("/api/docs/:id/share", (req, res) => {
    const doc = findAccessible(req, res); if (!doc) return;
    if (doc.owner !== req.user) return res.status(403).json({ error: "Only the owner can share" });
    const { email, role } = req.body;
    if (!userEmails.has(email)) return res.status(400).json({ error: `Unknown user. Valid users: ${USERS.map((u) => u.email).join(", ")}` });
    if (email === doc.owner) return res.status(400).json({ error: "Cannot share with the owner" });
    if (!["edit", "view"].includes(role)) return res.status(400).json({ error: "Role must be edit or view" });
    const existing = doc.shares.find((s) => s.email === email);
    if (existing) existing.role = role; else doc.shares.push({ email, role });
    doc.updatedAt = new Date().toISOString(); saveStore(dataFile, store); res.json(publicDoc(doc, req.user));
  });
  app.post("/api/upload", (req, res, next) => upload.single("file")(req, res, (error) => {
    if (error) { if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File exceeds the 5 MB limit" }); return res.status(400).json({ error: "Upload failed" }); }
    next();
  }), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "A file is required" });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (![".txt", ".md", ".docx"].includes(ext)) return res.status(400).json({ error: "Supported files are .txt, .md, and .docx" });
    try {
      let content;
      if (ext === ".docx") content = (await mammoth.convertToHtml({ buffer: req.file.buffer })).value;
      else content = ext === ".md" ? markdownToHtml(req.file.buffer.toString("utf8")) : req.file.buffer.toString("utf8").split(/\r?\n\s*\r?\n/).filter(Boolean).map((p) => `<p>${escapeHtml(p.replace(/\r?\n/g, " "))}</p>`).join("");
      const base = path.basename(req.file.originalname, ext).trim() || "Imported document";
      const doc = { id: crypto.randomUUID(), title: base.slice(0, 120), content: sanitize(content), owner: req.user, shares: [], updatedAt: new Date().toISOString() };
      store.documents.push(doc); saveStore(dataFile, store); res.status(201).json(publicDoc(doc, req.user));
    } catch (error) { res.status(422).json({ error: "Unable to read the uploaded file" }); }
  });
  app.use((error, req, res, next) => {
    if (error.type === "entity.too.large") return res.status(413).json({ error: "Request body exceeds the 2 MB limit" });
    if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: "Invalid JSON" });
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  });
  return app;
}
if (require.main === module) createApp().listen(process.env.PORT || 3000, () => console.log(`Docs app listening on ${process.env.PORT || 3000}`));
module.exports = { createApp, sanitize };
