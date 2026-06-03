const fs = require("fs");
const path = require("path");

let markedModule;
try {
  markedModule = require("marked");
} catch {
  markedModule = require("C:/Users/mineself/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/marked");
}
const { marked } = markedModule;

const root = process.cwd();
const outRoot = path.join(root, "_html");
const mpeRoot = path.join(
  process.env.USERPROFILE || "",
  ".vscode",
  "extensions",
  "shd101wyy.markdown-preview-enhanced-0.8.20",
  "crossnote",
  "styles"
);
const crossnoteRoot = path.join(process.env.USERPROFILE || "", ".crossnote");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readUtf8(file) {
  return fs.readFileSync(file, "utf8");
}

function writeUtf8(file, text) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, text, "utf8");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function isTopicDir(name) {
  return /^___.*___$/.test(name);
}

function collectTopics() {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((item) => item.isDirectory() && isTopicDir(item.name))
    .map((item) => item.name)
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function walkMarkdown(dirRel, out = []) {
  const dir = path.join(root, dirRel.replace(/\//g, path.sep));
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const itemRel = path.posix.join(dirRel, item.name);
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== "Pic") walkMarkdown(itemRel, out);
    } else if (item.isFile() && item.name.toLowerCase().endsWith(".md")) {
      out.push(itemRel);
    }
  }
  return out;
}

function stripMdExt(rel) {
  return rel.replace(/\.md$/i, "");
}

function isEntryRel(rel) {
  const normalized = rel.replace(/\\/g, "/");
  const dir = path.posix.dirname(normalized);
  const base = path.posix.basename(normalized, ".md");
  const dirBase = path.posix.basename(dir);
  return base.toLowerCase() === dirBase.toLowerCase();
}

function isTopicEntryRel(rel) {
  const normalized = rel.replace(/\\/g, "/");
  const dir = path.posix.dirname(normalized);
  const base = path.posix.basename(normalized, ".md");
  return isTopicDir(dir) && base.toLowerCase() === dir.toLowerCase();
}

function isGeneratedNavigationIndex(markdown, sourceRel) {
  if (isTopicEntryRel(sourceRel)) return false;
  return /^# .+ 笔记索引\s*\n\s*## (主题|目录|笔记)/m.test(markdown);
}

function markdownToHtmlRel(rel) {
  const normalized = rel.replace(/\\/g, "/");
  if (isEntryRel(normalized)) {
    const dir = path.posix.dirname(normalized);
    return path.posix.join(dir === "." ? "" : dir, "index.html");
  }
  return stripMdExt(normalized) + ".html";
}

function splitMarkdownHref(href) {
  const clean = href.replace(/^<|>$/g, "");
  // Only treat "#" after the .md suffix as an anchor. MNote paths may contain
  // literal "#" characters, such as C# or 算法API_C#.
  const mdIndex = clean.toLowerCase().indexOf(".md");
  const hashIndex = mdIndex >= 0 ? clean.indexOf("#", mdIndex + 3) : clean.indexOf("#");
  return {
    base: hashIndex >= 0 ? clean.slice(0, hashIndex) : clean,
    hash: hashIndex >= 0 ? clean.slice(hashIndex) : "",
  };
}

function markdownHrefToHtml(href) {
  const { base, hash } = splitMarkdownHref(href);
  if (!/\.md$/i.test(base) || /^[a-z]+:/i.test(base)) return href;
  return markdownToHtmlRel(base) + hash;
}

function encodeInternalHref(href) {
  const htmlIndex = href.toLowerCase().indexOf(".html");
  const hashIndex = htmlIndex >= 0 ? href.indexOf("#", htmlIndex + 5) : -1;
  const pathPart = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hashPart = hashIndex >= 0 ? href.slice(hashIndex) : "";
  return pathPart
    .split("/")
    .map((part) => encodeURIComponent(decodeURIComponent(part)))
    .join("/") + hashPart;
}

function parseImageAttrs(raw) {
  const attrs = [];
  for (const match of raw.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*'|[^\s]+)/g)) {
    const key = match[1];
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    attrs.push(`${key}="${escapeHtml(value)}"`);
  }
  return attrs.join(" ");
}

