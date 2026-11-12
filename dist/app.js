const $ = (id) => document.getElementById(id);

let user = "";
let currentUserObj = null;
let allUsers = [];
let current = null;
let timer = null;

async function api(url, options = {}) {
  options.headers = { ...(options.headers || {}), "x-user": user };
  const r = await fetch(`/api${url}`, options);
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== "/users") {
    openAuthModal({ tab: "create", allowClose: false });
    throw new Error(data.error || "Please sign in or create an account");
  }
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
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
  try {
    const r = await fetch("/api/users");
    allUsers = await r.json();
    updateUserSelects();
    renderExistingUsers();
  } catch (e) {
    console.error("Failed to load users", e);
  }
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
    setTimeout(() => $("newUserName").focus(), 100);
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
  const mineDocs = docs.filter((d) => d.role === "owner");
  const sharedDocs = docs.filter((d) => d.role !== "owner");
  $("mineCount").textContent = mineDocs.length;
  $("sharedCount").textContent = sharedDocs.length;

  docs.forEach((d) => {
    const row = document.createElement("div");
    row.className = "doc-row";
    const b = document.createElement("button");
    b.className = "doc";
    b.dataset.id = d.id;
    b.innerHTML = `<span class="doc-leading">${d.role === "owner" ? "▧" : "↗"}</span><span class="doc-copy"><b>${escapeText(d.title)}</b><span class="tag">${d.role === "owner" ? "Personal document" : `${escapeText(d.owner)} · ${d.role}`}</span></span>`;
    b.onclick = () => openDoc(d.id);
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

async function init() {
  await loadUsers();

  const savedUser = localStorage.getItem("ajaia_active_user");
  if (savedUser && allUsers.some((u) => u.email.toLowerCase() === savedUser.toLowerCase())) {
    setUser(savedUser);
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

  // Create account form
  $("createAccountForm").onsubmit = async (e) => {
    e.preventDefault();
    const errorEl = $("authError");
    errorEl.hidden = true;
    errorEl.textContent = "";

    const name = $("newUserName").value.trim();
    const email = $("newUserEmail").value.trim();

    if (!name) {
      errorEl.textContent = "Please enter your name.";
      errorEl.hidden = false;
      return;
    }
    if (!email) {
      errorEl.textContent = "Please enter an email address.";
      errorEl.hidden = false;
      return;
    }

    const submitBtn = $("createAccountSubmit");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `Creating account…`;

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      await loadUsers();
      setUser(data.email);
      closeAuthModal();
      showApp();

      current = null;
      $("editorWrap").hidden = true;
      $("empty").hidden = false;
      await loadDocs();

      message(`Welcome to Ajaia Docs, ${data.name}! Workspace created.`);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Create Account & Enter <span>→</span>`;
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
