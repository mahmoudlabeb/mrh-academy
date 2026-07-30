import type { EntityManager } from 'typeorm';

type ComprehensiveDemoContext = {
  studentId: string;
  tutorId: string;
  adminId: string;
  approvedCourseId: string;
  completedLessonId: string;
  walletPaymentId: string;
};

const ids = {
  activeLesson: '10000000-0000-4000-8000-000000000001',
  upcomingLesson: '10000000-0000-4000-8000-000000000002',
  cancelledLesson: '10000000-0000-4000-8000-000000000003',
  pendingReviewLesson: '10000000-0000-4000-8000-000000000004',
  rejectedReviewLesson: '10000000-0000-4000-8000-000000000005',
  videoLesson: '20000000-0000-4000-8000-000000000001',
  articleLesson: '20000000-0000-4000-8000-000000000002',
  resourceLesson: '20000000-0000-4000-8000-000000000003',
  enrollment: '30000000-0000-4000-8000-000000000001',
  videoCompletion: '40000000-0000-4000-8000-000000000001',
  articleCompletion: '40000000-0000-4000-8000-000000000002',
  coursePayment: '50000000-0000-4000-8000-000000000001',
  pendingPayment: '50000000-0000-4000-8000-000000000002',
  rejectedPayment: '50000000-0000-4000-8000-000000000003',
  refundedPayment: '50000000-0000-4000-8000-000000000004',
  fundingAllocation: '60000000-0000-4000-8000-000000000001',
  refundReversal: '70000000-0000-4000-8000-000000000001',
  pendingPayout: '80000000-0000-4000-8000-000000000001',
  successfulPayout: '80000000-0000-4000-8000-000000000002',
  failedPayout: '80000000-0000-4000-8000-000000000003',
  webhookEvent: '90000000-0000-4000-8000-000000000001',
  messageFromStudent: 'a0000000-0000-4000-8000-000000000001',
  messageFromTutor: 'a0000000-0000-4000-8000-000000000002',
  systemMessage: 'a0000000-0000-4000-8000-000000000003',
  studentNotification: 'b0000000-0000-4000-8000-000000000001',
  tutorNotification: 'b0000000-0000-4000-8000-000000000002',
  classroomStudentMessage: 'c0000000-0000-4000-8000-000000000001',
  classroomTutorMessage: 'c0000000-0000-4000-8000-000000000002',
  report: 'd0000000-0000-4000-8000-000000000001',
  approvedReview: 'e0000000-0000-4000-8000-000000000001',
  pendingReview: 'e0000000-0000-4000-8000-000000000002',
  rejectedReview: 'e0000000-0000-4000-8000-000000000003',
  publishedArticle: 'f0000000-0000-4000-8000-000000000001',
  draftArticle: 'f0000000-0000-4000-8000-000000000002',
  auditLog: '11000000-0000-4000-8000-000000000001',
  secondAuditLog: '11000000-0000-4000-8000-000000000002',
  promoCode: '12000000-0000-4000-8000-000000000001',
  lessonBook: '13000000-0000-4000-8000-000000000001',
  liveCourse: '14000000-0000-4000-8000-000000000001',
  draftCourse: '14000000-0000-4000-8000-000000000002',
  rejectedCourse: '14000000-0000-4000-8000-000000000003',
} as const;

