const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../server");

test("sharing permissions, sanitization, and persistence", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ajaia-"));
  const dataFile = path.join(dir, "data.json");
  const server = createApp({ dataFile }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = (url, user, options = {}) =>
    fetch(base + url, {
      ...options,
      headers: { "x-user": user, connection: "close", ...(options.headers || {}) }
    });
  const json = (r) => r.json();
  const owner = "owner@example.com", stranger = "stranger@example.com";

  // Create test accounts dynamically
  await fetch(`${base}/users`, {
    method: "POST",
    headers: { "content-type": "application/json", connection: "close" },
    body: JSON.stringify({ name: "Owner", email: owner })
  });
  await fetch(`${base}/users`, {
    method: "POST",
    headers: { "content-type": "application/json", connection: "close" },
    body: JSON.stringify({ name: "Stranger", email: stranger })
  });

  let r = await call("/docs", stranger); assert.equal(r.status, 200); assert.deepEqual(await json(r), []);
  r = await call("/docs", owner, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Shared", content: "<p>Hello</p>" }) });
  const doc = await json(r);
  r = await call(`/docs/${doc.id}`, stranger); assert.equal(r.status, 404);
  r = await call(`/docs/${doc.id}/share`, owner, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: stranger, role: "view" }) }); assert.equal(r.status, 200);
  r = await call("/docs", stranger); assert.equal((await json(r))[0].role, "view");
  r = await call(`/docs/${doc.id}`, stranger, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: "<p>no</p>" }) }); assert.equal(r.status, 403);
  await call(`/docs/${doc.id}/share`, owner, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: stranger, role: "edit" }) });
  r = await call(`/docs/${doc.id}`, stranger, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: "<p>safe</p><script>alert(1)</script>" }) }); assert.equal(r.status, 200);
  r = await call(`/docs/${doc.id}`, owner); const saved = await json(r); assert.equal(saved.content, "<p>safe</p>");
  r = await call(`/docs/${doc.id}`, stranger, { method: "DELETE" }); assert.equal(r.status, 403);
  r = await call(`/docs/${doc.id}`, owner, { method: "DELETE" }); assert.equal(r.status, 204);
  r = await call(`/docs/${doc.id}`, owner); assert.equal(r.status, 404);
  if (server.closeAllConnections) server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  assert.equal(JSON.parse(fs.readFileSync(dataFile, "utf8")).documents.length, 0);
});

test("dynamic user registration, validation, and multi-user collaboration", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ajaia-dynamic-"));
  const dataFile = path.join(dir, "data.json");
  const server = createApp({ dataFile }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const json = (r) => r.json();

  // 1. Initial users list starts empty (no demo accounts)
  let res = await fetch(`${base}/users`, { headers: { connection: "close" } });
  assert.equal(res.status, 200);
  let users = await json(res);
  assert.equal(users.length, 0);

  // 2. Reject empty email
  res = await fetch(`${base}/users`, {
    method: "POST",
    headers: { "content-type": "application/json", connection: "close" },
    body: JSON.stringify({ name: "Tester" })
  });
  assert.equal(res.status, 400);

  // 3. Reject invalid email
  res = await fetch(`${base}/users`, {
    method: "POST",
    headers: { "content-type": "application/json", connection: "close" },
    body: JSON.stringify({ name: "Tester", email: "invalid-email" })
  });
  assert.equal(res.status, 400);

  // 4. Create new user dynamically
  res = await fetch(`${base}/users`, {
    method: "POST",
    headers: { "content-type": "application/json", connection: "close" },
    body: JSON.stringify({ name: "Sachin Kannan", email: "sachin@example.com" })
  });
  assert.equal(res.status, 201);
  const created = await json(res);
  assert.equal(created.email, "sachin@example.com");
  assert.equal(created.name, "Sachin Kannan");

  // 5. Reject duplicate email (case-insensitive)
  res = await fetch(`${base}/users`, {
    method: "POST",
    headers: { "content-type": "application/json", connection: "close" },
    body: JSON.stringify({ name: "Duplicate", email: "SACHIN@example.com" })
  });
  assert.equal(res.status, 409);

  // 6. Dynamic user can authenticate and create a document
  const call = (url, user, options = {}) =>
    fetch(base + url, {
      ...options,
      headers: { "x-user": user, connection: "close", ...(options.headers || {}) }
    });

  res = await call("/docs", "sachin@example.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Sachin's First Doc", content: "<p>Dynamic user doc</p>" })
  });
  assert.equal(res.status, 201);
  const newDoc = await json(res);
  assert.equal(newDoc.owner, "sachin@example.com");

  // 7. Create another user and share from Sachin to Second User
  res = await fetch(`${base}/users`, {
    method: "POST",
    headers: { "content-type": "application/json", connection: "close" },
    body: JSON.stringify({ name: "Colleague", email: "colleague@example.com" })
  });
  assert.equal(res.status, 201);

  res = await call(`/docs/${newDoc.id}/share`, "sachin@example.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "colleague@example.com", role: "view" })
  });
  assert.equal(res.status, 200);

  // Colleague sees shared doc
  res = await call("/docs", "colleague@example.com");
  const colleagueDocs = await json(res);
  assert.equal(colleagueDocs.length, 1);
  assert.equal(colleagueDocs[0].id, newDoc.id);
  assert.equal(colleagueDocs[0].role, "view");

  // 8. Persistence check after server close
  if (server.closeAllConnections) server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  const diskData = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  assert.ok(diskData.users.some((u) => u.email === "sachin@example.com"));
  assert.ok(diskData.users.some((u) => u.email === "colleague@example.com"));

  // 9. New server instance reads persisted dynamic user
  const server2 = createApp({ dataFile }).listen(0);
  await new Promise((resolve) => server2.once("listening", resolve));
  const base2 = `http://127.0.0.1:${server2.address().port}/api`;
  const res2 = await fetch(`${base2}/users`, { headers: { connection: "close" } });
  const persistedUsers = await json(res2);
  assert.ok(persistedUsers.some((u) => u.email === "sachin@example.com"));
  if (server2.closeAllConnections) server2.closeAllConnections();
  await new Promise((resolve) => server2.close(resolve));
});

