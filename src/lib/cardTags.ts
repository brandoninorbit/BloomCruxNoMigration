/**
 * cardTags.ts
 * Dimensional topic-tag system for BloomCrux cards.
 *
 * Tag format (inside the Tags CSV column or Payload Tags key):
 *   dimension:value>subvalue|dimension:value|dimension:value>sub>subsub
 *
 * Constraints:
 *   - Max 6 tags per card
 *   - Max depth 3 (a>b>c)
 *   - Allowed characters: lowercase letters, digits, hyphens
 *   - Everything is lowercased and trimmed on parse
 */

export type CardTag = {
  dimension: string;
  path: string[]; // e.g. ["vertebrates", "mammal", "respiratory"]
};

const TAG_CHAR_RE = /^[a-z0-9-]+$/;
const MAX_TAGS = 6;
const MAX_DEPTH = 3;

function normalizeSegment(s: string): string {
  return s.trim().toLowerCase();
}

function isValidSegment(s: string): boolean {
  return s.length > 0 && TAG_CHAR_RE.test(s);
}

export type ParseTagsResult = {
  tags: CardTag[];
  errors: string[];
};

/**
 * Parse the Tags field string into structured CardTag objects.
 *
 * @param raw - pipe-separated tag strings, e.g. "topic:vertebrates>mammal|process:gas-exchange"
 */
export function parseCardTags(raw: string): ParseTagsResult {
  const errors: string[] = [];
  if (!raw || !raw.trim()) return { tags: [], errors };

  const parts = raw
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (parts.length > MAX_TAGS) {
    errors.push(
      `Too many tags (${parts.length}); max is ${MAX_TAGS}. Extra tags are ignored.`
    );
  }

  const tags: CardTag[] = [];

  for (const part of parts.slice(0, MAX_TAGS)) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) {
      errors.push(
        `Tag "${part}" missing dimension prefix (expected format: dimension:value).`
      );
      continue;
    }

    const rawDimension = part.slice(0, colonIdx);
    const rawValue = part.slice(colonIdx + 1);

    const dimension = normalizeSegment(rawDimension);
    if (!dimension) {
      errors.push(`Empty dimension in tag "${part}".`);
      continue;
    }
    if (!isValidSegment(dimension)) {
      errors.push(
        `Invalid dimension "${dimension}" — only lowercase letters, numbers, and hyphens allowed.`
      );
      continue;
    }

    if (!rawValue.trim()) {
      errors.push(`Empty value in tag "${part}".`);
      continue;
    }

    const rawSegments = rawValue.split('>').map(normalizeSegment);

    if (rawSegments.length > MAX_DEPTH) {
      errors.push(
        `Tag "${part}" exceeds max depth of ${MAX_DEPTH}. Extra levels are truncated.`
      );
      rawSegments.splice(MAX_DEPTH);
    }

    let valid = true;
    const path: string[] = [];
    for (const seg of rawSegments) {
      if (!seg) {
        errors.push(`Empty path segment in tag "${part}".`);
        valid = false;
        break;
      }
      if (!isValidSegment(seg)) {
        errors.push(
          `Invalid character in path segment "${seg}" (tag: "${part}") — only lowercase letters, numbers, and hyphens allowed.`
        );
        valid = false;
        break;
      }
      path.push(seg);
    }

    if (valid && path.length > 0) {
      tags.push({ dimension, path });
    }
  }

  return { tags, errors };
}

/**
 * Serialize CardTag array back to the pipe-separated string format.
 */
export function formatCardTags(tags: CardTag[]): string {
  return tags.map((t) => `${t.dimension}:${t.path.join('>')}`).join('|');
}

/**
 * Return a flat label for display: "topic › vertebrates › mammal"
 */
export function tagDisplayLabel(tag: CardTag): string {
  return `${tag.dimension} › ${tag.path.join(' › ')}`;
}

/**
 * Group tags by dimension for UI rendering or analytics.
 */
export function groupTagsByDimension(
  tags: CardTag[]
): Map<string, CardTag[]> {
  const map = new Map<string, CardTag[]>();
  for (const tag of tags) {
    const bucket = map.get(tag.dimension) ?? [];
    bucket.push(tag);
    map.set(tag.dimension, bucket);
  }
  return map;
}
