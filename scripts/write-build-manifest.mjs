import { access, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  REPOSITORY_ROOT,
  parseChannel,
  readPreparedManifest,
} from "./prepared-content.mjs";
import { treeFromDigest } from "./source-lock.mjs";

function gitRevision() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

async function outputMetrics(root) {
  let bytes = 0;
  let files = 0;

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(target);
      } else if (entry.isFile()) {
        files += 1;
        bytes += (await stat(target)).size;
      }
    }
  }

  await visit(root);
  return { files, bytes };
}

async function main() {
  const channelName = parseChannel(process.argv.slice(2));
  const { lock, manifest: content } = await readPreparedManifest(channelName);
  const channel = lock.channels[channelName];
  const distPath = path.join(REPOSITORY_ROOT, "dist");
  await access(path.join(distPath, "index.html"));

  const metrics = await outputMetrics(distPath);
  const siteCommit = gitRevision();
  const packageManifest = JSON.parse(
    await readFile(path.join(REPOSITORY_ROOT, "package.json"), "utf8"),
  );
  const buildManifest = {
    schema_version: 1,
    source_repository: lock.source_repository,
    source_commit: channel.commit,
    source_tree: treeFromDigest(channel.content_digest),
    channel: channelName,
    stable_tag: lock.channels.stable.tag,
    stable_commit: lock.channels.stable.commit,
    site_commit: siteCommit,
    generated_at: new Date().toISOString(),
    generator: "vitepress-2-poc-v1",
    vitepress_version: packageManifest.devDependencies.vitepress,
    content_adapter: content.adapter,
    page_count: content.pages.length,
    routes: content.pages.map((page) => page.route),
    output_files_before_manifest: metrics.files,
    output_bytes_before_manifest: metrics.bytes,
  };

  await writeFile(
    path.join(distPath, "build-manifest.json"),
    `${JSON.stringify(buildManifest, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `Wrote build manifest for ${content.pages.length} VitePress pages from ${channel.commit}.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
