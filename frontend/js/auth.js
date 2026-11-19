document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form[data-auth]");
  if (!form) return;
  const message = document.querySelector("[data-message]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); const button = form.querySelector("button[type=submit]"); button.disabled = true;
    try {
      const isRegister = form.dataset.auth === "register";
      const payload = Object.fromEntries(new FormData(form));
      if (isRegister) payload.interests = payload.interests.split(",").map(x => x.trim()).filter(Boolean);
      const result = await api(`/auth/${isRegister ? "register" : "login"}`, { method: "POST", body: JSON.stringify(payload) });
      saveSession(result); location.href = result.user.role === "admin" ? "/admin.html" : "/dashboard.html";
    } catch (error) { showMessage(message, error.message, true); button.disabled = false; }
  });
});
