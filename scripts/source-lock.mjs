import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
export const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
export const SOURCE_LOCK_PATH = path.join(
  REPOSITORY_ROOT,
  "config",
  "content-source.json",
);
export const EXPECTED_SOURCE_REPOSITORY = "FsDiG/Fs.Fox.CAD";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^git-tree:([0-9a-f]{40})$/;

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireObject(value, name) {
  requireCondition(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${name} must be an object.`,
  );
}

function validateChannel(channel, name, referenceKey) {
  requireObject(channel, `channels.${name}`);
  requireCondition(
    typeof channel[referenceKey] === "string" && channel[referenceKey].length > 0,
    `channels.${name}.${referenceKey} must be a non-empty string.`,
  );
  requireCondition(
    SHA_PATTERN.test(channel.commit),
    `channels.${name}.commit must be a full lowercase 40-character SHA.`,
  );
  requireCondition(
    DIGEST_PATTERN.test(channel.content_digest),
    `channels.${name}.content_digest must use git-tree:<40-character-tree>.`,
  );
}

export function validateSourceLock(lock) {
  requireObject(lock, "source lock");
  requireCondition(lock.schema_version === 1, "schema_version must be 1.");
  requireCondition(
    lock.source_repository === EXPECTED_SOURCE_REPOSITORY,
    `source_repository must be ${EXPECTED_SOURCE_REPOSITORY}.`,
  );
  requireObject(lock.channels, "channels");
  validateChannel(lock.channels.latest, "latest", "ref");
  validateChannel(lock.channels.stable, "stable", "tag");
  requireCondition(
    lock.channels.latest.ref === "main",
    "channels.latest.ref must remain main.",
  );
  return lock;
}

export async function readSourceLock(lockPath = SOURCE_LOCK_PATH) {
  const text = await readFile(lockPath, "utf8");
  return validateSourceLock(JSON.parse(text));
}

export function treeFromDigest(contentDigest) {
  const match = DIGEST_PATTERN.exec(contentDigest);
  requireCondition(match !== null, "Invalid Git tree content digest.");
  return match[1];
}

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Fs.Fox.CAD.Site/source-lock",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchGitHubCommit(repository, ref) {
  requireCondition(repository === EXPECTED_SOURCE_REPOSITORY, "Unexpected repository.");
  const url = `https://api.github.com/repos/${repository}/commits/${encodeURIComponent(ref)}`;
  const response = await fetch(url, { headers: githubHeaders() });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);
    throw new Error(`GitHub commit lookup failed (${response.status}): ${body}`);
  }
  const payload = await response.json();
  requireCondition(SHA_PATTERN.test(payload.sha), "GitHub returned an invalid commit SHA.");
  requireCondition(
    SHA_PATTERN.test(payload.commit?.tree?.sha),
    "GitHub returned an invalid Git tree SHA.",
  );
  return {
    commit: payload.sha,
    tree: payload.commit.tree.sha,
  };
}

export function updateLatestChannel(lock, remote) {
  validateSourceLock(lock);
  requireCondition(SHA_PATTERN.test(remote.commit), "Remote commit is invalid.");
  requireCondition(SHA_PATTERN.test(remote.tree), "Remote tree is invalid.");
  const digest = `git-tree:${remote.tree}`;
  const changed =
    lock.channels.latest.commit !== remote.commit ||
    lock.channels.latest.content_digest !== digest;
  if (changed) {
    lock.channels.latest.commit = remote.commit;
    lock.channels.latest.content_digest = digest;
  }
  return changed;
}

export function updateStableChannel(lock, tag, remote) {
  validateSourceLock(lock);
  requireCondition(typeof tag === "string" && tag.length > 0, "Stable tag is required.");
  requireCondition(SHA_PATTERN.test(remote.commit), "Remote commit is invalid.");
  requireCondition(SHA_PATTERN.test(remote.tree), "Remote tree is invalid.");
  const digest = `git-tree:${remote.tree}`;
  const changed =
    lock.channels.stable.tag !== tag ||
    lock.channels.stable.commit !== remote.commit ||
    lock.channels.stable.content_digest !== digest;
  if (changed) {
    lock.channels.stable.tag = tag;
    lock.channels.stable.commit = remote.commit;
    lock.channels.stable.content_digest = digest;
  }
  return changed;
}

export async function writeSourceLock(lock, lockPath = SOURCE_LOCK_PATH) {
  validateSourceLock(lock);
  const temporaryPath = `${lockPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  await rename(temporaryPath, lockPath);
}

async function verifyRemoteChannel(repository, channel, reference, name) {
  const remote = await fetchGitHubCommit(repository, reference);
  requireCondition(
    remote.commit === channel.commit,
    `${name} resolves to ${remote.commit}, not locked commit ${channel.commit}.`,
  );
  requireCondition(
    remote.tree === treeFromDigest(channel.content_digest),
    `${name} Git tree does not match the source lock.`,
  );
}

async function runCli(args) {
  const command = args[0] || "verify";
  const lock = await readSourceLock();

  if (command === "verify") {
    if (args.includes("--remote")) {
      await verifyRemoteChannel(
        lock.source_repository,
        lock.channels.latest,
        lock.channels.latest.commit,
        "latest commit",
      );
      await verifyRemoteChannel(
        lock.source_repository,
        lock.channels.stable,
        lock.channels.stable.tag,
        `stable tag ${lock.channels.stable.tag}`,
      );
      console.log("Source lock and remote commits are consistent.");
    } else {
      console.log("Source lock schema is valid.");
    }
    return;
  }

  if (command === "update") {
    const remote = await fetchGitHubCommit(
      lock.source_repository,
      lock.channels.latest.ref,
    );
    if (updateLatestChannel(lock, remote)) {
      await writeSourceLock(lock);
      console.log(`Updated latest source lock to ${remote.commit}.`);
    } else {
      console.log(`Latest source lock is already ${remote.commit}.`);
    }
    return;
  }

  if (command === "update-stable") {
    const tagIndex = args.indexOf("--tag");
    const tag = tagIndex >= 0 ? args[tagIndex + 1] : args[1];
    requireCondition(tag, "Usage: source-lock.mjs update-stable <release-tag>");
    const remote = await fetchGitHubCommit(lock.source_repository, tag);
    if (updateStableChannel(lock, tag, remote)) {
      await writeSourceLock(lock);
      console.log(`Updated stable source lock to ${tag} (${remote.commit}).`);
    } else {
      console.log(`Stable source lock is already ${tag} (${remote.commit}).`);
    }
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH);
if (isEntrypoint) {
  runCli(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
