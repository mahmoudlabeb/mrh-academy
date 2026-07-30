export enum UserRole {
  STUDENT = "student",
  TUTOR = "tutor",
  ADMIN = "admin",
  SUBADMIN = "subadmin",
  SYSTEM = "system",
}

export enum LessonStatus {
  CONFIRMED = "confirmed",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum LessonPaymentStatus {
  PAID = "paid",
  REFUNDED = "refunded",
}

export enum ClassroomAccessState {
  ALLOWED = "allowed",
  WAITING = "waiting",
  CANCELLED = "cancelled",
  REFUNDED = "refunded",
  EXPIRED = "expired",
  CLOSED = "closed",
  UNPAID = "unpaid",
}

export enum PaymentStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  FAILED = "failed",
  CANCELLED = "cancelled",
  PARTIALLY_REFUNDED = "partially_refunded",
  REFUNDED = "refunded",
  DISPUTED = "disputed",
}

export enum PaymentMethod {
  CARD = "card",
  PAYPAL = "paypal",
  VODAFONE = "vodafone",
  INSTAPAY = "instapay",
  BINANCE = "binance",
  BANK = "bank",
}

export enum PayoutStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  SUCCESS = "success",
  FAILED = "failed",
  CANCELLED = "cancelled",
  REFUNDED = "refunded",
}

export enum CourseStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export enum ReviewStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

// Interfaces will be mapped here to ensure types are shared exactly between NestJS and Next.js
import { z } from "zod";

// ─── User ────────────────────────────────────────────────────────────────────
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole).default(UserRole.STUDENT),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  timezone: z.string().default("Africa/Cairo"),
  googleId: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isVerified: z.boolean().default(false),
  isActive: z.boolean().default(true),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
});
export type User = z.infer<typeof UserSchema>;

