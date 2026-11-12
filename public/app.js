const $ = (id) => document.getElementById(id);

let user = "";
let currentUserObj = null;
let allUsers = [];
let current = null;
let timer = null;

// Local storage helpers for static hosting / offline fallback
function getLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem("ajaia_local_users") || "[]");
  } catch (e) {
    return [];
  }
}
function saveLocalUsers(list) {
  try {
    localStorage.setItem("ajaia_local_users", JSON.stringify(list));
  } catch (e) {}
}
function getLocalDocs(userEmail) {
  try {
    const norm = (userEmail || "").toLowerCase();
    const all = JSON.parse(localStorage.getItem("ajaia_local_docs") || "[]");
    return all.filter((d) => d.owner.toLowerCase() === norm || (d.shares && d.shares.some((s) => s.email.toLowerCase() === norm)));
  } catch (e) {
    return [];
  }
}
function saveLocalDoc(doc) {
  try {
    const all = JSON.parse(localStorage.getItem("ajaia_local_docs") || "[]");
    const idx = all.findIndex((d) => d.id === doc.id);
    if (idx >= 0) all[idx] = doc;
    else all.push(doc);
    localStorage.setItem("ajaia_local_docs", JSON.stringify(all));
  } catch (e) {}
}
function deleteLocalDoc(id) {
  try {
    const all = JSON.parse(localStorage.getItem("ajaia_local_docs") || "[]");
    const filtered = all.filter((d) => d.id !== id);
    localStorage.setItem("ajaia_local_docs", JSON.stringify(filtered));
  } catch (e) {}
}
function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "doc_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
}

async function api(url, options = {}) {
  options.headers = { ...(options.headers || {}), "x-user": user };
  try {
    const r = await fetch(`/api${url}`, options);
    // If route doesn't exist on host (404/405/500+), fall back to local storage
    if (r.status === 404 || r.status === 405 || r.status >= 500) {
      return handleLocalApi(url, options);
    }
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await r.json().catch(() => ({}));
      if (r.status === 401 && url !== "/users") {
        openAuthModal({ tab: "create", allowClose: false });
        throw new Error(data.error || "Please sign in or create an account");
      }
      if (!r.ok) {
        if (r.status === 400 || r.status === 403) {
          throw new Error(data.error || "Request failed");
        }
        return handleLocalApi(url, options);
      }
      return data;
    }
  } catch (err) {
    if (err.message && (err.message.includes("Please sign in") || err.message.includes("View-only") || err.message.includes("Only the owner") || err.message.includes("Title is required") || err.message.includes("Request failed"))) {
      throw err;
    }
  }

  // Fallback to local storage (e.g. static hosting on mobile/CDN without Node backend)
  return handleLocalApi(url, options);
}

function handleLocalApi(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  if (url === "/docs" && method === "GET") {
    return getLocalDocs(user).map((d) => ({
      ...d,
      role: d.owner.toLowerCase() === user.toLowerCase() ? "owner" : (d.shares?.find((s) => s.email.toLowerCase() === user.toLowerCase())?.role || "view")
    }));
  }

  if (url === "/docs" && method === "POST") {
    const body = JSON.parse(options.body || "{}");
    const doc = {
      id: generateUUID(),
      title: (body.title || "Untitled document").trim() || "Untitled document",
      content: body.content || "<p></p>",
      owner: user,
      shares: [],
      updatedAt: new Date().toISOString()
    };
    saveLocalDoc(doc);
    return { ...doc, role: "owner" };
  }

  const docIdMatch = url.match(/^\/docs\/([^/]+)$/);
  if (docIdMatch) {
    const id = docIdMatch[1];
    const all = JSON.parse(localStorage.getItem("ajaia_local_docs") || "[]");
    const doc = all.find((d) => d.id === id);

    if (method === "GET") {
      if (!doc) throw new Error("Document not found");
      return {
        ...doc,
        role: doc.owner.toLowerCase() === user.toLowerCase() ? "owner" : (doc.shares?.find((s) => s.email.toLowerCase() === user.toLowerCase())?.role || "view")
      };
    }

    if (method === "PUT") {
      if (!doc) throw new Error("Document not found");
      const body = JSON.parse(options.body || "{}");
      if (body.title !== undefined) doc.title = body.title.trim() || "Untitled document";
      if (body.content !== undefined) doc.content = body.content;
      doc.updatedAt = new Date().toISOString();
      saveLocalDoc(doc);
      return {
        ...doc,
        role: doc.owner.toLowerCase() === user.toLowerCase() ? "owner" : "view"
      };
    }

    if (method === "DELETE") {
      deleteLocalDoc(id);
      return {};
    }
  }

  const shareMatch = url.match(/^\/docs\/([^/]+)\/share$/);
  if (shareMatch && method === "POST") {
    const id = shareMatch[1];
    const all = JSON.parse(localStorage.getItem("ajaia_local_docs") || "[]");
    const doc = all.find((d) => d.id === id);
    if (!doc) throw new Error("Document not found");
    const { email, role } = JSON.parse(options.body || "{}");
    const existing = doc.shares.find((s) => s.email.toLowerCase() === (email || "").toLowerCase());
    if (existing) existing.role = role;
    else doc.shares.push({ email, role });
    doc.updatedAt = new Date().toISOString();
    saveLocalDoc(doc);
    return doc;
  }

  return {};
}