function readImageSize(file) {
  if (!fs.existsSync(file)) return null;
  const buffer = fs.readFileSync(file);
  if (buffer.length < 12) return null;

  if (buffer.readUInt32BE(0) === 0x89504e47 && buffer.toString("ascii", 12, 16) === "IHDR") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (buffer.toString("ascii", 0, 3) === "GIF") {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }

  if (buffer.readUInt16BE(0) === 0xffd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }

  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    const type = buffer.toString("ascii", 12, 16);
    if (type === "VP8X" && buffer.length >= 30) {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    }
    if (type === "VP8 " && buffer.length >= 30) {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }
    if (type === "VP8L" && buffer.length >= 25) {
      const bits = buffer.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }

  return null;
}

function classifyImage(size, href) {
  const name = path.basename(href).toLowerCase();
  if (name.includes(".small.")) return "small";
  if (name.includes(".medium.")) return "normal";
  if (name.includes(".large.")) return "large";
  if (name.includes(".full.")) return "full";
  if (!size || !size.width || !size.height) return "normal";

  const ratio = size.width / size.height;
  const inverse = size.height / size.width;
  if (size.width <= 420 && size.height <= 420) return "small";
  if (inverse >= 3.0) return "long";
  if (inverse >= 1.8) return "tall";
  if (ratio >= 1.8) return "wide";
  if (size.width > 1200 || size.height > 900) return "large";
  return "normal";
}

