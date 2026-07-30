import {
  getStudioCompletion,
  type CourseDraftForm,
  validateCourseDraft,
} from "./course-studio-validation";

const completeDraft: CourseDraftForm = {
  title: "Arabic conversation for confident beginners",
  subtitle: "Build practical speaking confidence through guided practice",
  description:
    "A practical Arabic course with guided conversations, focused exercises, useful vocabulary, and clear progress milestones for independent learners.",
  category: "Languages",
  language: "Arabic",
  level: "beginner",
  price: "39",
  courseType: "recorded",
  learningOutcomes: ["Hold an everyday Arabic conversation"],
  requirements: ["No prior Arabic experience is required"],
  targetAudience: ["Beginner Arabic learners"],
  capacity: "12",
  cohortStartAt: "",
  cohortEndAt: "",
};

describe("course studio validation", () => {
  it("marks a complete recorded course form as valid", () => {
    expect(validateCourseDraft(completeDraft)).toEqual({});
  });

  it("keeps incomplete courses out of the ready state", () => {
    const completion = getStudioCompletion(
      { ...completeDraft, learningOutcomes: [] },
      {
        hasCover: true,
        hasPromoVideo: true,
        sectionCount: 1,
        completeLessonCount: 1,
      },
    );

    expect(completion.audience).toBe(false);
    expect(Object.values(completion).every(Boolean)).toBe(false);
  });

  it("requires curriculum, cover, and promo media before submission", () => {
    const completion = getStudioCompletion(completeDraft, {
      hasCover: false,
      hasPromoVideo: false,
      sectionCount: 0,
      completeLessonCount: 0,
    });

    expect(completion.curriculum).toBe(false);
    expect(completion.media).toBe(false);
  });
});
