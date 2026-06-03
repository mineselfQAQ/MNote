const fs = require("fs");
const path = require("path");

const root = process.cwd();
const imageExts = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

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

function isTopicDir(name) {
  return /^___.*___$/.test(name);
}

function isIgnoredDir(name) {
  return name === ".git" || name === "_html" || name === "_html_test" || name === "_tools";
}

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (!isIgnoredDir(item.name)) walk(path.join(dir, item.name), predicate, out);
    } else {
      const full = path.join(dir, item.name);
      if (!predicate || predicate(full, item)) out.push(full);
    }
  }
  return out;
}

function rel(file) {
  return toPosix(path.relative(root, file));
}

function withoutExt(file) {
  return path.basename(file, path.extname(file));
}

function entryFileForDir(dir) {
  return path.join(dir, `${path.basename(dir)}.md`);
}

function isEntryFile(file) {
  return path.extname(file).toLowerCase() === ".md" && withoutExt(file) === path.basename(path.dirname(file));
}

function isCategoryEntry(file, topicDir) {
  return path.dirname(file) === topicDir && withoutExt(file) === path.basename(topicDir);
}

function parseHref(raw) {
  const trimmed = raw.trim();
  // Only treat "#" after the .md suffix as an anchor. MNote paths may contain
  // literal "#" characters, such as C# or 算法API_C#.
  const mdIndex = trimmed.toLowerCase().indexOf(".md");
  const hashIndex = mdIndex >= 0 ? trimmed.indexOf("#", mdIndex + 3) : trimmed.indexOf("#");
  return {
    base: hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed,
    hash: hashIndex >= 0 ? trimmed.slice(hashIndex) : "",
  };
}

