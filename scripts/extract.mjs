#!/usr/bin/env node
// Turn a git repo's history into a garden file for Mossgit.
// Usage: node scripts/extract.mjs <path-to-repo> [out.json] [--name display-name]
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const args = process.argv.slice(2);
const nameFlag = args.indexOf("--name");
let display = null;
if (nameFlag !== -1) { display = args[nameFlag + 1]; args.splice(nameFlag, 2); }
const repo = resolve(args[0] || ".");
const out = args[1] || `${basename(repo)}.json`;
const MAX_FILES = 700;

const raw = execFileSync("git", [
  "-C", repo, "log", "--reverse", "--no-renames", "--raw", "--numstat",
  "--format=%x1e%H%x1f%at%x1f%an%x1f%ae%x1f%ai%x1f%s",
], { maxBuffer: 1 << 28 }).toString("utf8");

// Group author aliases: same email, or same name once case, punctuation and trailing digits are dropped.
const parent = new Map();
const find = (k) => { while (parent.get(k) !== k) k = parent.get(k); return k; };
const union = (a, b) => { for (const k of [a, b]) if (!parent.has(k)) parent.set(k, k); parent.set(find(a), find(b)); };
const nameKey = (n) => "n:" + n.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/\d+$/, "");
const emailKey = (e) => "e:" + e.toLowerCase().replace(/^\d+\+/, "");

const commits = [];
for (const block of raw.split("\x1e").slice(1)) {
  const [head, ...lines] = block.split("\n");
  const [hash, at, an, ae, ai, subject] = head.split("\x1f");
  const tz = ai.match(/([+-])(\d\d)(\d\d)$/);
  const offset = tz ? (tz[1] === "-" ? -1 : 1) * (+tz[2] * 60 + +tz[3]) : 0;
  union(nameKey(an), emailKey(ae));
  const status = new Map(), stats = [];
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith(":")) {
      const [meta, path] = line.split("\t");
      status.set(path, meta.split(" ").pop()[0]);
    } else {
      const [a, d, path] = line.split("\t");
      stats.push({ path, a: a === "-" ? null : +a, d: d === "-" ? null : +d });
    }
  }
  commits.push({ hash, at: +at, offset, an, ae, subject, stats, status });
}

const authors = [], authorIndex = new Map(), nameCount = new Map();
for (const c of commits) {
  const root = find(nameKey(c.an));
  if (!nameCount.has(root)) nameCount.set(root, new Map());
  const m = nameCount.get(root); m.set(c.an, (m.get(c.an) || 0) + 1);
}
for (const c of commits) {
  const root = find(nameKey(c.an));
  if (!authorIndex.has(root)) {
    const best = [...nameCount.get(root)].sort((x, y) => y[1] - x[1])[0][0];
    authorIndex.set(root, authors.length);
    authors.push({ name: best, bot: /\[bot\]$|^github-actions/i.test(best), commits: 0 });
  }
  c.author = authorIndex.get(root);
  authors[c.author].commits++;
}

const files = [], fileIndex = new Map();
const outCommits = commits.map((c) => {
  const changes = [];
  for (const s of c.stats) {
    if (!fileIndex.has(s.path)) {
      if (files.length >= MAX_FILES) continue;
      fileIndex.set(s.path, files.length); files.push(s.path);
    }
    const st = c.status.get(s.path) || "M";
    // [file, linesAdded, linesDeleted, kind]  kind: a=added m=modified d=deleted b=binary
    const kind = st === "D" ? "d" : st === "A" ? "a" : "m";
    changes.push([fileIndex.get(s.path), s.a ?? 0, s.d ?? 0, s.a === null ? kind + "b" : kind]);
  }
  // o = the committer's UTC offset in minutes, so the garden knows the local hour
  return { h: c.hash.slice(0, 7), t: c.at, o: c.offset, a: c.author, m: c.subject.slice(0, 90), c: changes };
});

writeFileSync(out, JSON.stringify({
  name: display || basename(repo), authors, files, commits: outCommits,
}));
console.log(`${out}: ${outCommits.length} commits, ${files.length} files, ${authors.length} gardeners`);