function showApp() {
  $("landing").hidden = true;
  $("appShell").hidden = false;
  window.scrollTo(0, 0);
}

function showLanding() {
  $("appShell").hidden = true;
  $("landing").hidden = false;
  window.scrollTo(0, 0);
}

function message(text) {
  const el = $("message");
  el.textContent = text;
  el.style.display = text ? "block" : "none";
  if (text) {
    setTimeout(() => {
      el.style.display = "none";
    }, 4000);
  }
}

function getInitials(name, email) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (email || "U").slice(0, 2).toUpperCase();
}

async function loadUsers() {
  let serverUsers = null;
  try {
    const r = await fetch("/api/users");
    const ct = r.headers.get("content-type") || "";
    if (r.ok && ct.includes("application/json")) {
      serverUsers = await r.json();
    }
  } catch (e) {}

  if (Array.isArray(serverUsers)) {
    allUsers = serverUsers;
    const localUsers = getLocalUsers();
    // Merge any locally saved accounts
    localUsers.forEach((lu) => {
      if (!allUsers.some((su) => su.email.toLowerCase() === lu.email.toLowerCase())) {
        allUsers.push(lu);
      }
    });
  } else {
    allUsers = getLocalUsers();
  }

  updateUserSelects();
  renderExistingUsers();
}

function updateUserSelects() {
  const select = $("user");
  select.innerHTML = "";
  allUsers.forEach((u) => {
    select.add(new Option(`${u.name} (${u.email})`, u.email));
  });
  if (user) {
    select.value = user;
  }

  const shareSelect = $("shareUser");
  shareSelect.innerHTML = "";
  const otherUsers = allUsers.filter((u) => u.email.toLowerCase() !== (user || "").toLowerCase());
  if (otherUsers.length === 0) {
    shareSelect.add(new Option("No other users available", ""));
  } else {
    otherUsers.forEach((u) => {
      shareSelect.add(new Option(`${u.name} (${u.email})`, u.email));
    });
  }
}

function renderExistingUsers() {
  const list = $("existingUsersList");
  list.innerHTML = "";
  if (allUsers.length === 0) {
    list.innerHTML = `<div style="text-align:center;color:#88978e;padding:20px;font-size:12px">No registered accounts yet. Create your account to start!</div>`;
    return;
  }
  allUsers.forEach((u) => {
    const isActive = u.email.toLowerCase() === (user || "").toLowerCase();
    const card = document.createElement("div");
    card.className = `account-card ${isActive ? "active-user" : ""}`;
    card.innerHTML = `
      <div class="account-card-left">
        <span class="avatar-circle">${getInitials(u.name, u.email)}</span>
        <div class="account-card-info">
          <span class="account-card-name">${escapeText(u.name)}</span>
          <span class="account-card-email">${escapeText(u.email)}</span>
        </div>
      </div>
      <span class="account-card-action">${isActive ? "✓ Active" : "Enter →"}</span>
    `;
    card.onclick = () => {
      setUser(u.email);
      closeAuthModal();
      showApp();
      loadDocs();
      message(`Signed in as ${u.name}`);
    };
    list.appendChild(card);
  });
}

