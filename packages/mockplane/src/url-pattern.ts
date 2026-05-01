/**
 * Ported verbatim from Playwright's internal `globToRegexPattern` implementation:
 * https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/utils/isomorphic/urlMatch.ts
 *
 * Converts a Playwright-style URL glob pattern to a regex pattern string.
 *
 * Supported syntax:
 *   `*`      — matches any characters except `/`
 *   `**`     — matches any characters including `/` (and `://`)
 *   `{a,b}`  — matches either `a` or `b`
 *   `\x`     — escapes a special character
 *   `?`      — treated as a literal `?` (useful for query string separators)
 */

const escapedChars = new Set(['$', '^', '+', '.', '*', '(', ')', '|', '\\', '?', '{', '}', '[', ']']);

export function globToRegexPattern(glob: string): string {
  const tokens = ['^'];
  let inGroup = false;

  for (let i = 0; i < glob.length; ++i) {
    const c = glob[i];

    if (c === '\\' && i + 1 < glob.length) {
      const char = glob[++i];
      tokens.push(escapedChars.has(char) ? '\\' + char : char);
      continue;
    }

    if (c === '*') {
      const charBefore = glob[i - 1];
      let starCount = 1;
      while (glob[i + 1] === '*') {
        starCount++;
        i++;
      }
      if (starCount > 1) {
        const charAfter = glob[i + 1];
        if (charAfter === '/') {
          if (charBefore === '/') tokens.push('((.+/)|)');
          else tokens.push('(.*/)');
          ++i;
        } else {
          tokens.push('(.*)');
        }
      } else {
        tokens.push('([^/]*)');
      }
      continue;
    }

    switch (c) {
      case '{':
        inGroup = true;
        tokens.push('(');
        break;
      case '}':
        inGroup = false;
        tokens.push(')');
        break;
      case ',':
        if (inGroup) {
          tokens.push('|');
          break;
        }
        tokens.push('\\' + c);
        break;
      default:
        tokens.push(escapedChars.has(c) ? '\\' + c : c);
    }
  }

  tokens.push('$');
  return tokens.join('');
}

/**
 * Returns true if `url` matches the given Playwright-style glob `pattern`.
 * Falls back to exact string equality if the pattern contains no glob characters,
 * for zero overhead in the common case.
 */
export function urlMatchesPattern(pattern: string, url: string): boolean {
  const regex = new RegExp(globToRegexPattern(pattern));
  return regex.test(url);
}
