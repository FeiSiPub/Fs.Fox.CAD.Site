import assert from "node:assert/strict";
import test from "node:test";
import {
  routeToMarkdownPath,
  validatePreparedManifest,
} from "../scripts/prepared-content.mjs";

function validManifest() {
  return {
    schema_version: 1,
    adapter: "placeholder-v1",
    channel: "latest",
    source_repository: "FsDiG/Fs.Fox.CAD",
    source_commit: "a".repeat(40),
    source_tree: "b".repeat(40),
    sections: [
      { id: "guides", title: "使用指南", route: "/guides/", order: 10 },
    ],
    pages: [
      {
        id: "entry.product",
        title: "Fs.Fox.CAD 文档",
        route: "/",
        section: null,
        order: 0,
        markdown_path: "index.md",
      },
      {
        id: "guide.start",
        title: "开始使用",
        route: "/guides/start/",
        section: "guides",
        order: 10,
        markdown_path: "guides/start/index.md",
      },
    ],
  };
}

const expectedSource = {
  channel: "latest",
  source_repository: "FsDiG/Fs.Fox.CAD",
  source_commit: "a".repeat(40),
  source_tree: "b".repeat(40),
};

test("public routes map to stable Markdown paths", () => {
  assert.equal(routeToMarkdownPath("/"), "index.md");
  assert.equal(
    routeToMarkdownPath("/maintainers/architecture/"),
    "maintainers/architecture/index.md",
  );
});

test("unsafe or unstable routes are rejected", () => {
  for (const route of [
    "guides/",
    "/guides",
    "/../guides/",
    "/Guides/",
    "/guides?q=1/",
  ]) {
    assert.throws(() => routeToMarkdownPath(route), /Invalid public route/);
  }
});

test("prepared manifest accepts unique pages and known sections", () => {
  assert.equal(
    validatePreparedManifest(validManifest(), expectedSource).pages.length,
    2,
  );
});

test("prepared manifest rejects duplicate routes", () => {
  const manifest = validManifest();
  manifest.pages[1].route = "/";
  manifest.pages[1].markdown_path = "index.md";
  assert.throws(
    () => validatePreparedManifest(manifest, expectedSource),
    /Duplicate prepared page route/,
  );
});

test("prepared manifest rejects unknown sections", () => {
  const manifest = validManifest();
  manifest.pages[1].section = "missing";
  assert.throws(
    () => validatePreparedManifest(manifest, expectedSource),
    /unknown section/,
  );
});

test("prepared manifest rejects a mismatched source tree", () => {
  const manifest = validManifest();
  manifest.source_tree = "c".repeat(40);
  assert.throws(
    () => validatePreparedManifest(manifest, expectedSource),
    /tree does not match/,
  );
});