function imageHtml(alt, href, attrs, sourceRel) {
  const cleanHref = href.trim().replace(/^["']|["']$/g, "");
  const sourceAbs = path.join(root, sourceRel.replace(/\//g, path.sep));
  const imageAbs = /^(https?:|data:)/i.test(cleanHref)
    ? null
    : path.resolve(path.dirname(sourceAbs), cleanHref);
  const size = imageAbs ? readImageSize(imageAbs) : null;
  const kind = classifyImage(size, cleanHref);
  const attrText = attrs ? parseImageAttrs(attrs) : "";
  const dimensionAttrs = size ? ` data-width="${size.width}" data-height="${size.height}"` : "";
  return `<img src="${escapeHtml(cleanHref)}" alt="${escapeHtml(alt)}" class="mnote-img mnote-img-${kind}" data-mnote-image="1" data-kind="${kind}"${dimensionAttrs}${attrText ? ` ${attrText}` : ""}>`;
}

function preprocessMarkdown(markdown, sourceRel) {
  return markdown.replace(
    /!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?/g,
    (_all, alt, href, attrs = "") => imageHtml(alt, href, attrs, sourceRel)
  );
}

function makeRenderer() {
  const renderer = new marked.Renderer();
  const originalLink = renderer.link.bind(renderer);

  renderer.link = function link(token) {
    const href = typeof token === "object" ? token.href : arguments[0];
    if (href && /\.md(?:#.*)?$/i.test(href) && !/^[a-z]+:/i.test(href)) {
      const next = markdownHrefToHtml(href);
      if (typeof token === "object") {
        const text = token.tokens && this.parser ? this.parser.parseInline(token.tokens) : escapeHtml(token.text || next);
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
        return `<a href="${escapeHtml(encodeInternalHref(next))}"${title}>${text}</a>`;
      }
      arguments[0] = encodeInternalHref(next);
    }
    return originalLink.apply(renderer, arguments);
  };

  renderer.heading = function heading(token) {
    const text = typeof token === "object" ? token.text : arguments[0];
    const depth = typeof token === "object" ? token.depth : arguments[1];
    const id = String(text)
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .trim()
      .replace(/\s+/g, "-");
    return `<h${depth} id="${escapeHtml(id)}">${text}</h${depth}>\n`;
  };

  return renderer;
}

function loadCss() {
  const parts = [];
  const githubCss = path.join(mpeRoot, "preview_theme", "github-light.css");
  const previewCss = path.join(mpeRoot, "preview.css");
  const customCss = path.join(crossnoteRoot, "style.less");
  if (fs.existsSync(githubCss)) parts.push(readUtf8(githubCss));
  if (fs.existsSync(previewCss)) parts.push(readUtf8(previewCss));
  if (fs.existsSync(customCss)) parts.push(readUtf8(customCss));
  parts.push(`
body {
  margin: 0;
  background: #fff;
}
.preview-container .markdown-preview.crossnote[data-for="preview"],
body > .markdown-preview {
  max-width: 1040px;
  margin: 0 auto;
  padding: 32px 44px 72px;
}
.markdown-preview.markdown-preview img.mnote-img,
.preview-container .markdown-preview.crossnote[data-for="preview"] img.mnote-img {
  box-sizing: border-box;
  cursor: zoom-in;
  display: block !important;
  height: auto !important;
  margin: 14px auto !important;
  object-fit: contain;
  transform: none !important;
  transition: box-shadow 0.16s ease, opacity 0.16s ease !important;
  z-index: auto !important;
}
.markdown-preview.markdown-preview img.mnote-img:hover,
.preview-container .markdown-preview.crossnote[data-for="preview"] img.mnote-img:hover {
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
  opacity: 0.96;
  position: static !important;
  transform: none !important;
}
.markdown-preview.markdown-preview img.mnote-img-small {
  max-width: min(100%, 420px) !important;
  max-height: 420px !important;
}
.markdown-preview.markdown-preview img.mnote-img-normal {
  max-width: min(100%, 760px) !important;
  max-height: 620px !important;
}
.markdown-preview.markdown-preview img.mnote-img-wide {
  max-width: 100% !important;
  max-height: 560px !important;
}
.markdown-preview.markdown-preview img.mnote-img-large,
.markdown-preview.markdown-preview img.mnote-img-full {
  max-width: 100% !important;
  max-height: 720px !important;
}
.markdown-preview.markdown-preview img.mnote-img-tall {
  max-width: min(100%, 680px) !important;
  max-height: 760px !important;
}
.markdown-preview.markdown-preview img.mnote-img-long {
  max-width: min(100%, 720px) !important;
  max-height: 860px !important;
}
.mnote-lightbox {
  align-items: center;
  background: rgba(15, 23, 42, 0.88);
  box-sizing: border-box;
  display: none;
  inset: 0;
  justify-content: center;
  padding: 28px;
  position: fixed;
  z-index: 9999;
}
.mnote-lightbox.is-open {
  display: flex;
}
.mnote-lightbox__stage {
  box-sizing: border-box;
  max-height: calc(100vh - 56px);
  max-width: calc(100vw - 56px);
  overflow: hidden;
  position: relative;
  touch-action: none;
  width: 100%;
  height: calc(100vh - 56px);
}
.mnote-lightbox__stage.is-draggable {
  cursor: grab;
}
.mnote-lightbox__stage.is-dragging {
  cursor: grabbing;
}
.mnote-lightbox__image {
  box-shadow: 0 20px 70px rgba(0, 0, 0, 0.42);
  display: block;
  height: auto;
  left: 50%;
  max-height: none;
  max-width: none;
  object-fit: contain;
  position: absolute;
  top: 50%;
  transform-origin: center center;
  user-select: none;
  will-change: transform;
}
.mnote-lightbox__toolbar {
  align-items: center;
  display: flex;
  gap: 8px;
  position: fixed;
  right: 18px;
  top: 16px;
  z-index: 10000;
}
.mnote-lightbox__button {
  align-items: center;
  background: rgba(255, 255, 255, 0.92);
  border: 0;
  border-radius: 8px;
  color: #111827;
  cursor: pointer;
  display: flex;
  font-size: 15px;
  font-weight: 700;
  height: 40px;
  justify-content: center;
  line-height: 1;
  min-width: 40px;
  padding: 0 12px;
}
.mnote-lightbox__button:hover {
  background: #fff;
}
.mnote-lightbox__button.is-close {
  border-radius: 999px;
  font-size: 24px;
  padding: 0;
  width: 40px;
}
.mnote-topbar {
  border-bottom: 1px solid #e5e7eb;
  color: #667085;
  font-size: 13px;
  margin-bottom: 24px;
  padding-bottom: 10px;
}
.mnote-topbar a {
  color: #0857a5;
}
.mnote-home {
  min-height: 70vh;
}
.mnote-home h1 {
  margin-bottom: 24px;
}
.mnote-category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin-top: 14px;
}
.mnote-category-card {
  border: 1px solid #d8dee4;
  border-radius: 8px;
  padding: 16px 18px;
  background: #fff;
}
.mnote-category-card a {
  color: #0857a5;
  font-size: 1.15em;
  font-weight: 700;
}
.mnote-category-card p {
  color: #667085;
  margin: 8px 0 0;
}
@media (max-width: 720px) {
  .preview-container .markdown-preview.crossnote[data-for="preview"],
  body > .markdown-preview {
    padding: 18px 18px 48px;
  }
  .mnote-lightbox {
    padding: 14px;
  }
  .mnote-lightbox__stage {
    height: calc(100vh - 28px);
    max-height: calc(100vh - 28px);
    max-width: calc(100vw - 28px);
  }
}
`);
  return parts.join("\n\n");
}

function relativeStyleHref(sourceRel) {
  const htmlRel = markdownToHtmlRel(sourceRel);
  const from = path.dirname(htmlRel);
  return toPosix(path.relative(from, "styles/mnote.css")) || "styles/mnote.css";
}

function relativeIndexHref(sourceRel) {
  const htmlRel = markdownToHtmlRel(sourceRel);
  const from = path.dirname(htmlRel);
  return toPosix(path.relative(from, "index.html")) || "index.html";
}

function lightboxHtml() {
  return `  <div class="mnote-lightbox" data-mnote-lightbox aria-hidden="true">
    <div class="mnote-lightbox__toolbar" aria-label="Image controls">
      <button class="mnote-lightbox__button" type="button" data-mnote-lightbox-action="zoomOut" aria-label="Zoom out">-</button>
      <button class="mnote-lightbox__button" type="button" data-mnote-lightbox-action="zoomIn" aria-label="Zoom in">+</button>
      <button class="mnote-lightbox__button" type="button" data-mnote-lightbox-action="actual" aria-label="Actual size">1:1</button>
      <button class="mnote-lightbox__button" type="button" data-mnote-lightbox-action="fit" aria-label="Fit image">Fit</button>
      <button class="mnote-lightbox__button is-close" type="button" data-mnote-lightbox-close aria-label="Close image">×</button>
    </div>
    <div class="mnote-lightbox__stage" data-mnote-lightbox-stage>
      <img class="mnote-lightbox__image" data-mnote-lightbox-image alt="">
    </div>
  </div>
  <script>
(function () {
  var lightbox = document.querySelector("[data-mnote-lightbox]");
  if (!lightbox) return;
  var stage = lightbox.querySelector("[data-mnote-lightbox-stage]");
  var image = lightbox.querySelector("[data-mnote-lightbox-image]");
  var closeButton = lightbox.querySelector("[data-mnote-lightbox-close]");
  var scale = 1;
  var fitScale = 1;
  var panX = 0;
  var panY = 0;
  var drag = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function clampPan() {
    var stageRect = stage.getBoundingClientRect();
    var imageWidth = (image.naturalWidth || 1) * scale;
    var imageHeight = (image.naturalHeight || 1) * scale;
    var maxX = Math.max(0, (imageWidth - stageRect.width) / 2);
    var maxY = Math.max(0, (imageHeight - stageRect.height) / 2);
    panX = maxX ? clamp(panX, -maxX, maxX) : 0;
    panY = maxY ? clamp(panY, -maxY, maxY) : 0;
  }

  function applyTransform() {
    clampPan();
    image.style.transform = "translate(-50%, -50%) translate(" + panX + "px, " + panY + "px) scale(" + scale + ")";
    stage.classList.toggle("is-draggable", scale > fitScale * 1.01);
  }

  function measureFitScale() {
    var stageRect = stage.getBoundingClientRect();
    var safeWidth = Math.max(1, stageRect.width - 24);
    var safeHeight = Math.max(1, stageRect.height - 24);
    var naturalWidth = image.naturalWidth || 1;
    var naturalHeight = image.naturalHeight || 1;
    fitScale = Math.min(safeWidth / naturalWidth, safeHeight / naturalHeight, 1);
    if (!Number.isFinite(fitScale) || fitScale <= 0) fitScale = 1;
  }

  function applyScale(nextScale) {
    scale = clamp(nextScale, fitScale, 20);
    if (scale <= fitScale * 1.02) {
      fit();
      return;
    }
    applyTransform();
  }

  function fit() {
    measureFitScale();
    scale = fitScale;
    panX = 0;
    panY = 0;
    applyTransform();
  }

  function actualSize() {
    measureFitScale();
    applyScale(Math.max(1, fitScale));
  }

  function close() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    image.removeAttribute("src");
    image.alt = "";
    image.removeAttribute("data-kind");
    image.style.width = "";
    image.style.transform = "";
    scale = 1;
    fitScale = 1;
    panX = 0;
    panY = 0;
    drag = null;
    stage.classList.remove("is-draggable", "is-dragging");
    document.documentElement.style.overflow = "";
  }

  function open(source) {
    var kind = source.getAttribute("data-kind") || "normal";
    image.src = source.currentSrc || source.src;
    image.alt = source.alt || "";
    image.setAttribute("data-kind", kind);
    image.style.width = "";
    image.style.transform = "";
    scale = 1;
    fitScale = 1;
    panX = 0;
    panY = 0;
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";
    if (image.complete) requestAnimationFrame(fit);
    else image.onload = function () { requestAnimationFrame(fit); };
  }

  function runAction(action) {
    if (action === "zoomIn") applyScale(scale * 1.4);
    else if (action === "zoomOut") applyScale(scale / 1.4);
    else if (action === "actual") actualSize();
    else if (action === "fit") fit();
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    var actionButton = target && target.closest ? target.closest("[data-mnote-lightbox-action]") : null;
    if (target && target.matches && target.matches("img.mnote-img[data-mnote-image]")) {
      event.preventDefault();
      open(target);
    } else if (actionButton) {
      event.preventDefault();
      runAction(actionButton.getAttribute("data-mnote-lightbox-action"));
    } else if (target === lightbox || target === closeButton) {
      close();
    }
  });

  stage.addEventListener("wheel", function (event) {
    if (!lightbox.classList.contains("is-open")) return;
    event.preventDefault();
    applyScale(scale * (event.deltaY < 0 ? 1.35 : 1 / 1.35));
  }, { passive: false });

  image.addEventListener("dblclick", function (event) {
    event.preventDefault();
    if (scale <= fitScale * 1.01) actualSize();
    else fit();
  });

  stage.addEventListener("mousedown", function (event) {
    if (!stage.classList.contains("is-draggable")) return;
    drag = {
      x: event.clientX,
      y: event.clientY,
      panX: panX,
      panY: panY
    };
    stage.classList.add("is-dragging");
    event.preventDefault();
  });

  document.addEventListener("mousemove", function (event) {
    if (!drag) return;
    panX = drag.panX + (event.clientX - drag.x);
    panY = drag.panY + (event.clientY - drag.y);
    applyTransform();
  });

  document.addEventListener("mouseup", function () {
    drag = null;
    stage.classList.remove("is-dragging");
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && lightbox.classList.contains("is-open")) close();
    if (!lightbox.classList.contains("is-open")) return;
    if (event.key === "+" || event.key === "=") applyScale(scale * 1.4);
    if (event.key === "-") applyScale(scale / 1.4);
    if (event.key === "0") fit();
    if (event.key === "1") actualSize();
  });
})();
  </script>`;
}

function makeHtml(title, sourceRel, bodyHtml) {
  const headHtml = fs.existsSync(path.join(crossnoteRoot, "head.html"))
    ? readUtf8(path.join(crossnoteRoot, "head.html"))
    : "";
  const topbar = isEntryRel(sourceRel)
    ? ""
    : `      <div class="mnote-topbar"><a href="${escapeHtml(relativeIndexHref(sourceRel))}">Index</a> / ${escapeHtml(sourceRel)}</div>\n`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${escapeHtml(relativeStyleHref(sourceRel))}">
${headHtml}
</head>
<body>
  <div class="preview-container">
    <article class="markdown-preview markdown-preview crossnote" data-for="preview">
${topbar}${bodyHtml}
    </article>
  </div>
${lightboxHtml()}
</body>
</html>
`;
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const item of fs.readdirSync(src, { withFileTypes: true })) {
    const srcItem = path.join(src, item.name);
    const destItem = path.join(dest, item.name);
    if (item.isDirectory()) copyDir(srcItem, destItem);
    else fs.copyFileSync(srcItem, destItem);
  }
}

function checkMissingImages(mdAbs, markdown) {
  const missing = [];
  const dir = path.dirname(mdAbs);
  const regex = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(markdown))) {
    let href = match[1].trim().split(/\s+/)[0].replace(/^["']|["']$/g, "");
    if (/^(https?:|data:|#)/i.test(href)) continue;
    if (!fs.existsSync(path.join(dir, href))) {
      const line = markdown.slice(0, match.index).split(/\r?\n/).length;
      missing.push({ line, href });
    }
  }
  return missing;
}

marked.setOptions({
  async: false,
  breaks: true,
  gfm: true,
  mangle: false,
  headerIds: false,
});

const topics = collectTopics();
const targets = topics.flatMap((dir) => walkMarkdown(dir)).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

const resolvedOutRoot = path.resolve(outRoot);
if (
  fs.existsSync(resolvedOutRoot) &&
  path.basename(resolvedOutRoot) === "_html" &&
  resolvedOutRoot.startsWith(path.resolve(root) + path.sep)
) {
  fs.rmSync(resolvedOutRoot, { recursive: true, force: true });
}

ensureDir(path.join(outRoot, "styles"));
writeUtf8(path.join(outRoot, "styles", "mnote.css"), loadCss());

const results = [];
const missingImages = [];

for (const source of targets) {
  const mdAbs = path.join(root, source.replace(/\//g, path.sep));
  const markdown = readUtf8(mdAbs);
  const body = marked.parse(preprocessMarkdown(markdown, source), { renderer: makeRenderer() });
  const htmlRel = markdownToHtmlRel(source);
  const htmlAbs = path.join(outRoot, htmlRel.replace(/\//g, path.sep));
  writeUtf8(htmlAbs, makeHtml(path.basename(source, ".md"), source, body));
  copyDir(path.join(path.dirname(mdAbs), "Pic"), path.join(path.dirname(htmlAbs), "Pic"));
  for (const item of checkMissingImages(mdAbs, markdown)) missingImages.push({ file: source, ...item });
  results.push({ source, output: htmlRel, navigationIndex: isGeneratedNavigationIndex(markdown, source) });
}

const cards = topics
  .map((topic) => {
    const href = markdownToHtmlRel(path.posix.join(topic, `${topic}.md`));
    const count = results.filter((item) => item.source.startsWith(`${topic}/`) && !item.navigationIndex && !isTopicEntryRel(item.source)).length;
    return `<section class="mnote-category-card"><a href="${escapeHtml(href)}">${escapeHtml(topic)}</a><p>${count} 篇笔记</p></section>`;
  })
  .join("\n");

writeUtf8(
  path.join(outRoot, "index.html"),
  `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MNote</title>
  <link rel="stylesheet" href="styles/mnote.css">
</head>
<body>
  <main class="markdown-preview markdown-preview mnote-home">
    <h1>MNote</h1>
    <div class="mnote-category-grid">
${cards}
    </div>
  </main>
</body>
</html>
`
);

writeUtf8(
  path.join(outRoot, "export-report.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      output: outRoot,
      topics,
      results,
      missingImages,
    },
    null,
    2
  )
);

console.log(`Exported ${results.length} markdown files to ${outRoot}`);
console.log(`Missing images: ${missingImages.length}`);
for (const item of missingImages) console.log(`- ${item.file}:${item.line} -> ${item.href}`);