function setUser(email) {
  const found = allUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (found) {
    user = found.email;
    currentUserObj = found;
  } else {
    user = email;
    currentUserObj = { email, name: email.split("@")[0] };
  }
  localStorage.setItem("ajaia_active_user", user);

  $("userNameDisplay").textContent = currentUserObj.name;
  $("userEmailDisplay").textContent = currentUserObj.email;
  $("userAvatar").textContent = getInitials(currentUserObj.name, currentUserObj.email);
  $("userPill").hidden = false;

  if ($("user").value !== user) {
    $("user").value = user;
  }

  updateUserSelects();
  renderExistingUsers();
}

function openAuthModal({ tab = "create", allowClose = true } = {}) {
  $("authError").hidden = true;
  $("authError").textContent = "";
  $("newUserName").value = "";
  $("newUserEmail").value = "";

  const closeBtn = $("modalCloseBtn");
  if (allowClose && user) {
    closeBtn.hidden = false;
  } else {
    closeBtn.hidden = true;
  }

  setModalTab(tab);
  $("authModal").hidden = false;

  if (tab === "create") {
    setTimeout(() => {
      try {
        $("newUserName").focus();
      } catch (e) {}
    }, 150);
  }
}

function closeAuthModal() {
  $("authModal").hidden = true;
}

function setModalTab(tab) {
  if (tab === "create") {
    $("tabCreate").classList.add("active");
    $("tabExisting").classList.remove("active");
    $("createAccountForm").hidden = false;
    $("existingAccountsPanel").hidden = true;
    $("modalTitle").textContent = "Create your workspace";
    $("modalSubtitle").textContent = "Enter your details to create an account and start writing.";
  } else {
    $("tabCreate").classList.remove("active");
    $("tabExisting").classList.add("active");
    $("createAccountForm").hidden = true;
    $("existingAccountsPanel").hidden = false;
    $("modalTitle").textContent = "Select an account";
    $("modalSubtitle").textContent = "Choose an existing account to enter.";
    renderExistingUsers();
  }
}

