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

export class InitialSchema0000000000000 implements MigrationInterface {
  name = 'InitialSchema0000000000000';

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
      'pending',
      'success',
      'failed',
    ]);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "password_hash" character varying,
        "role" "users_role_enum" NOT NULL DEFAULT 'student',
        "first_name" character varying NOT NULL,
        "last_name" character varying NOT NULL,
        "phone" character varying,
        "timezone" character varying NOT NULL DEFAULT 'Africa/Cairo',
        "google_id" character varying,
        "avatar_url" character varying,
        "is_verified" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "notification_preferences" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employees" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "email" character varying NOT NULL,
        "role_title" character varying NOT NULL,
        "permissions" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_employees" PRIMARY KEY ("id"),
        CONSTRAINT "uq_employees_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "settings" (
        "key" character varying NOT NULL,
        "value" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_settings" PRIMARY KEY ("key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tutor_profiles" (
        "user_id" uuid NOT NULL,
        "bio" character varying NOT NULL,
        "specialization" character varying NOT NULL,
        "languages" text array NOT NULL,
        "hourly_rate" numeric(10,2) NOT NULL,
        "balance" numeric(10,2) NOT NULL DEFAULT 0,
        "total_hours_taught" numeric(10,2) NOT NULL DEFAULT 0,
        "status" "tutor_profiles_status_enum" NOT NULL DEFAULT 'pending',
        "rejection_reason" character varying,
        "video_url" character varying,
        "document_url" character varying,
        "stripe_account_id" character varying,
        "stripe_onboarding_complete" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_tutor_profiles" PRIMARY KEY ("user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "student_profiles" (
        "user_id" uuid NOT NULL,
        "balance" numeric(10,2) NOT NULL DEFAULT 0,
        "preferred_language" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_student_profiles" PRIMARY KEY ("user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sub_admin_profiles" (
        "user_id" uuid NOT NULL,
        "assigned_permissions" text array NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_sub_admin_profiles" PRIMARY KEY ("user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tutor_availabilities" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutor_id" uuid NOT NULL,
        "day_of_week" integer NOT NULL,
        "start_time" TIME NOT NULL,
        "end_time" TIME NOT NULL,
        "is_recurring" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_tutor_availabilities" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lessons" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutor_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "scheduled_time" TIMESTAMP NOT NULL,
        "end_time" TIMESTAMP NOT NULL,
        "duration_minutes" integer NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "platform_fee" numeric(10,2),
        "status" "lessons_status_enum" NOT NULL DEFAULT 'pending',
        "meet_url" character varying,
        "google_meet_url" character varying,
        "calendar_event_id" character varying,
        "notes" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_lessons" PRIMARY KEY ("id"),
        CONSTRAINT "chk_lessons_duration_minutes" CHECK ("duration_minutes" IN (25, 50))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "classrooms" (
        "lesson_id" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT false,
        "started_at" TIMESTAMP,
        "ended_at" TIMESTAMP,
        "whiteboard_snapshot" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_classrooms" PRIMARY KEY ("lesson_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "classroom_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "lesson_id" uuid NOT NULL,
        "sender_id" uuid NOT NULL,
        "content" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_classroom_messages" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "method" "payments_method_enum" NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'USD',
        "status" "payments_status_enum" NOT NULL DEFAULT 'pending',
        "receipt_url" character varying,
        "idempotency_key" character varying,
        "admin_note" character varying,
        "rejection_reason" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_payments" PRIMARY KEY ("id"),
        CONSTRAINT "uq_payments_idempotency_key" UNIQUE ("idempotency_key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_method_configs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "type" character varying(50) NOT NULL,
        "label" character varying(100) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "details" text,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_payment_method_configs_type" UNIQUE ("type"),
        CONSTRAINT "pk_payment_method_configs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "processed_webhook_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" character varying(255) NOT NULL,
        "event_type" character varying(100) NOT NULL,
        "processed_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_processed_webhook_events_event_id" UNIQUE ("event_id"),
        CONSTRAINT "pk_processed_webhook_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "sender_id" uuid NOT NULL,
        "receiver_id" uuid NOT NULL,
        "content" character varying NOT NULL,
        "is_read" boolean NOT NULL DEFAULT false,
        "is_system_message" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_messages" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "type" character varying NOT NULL,
        "title" character varying NOT NULL,
        "body" character varying NOT NULL,
        "is_read" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_notifications" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutor_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "description" character varying NOT NULL,
        "thumbnail_url" character varying,
        "price" numeric(10,2) NOT NULL,
        "bunny_video_id" character varying,
        "sold_by" character varying NOT NULL DEFAULT 'academy',
        "status" "courses_status_enum" NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_courses" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_lessons" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "course_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "video_asset_id" text NOT NULL,
        "duration_minutes" integer NOT NULL,
        "lesson_order" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_course_lessons" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_enrollments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "student_id" uuid NOT NULL,
        "course_id" uuid NOT NULL,
        "platform_fee" numeric(10,2),
        "tutor_share" numeric(10,2),
        "sold_by" character varying(10) NOT NULL DEFAULT 'academy',
        "referral_tutor_id" character varying,
        "progress_percentage" integer NOT NULL DEFAULT 0,
        "enrolled_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_course_enrollments" PRIMARY KEY ("id"),
        CONSTRAINT "uq_course_enrollments_student_course" UNIQUE ("student_id", "course_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_lesson_completions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "enrollment_id" uuid NOT NULL,
        "course_lesson_id" uuid NOT NULL,
        "completed_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_course_lesson_completions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_course_lesson_completions_enrollment_lesson" UNIQUE ("enrollment_id", "course_lesson_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reviews" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "student_id" uuid NOT NULL,
        "tutor_id" uuid NOT NULL,
        "lesson_id" uuid NOT NULL,
        "rating" integer NOT NULL,
        "comment" text,
        "status" "reviews_status_enum" NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "uq_reviews_lesson_id" UNIQUE ("lesson_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teacher_training_articles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" character varying NOT NULL,
        "cover_image_url" character varying,
        "content" text NOT NULL,
        "author_id" uuid NOT NULL,
        "is_published" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_teacher_training_articles" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "lesson_id" uuid,
        "issue_type" character varying NOT NULL,
        "description" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_reports" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vocabulary_words" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "word" character varying NOT NULL,
        "definition" text NOT NULL,
        "examples" text,
        "translation" text,
        "language" character varying NOT NULL DEFAULT 'en',
        "context_sentence" text,
        "saved_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_vocabulary_words" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payouts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutor_id" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "status" "payouts_status_enum" NOT NULL DEFAULT 'pending',
        "method" character varying(50),
        "account_details" text,
        "admin_note" text,
        "stripe_payout_id" character varying,
        "error_message" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_payouts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_promo_codes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutor_id" uuid NOT NULL,
        "course_id" uuid NOT NULL,
        "code" character varying NOT NULL,
        "usage_limit" integer NOT NULL DEFAULT 100,
        "current_uses" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_course_promo_codes" PRIMARY KEY ("id"),
        CONSTRAINT "uq_course_promo_codes_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_books" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "lesson_id" uuid NOT NULL,
        "uploaded_by" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "cloudinary_public_id" character varying NOT NULL,
        "page_count" integer NOT NULL DEFAULT 1,
        "mime_type" character varying(64) NOT NULL DEFAULT 'application/pdf',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_lesson_books" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "student_favorites" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "student_id" uuid NOT NULL,
        "tutor_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_student_favorites" PRIMARY KEY ("id"),
        CONSTRAINT "uq_student_favorites_student_tutor" UNIQUE ("student_id", "tutor_id")
      )
    `);

    const indexes: Array<[string, string, string]> = [
      [
        'tutor_availabilities',
        'idx_tutor_availabilities_tutor_id',
        '("tutor_id")',
      ],
      ['lessons', 'idx_lessons_tutor_id', '("tutor_id")'],
      ['lessons', 'idx_lessons_student_id', '("student_id")'],
      [
        'classroom_messages',
        'idx_classroom_messages_lesson_id',
        '("lesson_id")',
      ],
      [
        'classroom_messages',
        'idx_classroom_messages_sender_id',
        '("sender_id")',
      ],
      ['payments', 'idx_payments_user_id', '("user_id")'],
      ['messages', 'idx_messages_sender_id', '("sender_id")'],
      ['messages', 'idx_messages_receiver_id', '("receiver_id")'],
      ['notifications', 'idx_notifications_user_id', '("user_id")'],
      ['courses', 'idx_courses_tutor_id', '("tutor_id")'],
      ['course_lessons', 'idx_course_lessons_course_id', '("course_id")'],
      [
        'course_enrollments',
        'idx_course_enrollments_student_id',
        '("student_id")',
      ],
      [
        'course_enrollments',
        'idx_course_enrollments_course_id',
        '("course_id")',
      ],
      [
        'course_lesson_completions',
        'idx_course_lesson_completions_enrollment_id',
        '("enrollment_id")',
      ],
      [
        'course_lesson_completions',
        'idx_course_lesson_completions_course_lesson_id',
        '("course_lesson_id")',
      ],
      ['reviews', 'idx_reviews_student_id', '("student_id")'],
      ['reviews', 'idx_reviews_tutor_id', '("tutor_id")'],
      ['reviews', 'idx_reviews_lesson_id', '("lesson_id")'],
      [
        'teacher_training_articles',
        'idx_teacher_training_articles_author_id',
        '("author_id")',
      ],
      ['reports', 'idx_reports_user_id', '("user_id")'],
      ['reports', 'idx_reports_lesson_id', '("lesson_id")'],
      ['vocabulary_words', 'idx_vocabulary_words_user_id', '("user_id")'],
      ['payouts', 'idx_payouts_tutor_id', '("tutor_id")'],
      ['course_promo_codes', 'idx_course_promo_codes_tutor_id', '("tutor_id")'],
      [
        'course_promo_codes',
        'idx_course_promo_codes_course_id',
        '("course_id")',
      ],
      ['lesson_books', 'idx_lesson_books_lesson_id', '("lesson_id")'],
      [
        'student_favorites',
        'idx_student_favorites_student_id',
        '("student_id")',
      ],
      ['student_favorites', 'idx_student_favorites_tutor_id', '("tutor_id")'],
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
      'fk_tutor_profiles_user',
      'FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'student_profiles',
      'fk_student_profiles_user',
      'FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'sub_admin_profiles',
      'fk_sub_admin_profiles_user',
      'FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'tutor_availabilities',
      'fk_tutor_availabilities_tutor',
      'FOREIGN KEY ("tutor_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'lessons',
      'fk_lessons_tutor',
      'FOREIGN KEY ("tutor_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'lessons',
      'fk_lessons_student',
      'FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'classrooms',
      'fk_classrooms_lesson',
      'FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'classroom_messages',
      'fk_classroom_messages_lesson',
      'FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'classroom_messages',
      'fk_classroom_messages_sender',
      'FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'payments',
      'fk_payments_user',
      'FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'messages',
      'fk_messages_sender',
      'FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'messages',
      'fk_messages_receiver',
      'FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'notifications',
      'fk_notifications_user',
      'FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'courses',
      'fk_courses_tutor',
      'FOREIGN KEY ("tutor_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'course_lessons',
      'fk_course_lessons_course',
      'FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'course_enrollments',
      'fk_course_enrollments_student',
      'FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'course_enrollments',
      'fk_course_enrollments_course',
      'FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'course_lesson_completions',
      'fk_course_lesson_completions_enrollment',
      'FOREIGN KEY ("enrollment_id") REFERENCES "course_enrollments"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'course_lesson_completions',
      'fk_course_lesson_completions_lesson',
      'FOREIGN KEY ("course_lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'reviews',
      'fk_reviews_student',
      'FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'reviews',
      'fk_reviews_tutor',
      'FOREIGN KEY ("tutor_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'reviews',
      'fk_reviews_lesson',
      'FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'teacher_training_articles',
      'fk_teacher_training_articles_author',
      'FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'reports',
      'fk_reports_user',
      'FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'reports',
      'fk_reports_lesson',
      'FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL',
    );
    await ensureForeignKey(
      queryRunner,
      'vocabulary_words',
      'fk_vocabulary_words_user',
      'FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'payouts',
      'fk_payouts_tutor',
      'FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("user_id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'course_promo_codes',
      'fk_course_promo_codes_tutor',
      'FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("user_id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'course_promo_codes',
      'fk_course_promo_codes_course',
      'FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'lesson_books',
      'fk_lesson_books_lesson',
      'FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'student_favorites',
      'fk_student_favorites_student',
      'FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
    await ensureForeignKey(
      queryRunner,
      'student_favorites',
      'fk_student_favorites_tutor',
      'FOREIGN KEY ("tutor_id") REFERENCES "users"("id") ON DELETE CASCADE',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'processed_webhook_events',
      'payment_method_configs',
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
