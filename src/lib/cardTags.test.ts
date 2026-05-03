import { describe, expect, test } from "vitest";
import {
  buildTagHierarchyFromKeys,
  cardTagKey,
  expandCardTagPrefixes,
  findTagHierarchyNode,
  type CardTag,
} from "./cardTags";

describe("cardTags hierarchy", () => {
  test("expandCardTagPrefixes emits every prefix in order", () => {
    const tag: CardTag = { dimension: "topic", path: ["porifera", "cells", "types"] };
    expect(expandCardTagPrefixes(tag)).toEqual([
      { dimension: "topic", path: ["porifera"] },
      { dimension: "topic", path: ["porifera", "cells"] },
      { dimension: "topic", path: ["porifera", "cells", "types"] },
    ]);
  });

  test("buildTagHierarchyFromKeys nests child tags under shared parents", () => {
    const keys = [
      cardTagKey({ dimension: "topic", path: ["porifera"] }),
      cardTagKey({ dimension: "topic", path: ["porifera", "cells"] }),
      cardTagKey({ dimension: "topic", path: ["porifera", "classes"] }),
      cardTagKey({ dimension: "topic", path: ["porifera", "classes", "hexactinellida"] }),
    ];

    const roots = buildTagHierarchyFromKeys(keys);
    expect(roots).toHaveLength(1);
    expect(roots[0]?.key).toBe("topic:porifera");
    expect(roots[0]?.children.map((child) => child.key)).toEqual([
      "topic:porifera>cells",
      "topic:porifera>classes",
    ]);
    expect(findTagHierarchyNode(roots, "topic:porifera>classes")?.children.map((child) => child.key)).toEqual([
      "topic:porifera>classes>hexactinellida",
    ]);
  });
});