function downloadDoc() {
  if (!current) return message("Open a document before downloading");
  const safeName = (current.title || "document").replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").trim() || "document";
  const wordHtml = `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escapeText(current.title)}</title><style>body{font-family:Arial,sans-serif;color:#202124}h1{font-size:24pt}h2{font-size:18pt}p{font-size:11pt;line-height:1.5}</style></head><body>${$("content").innerHTML}</body></html>`;
  const blob = new Blob([wordHtml], { type: "application/msword" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${safeName}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
  message("Word document downloaded");
}

function renderDocs(docs) {
  $("mine").innerHTML = "";
  $("shared").innerHTML = "";
  const mineDocs = (docs || []).filter((d) => d.role === "owner");
  const sharedDocs = (docs || []).filter((d) => d.role !== "owner");
  $("mineCount").textContent = mineDocs.length;
  $("sharedCount").textContent = sharedDocs.length;

  (docs || []).forEach((d) => {
    const row = document.createElement("div");
    row.className = "doc-row";
    const b = document.createElement("button");
    b.className = "doc";
    b.dataset.id = d.id;
    b.innerHTML = `<span class="doc-leading">${d.role === "owner" ? "▧" : "↗"}</span><span class="doc-copy"><b>${escapeText(d.title)}</b><span class="tag">${d.role === "owner" ? "Personal document" : `${escapeText(d.owner)} · ${d.role}`}</span></span>`;
    b.onclick = () => {
      openDoc(d.id);
      // Close mobile sidebar on selection
      $("appShell").classList.remove("sidebar-open");
    };
    row.appendChild(b);

    if (d.role === "owner") {
      const remove = document.createElement("button");
      remove.className = "doc-delete";
      remove.type = "button";
      remove.title = "Delete document";
      remove.setAttribute("aria-label", `Delete ${d.title}`);
      remove.textContent = "⌫";
      remove.onclick = (event) => {
        event.stopPropagation();
        deleteDoc(d);
      };
      row.appendChild(remove);
    }
    (d.role === "owner" ? $("mine") : $("shared")).appendChild(row);
  });
}

async function deleteDoc(doc) {
  if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
  try {
    await api(`/docs/${doc.id}`, { method: "DELETE" });
    if (current?.id === doc.id) {
      current = null;
      $("editorWrap").hidden = true;
      $("empty").hidden = false;
    }
    await loadDocs();
    message("Document deleted");
  } catch (e) {
    message(e.message);
  }
}

function escapeText(s) {
  const e = document.createElement("span");
  e.textContent = s || "";
  return e.innerHTML;
}

async function loadDocs() {
  if (!user) return;
  try {
    const docs = await api("/docs");
    renderDocs(docs);
  } catch (e) {
    message(e.message);
  }
}

async function openDoc(id) {
  try {
    current = await api(`/docs/${id}`);
    $("empty").hidden = true;
    $("editorWrap").hidden = false;
    $("title").value = current.title;
    $("content").innerHTML = current.content;
    $("status").textContent = "Saved";
    const canEdit = current.role === "owner" || current.role === "edit";
    const canShare = current.role === "owner";
    $("title").disabled = !canEdit;
    $("content").contentEditable = canEdit;
    document.querySelectorAll(".toolbar button:not(#shareBtn)").forEach((b) => (b.disabled = !canEdit));
    $("shareBtn").disabled = !canShare;
    $("shareBtn").setAttribute("aria-disabled", String(!canShare));
    $("shareBtn").setAttribute("aria-expanded", "false");
    document.querySelectorAll(".doc").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
    $("sharePanel").hidden = true;
  } catch (e) {
    message(e.message);
  }
}

function save() {
  clearTimeout(timer);
  $("status").textContent = "Saving…";
  timer = setTimeout(async () => {
    try {
      await api(`/docs/${current.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: $("title").value, content: $("content").innerHTML })
      });
      $("status").textContent = "Saved";
      await loadDocs();
    } catch (e) {
      $("status").textContent = "Not saved";
      message(e.message);
    }
  }, 700);
}

function handleEnterApp() {
  if (user) {
    showApp();
    loadDocs();
  } else {
    openAuthModal({ tab: "create", allowClose: false });
  }
}

async function submitCreateAccount(e) {
  if (e && e.preventDefault) e.preventDefault();
  const errorEl = $("authError");
  errorEl.hidden = true;
  errorEl.textContent = "";

  const nameInput = $("newUserName");
  const emailInput = $("newUserEmail");
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();

  if (!name) {
    errorEl.textContent = "Please enter your name.";
    errorEl.hidden = false;
    nameInput.focus();
    return;
  }
  if (!email) {
    errorEl.textContent = "Please enter your email address.";
    errorEl.hidden = false;
    emailInput.focus();
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || email.length > 120) {
    errorEl.textContent = "Please enter a valid email address (e.g. name@domain.com).";
    errorEl.hidden = false;
    emailInput.focus();
    return;
  }

  const submitBtn = $("createAccountSubmit");
  submitBtn.disabled = true;
  submitBtn.innerHTML = `Creating account…`;

  try {
    await handleCreateAccount(name, email);
  } catch (err) {
    errorEl.textContent = err.message || "Failed to create account";
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Create Account & Enter <span>→</span>`;
  }
}

async function handleCreateAccount(name, email) {
  const normEmail = email.toLowerCase().trim();
  let createdUser = null;

  // 1. Try server API if backend exists
  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: normEmail })
    });
    if (res.status === 201 || res.status === 200) {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        createdUser = await res.json();
      }
    } else if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "An account with this email already exists");
    } else if (res.status === 400) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Please enter a valid email address");
    }
  } catch (err) {
    if (err.message && (err.message.includes("already exists") || err.message.includes("valid email") || err.message.includes("Invalid"))) {
      throw err;
    }
  }

  // 2. If server not available (e.g. static hosting on mobile/CDN), save in local browser storage
  if (!createdUser) {
    const localUsers = getLocalUsers();
    if (localUsers.some((u) => u.email.toLowerCase() === normEmail)) {
      throw new Error("An account with this email already exists");
    }
    createdUser = { name: name.trim(), email: normEmail };
    localUsers.push(createdUser);
    saveLocalUsers(localUsers);
  }

  await loadUsers();
  setUser(createdUser.email);
  closeAuthModal();
  showApp();

  current = null;
  $("editorWrap").hidden = true;
  $("empty").hidden = false;
  await loadDocs();

  message(`Welcome, ${createdUser.name}! Workspace created.`);
}