function splitAttrs(raw) {
  const trimmed = raw.trim();
  const match = trimmed.match(/^([^ \t]+)(.*)$/s);
  return match ? { href: match[1].replace(/^["']|["']$/g, ""), suffix: match[2] || "" } : { href: trimmed, suffix: "" };
}

function isExternal(href) {
  return /^(https?:|mailto:|data:|#)/i.test(href) || /^[a-zA-Z]:/.test(href);
}

function resolveOldLink(oldSourceAbs, href) {
  const clean = href.trim().replace(/^<|>$/g, "");
  if (!clean || isExternal(clean)) return null;
  const { base } = parseHref(clean);
  if (!base) return null;
  return path.resolve(path.dirname(oldSourceAbs), base);
}

function relativeMarkdownLink(fromFile, targetFile, hash = "") {
  const fromDir = path.dirname(fromFile);
  let next = toPosix(path.relative(fromDir, targetFile));
  if (!next.startsWith(".")) next = `./${next}`;
  return next + hash;
}

function escapeMarkdownLabel(value) {
  return String(value).replace(/([\\`*_[\]{}()#+\-.!|>])/g, "\\$1");
}

function copyImageForNote(oldSourceAbs, newSourceAbs, href) {
  const { href: cleanHref } = splitAttrs(href);
  if (!cleanHref || isExternal(cleanHref)) return href;
  const imageAbs = path.resolve(path.dirname(oldSourceAbs), cleanHref);
  if (!fs.existsSync(imageAbs) || !imageExts.has(path.extname(imageAbs).toLowerCase())) return href;

  const picDir = path.join(path.dirname(newSourceAbs), "Pic");
  ensureDir(picDir);
  const dest = path.join(picDir, path.basename(imageAbs));
  if (path.resolve(imageAbs) !== path.resolve(dest)) {
    fs.copyFileSync(imageAbs, dest);
  }
  return `Pic/${path.basename(imageAbs)}`;
}

function rewriteContent(content, oldSourceAbs, newSourceAbs, moveMap) {
  let next = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (all, alt, rawHref) => {
    const { href, suffix } = splitAttrs(rawHref);
    const newHref = copyImageForNote(oldSourceAbs, newSourceAbs, href);
    return `![${alt}](${newHref}${suffix})`;
  });

  next = next.replace(/(?<!!)\[([^\]]+)\]\((<[^>]+>|[^)\s]+)([^)]*)\)/g, (all, label, rawHref, suffix) => {
    const href = rawHref.trim().replace(/^<|>$/g, "");
    if (!href || isExternal(href)) return all;
    const { base, hash } = parseHref(href);
    if (!base || path.extname(base).toLowerCase() !== ".md") return all;
    const oldTarget = path.resolve(path.dirname(oldSourceAbs), base);
    const mapped = moveMap.get(oldTarget);
    if (!mapped) return all;
    const newHref = relativeMarkdownLink(newSourceAbs, mapped, hash);
    const wrapped = /[()\s]/.test(newHref) ? `<${newHref}>` : newHref;
    return `[${label}](${wrapped}${suffix || ""})`;
  });

  return next;
}

function collectTopics() {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((item) => item.isDirectory() && isTopicDir(item.name))
    .map((item) => path.join(root, item.name));
}

function planMoves(topicDirs) {
  const moveMap = new Map();
  for (const topicDir of topicDirs) {
    for (const file of walk(topicDir, (full) => path.extname(full).toLowerCase() === ".md")) {
      if (isCategoryEntry(file, topicDir) || isEntryFile(file)) {
        moveMap.set(path.resolve(file), path.resolve(file));
        continue;
      }
      const base = withoutExt(file);
      const dest = path.join(path.dirname(file), base, `${base}.md`);
      moveMap.set(path.resolve(file), path.resolve(dest));
    }
  }
  return moveMap;
}

function applyMoves(moveMap) {
  for (const [oldAbs, newAbs] of moveMap.entries()) {
    if (oldAbs === newAbs) continue;
    if (!fs.existsSync(oldAbs)) continue;
    if (fs.existsSync(newAbs)) continue;
    ensureDir(path.dirname(newAbs));
    fs.renameSync(oldAbs, newAbs);
  }
}

function rewriteMovedMarkdown(moveMap) {
  for (const [oldAbs, newAbs] of moveMap.entries()) {
    if (!fs.existsSync(newAbs)) continue;
    const text = readUtf8(newAbs);
    writeUtf8(newAbs, rewriteContent(text, oldAbs, newAbs, moveMap));
  }
}

function hasEntry(dir) {
  return fs.existsSync(entryFileForDir(dir));
}

function listVisibleChildren(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((item) => item.isDirectory() && item.name !== "Pic" && !isIgnoredDir(item.name))
    .map((item) => path.join(dir, item.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), "zh-Hans-CN"));
}

function childLinkLine(dir, child) {
  const childEntry = entryFileForDir(child);
  const href = toPosix(path.relative(dir, childEntry));
  const wrapped = /[()\s#]/.test(href) ? `<${href}>` : href;
  return `- [${escapeMarkdownLabel(path.basename(child))}](${wrapped})`;
}

function isGeneratedIndexFile(file) {
  if (!fs.existsSync(file)) return false;
  return /^# .+ 笔记索引\s*\n/m.test(readUtf8(file));
}

function generatedIndexText(dir, children) {
  const title = path.basename(dir);
  const directories = [];
  const notes = [];
  for (const child of children) {
    const childEntry = entryFileForDir(child);
    if (isGeneratedIndexFile(childEntry)) directories.push(child);
    else notes.push(child);
  }
  const lines = [`# ${title} 笔记索引`, ""];
  if (directories.length) {
    lines.push("## 目录", "");
    for (const child of directories) lines.push(childLinkLine(dir, child));
    lines.push("");
  }
  if (notes.length) {
    lines.push("## 笔记", "");
    for (const child of notes) lines.push(childLinkLine(dir, child));
    lines.push("");
  }
  if (!directories.length && !notes.length) lines.push("## 目录", "");
  lines.push("");
  return lines.join("\n");
}

function isGeneratedIndex(current, dir, category) {
  const trimmed = current.trim();
  return (
    /^# .*(笔记索引)?\s*\n\s*## 主题/m.test(current) ||
    /^# .*(笔记索引)?\s*\n\s*## 目录/m.test(current) ||
    trimmed === `# ${path.basename(dir)}` ||
    trimmed === `# ${category}`
  );
}

function createIndexes(topicDirs) {
  for (const topicDir of topicDirs) {
    const category = path.basename(topicDir);
    const categoryEntry = path.join(topicDir, `${category}.md`);
    if (!fs.existsSync(categoryEntry)) {
      writeUtf8(categoryEntry, `# ${category}\n\n## 主题\n\n`);
    }

    const dirs = [topicDir];
    for (const child of fs.readdirSync(topicDir, { withFileTypes: true })) {
      const childAbs = path.join(topicDir, child.name);
      if (child.isDirectory() && child.name !== "Pic") {
        dirs.push(...walkDirs(childAbs));
      }
    }

    for (const dir of dirs) {
      const children = listVisibleChildren(dir);
      if (!children.length) continue;
      const entry = entryFileForDir(dir);
      if (!fs.existsSync(entry)) {
        writeUtf8(entry, generatedIndexText(dir, []));
      }
    }

    for (const dir of dirs) {
      const children = listVisibleChildren(dir).filter((child) => hasEntry(child));
      if (!children.length) continue;
      const entry = entryFileForDir(dir);
      if (!fs.existsSync(entry)) continue;
      const current = readUtf8(entry);
      if (isGeneratedIndex(current, dir, category)) {
        writeUtf8(entry, generatedIndexText(dir, children));
      }
    }
  }
}

function walkDirs(dir, out = []) {
  out.push(dir);
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory() && item.name !== "Pic" && !isIgnoredDir(item.name)) {
      walkDirs(path.join(dir, item.name), out);
    }
  }
  return out;
}

function removeEmptyPicDirs(topicDirs) {
  const dirs = [];
  for (const topicDir of topicDirs) {
    for (const item of walkDirs(topicDir)) {
      const pic = path.join(item, "Pic");
      if (fs.existsSync(pic) && fs.readdirSync(pic).length === 0) dirs.push(pic);
    }
  }
  for (const dir of dirs.reverse()) fs.rmSync(dir, { recursive: true, force: true });
}

function collectImageReferences(topicDirs) {
  const refs = new Set();
  for (const topicDir of topicDirs) {
    for (const md of walk(topicDir, (full) => path.extname(full).toLowerCase() === ".md")) {
      const dir = path.dirname(md);
      const text = readUtf8(md);
      for (const match of text.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)) {
        const href = match[1].trim().split(/\s+/)[0].replace(/^["']|["']$/g, "");
        if (!href || isExternal(href)) continue;
        refs.add(path.resolve(dir, href));
      }
    }
  }
  return refs;
}

function cleanupDuplicateUnusedImages(topicDirs) {
  const refs = collectImageReferences(topicDirs);
  const images = [];
  for (const topicDir of topicDirs) {
    for (const img of walk(topicDir, (full) => imageExts.has(path.extname(full).toLowerCase()))) {
      images.push(path.resolve(img));
    }
  }

  const bySignature = new Map();
  for (const img of images) {
    const stat = fs.statSync(img);
    const key = `${path.basename(img).toLowerCase()}|${stat.size}`;
    if (!bySignature.has(key)) bySignature.set(key, []);
    bySignature.get(key).push(img);
  }

  for (const img of images) {
    if (refs.has(img)) continue;
    const stat = fs.statSync(img);
    const key = `${path.basename(img).toLowerCase()}|${stat.size}`;
    const duplicates = bySignature.get(key) || [];
    const hasReferencedCopy = duplicates.some((candidate) => refs.has(candidate));
    if (hasReferencedCopy) fs.rmSync(img, { force: true });
  }
}

const topicDirs = collectTopics();
const moveMap = planMoves(topicDirs);
applyMoves(moveMap);
rewriteMovedMarkdown(moveMap);
createIndexes(topicDirs);
cleanupDuplicateUnusedImages(topicDirs);
removeEmptyPicDirs(topicDirs);

console.log(`Migrated topics: ${topicDirs.length}`);
console.log(`Markdown files tracked: ${moveMap.size}`);
