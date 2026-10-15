(() => {
  "use strict";

  const grid = document.getElementById("video-grid");
  const notice = document.getElementById("notice");
  const count = document.getElementById("video-count");
  const year = document.getElementById("year");

  if (year) year.textContent = String(new Date().getFullYear());

  // Derive the site base from this script's URL. Works at both / and /repo-name/.
  const scriptElement = document.currentScript;
  const siteBase = new URL(".", scriptElement ? scriptElement.src : window.location.href);
  const videosUrl = new URL("images/videos.json", siteBase);
  const linksUrl = new URL("images/links.json", siteBase);
  const thumbnailsBase = new URL("images/", siteBase);

  function showNotice(message, isError = false) {
    notice.textContent = message;
    notice.classList.toggle("error", isError);
    notice.hidden = false;
  }

  function hideNotice() {
    notice.hidden = true;
    notice.textContent = "";
    notice.classList.remove("error");
  }

  async function fetchJson(url, label) {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${label} লোড করা যায়নি (HTTP ${response.status})`);
    return response.json();
  }

  function safeThumbnailUrl(filename) {
    if (typeof filename !== "string") return null;
    const name = filename.trim();
    // Accept only a plain filename, not a path, URL, query, fragment or encoded traversal.
    if (!name || name === "." || name === ".." || /[\/\\?#:%\u0000-\u001f]/.test(name) || name.includes("..")) return null;
    return new URL(name, thumbnailsBase).href;
  }

  function normalizeVideos(value) {
    if (!Array.isArray(value)) throw new Error("videos.json-এর মূল data অবশ্যই একটি JSON array হতে হবে।");
    return value.filter(item => item && typeof item === "object" && !Array.isArray(item));
  }

  function normalizeLinks(value) {
    if (!Array.isArray(value)) throw new Error("links.json-এর মূল data অবশ্যই একটি JSON array হতে হবে।");
    const valid = [];
    for (const item of value) {
      if (typeof item !== "string" || !item.trim()) continue;
      try {
        const url = new URL(item.trim());
        if (url.protocol === "http:" || url.protocol === "https:") valid.push(url.href);
      } catch (_) {
        // Ignore malformed URLs.
      }
    }
    return [...new Set(valid)];
  }

  function makePlayIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M8 5.5v13l10-6.5z");
    svg.appendChild(path);
    return svg;
  }

  function openRandomLink(links) {
    if (!links.length) {
      showNotice("এখন কোনো valid video link পাওয়া যায়নি। images/links.json ফাইলে একটি সঠিক https:// বা http:// URL যোগ করুন।", true);
      return;
    }
    hideNotice();
    const index = Math.floor(Math.random() * links.length);
    const selectedUrl = links[index];
    // noopener prevents the opened page from controlling this page; noreferrer suppresses referrer.
    const opened = window.open(selectedUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      showNotice("নতুন ট্যাব খোলা যায়নি। আপনার browser-এর popup blocking সেটিং পরীক্ষা করুন।", true);
    }
  }

  function renderVideos(videos, links) {
    grid.replaceChildren();
    if (count) count.textContent = `${videos.length} টি ভিডিও`;

    if (!videos.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const title = document.createElement("strong");
      title.textContent = "এখনও কোনো ভিডিও যোগ করা হয়নি";
      const detail = document.createElement("span");
      detail.textContent = "images/videos.json ফাইলে ভিডিওর title ও thumbnail filename যোগ করুন।";
      empty.append(title, detail);
      grid.appendChild(empty);
      return;
    }

    for (const [index, video] of videos.entries()) {
      const card = document.createElement("article");
      card.className = "video-card";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "thumbnail-button";
      const titleText = typeof video.title === "string" && video.title.trim()
        ? video.title.trim()
        : `Untitled video ${index + 1}`;
      button.setAttribute("aria-label", `${titleText} — random video link খুলুন`);

      const fallback = document.createElement("span");
      fallback.className = "thumbnail-fallback";
      fallback.setAttribute("aria-hidden", "true");
      button.appendChild(fallback);

      const imageUrl = safeThumbnailUrl(video.image);
      fallback.style.display = imageUrl ? "none" : "grid";
      if (imageUrl) {
        const img = document.createElement("img");
        img.className = "thumbnail";
        img.src = imageUrl;
        img.alt = "";
        img.loading = index < 2 ? "eager" : "lazy";
        img.decoding = "async";
        img.addEventListener("error", () => {
          img.remove();
          fallback.style.display = "grid";
        }, { once: true });
        button.insertBefore(img, fallback);
      }

      const play = document.createElement("span");
      play.className = "play-button";
      play.appendChild(makePlayIcon());
      button.appendChild(play);
      button.addEventListener("click", () => openRandomLink(links));

      const body = document.createElement("div");
      body.className = "card-body";
      const heading = document.createElement("h3");
      heading.className = "card-title";
      heading.textContent = titleText;
      body.appendChild(heading);

      card.append(button, body);
      grid.appendChild(card);
    }

    if (!links.length) {
      showNotice("ভিডিও কার্ডগুলো দেখা যাচ্ছে, কিন্তু এখন কোনো valid link নেই। images/links.json ফাইলে সঠিক URL যোগ করুন।", true);
    } else {
      hideNotice();
    }
  }

  async function init() {
    try {
      const [videosData, linksData] = await Promise.all([
        fetchJson(videosUrl, "ভিডিও তালিকা"),
        fetchJson(linksUrl, "লিংক তালিকা")
      ]);
      const videos = normalizeVideos(videosData);
      const links = normalizeLinks(linksData);
      renderVideos(videos, links);
    } catch (error) {
      console.error("All Viral Links loading error:", error);
      grid.replaceChildren();
      if (count) count.textContent = "লোড ব্যর্থ";
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const title = document.createElement("strong");
      title.textContent = "ডেটা লোড করা যায়নি";
      const detail = document.createElement("span");
      detail.textContent = `${error instanceof Error ? error.message : "একটি অপ্রত্যাশিত সমস্যা হয়েছে।"} videos.json ও links.json-এর path এবং JSON syntax পরীক্ষা করুন।`;
      empty.append(title, detail);
      grid.appendChild(empty);
      showNotice("সাইটের ফাইলগুলো HTTP server বা GitHub Pages দিয়ে খুলুন; file:// দিয়ে খুললে fetch কাজ নাও করতে পারে।", true);
    }
  }

  init();
})();