// ─── TutorProfile ────────────────────────────────────────────────────────────
export const TutorProfileSchema = z.object({
  userId: z.string().uuid(),
  bio: z.string(),
  specialization: z.string(),
  languages: z.array(z.string()),
  hourlyRate: z.number(),
  balance: z.number().default(0),
  totalHoursTaught: z.number().default(0),
  status: z.nativeEnum(CourseStatus).default(CourseStatus.PENDING),
  rejectionReason: z.string().nullable(),
  videoUrl: z.string().nullable(),
  introVideoId: z.string().nullable(),
  introCaptionLanguages: z.array(z.string()).nullable(),
  documentUrl: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type TutorProfile = z.infer<typeof TutorProfileSchema>;

// ─── StudentProfile ──────────────────────────────────────────────────────────
export const StudentProfileSchema = z.object({
  userId: z.string().uuid(),
  balance: z.number().default(0),
  preferredLanguage: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type StudentProfile = z.infer<typeof StudentProfileSchema>;

// ─── TutorAvailability ───────────────────────────────────────────────────────
export const TutorAvailabilitySchema = z.object({
  id: z.string().uuid(),
  tutorId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
  isRecurring: z.boolean().default(true),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type TutorAvailability = z.infer<typeof TutorAvailabilitySchema>;

// ─── Lesson ──────────────────────────────────────────────────────────────────
export const LessonSchema = z.object({
  id: z.string().uuid(),
  tutorId: z.string().uuid(),
  studentId: z.string().uuid(),
  scheduledTime: z.coerce.date(),
  endTime: z.coerce.date(),
  durationMinutes: z.number().int().positive(),
  price: z.number(),
  platformFee: z.number().nullable(),
  tutorShare: z.number().nullable().optional(),
  tutorShareReleasedAt: z.coerce.date().nullable().optional(),
  status: z.nativeEnum(LessonStatus).default(LessonStatus.CONFIRMED),
  sessionStatus: z.nativeEnum(LessonStatus),
  paymentStatus: z.nativeEnum(LessonPaymentStatus),
  timezone: z.string(),
  meetUrl: z.string().nullable(),
  googleMeetUrl: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Lesson = z.infer<typeof LessonSchema>;

// ─── Classroom ───────────────────────────────────────────────────────────────
export const ClassroomSchema = z.object({
  lessonId: z.string().uuid(),
  isActive: z.boolean().default(false),
  startedAt: z.coerce.date().nullable(),
  endedAt: z.coerce.date().nullable(),
  whiteboardSnapshot: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Classroom = z.infer<typeof ClassroomSchema>;

// ─── ClassroomMessage ────────────────────────────────────────────────────────
export const ClassroomMessageSchema = z.object({
  id: z.string().uuid(),
  lessonId: z.string().uuid(),
  senderId: z.string().uuid(),
  content: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ClassroomMessage = z.infer<typeof ClassroomMessageSchema>;

// ─── Payment ─────────────────────────────────────────────────────────────────
export const PaymentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z.number(),
  method: z.nativeEnum(PaymentMethod),
  currency: z.string().default("USD"),
  status: z.nativeEnum(PaymentStatus).default(PaymentStatus.PENDING),
  receiptUrl: z.string().nullable(),
  adminNote: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Payment = z.infer<typeof PaymentSchema>;

// ─── Message ─────────────────────────────────────────────────────────────────
export const MessageSchema = z.object({
  id: z.string().uuid(),
  senderId: z.string().uuid(),
  receiverId: z.string().uuid(),
  content: z.string(),
  isRead: z.boolean().default(false),
  isSystemMessage: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Message = z.infer<typeof MessageSchema>;

// ─── Notification ────────────────────────────────────────────────────────────
export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  isRead: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Notification = z.infer<typeof NotificationSchema>;

// ─── Course ──────────────────────────────────────────────────────────────────
export const CourseSchema = z.object({
  id: z.string().uuid(),
  tutorId: z.string().uuid(),
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  description: z.string(),
  thumbnailUrl: z.string().nullable(),
  category: z.string().nullable().optional(),
  courseType: z.enum(["recorded", "live"]).optional(),
  learningOutcomes: z.array(z.string()).nullable().optional(),
  requirements: z.array(z.string()).nullable().optional(),
  targetAudience: z.array(z.string()).nullable().optional(),
  language: z.string().optional(),
  level: z.string().optional(),
  isDraft: z.boolean().optional(),
  submittedAt: z.coerce.date().nullable().optional(),
  previewVideoUrl: z.string().nullable(),
  overviewVideoId: z.string().nullable(),
  overviewCaptionLanguages: z.array(z.string()).nullable(),
  price: z.number(),
  bunnyVideoId: z.string().nullable(),
  soldBy: z.string().default("academy"),
  status: z.nativeEnum(CourseStatus).default(CourseStatus.PENDING),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Course = z.infer<typeof CourseSchema>;

export const CourseSectionSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  sectionOrder: z.number().int().positive(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type CourseSection = z.infer<typeof CourseSectionSchema>;

export const VideoPlaybackSchema = z.object({
  status: z.enum([
    "missing",
    "created",
    "uploaded",
    "processing",
    "ready",
    "failed",
  ]),
  embedUrl: z.string().url().optional(),
  expiresAt: z.number().int().optional(),
  durationSeconds: z.number().nullable().optional(),
  captions: z
    .array(
      z.object({
        language: z.string(),
        label: z.string(),
      }),
    )
    .optional(),
});
export type VideoPlayback = z.infer<typeof VideoPlaybackSchema>;

// ─── CourseLesson ────────────────────────────────────────────────────────────
export const CourseLessonSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  sectionId: z.string().uuid().nullable().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  contentType: z.enum(["video", "article", "resource"]).optional(),
  videoAssetId: z.string().nullable(),
  videoUrl: z.string().nullable().optional(),
  articleContent: z.string().nullable().optional(),
  resourceUrl: z.string().nullable().optional(),
  downloadableFiles: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        url: z.string(),
        publicId: z.string(),
        size: z.number(),
        mimeType: z.string(),
      }),
    )
    .optional(),
  externalLinks: z
    .array(z.object({ title: z.string(), url: z.string() }))
    .optional(),
  isPreview: z.boolean().optional(),
  durationMinutes: z.number().int(),
  lessonOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type CourseLesson = z.infer<typeof CourseLessonSchema>;

// ─── CourseEnrollment ────────────────────────────────────────────────────────
export const CourseEnrollmentSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  courseId: z.string().uuid(),
  platformFee: z.number().nullable(),
  progressPercentage: z.number().int().default(0),
  enrolledAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type CourseEnrollment = z.infer<typeof CourseEnrollmentSchema>;

// ─── CourseLessonCompletion ──────────────────────────────────────────────────
export const CourseLessonCompletionSchema = z.object({
  id: z.string().uuid(),
  enrollmentId: z.string().uuid(),
  courseLessonId: z.string().uuid(),
  completedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type CourseLessonCompletion = z.infer<
  typeof CourseLessonCompletionSchema
>;

// ─── Review ──────────────────────────────────────────────────────────────────
export const ReviewSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  tutorId: z.string().uuid(),
  lessonId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  status: z.nativeEnum(CourseStatus).default(CourseStatus.PENDING),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Review = z.infer<typeof ReviewSchema>;

// ─── TeacherTrainingArticle ──────────────────────────────────────────────────
export const TeacherTrainingArticleSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  coverImageUrl: z.string().nullable(),
  content: z.string(),
  authorId: z.string().uuid(),
  isPublished: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type TeacherTrainingArticle = z.infer<
  typeof TeacherTrainingArticleSchema
>;

// ─── Employee ────────────────────────────────────────────────────────────────
export const EmployeeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  roleTitle: z.string(),
  permissions: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Employee = z.infer<typeof EmployeeSchema>;

// ─── Setting ─────────────────────────────────────────────────────────────────
export const SettingSchema = z.object({
  key: z.string(),
  value: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Setting = z.infer<typeof SettingSchema>;

// ─── Report ──────────────────────────────────────────────────────────────────
export const ReportSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  lessonId: z.string().uuid().nullable(),
  issueType: z.string(),
  description: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Report = z.infer<typeof ReportSchema>;

// ─── SubAdminProfile ─────────────────────────────────────────────────────────
export const SubAdminProfileSchema = z.object({
  userId: z.string().uuid(),
  assignedPermissions: z.array(z.string()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type SubAdminProfile = z.infer<typeof SubAdminProfileSchema>;
