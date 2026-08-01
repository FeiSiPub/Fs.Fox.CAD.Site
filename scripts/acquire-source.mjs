import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  REPOSITORY_ROOT,
  readSourceLock,
  treeFromDigest,
} from "./source-lock.mjs";

function parseChannel(args) {
  const index = args.indexOf("--channel");
  const channel = index >= 0 ? args[index + 1] : "latest";
  if (channel !== "latest" && channel !== "stable") {
    throw new Error("--channel must be latest or stable.");
  }
  return channel;
}

function runGit(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "git failed").trim();
    throw new Error(`git ${args[0]} failed: ${detail}`);
  }
  return result.stdout.trim();
}

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function assertInsideCache(cacheRoot, targetPath) {
  const relative = path.relative(cacheRoot, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Resolved source cache path is outside .cache/source.");
  }
}

async function verifyCheckout(targetPath, commit, tree) {
  const actualCommit = runGit(["rev-parse", "HEAD"], targetPath);
  if (actualCommit !== commit) {
    throw new Error(`Cached source HEAD is ${actualCommit}, expected ${commit}.`);
  }
  const actualTree = runGit(["rev-parse", "HEAD^{tree}"], targetPath);
  if (actualTree !== tree) {
    throw new Error(`Cached source tree is ${actualTree}, expected ${tree}.`);
  }
}

async function main() {
  const channelName = parseChannel(process.argv.slice(2));
  const lock = await readSourceLock();
  const channel = lock.channels[channelName];
  const tree = treeFromDigest(channel.content_digest);
  const cacheRoot = path.join(REPOSITORY_ROOT, ".cache", "source");
  const targetPath = path.join(cacheRoot, channel.commit);
  assertInsideCache(cacheRoot, targetPath);

  if (await exists(targetPath)) {
    if (!(await exists(path.join(targetPath, ".git")))) {
      throw new Error(
        `Source cache exists but is not a Git checkout: ${targetPath}. Remove it explicitly and retry.`,
      );
    }
    await verifyCheckout(targetPath, channel.commit, tree);
    console.log(`Verified cached ${channelName} source at ${targetPath}.`);
    return;
  }

  await mkdir(targetPath, { recursive: true });
  runGit(["init", "--quiet"], targetPath);
  runGit(
    [
      "remote",
      "add",
      "origin",
      `https://github.com/${lock.source_repository}.git`,
    ],
    targetPath,
  );
  runGit(["fetch", "--depth=1", "origin", channel.commit], targetPath);
  runGit(["-c", "advice.detachedHead=false", "checkout", "--detach", "FETCH_HEAD"], targetPath);
  await verifyCheckout(targetPath, channel.commit, tree);
  console.log(`Acquired ${channelName} source at ${targetPath}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
