import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSourceLock, treeFromDigest } from "./source-lock.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
export const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");

export function parseChannel(args) {
  const index = args.indexOf("--channel");
  const channel = index >= 0 ? args[index + 1] : "latest";
  if (channel !== "latest" && channel !== "stable") {
    throw new Error("--channel must be latest or stable.");
  }
  return channel;
}

export function contentRootForCommit(commit) {
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error("Content root requires a full 40-character commit.");
  }
  return path.join(REPOSITORY_ROOT, ".cache", "content", commit);
}

export function routeToMarkdownPath(route) {
  if (
    typeof route !== "string" ||
    !/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/.test(route)
  ) {
    throw new Error(`Invalid public route: ${route}`);
  }
  if (route === "/") {
    return "index.md";
  }
  return `${route.slice(1)}index.md`;
}

export function validatePreparedManifest(manifest, expected) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Prepared content manifest must be an object.");
  }
  if (manifest.schema_version !== 1) {
    throw new Error("Prepared content manifest schema_version must be 1.");
  }
  if (manifest.channel !== expected.channel) {
    throw new Error("Prepared content channel does not match the build channel.");
  }
  if (manifest.source_repository !== expected.source_repository) {
    throw new Error("Prepared content repository does not match the source lock.");
  }
  if (manifest.source_commit !== expected.source_commit) {
    throw new Error("Prepared content commit does not match the source lock.");
  }
  if (manifest.source_tree !== expected.source_tree) {
    throw new Error("Prepared content tree does not match the source lock.");
  }
  if (!Array.isArray(manifest.sections) || !Array.isArray(manifest.pages)) {
    throw new Error("Prepared content manifest requires sections and pages arrays.");
  }

  const sectionIds = new Set();
  for (const section of manifest.sections) {
    if (!section?.id || !section?.title || !section?.route) {
      throw new Error("Each prepared section requires id, title, and route.");
    }
    if (sectionIds.has(section.id)) {
      throw new Error(`Duplicate prepared section id: ${section.id}`);
    }
    routeToMarkdownPath(section.route);
    sectionIds.add(section.id);
  }

  const pageIds = new Set();
  const routes = new Set();
  for (const page of manifest.pages) {
    if (!page?.id || !page?.title || !page?.route || !page?.markdown_path) {
      throw new Error(
        "Each prepared page requires id, title, route, and markdown_path.",
      );
    }
    if (pageIds.has(page.id)) {
      throw new Error(`Duplicate prepared page id: ${page.id}`);
    }
    if (routes.has(page.route)) {
      throw new Error(`Duplicate prepared page route: ${page.route}`);
    }
    if (page.markdown_path !== routeToMarkdownPath(page.route)) {
      throw new Error(`Prepared page path does not match route: ${page.id}`);
    }
    if (page.section !== null && !sectionIds.has(page.section)) {
      throw new Error(`Prepared page references an unknown section: ${page.id}`);
    }
    pageIds.add(page.id);
    routes.add(page.route);
  }

  return manifest;
}

export async function readPreparedManifest(channelName = "latest") {
  const lock = await readSourceLock();
  const channel = lock.channels[channelName];
  if (!channel) {
    throw new Error(`Unknown source channel: ${channelName}`);
  }
  const contentRoot = contentRootForCommit(channel.commit);
  const manifestPath = path.join(contentRoot, "content-manifest.json");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(
        `Prepared content is missing for ${channel.commit}. Run npm run content:prepare first.`,
      );
    }
    throw error;
  }

  validatePreparedManifest(manifest, {
    channel: channelName,
    source_repository: lock.source_repository,
    source_commit: channel.commit,
    source_tree: treeFromDigest(channel.content_digest),
  });
  return { contentRoot, lock, manifest };
}