export async function seedComprehensiveDemoFixtures(
  manager: EntityManager,
  context: ComprehensiveDemoContext,
): Promise<void> {
  const now = Date.now();
  const minutes = (value: number) => new Date(now + value * 60 * 1000);
  const days = (value: number) => new Date(now + value * 24 * 60 * 60 * 1000);

  await manager.query(
    `
      UPDATE "student_profiles"
      SET "balance" = 235, "held_balance" = 20,
          "preferred_language" = 'English', "updated_at" = now()
      WHERE "user_id" = $1
    `,
    [context.studentId],
  );
  await manager.query(
    `
      UPDATE "tutor_profiles"
      SET "balance" = 84.50, "total_hours_taught" = 4.17,
          "country" = 'Egypt', "experience_years" = 8,
          "updated_at" = now()
      WHERE "user_id" = $1
    `,
    [context.tutorId],
  );
  await manager.query(
    `
      UPDATE "courses"
      SET "subtitle" = 'Build practical confidence through guided conversations',
          "learning_outcomes" = 'Introduce yourself confidently,Handle everyday conversations,Use practical pronunciation patterns',
          "requirements" = 'No prior Arabic study required',
          "target_audience" = 'Adult beginners,Travelers,Heritage learners',
          "language" = 'Arabic', "level" = 'beginner',
          "video_quality_approved_by" = $2, "updated_at" = now()
      WHERE "id" = $1
    `,
    [context.approvedCourseId, context.adminId],
  );
  await manager.query(
    `
      UPDATE "payments"
      SET "credited_amount_usd" = 100, "allocated_amount" = 0,
          "updated_at" = now()
      WHERE "id" = $1
    `,
    [context.walletPaymentId],
  );

  await manager.query(
    `
      INSERT INTO "courses"
        ("id", "tutor_id", "title", "description", "course_type", "subtitle",
         "learning_outcomes", "requirements", "target_audience", "language",
         "level", "timezone", "capacity", "cohort_start_at", "cohort_end_at",
         "is_draft", "submitted_at", "price", "sold_by", "status",
         "video_quality_approved_at", "video_quality_approved_by")
      VALUES
        ($1, $4, 'Live Arabic Speaking Lab',
         'A fictional small-cohort speaking lab for live-course testing.', 'live',
         'Weekly coached speaking practice', 'Speak with more fluency,Respond in real time',
         'Basic Arabic reading', 'Intermediate adult learners', 'Arabic', 'intermediate',
         'Africa/Cairo', 12, $6, $7, false, $5, 120, 'tutor', 'approved', $5, $8),
        ($2, $4, 'Draft Pronunciation Mini-Course',
         'An unpublished fictional draft for the tutor authoring studio.', 'recorded',
         'Draft content for local testing', 'Plan a pronunciation routine',
         'No requirements', 'Arabic learners', 'Arabic', 'beginner', 'Africa/Cairo',
         NULL, NULL, NULL, true, NULL, 35, 'tutor', 'pending', NULL, NULL),
        ($3, $4, 'Rejected Course Example',
         'A fictional rejected submission for moderation-state testing.', 'recorded',
         'Needs revision before resubmission', 'Review course-quality feedback',
         'No requirements', 'Tutors testing moderation', 'English', 'advanced',
         'Africa/Cairo', NULL, NULL, NULL, false, $5, 45, 'academy', 'rejected',
         NULL, NULL)
      ON CONFLICT ("id") DO UPDATE SET
        "title" = EXCLUDED."title", "description" = EXCLUDED."description",
        "course_type" = EXCLUDED."course_type", "subtitle" = EXCLUDED."subtitle",
        "capacity" = EXCLUDED."capacity", "cohort_start_at" = EXCLUDED."cohort_start_at",
        "cohort_end_at" = EXCLUDED."cohort_end_at", "is_draft" = EXCLUDED."is_draft",
        "submitted_at" = EXCLUDED."submitted_at", "status" = EXCLUDED."status",
        "updated_at" = now()
    `,
    [
      ids.liveCourse,
      ids.draftCourse,
      ids.rejectedCourse,
      context.tutorId,
      new Date(),
      days(7),
      days(35),
      context.adminId,
    ],
  );

  await manager.query(
    `
      INSERT INTO "course_lessons"
        ("id", "course_id", "title", "video_asset_id", "description",
         "content_type", "article_content", "resource_url", "is_preview",
         "duration_minutes", "lesson_order")
      VALUES
        ($1, $4, 'Greetings and introductions', 'demo-video-asset-01',
         'Practice greetings and a confident self-introduction.', 'video', NULL,
         NULL, true, 18, 1),
        ($2, $4, 'Everyday conversation patterns', NULL,
         'Read and apply reusable conversation patterns.', 'article',
         'Use short question-and-answer patterns, then personalize each example.',
         NULL, false, 12, 2),
        ($3, $4, 'Practice worksheet', NULL,
         'Downloadable fictional worksheet metadata for local testing.', 'resource',
         NULL, 'https://assets.mrh-academy.example/demo/conversation-worksheet.pdf',
         false, 10, 3)
      ON CONFLICT ("id") DO UPDATE SET
        "title" = EXCLUDED."title", "description" = EXCLUDED."description",
        "content_type" = EXCLUDED."content_type",
        "article_content" = EXCLUDED."article_content",
        "resource_url" = EXCLUDED."resource_url",
        "is_preview" = EXCLUDED."is_preview",
        "duration_minutes" = EXCLUDED."duration_minutes",
        "lesson_order" = EXCLUDED."lesson_order", "updated_at" = now()
    `,
    [
      ids.videoLesson,
      ids.articleLesson,
      ids.resourceLesson,
      context.approvedCourseId,
    ],
  );

  await manager.query(
    `
      INSERT INTO "course_promo_codes"
        ("id", "tutor_id", "course_id", "code", "usage_limit", "current_uses")
      VALUES ($1, $2, $3, 'DEMO100', 100, 1)
      ON CONFLICT ("id") DO UPDATE SET
        "usage_limit" = EXCLUDED."usage_limit",
        "current_uses" = EXCLUDED."current_uses"
    `,
    [ids.promoCode, context.tutorId, context.approvedCourseId],
  );

  await manager.query(
    `
      INSERT INTO "course_enrollments"
        ("id", "student_id", "course_id", "platform_fee", "tutor_share",
         "sold_by", "referral_tutor_id", "progress_percentage", "enrolled_at",
         "tutor_share_available_at", "tutor_share_released_at")
      VALUES ($1, $2, $3, 25.97, 23.03, 'academy', NULL, 67, $4, $5, $6)
      ON CONFLICT ("id") DO UPDATE SET
        "platform_fee" = EXCLUDED."platform_fee",
        "tutor_share" = EXCLUDED."tutor_share",
        "progress_percentage" = EXCLUDED."progress_percentage",
        "tutor_share_available_at" = EXCLUDED."tutor_share_available_at",
        "tutor_share_released_at" = EXCLUDED."tutor_share_released_at",
        "updated_at" = now()
    `,
    [
      ids.enrollment,
      context.studentId,
      context.approvedCourseId,
      days(-30),
      days(-16),
      days(-2),
    ],
  );
  await manager.query(
    `
      INSERT INTO "course_lesson_completions"
        ("id", "enrollment_id", "course_lesson_id", "completed_at")
      VALUES ($1, $3, $4, $5), ($2, $3, $6, $7)
      ON CONFLICT ("id") DO UPDATE SET "completed_at" = EXCLUDED."completed_at",
        "updated_at" = now()
    `,
    [
      ids.videoCompletion,
      ids.articleCompletion,
      ids.enrollment,
      ids.videoLesson,
      days(-20),
      ids.articleLesson,
      days(-12),
    ],
  );

  await manager.query(
    `
      INSERT INTO "payments"
        ("id", "user_id", "amount", "method", "currency", "status",
         "receipt_url", "idempotency_key", "admin_note",
         "stripe_checkout_session_id", "stripe_payment_intent_id",
         "allocated_amount", "credited_amount_usd", "refunded_amount",
         "refunded_at", "rejection_reason")
      VALUES
        ($1, $5, 49, 'card', 'USD', 'approved', NULL, 'demo-course-checkout',
         'Approved demo course checkout', 'cs_demo_course_01', 'pi_demo_course_01',
         49, 49, 0, NULL, NULL),
        ($2, $5, 750, 'instapay', 'EGP', 'pending',
         'https://assets.mrh-academy.example/demo/pending-receipt.png',
         'demo-manual-pending', 'Awaiting fictional manual review', NULL, NULL,
         0, NULL, 0, NULL, NULL),
        ($3, $5, 500, 'vodafone', 'EGP', 'rejected',
         'https://assets.mrh-academy.example/demo/rejected-receipt.png',
         'demo-manual-rejected', 'Rejected fictional receipt', NULL, NULL,
         0, NULL, 0, NULL, 'Receipt reference was unreadable'),
        ($4, $5, 65, 'card', 'USD', 'approved', NULL, 'demo-refunded-payment',
         'Fully refunded demo checkout', 'cs_demo_refund_01', 'pi_demo_refund_01',
         0, 65, 65, $6, NULL)
      ON CONFLICT ("id") DO UPDATE SET
        "status" = EXCLUDED."status", "admin_note" = EXCLUDED."admin_note",
        "allocated_amount" = EXCLUDED."allocated_amount",
        "credited_amount_usd" = EXCLUDED."credited_amount_usd",
        "refunded_amount" = EXCLUDED."refunded_amount",
        "refunded_at" = EXCLUDED."refunded_at",
        "rejection_reason" = EXCLUDED."rejection_reason", "updated_at" = now()
    `,
    [
      ids.coursePayment,
      ids.pendingPayment,
      ids.rejectedPayment,
      ids.refundedPayment,
      context.studentId,
      days(-5),
    ],
  );
  await manager.query(
    `
      INSERT INTO "course_funding_allocations"
        ("id", "payment_id", "enrollment_id", "amount")
      VALUES ($1, $2, $3, 49)
      ON CONFLICT ("id") DO UPDATE SET "amount" = EXCLUDED."amount"
    `,
    [ids.fundingAllocation, ids.coursePayment, ids.enrollment],
  );
  await manager.query(
    `
      INSERT INTO "course_refund_reversals"
        ("id", "payment_id", "original_enrollment_id", "student_id",
         "course_id", "tutor_id", "sold_by", "paid_amount", "platform_fee",
         "tutor_share", "stripe_charge_id", "reversed_at")
      VALUES ($1, $2, '70000000-0000-4000-8000-000000000099', $3, $4, $5,
              'tutor', 65, 1.30, 63.70, 'ch_demo_refund_01', $6)
      ON CONFLICT ("id") DO UPDATE SET "reversed_at" = EXCLUDED."reversed_at"
    `,
    [
      ids.refundReversal,
      ids.refundedPayment,
      context.studentId,
      context.approvedCourseId,
      context.tutorId,
      days(-5),
    ],
  );

  await manager.query(
    `
      INSERT INTO "lessons"
        ("id", "tutor_id", "student_id", "scheduled_time", "end_time",
         "duration_minutes", "price", "platform_fee", "idempotency_key",
         "status", "room_id", "meet_url", "notes")
      VALUES
        ($1, $6, $7, $8, $9, 50, 15, 1.50, 'demo-active-lesson', 'confirmed',
         'demo-live-classroom', 'demo-live-classroom',
         'Starts soon so both participants can test the native classroom.'),
        ($2, $6, $7, $10, $11, 25, 8, 0.80, 'demo-upcoming-lesson', 'confirmed',
         'demo-upcoming-room', 'demo-upcoming-room', 'Upcoming booking state.'),
        ($3, $6, $7, $12, $13, 25, 8, 0.80, 'demo-cancelled-lesson', 'cancelled',
         'demo-cancelled-room', 'demo-cancelled-room', 'Cancelled booking history.'),
        ($4, $6, $7, $14, $15, 50, 15, 1.50, 'demo-pending-review-lesson',
         'completed', 'demo-pending-review-room', 'demo-pending-review-room',
         'Completed lesson with a pending review.'),
        ($5, $6, $7, $16, $17, 50, 15, 1.50, 'demo-rejected-review-lesson',
         'completed', 'demo-rejected-review-room', 'demo-rejected-review-room',
         'Completed lesson with a rejected review.')
      ON CONFLICT ("id") DO UPDATE SET
        "scheduled_time" = EXCLUDED."scheduled_time", "end_time" = EXCLUDED."end_time",
        "status" = EXCLUDED."status", "room_id" = EXCLUDED."room_id",
        "meet_url" = EXCLUDED."meet_url", "notes" = EXCLUDED."notes",
        "updated_at" = now()
    `,
    [
      ids.activeLesson,
      ids.upcomingLesson,
      ids.cancelledLesson,
      ids.pendingReviewLesson,
      ids.rejectedReviewLesson,
      context.tutorId,
      context.studentId,
      minutes(20),
      minutes(70),
      days(3),
      new Date(days(3).getTime() + 25 * 60 * 1000),
      days(-3),
      new Date(days(-3).getTime() + 25 * 60 * 1000),
      days(-14),
      new Date(days(-14).getTime() + 50 * 60 * 1000),
      days(-21),
      new Date(days(-21).getTime() + 50 * 60 * 1000),
    ],
  );

  await manager.query(
    `
      INSERT INTO "classrooms"
        ("lesson_id", "is_active", "started_at", "ended_at", "whiteboard_snapshot")
      VALUES
        ($1, true, $3, NULL,
         '{"pages":{"1":[{"tool":"pen","color":"#173f35","points":[{"x":120,"y":140},{"x":240,"y":180}]}],"2":[]},"currentPage":1}'::jsonb),
        ($2, false, $4, $5, '{"pages":{"1":[]},"currentPage":1}'::jsonb)
      ON CONFLICT ("lesson_id") DO UPDATE SET
        "is_active" = EXCLUDED."is_active", "started_at" = EXCLUDED."started_at",
        "ended_at" = EXCLUDED."ended_at",
        "whiteboard_snapshot" = EXCLUDED."whiteboard_snapshot", "updated_at" = now()
    `,
    [
      ids.activeLesson,
      context.completedLessonId,
      minutes(-5),
      days(-7),
      days(-7),
    ],
  );
  await manager.query(
    `
      INSERT INTO "classroom_messages" ("id", "lesson_id", "sender_id", "content")
      VALUES
        ($1, $3, $4, 'Hello! I am ready for today''s lesson.'),
        ($2, $3, $5, 'Welcome — we will begin with a quick speaking warm-up.')
      ON CONFLICT ("id") DO UPDATE SET "content" = EXCLUDED."content",
        "updated_at" = now()
    `,
    [
      ids.classroomStudentMessage,
      ids.classroomTutorMessage,
      ids.activeLesson,
      context.studentId,
      context.tutorId,
    ],
  );
  await manager.query(
    `
      INSERT INTO "lesson_books"
        ("id", "lesson_id", "uploaded_by", "title", "cloudinary_public_id",
         "page_count", "mime_type")
      VALUES ($1, $2, $3, 'Demo classroom workbook',
              'mrh-academy/demo/classroom-workbook', 12, 'application/pdf')
      ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title",
        "page_count" = EXCLUDED."page_count"
    `,
    [ids.lessonBook, ids.activeLesson, context.tutorId],
  );

  await manager.query(
    `
      INSERT INTO "messages"
        ("id", "sender_id", "receiver_id", "content", "is_read", "is_system_message")
      VALUES
        ($1, $4, $5, 'Could we focus on pronunciation in our next lesson?', true, false),
        ($2, $5, $4, 'Absolutely. I added a warm-up exercise for you.', false, false),
        ($3, $6, $4, 'Your demo course enrollment is ready.', false, true)
      ON CONFLICT ("id") DO UPDATE SET "content" = EXCLUDED."content",
        "is_read" = EXCLUDED."is_read", "updated_at" = now()
    `,
    [
      ids.messageFromStudent,
      ids.messageFromTutor,
      ids.systemMessage,
      context.studentId,
      context.tutorId,
      context.adminId,
    ],
  );
  await manager.query(
    `
      INSERT INTO "notifications" ("id", "user_id", "type", "title", "body", "is_read")
      VALUES
        ($1, $3, 'lesson_reminder', 'Lesson starts soon',
         'Your demo classroom opens in about 20 minutes.', false),
        ($2, $4, 'payout_update', 'Payout request pending',
         'Your fictional $25.00 payout request is awaiting review.', false)
      ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title",
        "body" = EXCLUDED."body", "is_read" = EXCLUDED."is_read",
        "updated_at" = now()
    `,
    [
      ids.studentNotification,
      ids.tutorNotification,
      context.studentId,
      context.tutorId,
    ],
  );

  await manager.query(
    `
      INSERT INTO "reviews"
        ("id", "student_id", "tutor_id", "lesson_id", "rating", "comment", "status")
      VALUES
        ($1, $4, $5, $6, 5, 'Patient, practical, and easy to follow.', 'approved'),
        ($2, $4, $5, $7, 4, 'Useful lesson awaiting moderation.', 'pending'),
        ($3, $4, $5, $8, 2, 'Fictional rejected review for moderation testing.', 'rejected')
      ON CONFLICT ("id") DO UPDATE SET "rating" = EXCLUDED."rating",
        "comment" = EXCLUDED."comment", "status" = EXCLUDED."status",
        "updated_at" = now()
    `,
    [
      ids.approvedReview,
      ids.pendingReview,
      ids.rejectedReview,
      context.studentId,
      context.tutorId,
      context.completedLessonId,
      ids.pendingReviewLesson,
      ids.rejectedReviewLesson,
    ],
  );
  await manager.query(
    `
      INSERT INTO "reports" ("id", "user_id", "lesson_id", "issue_type", "description")
      VALUES ($1, $2, $3, 'audio_quality',
              'Fictional classroom report for the admin operations queue.')
      ON CONFLICT ("id") DO UPDATE SET "description" = EXCLUDED."description",
        "updated_at" = now()
    `,
    [ids.report, context.studentId, context.completedLessonId],
  );
  await manager.query(
    `
      INSERT INTO "teacher_training_articles"
        ("id", "title", "cover_image_url", "content", "author_id", "is_published")
      VALUES
        ($1, 'Giving useful feedback after a speaking task', NULL,
         'Use one concrete success, one focused correction, and one next-step prompt.', $3, true),
        ($2, 'Draft: planning a bilingual warm-up', NULL,
         'A fictional unpublished draft for content-management testing.', $3, false)
      ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title",
        "content" = EXCLUDED."content", "is_published" = EXCLUDED."is_published",
        "updated_at" = now()
    `,
    [ids.publishedArticle, ids.draftArticle, context.adminId],
  );

  await manager.query(
    `
      INSERT INTO "payouts"
        ("id", "tutor_id", "amount", "status", "method", "account_details",
         "admin_note", "stripe_payout_id", "error_message")
      VALUES
        ($1, $4, 25, 'pending', 'instapay', 'demo-tutor@instapay.example',
         'Fictional pending payout', NULL, NULL),
        ($2, $4, 40, 'success', 'bank', 'Fictional sandbox bank account',
         'Approved by demo admin', 'po_demo_success_01', NULL),
        ($3, $4, 15, 'failed', 'vodafone', '+201000000000',
         'Rejected demo payout', NULL, 'Fictional account verification failure')
      ON CONFLICT ("id") DO UPDATE SET "status" = EXCLUDED."status",
        "admin_note" = EXCLUDED."admin_note", "error_message" = EXCLUDED."error_message",
        "updated_at" = now()
    `,
    [
      ids.pendingPayout,
      ids.successfulPayout,
      ids.failedPayout,
      context.tutorId,
    ],
  );
  await manager.query(
    `
      INSERT INTO "processed_webhook_events" ("id", "event_id", "event_type")
      VALUES ($1, 'evt_demo_checkout_completed', 'checkout.session.completed')
      ON CONFLICT ("id") DO UPDATE SET "event_type" = EXCLUDED."event_type"
    `,
    [ids.webhookEvent],
  );
  await manager.query(
    `
      INSERT INTO "admin_audit_logs"
        ("id", "admin_id", "target_user_id", "action", "ip_address", "metadata")
      VALUES
        ($1, $3, $4, 'demo.tutor.approved', '127.0.0.1',
         '{"source":"comprehensive-demo-seed"}'::jsonb),
        ($2, $3, $5, 'demo.payment.reviewed', '127.0.0.1',
         '{"paymentStatus":"rejected"}'::jsonb)
      ON CONFLICT ("id") DO UPDATE SET "metadata" = EXCLUDED."metadata"
    `,
    [
      ids.auditLog,
      ids.secondAuditLog,
      context.adminId,
      context.tutorId,
      context.studentId,
    ],
  );
  await manager.query(`
    UPDATE "payment_method_configs"
    SET "enabled" = true,
        "details" = CASE "type"
          WHEN 'instapay' THEN 'Fictional sandbox destination: payments@mrh-academy.example'
          WHEN 'vodafone' THEN 'Fictional sandbox wallet: +201000000000'
          ELSE "details"
        END,
        "updated_at" = now()
    WHERE "type" IN ('instapay', 'vodafone')
  `);
}
