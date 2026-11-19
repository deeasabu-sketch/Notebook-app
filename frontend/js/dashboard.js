document.addEventListener("DOMContentLoaded", async () => {
  const user = requireUser();
  if (!user) return;

  document.querySelector("[data-name]").textContent = user.name;
  document.querySelectorAll("[data-logout]").forEach(button => button.addEventListener("click", logout));

  const noteForm = document.querySelector("[data-note-form]");
  const message = document.querySelector("[data-message]");
  const noteList = document.querySelector("[data-notes]");
  const previous = document.querySelector("[data-notes-prev]");
  const next = document.querySelector("[data-notes-next]");
  const pageLabel = document.querySelector("[data-notes-page]");
  let page = 1;
  let totalPages = 0;

  async function loadNotes(requestedPage = page) {
    page = requestedPage;
    noteList.textContent = "Loading notes…";
    try {
      const result = await api(`/notes?page=${page}&limit=10`);
      if (page > Math.max(result.pagination.totalPages, 1)) {
        return loadNotes(Math.max(result.pagination.totalPages, 1));
      }
      page = result.pagination.page;
      totalPages = result.pagination.totalPages;
      noteList.replaceChildren();
      pageLabel.textContent = `Page ${page} of ${Math.max(totalPages, 1)} (${result.pagination.total} notes)`;
      previous.disabled = page <= 1;
      next.disabled = page >= totalPages;

      if (result.data.length === 0) {
        noteList.textContent = "No notes on this page. Create your first note above.";
        return;
      }

      result.data.forEach(note => {
        const card = document.createElement("article");
        card.className = "card note";
        const title = document.createElement("h3");
        title.textContent = note.title;
        const content = document.createElement("p");
        content.textContent = note.content;

        const edit = document.createElement("button");
        edit.textContent = "Edit";
        edit.className = "secondary";
        edit.onclick = async () => {
          const nextTitle = prompt("Note title", note.title);
          if (nextTitle === null) return;
          const nextContent = prompt("Note content", note.content);
          if (nextContent === null) return;
          try {
            await api(`/notes/${note._id}`, { method: "PUT", body: JSON.stringify({ title: nextTitle, content: nextContent }) });
            showMessage(message, "Note updated.");
            await loadNotes();
          } catch (error) { showMessage(message, error.message, true); }
        };

        const remove = document.createElement("button");
        remove.textContent = "Delete";
        remove.className = "danger";
        remove.onclick = async () => {
          if (!confirm("Delete this note?")) return;
          try {
            await api(`/notes/${note._id}`, { method: "DELETE" });
            showMessage(message, "Note deleted.");
            await loadNotes(page);
          } catch (error) { showMessage(message, error.message, true); }
        };
        const actions = document.createElement("div");
        actions.className = "actions";
        actions.append(edit, remove);
        card.append(title, content, actions);
        noteList.append(card);
      });
    } catch (error) {
      noteList.textContent = error.message;
      pageLabel.textContent = "Notes could not be loaded.";
      previous.disabled = true;
      next.disabled = true;
    }
  }

  previous.addEventListener("click", () => loadNotes(page - 1));
  next.addEventListener("click", () => loadNotes(page + 1));

  noteForm.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      await api("/notes", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(noteForm))) });
      noteForm.reset();
      showMessage(message, "Note saved.");
      await loadNotes(1);
    } catch (error) { showMessage(message, error.message, true); }
  });

  document.querySelector("[data-post-form]").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const result = await api("/posts", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      form.reset();
      showMessage(message, `Public post created (${result.data._id}).`);
    } catch (error) { showMessage(message, error.message, true); }
  });

  await loadNotes();
});
