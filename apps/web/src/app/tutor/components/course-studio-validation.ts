export type CourseDraftForm = {
  title: string;
  subtitle: string;
  description: string;
  category: string;
  language: string;
  level: string;
  price: string;
  courseType: "recorded" | "live";
  learningOutcomes: string[];
  requirements: string[];
  targetAudience: string[];
  capacity: string;
  cohortStartAt: string;
  cohortEndAt: string;
};

export type CourseDraftField = keyof CourseDraftForm;

export function validateCourseDraft(draft: CourseDraftForm) {
  const errors: Partial<Record<CourseDraftField, string>> = {};
  if (draft.title.trim().length < 10) errors.title = "title_min";
  if (draft.subtitle.trim().length < 20) errors.subtitle = "subtitle_min";
  if (draft.description.trim().length < 100)
    errors.description = "description_min";
  if (!draft.category.trim()) errors.category = "category_required";
  if (!draft.language.trim()) errors.language = "language_required";
  if (!draft.level.trim()) errors.level = "level_required";
  const price = Number(draft.price);
  if (draft.price === "" || !Number.isFinite(price) || price < 0)
    errors.price = "price_invalid";
  if (draft.learningOutcomes.filter(Boolean).length === 0)
    errors.learningOutcomes = "outcomes_required";
  if (draft.requirements.filter(Boolean).length === 0)
    errors.requirements = "requirements_required";
  if (draft.targetAudience.filter(Boolean).length === 0)
    errors.targetAudience = "audience_required";
  if (draft.courseType === "live") {
    const capacity = Number(draft.capacity);
    if (!Number.isInteger(capacity) || capacity < 2)
      errors.capacity = "capacity_invalid";
    if (!draft.cohortStartAt) errors.cohortStartAt = "start_required";
    if (!draft.cohortEndAt) errors.cohortEndAt = "end_required";
    if (
      draft.cohortStartAt &&
      draft.cohortEndAt &&
      new Date(draft.cohortEndAt) <= new Date(draft.cohortStartAt)
    ) {
      errors.cohortEndAt = "end_after_start";
    }
  }
  return errors;
}

export function getStudioCompletion(
  draft: CourseDraftForm,
  options: {
    hasCover: boolean;
    hasPromoVideo: boolean;
    sectionCount: number;
    completeLessonCount: number;
  },
) {
  const errors = validateCourseDraft(draft);
  return {
    basics: ![
      "title",
      "subtitle",
      "description",
      "category",
      "language",
      "level",
      "capacity",
      "cohortStartAt",
      "cohortEndAt",
    ].some((field) => field in errors),
    audience: !["learningOutcomes", "requirements", "targetAudience"].some(
      (field) => field in errors,
    ),
    curriculum:
      options.sectionCount > 0 &&
      (draft.courseType === "live" || options.completeLessonCount > 0),
    media: options.hasCover && options.hasPromoVideo,
    pricing: !errors.price,
  };
}
