import { normalizeCollection } from "./api-collection";

describe("normalizeCollection", () => {
  const lessons = [{ id: "lesson-1" }];

  it.each([
    ["array", lessons],
    ["data envelope", { data: lessons }],
    ["items envelope", { items: lessons }],
  ])("normalizes the %s response shape", (_label, response) => {
    expect(normalizeCollection(response)).toEqual(lessons);
  });

  it("returns an empty collection for an empty envelope", () => {
    expect(normalizeCollection({})).toEqual([]);
  });
});
