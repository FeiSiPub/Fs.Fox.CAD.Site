import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitepress";
import { validatePreparedManifest } from "../scripts/prepared-content.mjs";
import { treeFromDigest } from "../scripts/source-lock.mjs";
import { tokenizeSearchText } from "./search-tokenizer.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceLock = JSON.parse(
  readFileSync(path.join(repositoryRoot, "config", "content-source.json"), "utf8"),
);
const sourceCommit = sourceLock.channels.latest.commit;
const contentRoot = path.join(
  repositoryRoot,
  ".cache",
  "content",
  sourceCommit,
);
const contentManifest = JSON.parse(
  readFileSync(path.join(contentRoot, "content-manifest.json"), "utf8"),
);
// Reject stale or mixed-source content before deriving navigation and search data.
validatePreparedManifest(contentManifest, {
  channel: "latest",
  source_repository: sourceLock.source_repository,
  source_commit: sourceCommit,
  source_tree: treeFromDigest(sourceLock.channels.latest.content_digest),
});

const sections = [...contentManifest.sections].sort(
  (left, right) => left.order - right.order,
);
const pages = [...contentManifest.pages].sort(
  (left, right) => left.order - right.order,
);
const nav = sections.map((section) => ({
  text: section.title,
  link: section.route,
}));
const sidebar = Object.fromEntries(
  sections.map((section) => [
    section.route,
    [
      {
        text: section.title,
        items: pages
          .filter((page) => page.section === section.id)
          .map((page) => ({ text: page.title, link: page.route })),
      },
    ],
  ]),
);

export default defineConfig({
  lang: "zh-CN",
  title: "Fs.Fox.CAD",
  description: "Fs.Fox.CAD CAD 通用基础类库开发文档",
  srcDir: path.relative(repositoryRoot, contentRoot),
  outDir: "dist",
  cacheDir: ".cache/vitepress",
  cleanUrls: true,
  lastUpdated: false,
  markdown: {
    cjkFriendlyEmphasis: true,
  },
  head: [
    ["meta", { name: "theme-color", content: "#17664b" }],
    ["meta", { name: "color-scheme", content: "light dark" }],
  ],
  themeConfig: {
    nav,
    sidebar,
    darkModeSwitchLabel: "外观",
    lightModeSwitchTitle: "切换到浅色主题",
    darkModeSwitchTitle: "切换到深色主题",
    sidebarMenuLabel: "文档导航",
    returnToTopLabel: "返回顶部",
    langMenuLabel: "切换语言",
    skipToContentLabel: "跳到正文",
    outline: {
      level: [2, 3],
      label: "本页内容",
    },
    search: {
      provider: "local",
      options: {
        miniSearch: {
          options: {
            tokenize: tokenizeSearchText,
          },
          searchOptions: {
            combineWith: "AND",
            prefix: true,
          },
        },
        translations: {
          button: {
            buttonText: "搜索文档",
            buttonAriaLabel: "搜索文档",
          },
          modal: {
            displayDetails: "显示详细结果",
            resetButtonTitle: "清除搜索",
            backButtonTitle: "关闭搜索",
            noResultsText: "没有找到相关内容",
            footer: {
              selectText: "选择",
              navigateText: "切换",
              closeText: "关闭",
            },
          },
        },
      },
    },
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/FsDiG/Fs.Fox.CAD",
        ariaLabel: "Fs.Fox.CAD GitHub 仓库",
      },
    ],
    footer: {
      message: "产品内容来源于 FsDiG/Fs.Fox.CAD 的确定提交",
      copyright: "MIT License",
    },
  },
});
