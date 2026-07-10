import { MigrationInterface, QueryRunner } from 'typeorm';

async function ensureEnum(
  queryRunner: QueryRunner,
  name: string,
  values: string[],
): Promise<void> {
  const literals = values.map((v) => `'${v}'`).join(', ');
  await queryRunner.query(`
    DO $$ BEGIN
      CREATE TYPE "${name}" AS ENUM (${literals});
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);
}

async function ensureForeignKey(
  queryRunner: QueryRunner,
  table: string,
  constraint: string,
  ddl: string,
): Promise<void> {
  await queryRunner.query(`
    DO $$ BEGIN
      ALTER TABLE "${table}" ADD CONSTRAINT "${constraint}" ${ddl};
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);
}

export class InitialSchema1737000000000 implements MigrationInterface {
  name = 'InitialSchema1737000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await ensureEnum(queryRunner, 'users_role_enum', [
      'student',
      'tutor',
      'admin',
      'subadmin',
      'system',
    ]);
    await ensureEnum(queryRunner, 'lessons_status_enum', [
      'pending',
      'confirmed',
      'completed',
      'cancelled',
    ]);
    await ensureEnum(queryRunner, 'payments_method_enum', [
      'card',
      'paypal',
      'vodafone',
      'instapay',
      'binance',
      'bank',
    ]);
    await ensureEnum(queryRunner, 'payments_status_enum', [
      'pending',
      'approved',
      'rejected',
    ]);
    await ensureEnum(queryRunner, 'tutor_profiles_status_enum', [
      'pending',
      'approved',
      'rejected',
    ]);
    await ensureEnum(queryRunner, 'courses_status_enum', [
      'pending',
      'approved',
      'rejected',
    ]);
    await ensureEnum(queryRunner, 'reviews_status_enum', [
      'pending',
      'approved',
      'rejected',
    ]);
    await ensureEnum(queryRunner, 'payouts_status_enum', [
      'PENDING',
      'SUCCESS',
      'FAILED',
    ]);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'student',
        "firstName" character varying NOT NULL,
        "lastName" character varying NOT NULL,
        "phone" character varying,
        "timezone" character varying NOT NULL DEFAULT 'Africa/Cairo',
        "googleId" character varying,
        "avatarUrl" character varying,
        "isVerified" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "notificationPreferences" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employees" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "email" character varying NOT NULL,
        "roleTitle" character varying NOT NULL,
        "permissions" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employees" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_employees_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "settings" (
        "key" character varying NOT NULL,
        "value" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_settings" PRIMARY KEY ("key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tutor_profiles" (
        "userId" uuid NOT NULL,
        "bio" character varying NOT NULL,
        "specialization" character varying NOT NULL,
        "languages" text array NOT NULL,
        "hourlyRate" numeric(10,2) NOT NULL,
        "balance" numeric(10,2) NOT NULL DEFAULT 0,
        "totalHoursTaught" numeric(10,2) NOT NULL DEFAULT 0,
        "status" "tutor_profiles_status_enum" NOT NULL DEFAULT 'pending',
        "rejectionReason" character varying,
        "videoUrl" character varying,
        "documentUrl" character varying,
        "stripeAccountId" character varying,
        "stripeOnboardingComplete" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tutor_profiles" PRIMARY KEY ("userId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "student_profiles" (
        "userId" uuid NOT NULL,
        "balance" numeric(10,2) NOT NULL DEFAULT 0,
        "preferredLanguage" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_profiles" PRIMARY KEY ("userId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sub_admin_profiles" (
        "userId" uuid NOT NULL,
        "assignedPermissions" text array NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sub_admin_profiles" PRIMARY KEY ("userId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tutor_availabilities" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutorId" uuid NOT NULL,
        "dayOfWeek" integer NOT NULL,
        "startTime" TIME NOT NULL,
        "endTime" TIME NOT NULL,
        "isRecurring" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tutor_availabilities" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lessons" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutorId" uuid NOT NULL,
        "studentId" uuid NOT NULL,
        "scheduledTime" TIMESTAMP NOT NULL,
        "endTime" TIMESTAMP NOT NULL,
        "durationMinutes" integer NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "platformFee" numeric(10,2),
        "status" "lessons_status_enum" NOT NULL DEFAULT 'pending',
        "meetUrl" character varying,
        "notes" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lessons" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_lessons_duration_minutes" CHECK ("durationMinutes" IN (25, 50))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "classrooms" (
        "lessonId" uuid NOT NULL,
        "isActive" boolean NOT NULL DEFAULT false,
        "startedAt" TIMESTAMP,
        "endedAt" TIMESTAMP,
        "whiteboardSnapshot" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_classrooms" PRIMARY KEY ("lessonId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "classroom_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "lessonId" uuid NOT NULL,
        "senderId" uuid NOT NULL,
        "content" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_classroom_messages" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "method" "payments_method_enum" NOT NULL,
        "status" "payments_status_enum" NOT NULL DEFAULT 'pending',
        "receiptUrl" character varying,
        "idempotencyKey" character varying,
        "adminNote" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payments_idempotencyKey" UNIQUE ("idempotencyKey")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "senderId" uuid NOT NULL,
        "receiverId" uuid NOT NULL,
        "content" character varying NOT NULL,
        "isRead" boolean NOT NULL DEFAULT false,
        "isSystemMessage" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "type" character varying NOT NULL,
        "title" character varying NOT NULL,
        "body" character varying NOT NULL,
        "isRead" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutorId" uuid NOT NULL,
        "title" character varying NOT NULL,
        "description" character varying NOT NULL,
        "thumbnailUrl" character varying,
        "price" numeric(10,2) NOT NULL,
        "bunnyVideoId" character varying,
        "soldBy" character varying NOT NULL DEFAULT 'academy',
        "status" "courses_status_enum" NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_courses" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_lessons" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "courseId" uuid NOT NULL,
        "title" character varying NOT NULL,
        "videoAssetId" text NOT NULL,
        "durationMinutes" integer NOT NULL,
        "lessonOrder" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_lessons" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_enrollments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "studentId" uuid NOT NULL,
        "courseId" uuid NOT NULL,
        "platformFee" numeric(10,2),
        "tutorShare" numeric(10,2),
        "soldBy" character varying(10) NOT NULL DEFAULT 'academy',
        "referralTutorId" character varying,
        "progressPercentage" integer NOT NULL DEFAULT 0,
        "enrolledAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_enrollments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_course_enrollments_student_course" UNIQUE ("studentId", "courseId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_lesson_completions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "enrollmentId" uuid NOT NULL,
        "courseLessonId" uuid NOT NULL,
        "completedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_lesson_completions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_course_lesson_completions_enrollment_lesson" UNIQUE ("enrollmentId", "courseLessonId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reviews" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "studentId" uuid NOT NULL,
        "tutorId" uuid NOT NULL,
        "lessonId" uuid NOT NULL,
        "rating" integer NOT NULL,
        "comment" text,
        "status" "reviews_status_enum" NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reviews_lessonId" UNIQUE ("lessonId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teacher_training_articles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" character varying NOT NULL,
        "coverImageUrl" character varying,
        "content" text NOT NULL,
        "authorId" uuid NOT NULL,
        "isPublished" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teacher_training_articles" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "lessonId" uuid,
        "issueType" character varying NOT NULL,
        "description" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reports" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vocabulary_words" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "word" character varying NOT NULL,
        "definition" text NOT NULL,
        "examples" text,
        "translation" text,
        "language" character varying NOT NULL DEFAULT 'en',
        "contextSentence" text,
        "savedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vocabulary_words" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payouts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutorId" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "status" "payouts_status_enum" NOT NULL DEFAULT 'PENDING',
        "stripePayoutId" character varying,
        "errorMessage" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payouts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_promo_codes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutorId" uuid NOT NULL,
        "courseId" uuid NOT NULL,
        "code" character varying NOT NULL,
        "usageLimit" integer NOT NULL DEFAULT 100,
        "currentUses" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_promo_codes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_course_promo_codes_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_books" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "lessonId" uuid NOT NULL,
        "uploadedBy" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "cloudinaryPublicId" character varying NOT NULL,
        "pageCount" integer NOT NULL DEFAULT 1,
        "mimeType" character varying(64) NOT NULL DEFAULT 'application/pdf',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_books" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "student_favorites" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "studentId" uuid NOT NULL,
        "tutorId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_favorites" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_student_favorites_student_tutor" UNIQUE ("studentId", "tutorId")
      )
    `);

    const indexes: Array<[string, string, string]> = [
      ['tutor_availabilities', 'IDX_tutor_availabilities_tutorId', '("tutorId")'],
      ['lessons', 'IDX_lessons_tutorId', '("tutorId")'],
      ['lessons', 'IDX_lessons_studentId', '("studentId")'],
      ['classroom_messages', 'IDX_classroom_messages_lessonId', '("lessonId")'],
      ['classroom_messages', 'IDX_classroom_messages_senderId', '("senderId")'],
      ['payments', 'IDX_payments_userId', '("userId")'],
      ['messages', 'IDX_messages_senderId', '("senderId")'],
      ['messages', 'IDX_messages_receiverId', '("receiverId")'],
      ['notifications', 'IDX_notifications_userId', '("userId")'],
      ['courses', 'IDX_courses_tutorId', '("tutorId")'],
      ['course_lessons', 'IDX_course_lessons_courseId', '("courseId")'],
      ['course_enrollments', 'IDX_course_enrollments_studentId', '("studentId")'],
      ['course_enrollments', 'IDX_course_enrollments_courseId', '("courseId")'],
      [
        'course_lesson_completions',
        'IDX_course_lesson_completions_enrollmentId',
        '("enrollmentId")',
      ],
      [
        'course_lesson_completions',
        'IDX_course_lesson_completions_courseLessonId',
        '("courseLessonId")',
      ],
      ['reviews', 'IDX_reviews_studentId', '("studentId")'],
      ['reviews', 'IDX_reviews_tutorId', '("tutorId")'],
      ['reviews', 'IDX_reviews_lessonId', '("lessonId")'],
      [
        'teacher_training_articles',
        'IDX_teacher_training_articles_authorId',
        '("authorId")',
      ],
      ['reports', 'IDX_reports_userId', '("userId")'],
      ['reports', 'IDX_reports_lessonId', '("lessonId")'],
      ['vocabulary_words', 'IDX_vocabulary_words_userId', '("userId")'],
      ['payouts', 'IDX_payouts_tutorId', '("tutorId")'],
      ['course_promo_codes', 'IDX_course_promo_codes_tutorId', '("tutorId")'],
      ['course_promo_codes', 'IDX_course_promo_codes_courseId', '("courseId")'],
      ['lesson_books', 'IDX_lesson_books_lessonId', '("lessonId")'],
      ['student_favorites', 'IDX_student_favorites_studentId', '("studentId")'],
      ['student_favorites', 'IDX_student_favorites_tutorId', '("tutorId")'],
    ];

    for (const [table, name, columns] of indexes) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "${name}"
        ON "${table}" ${columns}
      `);
    }

    await ensureForeignKey(
      queryRunner,
      'tutor_profiles',
      'FK_tutor_profiles_user',
      'FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'student_profiles',
      'FK_student_profiles_user',
      'FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'sub_admin_profiles',
      'FK_sub_admin_profiles_user',
      'FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'tutor_availabilities',
      'FK_tutor_availabilities_tutor',
      'FOREIGN KEY ("tutorId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'lessons',
      'FK_lessons_tutor',
      'FOREIGN KEY ("tutorId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'lessons',
      'FK_lessons_student',
      'FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'classrooms',
      'FK_classrooms_lesson',
      'FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'classroom_messages',
      'FK_classroom_messages_lesson',
      'FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'classroom_messages',
      'FK_classroom_messages_sender',
      'FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'payments',
      'FK_payments_user',
      'FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'messages',
      'FK_messages_sender',
      'FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'messages',
      'FK_messages_receiver',
      'FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'notifications',
      'FK_notifications_user',
      'FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'courses',
      'FK_courses_tutor',
      'FOREIGN KEY ("tutorId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'course_lessons',
      'FK_course_lessons_course',
      'FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'course_enrollments',
      'FK_course_enrollments_student',
      'FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'course_enrollments',
      'FK_course_enrollments_course',
      'FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'course_lesson_completions',
      'FK_course_lesson_completions_enrollment',
      'FOREIGN KEY ("enrollmentId") REFERENCES "course_enrollments"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'course_lesson_completions',
      'FK_course_lesson_completions_lesson',
      'FOREIGN KEY ("courseLessonId") REFERENCES "course_lessons"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'reviews',
      'FK_reviews_student',
      'FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'reviews',
      'FK_reviews_tutor',
      'FOREIGN KEY ("tutorId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'reviews',
      'FK_reviews_lesson',
      'FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'teacher_training_articles',
      'FK_teacher_training_articles_author',
      'FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'reports',
      'FK_reports_user',
      'FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'reports',
      'FK_reports_lesson',
      'FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL',
    );
    await ensureForeignKey(
      queryRunner,
      'vocabulary_words',
      'FK_vocabulary_words_user',
      'FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'payouts',
      'FK_payouts_tutor',
      'FOREIGN KEY ("tutorId") REFERENCES "tutor_profiles"("userId") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'course_promo_codes',
      'FK_course_promo_codes_tutor',
      'FOREIGN KEY ("tutorId") REFERENCES "tutor_profiles"("userId") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'course_promo_codes',
      'FK_course_promo_codes_course',
      'FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'lesson_books',
      'FK_lesson_books_lesson',
      'FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'student_favorites',
      'FK_student_favorites_student',
      'FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'student_favorites',
      'FK_student_favorites_tutor',
      'FOREIGN KEY ("tutorId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'student_favorites',
      'lesson_books',
      'course_promo_codes',
      'payouts',
      'vocabulary_words',
      'reports',
      'teacher_training_articles',
      'reviews',
      'course_lesson_completions',
      'course_enrollments',
      'course_lessons',
      'courses',
      'notifications',
      'messages',
      'payments',
      'classroom_messages',
      'classrooms',
      'lessons',
      'tutor_availabilities',
      'sub_admin_profiles',
      'student_profiles',
      'tutor_profiles',
      'settings',
      'employees',
      'users',
    ];

    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }

    const enums = [
      'payouts_status_enum',
      'reviews_status_enum',
      'courses_status_enum',
      'tutor_profiles_status_enum',
      'payments_status_enum',
      'payments_method_enum',
      'lessons_status_enum',
      'users_role_enum',
    ];

    for (const enumName of enums) {
      await queryRunner.query(`DROP TYPE IF EXISTS "${enumName}" CASCADE`);
    }
  }
}
