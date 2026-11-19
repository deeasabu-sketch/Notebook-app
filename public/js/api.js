(() => {
  const token = () => localStorage.getItem("token");
  async function api(path, options = {}) {
    const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    let response;
    try { response = await fetch(`/api${path}`, { ...options, headers }); }
    catch { throw new Error("Unable to reach the server. Check that it is running."); }
    let body = {};
    try { body = await response.json(); } catch { body = {}; }
    if (!response.ok) {
      if (response.status === 401 && token()) { localStorage.removeItem("token"); localStorage.removeItem("user"); if (!location.pathname.endsWith("login.html")) location.href = "/login.html"; }
      throw new Error(response.status === 403 ? "You do not have permission to do that." : (body.message || `Request failed (${response.status})`));
    }
    return body;
  }
  window.api = api;
  window.saveSession = (data) => { localStorage.setItem("token", data.token); localStorage.setItem("user", JSON.stringify(data.user)); };
  window.currentUser = () => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } };
  window.requireUser = (admin = false) => { const user = window.currentUser(); if (!token() || !user) { location.href = "/login.html"; return null; } if (admin && user.role !== "admin") { location.href = "/dashboard.html"; return null; } return user; };
  window.logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); location.href = "/login.html"; };
  window.showMessage = (el, message, error = false) => { el.textContent = message; el.className = `message ${error ? "error" : "success"}`; };
})();
