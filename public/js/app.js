async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function currentUser() {
  const { user } = await api("/api/me");
  return user;
}

function goHomeForRole(role) {
  const map = {
    patient: "/patient-dashboard.html",
    doctor: "/doctor-dashboard.html",
    admin: "/admin-dashboard.html",
    staff: "/emergency.html"
  };
  location.href = map[role] || "/";
}

async function requireLogin(roles) {
  const user = await currentUser();
  if (!user) {
    location.href = "/login.html";
    throw new Error("login");
  }
  if (roles && !roles.includes(user.role)) {
    goHomeForRole(user.role);
    throw new Error("role");
  }
  return user;
}

async function logout() {
  await api("/api/auth/logout", { method: "POST", body: {} });
  location.href = "/";
}

function formatTime(t) {
  return String(t || "").slice(0, 5);
}

function weekdayName(n) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][n] || n;
}

function showError(id, message) {
  const el = document.getElementById(id);
  if (!el) return alert(message);
  el.style.display = "block";
  el.textContent = message;
}

function fillUser(user) {
  document.querySelectorAll("[data-user-name]").forEach((el) => {
    el.textContent = user.name;
  });
}