test("file uploads: PDF, DOC, DOCX, MD, and TXT support and sanitization", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ajaia-upload-"));
  const dataFile = path.join(dir, "data.json");
  const server = createApp({ dataFile }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const zlib = require("node:zlib");

  const user = "uploader@example.com";
  await fetch(`${base}/users`, {
    method: "POST",
    headers: { "content-type": "application/json", connection: "close" },
    body: JSON.stringify({ name: "Uploader", email: user })
  });

  const uploadFile = async (filename, buffer, mimeType) => {
    const fd = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    fd.append("file", blob, filename);
    return fetch(`${base}/upload`, {
      method: "POST",
      headers: { "x-user": user, connection: "close" },
      body: fd
    });
  };

  // 1. Text file upload
  let res = await uploadFile("notes.txt", Buffer.from("Line 1\n\nLine 2"), "text/plain");
  assert.equal(res.status, 201);
  let doc = await res.json();
  assert.equal(doc.title, "notes");
  assert.ok(doc.content.includes("Line 1") && doc.content.includes("Line 2"));

  // 2. Markdown file upload
  res = await uploadFile("guide.md", Buffer.from("# Welcome\n\nThis is a guide"), "text/markdown");
  assert.equal(res.status, 201);
  doc = await res.json();
  assert.equal(doc.title, "guide");
  assert.ok(doc.content.includes("<h1>Welcome</h1>"));

  // 3. HTML-based .doc file upload
  res = await uploadFile("draft.doc", Buffer.from("<html><body><h2>Doc Header</h2><p>Doc paragraph</p></body></html>"), "application/msword");
  assert.equal(res.status, 201);
  doc = await res.json();
  assert.equal(doc.title, "draft");
  assert.ok(doc.content.includes("<h2>Doc Header</h2>"));

  // 4. PDF file upload with compressed stream
  const streamText = "BT /F1 12 Tf (PDF Hello World) Tj ET";
  const deflated = zlib.deflateSync(Buffer.from(streamText));
  const pdfBytes = Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Length ${deflated.length} /Filter /FlateDecode >>\nstream\r\n` +
    deflated.toString("latin1") +
    "\r\nendstream\nendobj\n%%EOF",
    "latin1"
  );
  res = await uploadFile("document.pdf", pdfBytes, "application/pdf");
  assert.equal(res.status, 201);
  doc = await res.json();
  assert.equal(doc.title, "document");
  assert.ok(doc.content.includes("PDF Hello World"));

  // 5. Unsupported file rejection
  res = await uploadFile("malicious.exe", Buffer.from("bad binary"), "application/octet-stream");
  assert.equal(res.status, 400);

  if (server.closeAllConnections) server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});
