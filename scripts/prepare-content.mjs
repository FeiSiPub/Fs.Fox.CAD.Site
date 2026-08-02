import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  REPOSITORY_ROOT,
  contentRootForCommit,
  parseChannel,
  routeToMarkdownPath,
  validatePreparedManifest,
} from "./prepared-content.mjs";
import { readSourceLock, treeFromDigest } from "./source-lock.mjs";

function sourceCommitUrl(repository, commit) {
  return `https://github.com/${repository}/tree/${commit}`;
}

function sourceFileUrl(repository, commit, sourcePath) {
  return `https://github.com/${repository}/blob/${commit}/${sourcePath}`;
}

function placeholderPublication(source) {
  const sourceUrl = sourceCommitUrl(source.repository, source.commit);
  const docsIndexUrl = sourceFileUrl(
    source.repository,
    source.commit,
    "docs/README.md",
  );
  const shortCommit = source.commit.slice(0, 12);
  const sourceTable = [
    "| 项目 | 值 |",
    "| --- | --- |",
    `| 通道 | \`${source.channel}\` |`,
    `| 源提交 | [\`${shortCommit}\`](${sourceUrl}) |`,
    `| Git tree | \`${source.tree}\` |`,
  ].join("\n");

  const sections = [
    { id: "guides", title: "使用指南", route: "/guides/", order: 10 },
    { id: "reference", title: "参考资料", route: "/reference/", order: 20 },
    {
      id: "maintainers",
      title: "维护者文档",
      route: "/maintainers/",
      order: 30,
    },
  ];

  const pages = [
    {
      id: "entry.product",
      title: "Fs.Fox.CAD 文档",
      route: "/",
      section: null,
      order: 0,
      markdown: `---
title: Fs.Fox.CAD 文档
description: Fs.Fox.CAD 文档站点构建入口
outline: [2, 3]
---

# Fs.Fox.CAD 文档

::: note 当前状态
VitePress 2 构建、精确来源锁和 EdgeOne 兼容的静态输出链路已经接通。产品 Markdown 发布契约尚未加入源仓库，因此当前页面只展示构建期占位内容；EdgeOne 云端连接仍由仓库所有者完成。
:::

## 文档区域

- [使用指南](/guides/)：后续承载入门与任务型文档。
- [参考资料](/reference/)：后续承载兼容性、包和配置参考。
- [维护者文档](/maintainers/)：后续承载架构、契约与贡献说明。

## 构建来源

${sourceTable}

源仓库当前的人工文档入口仍是 [docs/README.md](${docsIndexUrl})。本站不会在展示仓库维护第二份产品正文。
`,
    },
    {
      id: "placeholder.guides",
      title: "使用指南",
      route: "/guides/",
      section: "guides",
      order: 10,
      markdown: `---
title: 使用指南
description: Fs.Fox.CAD 使用指南占位入口
---

# 使用指南

本区域已经进入 VitePress 导航和本地搜索，但尚未复制或改写源仓库中的产品指南。

## 接入门槛

- [x] 锁定并校验精确 source commit
- [x] 在构建目录生成 Markdown
- [x] 通过 VitePress 2 输出静态页面
- [ ] 由源仓库提供 \`docs/publication.yml\`
- [ ] 校验页面元数据、链接和资源

[查看锁定的源提交](${sourceUrl})
`,
    },
    {
      id: "placeholder.reference",
      title: "参考资料",
      route: "/reference/",
      section: "reference",
      order: 20,
      markdown: `---
title: 参考资料
description: Fs.Fox.CAD 参考资料占位入口
---

# 参考资料

兼容性、包、配置和后续 API 页面将由源仓库的确定提交生成。本占位页只验证路由、导航、中文搜索和静态部署结构。

::: important 来源边界
ObjectARX/ZRX 程序集和 XML API 数据必须在 Fs.Fox.CAD 的 Windows/CAD SDK CI 中生成；EdgeOne 只负责渲染确定的数据包。
:::

${sourceTable}
`,
    },
    {
      id: "placeholder.maintainers",
      title: "维护者文档",
      route: "/maintainers/",
      section: "maintainers",
      order: 30,
      markdown: `---
title: 维护者文档
description: Fs.Fox.CAD 维护者文档占位入口
---

# 维护者文档

架构、代码契约和贡献说明仍以源仓库为事实源。后续适配器会根据稳定文档 ID 组织导航，文件移动不会直接改变公开 URL。

## 当前验证对象

1. 页面来自与来源锁一致的提交。
2. 生成 Markdown 和 VitePress 缓存不会进入 Git。
3. 构建清单同时记录 source commit 与 site commit。

[查看源仓库文档索引](${docsIndexUrl})
`,
    },
  ];

  return { sections, pages };
}

function assertContentRoot(cacheRoot, contentRoot) {
  const relative = path.relative(cacheRoot, contentRoot);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Resolved content path is outside .cache/content.");
  }
}

async function main() {
  const channelName = parseChannel(process.argv.slice(2));
  const lock = await readSourceLock();
  const channel = lock.channels[channelName];
  const sourceRoot = path.join(
    REPOSITORY_ROOT,
    ".cache",
    "source",
    channel.commit,
  );

  await access(path.join(sourceRoot, ".git"));
  await readFile(path.join(sourceRoot, "README.md"), "utf8");
  await readFile(path.join(sourceRoot, "docs", "README.md"), "utf8");

  const contentCacheRoot = path.join(REPOSITORY_ROOT, ".cache", "content");
  const contentRoot = contentRootForCommit(channel.commit);
  assertContentRoot(contentCacheRoot, contentRoot);
  await rm(contentRoot, { recursive: true, force: true });
  await mkdir(contentRoot, { recursive: true });

  const source = {
    repository: lock.source_repository,
    channel: channelName,
    commit: channel.commit,
    tree: treeFromDigest(channel.content_digest),
  };
  const publication = placeholderPublication(source);
  const pages = publication.pages.map(({ markdown, ...page }) => ({
    ...page,
    markdown_path: routeToMarkdownPath(page.route),
    source_path: null,
  }));
  const manifest = {
    schema_version: 1,
    adapter: "placeholder-v1",
    channel: channelName,
    source_repository: source.repository,
    source_commit: source.commit,
    source_tree: source.tree,
    sections: publication.sections,
    pages,
  };
  validatePreparedManifest(manifest, {
    channel: channelName,
    source_repository: source.repository,
    source_commit: source.commit,
    source_tree: source.tree,
  });

  for (const page of publication.pages) {
    const markdownPath = path.join(contentRoot, routeToMarkdownPath(page.route));
    await mkdir(path.dirname(markdownPath), { recursive: true });
    await writeFile(markdownPath, page.markdown, "utf8");
  }
  await writeFile(
    path.join(contentRoot, "content-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `Prepared ${pages.length} placeholder pages for ${channelName} source ${channel.commit}.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
