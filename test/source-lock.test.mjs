import assert from "node:assert/strict";
import test from "node:test";
import {
  readSourceLock,
  updateLatestChannel,
  updateStableChannel,
  validateSourceLock,
} from "../scripts/source-lock.mjs";

function validLock() {
  return {
    schema_version: 1,
    source_repository: "FsDiG/Fs.Fox.CAD",
    channels: {
      latest: {
        ref: "main",
        commit: "a".repeat(40),
        content_digest: `git-tree:${"b".repeat(40)}`,
      },
      stable: {
        tag: "v1.0.0",
        commit: "c".repeat(40),
        content_digest: `git-tree:${"d".repeat(40)}`,
      },
    },
  };
}

test("repository source lock is valid", async () => {
  const lock = await readSourceLock();
  assert.equal(lock.source_repository, "FsDiG/Fs.Fox.CAD");
});

test("short commits are rejected", () => {
  const lock = validLock();
  lock.channels.latest.commit = "abc123";
  assert.throws(() => validateSourceLock(lock), /40-character SHA/);
});

test("unexpected source repositories are rejected", () => {
  const lock = validLock();
  lock.source_repository = "example/other";
  assert.throws(() => validateSourceLock(lock), /source_repository/);
});

test("latest update changes only the latest channel", () => {
  const lock = validLock();
  const originalStable = structuredClone(lock.channels.stable);
  const changed = updateLatestChannel(lock, {
    commit: "e".repeat(40),
    tree: "f".repeat(40),
  });
  assert.equal(changed, true);
  assert.equal(lock.channels.latest.commit, "e".repeat(40));
  assert.equal(lock.channels.latest.content_digest, `git-tree:${"f".repeat(40)}`);
  assert.deepEqual(lock.channels.stable, originalStable);
});

test("latest update is a no-op when commit and tree match", () => {
  const lock = validLock();
  const changed = updateLatestChannel(lock, {
    commit: lock.channels.latest.commit,
    tree: lock.channels.latest.content_digest.slice("git-tree:".length),
  });
  assert.equal(changed, false);
});

test("stable update records both tag and resolved commit", () => {
  const lock = validLock();
  const changed = updateStableChannel(lock, "v2.0.0", {
    commit: "1".repeat(40),
    tree: "2".repeat(40),
  });
  assert.equal(changed, true);
  assert.deepEqual(lock.channels.stable, {
    tag: "v2.0.0",
    commit: "1".repeat(40),
    content_digest: `git-tree:${"2".repeat(40)}`,
  });
});
