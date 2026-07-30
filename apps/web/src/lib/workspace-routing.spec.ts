import {
  authenticatedGuestDestination,
  workspaceHomeForRole,
} from "./workspace-routing";

describe("workspace routing", () => {
  it.each([
    ["student", "/en/learn"],
    ["tutor", "/en/teach"],
    ["admin", "/en/ops"],
    ["subadmin", "/en/ops"],
  ])("routes an authenticated %s to the correct home", (role, expected) => {
    expect(workspaceHomeForRole("en", role)).toBe(expected);
  });

  it.each([
    ["/en/tutors", "/en/learn/tutors"],
    ["/ar/tutors/tutor-1", "/ar/learn/tutors/tutor-1"],
    ["/en/tutors/tutor-1/book", "/en/learn/tutors/tutor-1/book"],
    ["/en/courses", "/en/learn/courses#catalog"],
    ["/ar/courses/course-1", "/ar/learn/courses/catalog/course-1"],
    [
      "/en/courses/course-1/enroll",
      "/en/learn/courses/catalog/course-1/enroll",
    ],
  ])("keeps learner marketplace intent for %s", (pathname, expected) => {
    expect(authenticatedGuestDestination(pathname, "student")).toBe(expected);
  });

  it("returns non-students to their own workspace", () => {
    expect(authenticatedGuestDestination("/en/tutors", "tutor")).toBe(
      "/en/teach",
    );
    expect(authenticatedGuestDestination("/ar/courses/course-1", "admin")).toBe(
      "/ar/ops",
    );
  });

  it("keeps authenticated accounts out of guest authentication pages", () => {
    expect(authenticatedGuestDestination("/en/sign-in", "student")).toBe(
      "/en/learn",
    );
    expect(authenticatedGuestDestination("/ar/sign-up", "tutor")).toBe(
      "/ar/teach",
    );
  });

  it("preserves learner marketplace query and deep-link intent", () => {
    expect(
      authenticatedGuestDestination("/en/courses?sort=price", "student"),
    ).toBe("/en/learn/courses?sort=price#catalog");
    expect(
      authenticatedGuestDestination(
        "/ar/tutors/tutor-1?day=2#availability",
        "student",
      ),
    ).toBe("/ar/learn/tutors/tutor-1?day=2#availability");
  });

  it("does not redirect authenticated informational pages", () => {
    expect(authenticatedGuestDestination("/en/help", "student")).toBeNull();
  });
});
