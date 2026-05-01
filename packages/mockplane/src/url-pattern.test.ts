import { describe, expect, it } from 'vitest';
import { globToRegexPattern, urlMatchesPattern } from './url-pattern';

describe('globToRegexPattern', () => {
  it('produces an anchored regex string', () => {
    const pattern = globToRegexPattern('https://example.com/foo');
    expect(pattern).toMatch(/^\^/);
    expect(pattern).toMatch(/\$$/);
  });

  it('escapes regex special characters in literal URLs', () => {
    // Dots in domain names must be literal, not "any character"
    const pattern = globToRegexPattern('https://example.com/foo');
    expect(pattern).toContain('\\.');
  });

  it('converts * to a non-slash-crossing wildcard', () => {
    const pattern = globToRegexPattern('https://example.com/*');
    expect(pattern).toContain('([^/]*)');
  });

  it('converts ** to a slash-crossing wildcard', () => {
    const pattern = globToRegexPattern('https://example.com/**');
    expect(pattern).toContain('(.*)');
  });

  it('converts {a,b} groups to regex alternation', () => {
    const pattern = globToRegexPattern('{http,https}://example.com');
    expect(pattern).toContain('(http|https)');
  });

  it('treats ? as a literal character (not a single-char wildcard)', () => {
    // ? is in escapedChars, so it must be escaped to \? in the regex
    const pattern = globToRegexPattern('https://example.com/path?foo=bar');
    expect(pattern).toContain('\\?');
  });
});

describe('urlMatchesPattern', () => {
  describe('exact matches', () => {
    it('matches an identical URL', () => {
      expect(urlMatchesPattern('https://example.com/posts', 'https://example.com/posts')).toBe(true);
    });

    it('does not match a different URL', () => {
      expect(urlMatchesPattern('https://example.com/posts', 'https://example.com/comments')).toBe(false);
    });

    it('matches a URL with a query string exactly', () => {
      expect(
        urlMatchesPattern(
          'https://example.com/posts?_limit=5',
          'https://example.com/posts?_limit=5',
        ),
      ).toBe(true);
    });

    it('does not match when the query string differs', () => {
      expect(
        urlMatchesPattern(
          'https://example.com/posts?_limit=5',
          'https://example.com/posts?_limit=10',
        ),
      ).toBe(false);
    });
  });

  describe('** wildcard (crosses slashes and ://)', () => {
    it('matches any path under a host', () => {
      expect(urlMatchesPattern('https://example.com/**', 'https://example.com/posts')).toBe(true);
      expect(urlMatchesPattern('https://example.com/**', 'https://example.com/v1/users/42')).toBe(true);
    });

    it('matches with a leading ** across the protocol separator', () => {
      expect(urlMatchesPattern('**/posts', 'https://example.com/posts')).toBe(true);
      expect(urlMatchesPattern('**/posts', 'https://api.example.com/v1/posts')).toBe(true);
    });

    it('does not match a different host with a fixed host pattern', () => {
      expect(urlMatchesPattern('https://example.com/**', 'https://other.com/posts')).toBe(false);
    });
  });

  describe('* wildcard (single segment, no slash crossing)', () => {
    it('matches a single path segment', () => {
      expect(urlMatchesPattern('https://example.com/users/*', 'https://example.com/users/42')).toBe(
        true,
      );
    });

    it('does not cross a slash', () => {
      expect(
        urlMatchesPattern('https://example.com/users/*', 'https://example.com/users/42/posts'),
      ).toBe(false);
    });

    it('does not match a different segment', () => {
      expect(urlMatchesPattern('https://example.com/users/*', 'https://example.com/posts/42')).toBe(
        false,
      );
    });
  });

  describe('{a,b} alternation', () => {
    it('matches either alternative', () => {
      expect(
        urlMatchesPattern('{http,https}://example.com/posts', 'http://example.com/posts'),
      ).toBe(true);
      expect(
        urlMatchesPattern('{http,https}://example.com/posts', 'https://example.com/posts'),
      ).toBe(true);
    });

    it('does not match outside the alternatives', () => {
      expect(
        urlMatchesPattern('{http,https}://example.com/posts', 'ftp://example.com/posts'),
      ).toBe(false);
    });
  });

  describe('? as a literal query string separator', () => {
    it('matches a URL with a literal ? separator', () => {
      expect(
        urlMatchesPattern('https://example.com/posts?**', 'https://example.com/posts?page=1&limit=5'),
      ).toBe(true);
    });

    it('does not match when ? is absent but pattern requires it', () => {
      expect(
        urlMatchesPattern('https://example.com/posts?**', 'https://example.com/posts'),
      ).toBe(false);
    });
  });
});
