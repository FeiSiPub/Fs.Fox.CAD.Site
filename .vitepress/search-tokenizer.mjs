// VitePress serializes this function into client metadata, so keep it self-contained.
export function tokenizeSearchText(text) {
  const tokens = [];
  const groups = text
    .toLocaleLowerCase("zh-CN")
    .match(/[\p{Script=Han}]+|(?:(?!\p{Script=Han})[\p{Letter}\p{Number}])+/gu);

  for (const group of groups ?? []) {
    if (/^\p{Script=Han}+$/u.test(group)) {
      const characters = Array.from(group);
      if (characters.length === 1) {
        tokens.push(group);
      } else {
        // Overlapping bigrams make unsegmented Chinese phrases searchable.
        for (let index = 0; index < characters.length - 1; index += 1) {
          tokens.push(characters.slice(index, index + 2).join(""));
        }
      }
    } else {
      tokens.push(group);
    }
  }

  return tokens;
}
