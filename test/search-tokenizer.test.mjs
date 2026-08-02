import assert from "node:assert/strict";
import test from "node:test";
import { tokenizeSearchText } from "../.vitepress/search-tokenizer.mjs";

test("Chinese text is tokenized into overlapping bigrams", () => {
  assert.deepEqual(tokenizeSearchText("来源锁"), ["来源", "源锁"]);
});

test("Latin words and numbers are normalized without punctuation", () => {
  assert.deepEqual(tokenizeSearchText("ObjectARX/ZRX 2026"), [
    "objectarx",
    "zrx",
    "2026",
  ]);
});

test("mixed Chinese and Latin text keeps both token families", () => {
  assert.deepEqual(tokenizeSearchText("CAD文档 API"), [
    "cad",
    "文档",
    "api",
  ]);
});