async function init() {
  await loadUsers();

  const savedUser = localStorage.getItem("ajaia_active_user");
  if (savedUser && allUsers.some((u) => u.email.toLowerCase() === savedUser.toLowerCase())) {
    setUser(savedUser);
  } else {
    user = "";
    currentUserObj = null;
    localStorage.removeItem("ajaia_active_user");
    $("userPill").hidden = true;
  }

  // Mobile menu toggle
  const mobileToggle = $("mobileMenuToggle");
  if (mobileToggle) {
    mobileToggle.onclick = () => {
      $("appShell").classList.toggle("sidebar-open");
    };
  }

  // Setup landing actions
  $("heroOpen").onclick = handleEnterApp;
  $("navOpen").onclick = handleEnterApp;
  $("bottomOpen").onclick = handleEnterApp;

  // Header and Navigation
  $("backHome").onclick = showLanding;
  $("homeLink").onclick = (e) => {
    e.preventDefault();
    showLanding();
  };

  $("userPill").onclick = () => openAuthModal({ tab: "existing", allowClose: true });
  $("openAuthModalBtn").onclick = () => openAuthModal({ tab: "create", allowClose: Boolean(user) });
  $("modalCloseBtn").onclick = closeAuthModal;

  $("tabCreate").onclick = () => setModalTab("create");
  $("tabExisting").onclick = () => setModalTab("existing");
  $("switchToExisting").onclick = () => setModalTab("existing");
  $("switchToCreate").onclick = () => setModalTab("create");

  // Legacy select support
  $("user").onchange = () => {
    setUser($("user").value);
    current = null;
    $("editorWrap").hidden = true;
    $("empty").hidden = false;
    loadDocs();
  };

  // Create account form & button triggers
  $("createAccountForm").onsubmit = submitCreateAccount;
  $("createAccountSubmit").onclick = (e) => {
    if (e.target.type !== "submit") {
      submitCreateAccount(e);
    }
  };

  // Document actions
  $("new").onclick = async () => {
    try {
      const d = await api("/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled document", content: "<p></p>" })
      });
      await loadDocs();
      openDoc(d.id);
      $("appShell").classList.remove("sidebar-open");
    } catch (e) {
      message(e.message);
    }
  };

  $("title").oninput = save;
  $("content").oninput = save;

  document.querySelectorAll("[data-cmd]").forEach((b) => {
    b.onclick = () => {
      document.execCommand(b.dataset.cmd, false, b.dataset.value || null);
      $("content").focus();
      save();
    };
  });

  $("shareBtn").onclick = () => {
    if (!current || current.role !== "owner") return message("Only the document owner can share it");
    const panel = $("sharePanel");
    panel.hidden = !panel.hidden;
    $("shareBtn").setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) {
      updateUserSelects();
      $("shareUser").focus();
    }
  };

  $("downloadBtn").onclick = downloadDoc;

  $("share").onclick = async () => {
    const targetEmail = $("shareUser").value;
    if (!targetEmail) return message("No user selected to share with");
    try {
      await api(`/docs/${current.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, role: $("shareRole").value })
      });
      message(`Document shared with ${targetEmail}`);
      $("sharePanel").hidden = true;
    } catch (e) {
      message(e.message);
    }
  };

  $("file").onchange = async () => {
    if (!$("file").files[0]) return;
    const fd = new FormData();
    fd.append("file", $("file").files[0]);
    try {
      const d = await api("/upload", { method: "POST", body: fd });
      await loadDocs();
      openDoc(d.id);
      $("appShell").classList.remove("sidebar-open");
    } catch (e) {
      message(e.message);
    }
    $("file").value = "";
  };

  // Close modal when clicking outside container
  $("authModal").onclick = (e) => {
    if (e.target === $("authModal") && !$("modalCloseBtn").hidden) {
      closeAuthModal();
    }
  };

  // If user is already active, pre-load docs
  if (user) {
    loadDocs();
  }
}

init();
