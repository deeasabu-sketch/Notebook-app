document.addEventListener("DOMContentLoaded", async () => {
  const admin = requireUser(true);
  if (!admin) return;
  document.querySelectorAll("[data-logout]").forEach(button => button.addEventListener("click", logout));

  const message = document.querySelector("[data-message]");
  const userRoot = document.querySelector("[data-users]");
  const userPageLabel = document.querySelector("[data-page]");
  const userPrevious = document.querySelector("[data-prev]");
  const userNext = document.querySelector("[data-next]");
  const notesRoot = document.querySelector("[data-admin-notes]");
  const notesPageLabel = document.querySelector("[data-notes-page]");
  const notesPrevious = document.querySelector("[data-notes-prev]");
  const notesNext = document.querySelector("[data-notes-next]");
  const groupsRoot = document.querySelector("[data-groups]");
  const groupsPageLabel = document.querySelector("[data-groups-page]");
  const groupsPrevious = document.querySelector("[data-groups-prev]");
  const groupsNext = document.querySelector("[data-groups-next]");
  const pageSize = 10;
  let userPage = 1, notePage = 1, groupsPage = 1;

  async function loadUsers() {
    userRoot.textContent = "Loading users…";
    try {
      const result = await api(`/admin/users?page=${userPage}&limit=${pageSize}`);
      if (userPage > Math.max(result.pagination.totalPages, 1)) {
        userPage = Math.max(result.pagination.totalPages, 1);
        return loadUsers();
      }
      userPage = result.pagination.page;
      const pages = result.pagination.totalPages;
      userRoot.replaceChildren();
      if (!result.data.length) {
        userRoot.textContent = "No users found.";
      } else result.data.forEach(user => {
        const row = document.createElement("div");
        row.className = "row";
        const summary = document.createElement("span");
        summary.textContent = `${user.name} · ${user.email} · ${user.role} · ${(user.interests || []).join(", ")}`;

        const edit = document.createElement("button");
        edit.textContent = "Edit";
        edit.className = "secondary";
        edit.onclick = async () => {
          const name = prompt("Name", user.name);
          if (name === null) return;
          const role = prompt("Role (user/admin)", user.role);
          if (role === null) return;
          const interests = prompt("Interests, comma separated", (user.interests || []).join(", "));
          if (interests === null) return;
          try {
            await api(`/admin/users/${user._id}`, { method: "PUT", body: JSON.stringify({ name, role, interests: interests.split(",").map(value => value.trim()).filter(Boolean) }) });
            await Promise.all([loadUsers(), loadGroups()]);
            showMessage(message, "User updated.");
          } catch (error) { showMessage(message, error.message, true); }
        };

        const remove = document.createElement("button");
        remove.textContent = user._id === admin.id ? "Current account" : "Delete";
        remove.className = user._id === admin.id ? "secondary" : "danger";
        remove.disabled = user._id === admin.id;
        remove.onclick = async () => {
          if (!confirm(`Delete ${user.email} and their notes/posts?`)) return;
          try {
            await api(`/admin/users/${user._id}`, { method: "DELETE" });
            const refreshed = await api(`/admin/users?page=${userPage}&limit=${pageSize}`);
            if (userPage > Math.max(refreshed.pagination.totalPages, 1)) userPage = Math.max(refreshed.pagination.totalPages, 1);
            await Promise.all([loadUsers(), loadGroups()]);
            showMessage(message, "User and their notes/posts deleted.");
          } catch (error) { showMessage(message, error.message, true); }
        };
        const actions = document.createElement("div");
        actions.className = "actions";
        actions.append(edit, remove);
        row.append(summary, actions);
        userRoot.append(row);
      });
      userPageLabel.textContent = `Page ${userPage} of ${Math.max(pages, 1)} (${result.pagination.total} users)`;
      userPrevious.disabled = userPage <= 1;
      userNext.disabled = userPage >= pages;
    } catch (error) {
      userRoot.textContent = error.message;
      userPageLabel.textContent = "Users could not be loaded.";
      userPrevious.disabled = true;
      userNext.disabled = true;
    }
  }

  async function loadNotes() {
    notesRoot.textContent = "Loading notes…";
    try {
      const result = await api(`/admin/notes?page=${notePage}&limit=${pageSize}`);
      if (notePage > Math.max(result.pagination.totalPages, 1)) {
        notePage = Math.max(result.pagination.totalPages, 1);
        return loadNotes();
      }
      notePage = result.pagination.page;
      notesRoot.replaceChildren();
      if (!result.data.length) notesRoot.textContent = "No notes found.";
      else result.data.forEach(note => {
        const row = document.createElement("p");
        const owner = note.userId ? `${note.userId.name} (${note.userId.email})` : "Unknown owner";
        row.textContent = `${note.title} — ${owner}`;
        notesRoot.append(row);
      });
      notesPageLabel.textContent = `Page ${notePage} of ${Math.max(result.pagination.totalPages, 1)} (${result.pagination.total} notes)`;
      notesPrevious.disabled = notePage <= 1;
      notesNext.disabled = notePage >= result.pagination.totalPages;
    } catch (error) {
      notesRoot.textContent = error.message;
      notesPageLabel.textContent = "Notes could not be loaded.";
      notesPrevious.disabled = true;
      notesNext.disabled = true;
    }
  }

  async function loadGroups() {
    groupsRoot.textContent = "Loading interest groups…";
    try {
      const result = await api(`/aggregation/interests?page=${groupsPage}&limit=5`);
      if (groupsPage > Math.max(result.pagination.totalPages, 1)) {
        groupsPage = Math.max(result.pagination.totalPages, 1);
        return loadGroups();
      }
      groupsPage = result.pagination.page;
      groupsRoot.replaceChildren();
      if (!result.data.length) groupsRoot.textContent = "No interests found.";
      else result.data.forEach(group => {
        const section = document.createElement("section");
        const heading = document.createElement("h3");
        heading.textContent = `${group.interest} (${group.totalUsers})`;
        const names = document.createElement("p");
        names.textContent = group.users.map(user => `${user.name} (${user.email})`).join(", ");
        section.append(heading, names);
        groupsRoot.append(section);
      });
      groupsPageLabel.textContent = `Page ${groupsPage} of ${Math.max(result.pagination.totalPages, 1)} (${result.pagination.total} interests)`;
      groupsPrevious.disabled = groupsPage <= 1;
      groupsNext.disabled = groupsPage >= result.pagination.totalPages;
    } catch (error) {
      groupsRoot.textContent = error.message;
      groupsPageLabel.textContent = "Interest groups could not be loaded.";
      groupsPrevious.disabled = true;
      groupsNext.disabled = true;
    }
  }

  userPrevious.onclick = () => { userPage -= 1; loadUsers(); };
  userNext.onclick = () => { userPage += 1; loadUsers(); };
  notesPrevious.onclick = () => { notePage -= 1; loadNotes(); };
  notesNext.onclick = () => { notePage += 1; loadNotes(); };
  groupsPrevious.onclick = () => { groupsPage -= 1; loadGroups(); };
  groupsNext.onclick = () => { groupsPage += 1; loadGroups(); };

  document.querySelector("[data-create-user]").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    payload.interests = payload.interests.split(",").map(value => value.trim()).filter(Boolean);
    try {
      await api("/admin/users", { method: "POST", body: JSON.stringify(payload) });
      form.reset();
      userPage = 1;
      await Promise.all([loadUsers(), loadGroups()]);
      showMessage(message, "User created.");
    } catch (error) { showMessage(message, error.message, true); }
  });

  document.querySelector("[data-inspect]").addEventListener("submit", async event => {
    event.preventDefault();
    const id = new FormData(event.currentTarget).get("id");
    const root = document.querySelector("[data-posts]");
    root.textContent = "Loading…";
    try {
      const result = await api(`/aggregation/users/${encodeURIComponent(id)}/posts`);
      root.replaceChildren();
      const heading = document.createElement("h3");
      heading.textContent = `${result.data.name} · ${result.data._id}`;
      root.append(heading);
      if (!result.data.posts.length) root.append("No public posts.");
      result.data.posts.forEach(post => {
        const article = document.createElement("article");
        article.className = "card";
        const title = document.createElement("h4"); title.textContent = post.title;
        const content = document.createElement("p"); content.textContent = post.content;
        article.append(title, content);
        root.append(article);
      });
    } catch (error) { root.textContent = error.message; }
  });

  await Promise.all([loadUsers(), loadNotes(), loadGroups()]);
});
