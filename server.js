const express = require("express");
const multer = require("multer");
const mammoth = require("mammoth");
const sanitizeHtml = require("sanitize-html");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const cleanOptions = { allowedTags: ["h1", "h2", "h3", "p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "div"], allowedAttributes: {} };

function loadStore(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    const documents = Array.isArray(parsed.documents) ? parsed.documents : [];
    const users = Array.isArray(parsed.users) ? parsed.users : [];
    return { documents, users };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { documents: [], users: [] };
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
  const normalizedUser = (user || "").toLowerCase();
  const own = doc.owner.toLowerCase() === normalizedUser;
  const share = doc.shares.find((s) => s.email.toLowerCase() === normalizedUser);
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    owner: doc.owner,
    role: own ? "owner" : (share ? share.role : "none"),
    updatedAt: doc.updatedAt
  };
}

function createApp(options = {}) {
  const dataFile = options.dataFile || process.env.DATA_FILE || path.join(__dirname, "data.json");
  const store = loadStore(dataFile);
  const app = express();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

  app.use(express.json({ limit: "2mb" }));
  app.use(express.static(path.join(__dirname, "dist")));
  app.use(express.static(path.join(__dirname, "public")));

  app.use("/api", (req, res, next) => {
    if (req.path === "/users") return next();
    const user = req.get("x-user");
    if (!user) return res.status(401).json({ error: "Missing x-user authentication header" });
    const target = user.trim().toLowerCase();
    const found = store.users.find((u) => u.email.toLowerCase() === target);
    if (!found) return res.status(401).json({ error: "Unknown user" });
    req.user = found.email;
    next();
  });

  app.get("/api/users", (req, res) => res.json(store.users));

  app.post("/api/users", (req, res) => {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const rawName = typeof req.body?.name === "string" ? req.body.name.trim() : "";

    if (!rawEmail) {
      return res.status(400).json({ error: "Email is required" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(rawEmail) || rawEmail.length > 120) {
      return res.status(400).json({ error: "A valid email address is required (e.g. name@domain.com)" });
    }
    const email = rawEmail.toLowerCase();
    if (store.users.some((u) => u.email.toLowerCase() === email)) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    const fallbackName = rawEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const name = (rawName || fallbackName).slice(0, 60);
    const newUser = { email, name };
    store.users.push(newUser);
    saveStore(dataFile, store);
    res.status(201).json(newUser);
  });

  app.get("/api/docs", (req, res) => {
    const currentUser = req.user.toLowerCase();
    res.json(
      store.documents
        .filter((d) => d.owner.toLowerCase() === currentUser || d.shares.some((s) => s.email.toLowerCase() === currentUser))
        .map((d) => publicDoc(d, req.user))
    );
  });

  app.post("/api/docs", (req, res) => {
    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    if (!title) return res.status(400).json({ error: "Title is required" });
    if (title.length > 120) return res.status(400).json({ error: "Title must be 120 characters or fewer" });
    const doc = {
      id: crypto.randomUUID(),
      title,
      content: sanitize(req.body.content || ""),
      owner: req.user,
      shares: [],
      updatedAt: new Date().toISOString()
    };
    store.documents.push(doc);
    saveStore(dataFile, store);
    res.status(201).json(publicDoc(doc, req.user));
  });

  function findAccessible(req, res) {
    const currentUser = req.user.toLowerCase();
    const doc = store.documents.find((d) => d.id === req.params.id);
    if (!doc || (doc.owner.toLowerCase() !== currentUser && !doc.shares.some((s) => s.email.toLowerCase() === currentUser))) {
      res.status(404).json({ error: "Document not found" });
      return null;
    }
    return doc;
  }

  app.get("/api/docs/:id", (req, res) => {
    const doc = findAccessible(req, res);
    if (doc) res.json(publicDoc(doc, req.user));
  });

  app.put("/api/docs/:id", (req, res) => {
    const doc = findAccessible(req, res);
    if (!doc) return;
    const currentUser = req.user.toLowerCase();
    const isOwner = doc.owner.toLowerCase() === currentUser;
    const userShare = doc.shares.find((s) => s.email.toLowerCase() === currentUser);
    if (!isOwner && userShare?.role !== "edit") return res.status(403).json({ error: "View-only access cannot edit" });
    if (req.body.title !== undefined) {
      if (typeof req.body.title !== "string" || !req.body.title.trim()) return res.status(400).json({ error: "Title is required" });
      if (req.body.title.trim().length > 120) return res.status(400).json({ error: "Title must be 120 characters or fewer" });
      doc.title = req.body.title.trim();
    }
    if (req.body.content !== undefined) doc.content = sanitize(req.body.content);
    doc.updatedAt = new Date().toISOString();
    saveStore(dataFile, store);
    res.json(publicDoc(doc, req.user));
  });

  app.delete("/api/docs/:id", (req, res) => {
    const currentUser = req.user.toLowerCase();
    const doc = store.documents.find((d) => d.id === req.params.id);
    if (!doc || (doc.owner.toLowerCase() !== currentUser && !doc.shares.some((s) => s.email.toLowerCase() === currentUser))) {
      return res.status(404).json({ error: "Document not found" });
    }
    if (doc.owner.toLowerCase() !== currentUser) return res.status(403).json({ error: "Only the owner can delete this document" });
    store.documents = store.documents.filter((item) => item.id !== doc.id);
    saveStore(dataFile, store);
    res.status(204).end();
  });

  app.post("/api/docs/:id/share", (req, res) => {
    const doc = findAccessible(req, res);
    if (!doc) return;
    const currentUser = req.user.toLowerCase();
    if (doc.owner.toLowerCase() !== currentUser) return res.status(403).json({ error: "Only the owner can share" });
    const { email, role } = req.body || {};
    const targetEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const targetUser = store.users.find((u) => u.email.toLowerCase() === targetEmail);
    if (!targetUser) return res.status(400).json({ error: `Unknown user. Valid users: ${store.users.map((u) => u.email).join(", ")}` });
    if (targetEmail === doc.owner.toLowerCase()) return res.status(400).json({ error: "Cannot share with the owner" });
    if (!["edit", "view"].includes(role)) return res.status(400).json({ error: "Role must be edit or view" });
    const existing = doc.shares.find((s) => s.email.toLowerCase() === targetEmail);
    if (existing) existing.role = role;
    else doc.shares.push({ email: targetUser.email, role });
    doc.updatedAt = new Date().toISOString();
    saveStore(dataFile, store);
    res.json(publicDoc(doc, req.user));
  });

  app.post("/api/upload", (req, res, next) => upload.single("file")(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File exceeds the 5 MB limit" });
      return res.status(400).json({ error: "Upload failed" });
    }
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
      store.documents.push(doc);
      saveStore(dataFile, store);
      res.status(201).json(publicDoc(doc, req.user));
    } catch (error) {
      res.status(422).json({ error: "Unable to read the uploaded file" });
    }
  });

  app.use((error, req, res, next) => {
    if (error.type === "entity.too.large") return res.status(413).json({ error: "Request body exceeds the 2 MB limit" });
    if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: "Invalid JSON" });
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  createApp().listen(PORT, () => {
    console.log(`\n  ✨ Ajaia Docs server is ready!`);
    console.log(`  ➜ Local:   http://localhost:${PORT}`);
    console.log(`  ➜ Network: http://127.0.0.1:${PORT}\n`);
  });
}

module.exports = { createApp, sanitize };
