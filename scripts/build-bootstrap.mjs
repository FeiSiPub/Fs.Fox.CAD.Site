import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  REPOSITORY_ROOT,
  readSourceLock,
  treeFromDigest,
} from "./source-lock.mjs";

function gitRevision() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function main() {
  const lock = await readSourceLock();
  const latest = lock.channels.latest;
  const stable = lock.channels.stable;
  const sourcePath = path.join(
    REPOSITORY_ROOT,
    ".cache",
    "source",
    latest.commit,
  );

  await readFile(path.join(sourcePath, "README.md"), "utf8");
  await readFile(path.join(sourcePath, "docs", "README.md"), "utf8");

  const siteCommit = gitRevision();
  const generatedAt = new Date().toISOString();
  const manifest = {
    schema_version: 1,
    source_repository: lock.source_repository,
    source_commit: latest.commit,
    source_tree: treeFromDigest(latest.content_digest),
    channel: "latest",
    stable_tag: stable.tag,
    stable_commit: stable.commit,
    site_commit: siteCommit,
    generated_at: generatedAt,
    generator: "bootstrap-v1",
  };

  const sourceUrl = `https://github.com/${lock.source_repository}`;
  const latestCommitUrl = `${sourceUrl}/commit/${latest.commit}`;
  const docsUrl = `${sourceUrl}/blob/${latest.commit}/docs/README.md`;
  const siteCommitText = siteCommit || "unavailable in this checkout";
  const siteCommitUrl = siteCommit
    ? `https://github.com/FeiSiPub/Fs.Fox.CAD.Site/commit/${siteCommit}`
    : "https://github.com/FeiSiPub/Fs.Fox.CAD.Site";

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fs.Fox.CAD Documentation</title>
  <style>
    :root { color-scheme: light; font-family: Inter, "Segoe UI", sans-serif; color: #202124; background: #f7f8fa; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    header { border-bottom: 1px solid #d9dde3; background: #ffffff; }
    header div, main { width: min(920px, calc(100% - 40px)); margin: 0 auto; }
    header div { min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
    h1 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: 0; }
    .status { color: #17643a; font-size: 14px; font-weight: 600; }
    main { padding: 56px 0 72px; }
    h2 { margin: 0 0 12px; font-size: 28px; line-height: 1.25; letter-spacing: 0; }
    p { margin: 0; color: #59616c; line-height: 1.7; }
    section { padding: 28px 0; border-bottom: 1px solid #d9dde3; }
    dl { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 14px 24px; margin: 20px 0 0; }
    dt { color: #59616c; }
    dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
    code { font-family: "Cascadia Code", Consolas, monospace; font-size: 13px; }
    a { color: #1457a6; text-underline-offset: 3px; }
    .actions { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 22px; }
    @media (max-width: 620px) {
      header div { align-items: flex-start; flex-direction: column; justify-content: center; gap: 4px; padding: 14px 0; }
      main { padding-top: 36px; }
      dl { grid-template-columns: 1fr; gap: 5px; }
      dd { margin-bottom: 10px; }
    }
  </style>
</head>
<body>
  <header><div><h1>Fs.Fox.CAD Documentation</h1><span class="status">Source verified</span></div></header>
  <main>
    <section>
      <h2>站点来源连接已就绪</h2>
      <p>这是展示仓库的启动构建，用于验证精确源码提交、Git tree 与部署链路。最终文档框架尚未选定。</p>
      <div class="actions"><a href="${docsUrl}">查看来源文档索引</a><a href="build-manifest.json">查看构建清单</a></div>
    </section>
    <section>
      <h2>Latest</h2>
      <dl>
        <dt>Repository</dt><dd><a href="${sourceUrl}">${escapeHtml(lock.source_repository)}</a></dd>
        <dt>Source commit</dt><dd><a href="${latestCommitUrl}"><code>${latest.commit}</code></a></dd>
        <dt>Git tree</dt><dd><code>${treeFromDigest(latest.content_digest)}</code></dd>
      </dl>
    </section>
    <section>
      <h2>Stable</h2>
      <dl>
        <dt>Release</dt><dd><code>${escapeHtml(stable.tag)}</code></dd>
        <dt>Source commit</dt><dd><code>${stable.commit}</code></dd>
        <dt>Site commit</dt><dd><a href="${siteCommitUrl}"><code>${escapeHtml(siteCommitText)}</code></a></dd>
        <dt>Generated</dt><dd><code>${generatedAt}</code></dd>
      </dl>
    </section>
  </main>
</body>
</html>
`;

  const distPath = path.join(REPOSITORY_ROOT, "dist");
  if (distPath !== path.resolve(REPOSITORY_ROOT, "dist")) {
    throw new Error("Unexpected dist path.");
  }
  await rm(distPath, { recursive: true, force: true });
  await mkdir(distPath, { recursive: true });
  await writeFile(path.join(distPath, "index.html"), html, "utf8");
  await writeFile(
    path.join(distPath, "build-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  console.log(`Built bootstrap site for source ${latest.commit}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
