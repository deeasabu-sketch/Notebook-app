document.addEventListener("DOMContentLoaded", async () => {
  const feed = document.querySelector("[data-feed]");
  const message = document.querySelector("[data-feed-message]");
  const previous = document.querySelector("[data-feed-prev]");
  const next = document.querySelector("[data-feed-next]");
  const pageLabel = document.querySelector("[data-feed-page]");
  let page = 1;

  async function load(requestedPage = page) {
    page = requestedPage;
    feed.textContent = "Loading posts…";
    try {
      const result = await api(`/posts?page=${page}&limit=10`);
      page = result.pagination.page;
      feed.replaceChildren();
      pageLabel.textContent = `Page ${page} of ${Math.max(result.pagination.totalPages, 1)} (${result.pagination.total} posts)`;
      previous.disabled = page <= 1;
      next.disabled = page >= result.pagination.totalPages;

      if (!result.data.length) {
        feed.textContent = result.pagination.total === 0 ? "No public posts yet. Check back soon." : "There are no posts on this page.";
        return;
      }

      result.data.forEach(post => {
        const card = document.createElement("article");
        card.className = "card public-post";
        const heading = document.createElement("h2");
        heading.textContent = post.title;
        const meta = document.createElement("p");
        meta.className = "muted post-meta";
        const author = post.userId?.name || "Former user";
        const date = new Date(post.createdAt);
        meta.textContent = `By ${author} · ${Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString()}`;
        const content = document.createElement("p");
        content.className = "post-content";
        content.textContent = post.content;
        card.append(heading, meta, content);
        feed.append(card);
      });
    } catch (error) {
      feed.textContent = "Public posts could not be loaded.";
      showMessage(message, error.message, true);
      pageLabel.textContent = "";
      previous.disabled = true;
      next.disabled = true;
    }
  }

  previous.addEventListener("click", () => load(page - 1));
  next.addEventListener("click", () => load(page + 1));
  await load();
});
