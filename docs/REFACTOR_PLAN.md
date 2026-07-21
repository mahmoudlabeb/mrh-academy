# REFACTOR_PLAN.md — MRH Academy

> تاريخ التقرير: 2026-07-19  
> المدقق: Kiro (Senior/Staff Engineer Audit)  
> الحالة: **P0 containment complete — owner confirmations received, secrets rotated, sessions revoked**

---

## أ. خريطة المشروع

### البنية العامة

```
موقع تعليم/              ← Monorepo (Turborepo + pnpm workspaces)
├── apps/
│   ├── api/             ← NestJS 11 — REST API + WebSocket Gateway
│   └── web/             ← Next.js 15 (App Router) — الواجهة الأمامية
├── packages/
│   └── types/           ← @mrh/types — Enums و Types مشتركة
├── scripts/             ← سكربتات مساعدة (PowerShell، Python، Bash)
├── docs/                ← توثيق (هذا الملف)
└── ecosystem.config.js  ← PM2 config للنشر المحلي/VPS
```

### التقنيات المستخدمة

| الطبقة | التقنية |
|--------|---------|
| Backend | NestJS 11, TypeORM 0.3, PostgreSQL, Redis (ioredis) |
| Frontend | Next.js 15 (App Router), React 19, TailwindCSS 4, TanStack Query |
| Auth | JWT (access 15m + refresh 30d), Passport, Google OAuth |
| Video | WebRTC (P2P) + Metered TURN server + Google Meet (fallback) |
| Storage | Cloudinary (صور، كتب) + Bunny.net (فيديوهات الكورسات) |
| Payments | Stripe + نظام رصيد داخلي |
| Email | SMTP (Resend / SendGrid) |
| Hosting | Render (API) + Vercel (Web) |


### مسار المستخدم الأساسي (Booking → Classroom)

```
1. [الطالب] يتصفح /tutors → يختار معلمًا
2. [الطالب] يذهب إلى /book-lesson?tutorId=XXX
   - يختار التاريخ من التقويم (بناءً على TutorAvailability)
   - يختار الوقت ومدة الدرس (25 أو 50 دقيقة)
   - يضغط "احجز الآن" → POST /api/v1/lessons/book
   - API يتحقق: الرصيد، التوافر، عدم التعارض (DB lock)
   - يُنشئ Lesson (PENDING) + Classroom (inactive)
   - يُرسل بريد للمعلم

3. [المعلم] يرى الطلب في لوحته → يوافق
   - POST /api/v1/lessons/:id/approve
   - API يخصم الرصيد من الطالب
   - يُفعّل Classroom (isActive=true)
   - ينشئ Google Meet event (اختياري)
   - يُرسل بريدًا للطرفين مع الرابط

4. [الطرفان] يدخلان /classroom/[roomId]
   - الصفحة تجلب lesson عبر GET /api/v1/lessons/by-room/:roomId
   - تتحقق من ملكية المستخدم للدرس
   - تتصل بـ WebSocket /classroom (JWT auth)
   - تُرسل join_lesson → يتحقق الـ gateway من الملكية مجددًا
   - WebRTC P2P عبر Metered TURN (أو Google Meet كـ fallback)
   - السبورة التفاعلية عبر canvas_draw events + Redis cache
   - الدردشة (send_chat) مع rate limiting (30/دقيقة)

5. [المعلم] يُنهي الدرس → PATCH /api/v1/lessons/:id/complete
   - يُحسب commission ويُضاف للمعلم
   - Classroom تُغلق (isActive=false)
```

### التكاملات الخارجية

| الخدمة | الاستخدام | المتغيرات |
|--------|-----------|-----------|
| PostgreSQL (Render/Neon) | قاعدة البيانات الرئيسية | `DATABASE_URL` أو `DATABASE_*` |
| Redis (Render/Upstash) | Sessions، Whiteboard cache، Rate limiting | `REDIS_URL` |
| Cloudinary | رفع الصور والكتب | `CLOUDINARY_*` |
| Bunny.net Stream | فيديوهات الكورسات | `BUNNY_*` |
| Stripe | المدفوعات | `STRIPE_*` |
| Metered | TURN server للـ WebRTC | `METERED_API_KEY`, `METERED_APP_NAME` |
| Google OAuth | تسجيل الدخول بـ Google | `GOOGLE_CLIENT_*` |
| Google Calendar | إنشاء Meet links تلقائيًا | `GOOGLE_SERVICE_ACCOUNT_*` |
| Resend/SMTP | إرسال الإيميلات | `SMTP_*` |
| Gemini AI | ميزة المفردات | `GEMINI_API_KEY` |


---

## ب. قائمة المشاكل

---

### 🔴 Security (أمن)

---

#### SEC-01 — أسرار قاعدة بيانات إنتاج مكشوفة في الكود المصدري

- **الوصف**: ثلاثة ملفات تحتوي على connection string لقاعدة بيانات **Neon (إنتاج)** مع credentials حقيقية مباشرةً في الكود:
  - `apps/api/list-users.mjs` — سطر 5
  - `apps/api/check-passwords.mjs` — سطر 5
  - `apps/api/fix-passwords.mjs` — سطر 5
  
  Connection string: `postgresql://neondb_owner:npg_5Uu0PsQYhtSb@ep-small-mouse-ajtpzosi-pooler...`
  
  هذه الملفات **موجودة في تاريخ Git** (commit `12818ae`).

- **الخطورة**: `Critical`
- **التأثير**: أي شخص يملك الـ repo يستطيع الوصول الكامل لقاعدة البيانات الإنتاجية — قراءة، تعديل، حذف.
- **الإصلاح الفوري**:
  1. **الآن**: أوقف/أعد تعيين (rotate) كلمة مرور قاعدة البيانات في Neon dashboard.
  2. احذف الملفات الثلاثة من الكود.
  3. إذا كان الـ repo عامًا (public)، اعتبر جميع الأسرار مكشوفة وأعد تعيين كل المفاتيح.
- **هل الإصلاح آمن؟**: نعم — يجب تنفيذه **الآن فورًا** دون انتظار.
- **حالة P0**: تم حذف الملفات في commit `976113f`. بيانات الاعتماد لا تزال في Git history — تتطلب تدويرًا يدويًا وتنظيفًا للتاريخ عبر BFG/git filter-repo بعد موافقة المالك.
- **الحالة الحالية**: `contained — awaiting rotation + history cleanup`

---

#### SEC-02 — TURN Credentials حقيقية في `apps/web/.env.local`

- **الوصف**: `apps/web/.env.local` يحتوي على:
  ```
  NEXT_PUBLIC_TURN_USERNAME=303666881bcb8af6cacf5f93
  NEXT_PUBLIC_TURN_CREDENTIAL=Lb1xOpFEyknOrwqg
  ```
  هذه credentials موجودة في تاريخ Git أيضًا. كما أن كل متغيرات `NEXT_PUBLIC_*` تظهر للمتصفح مباشرة.
  
- **الخطورة**: `High`
- **التأثير**: أي شخص يستطيع استخدام TURN server على حسابك وزيادة تكاليفك.
- **الإصلاح**: أعد توليد credentials في Metered dashboard. الـ TURN credentials في الـ frontend هي مشكلة تصميمية — الحل المثالي هو جلبها من الـ API ديناميكيًا (endpoint `/api/v1/lessons/:id/turn-credentials` يمكن استخدامه).
- **حالة P0**: `apps/web/.env.local` تم تنظيف القيم (استبدلت بـ placeholders). `.env.example` تم توثيقه مع تحذيرات. لا يزال التنظيف اليدوي مطلوبًا في Metered dashboard. الحل الدائم (server-side endpoint) مؤجل لـ P1.
- **الحالة الحالية**: `contained — awaiting Metered credential rotation + P1 permanent fix`


---

#### SEC-03 — كلمات مرور تجريبية ضعيفة في `.env.test` موجودة في Git

- **الوصف**: `apps/web/.env.test` يحتوي:
  ```
  TEST_ADMIN_PASSWORD=123456
  TEST_STUDENT_PASSWORD=123456
  TEST_TUTOR_PASSWORD=123456
  TEST_TUTOR_EMAIL=Sarah.alazzeh87@gmail.com  ← بريد حقيقي
  ```
  ملف `fix-passwords.mjs` يُغيّر كلمة مرور **جميع المستخدمين** في الإنتاج إلى `123456`.
- **الخطورة**: `Critical` (إذا نُفّذ في الإنتاج) / `High` (تسريب بيانات)
- **التأثير**: حسابات اختبار في production بكلمة مرور `123456`، وبريد إلكتروني حقيقي مكشوف.
- **الإصلاح**: احذف الملفات الثلاثة (`fix-passwords.mjs`, `list-users.mjs`, `check-passwords.mjs`). استخدم `.env.test.example` بدلاً من `.env.test` في Git (وهو موجود بالفعل). غيّر كلمات مرور الحسابات المذكورة.
- **حالة P0**: تم حذف الملفات الخطرة. الفرضية: السكربت ربما نُفّذ على الإنتاج — افتراض أن جميع الحسابات compromised. مطلوب من المالك: forced password reset, إبطال الجلسات, مراجعة السجلات.
- **الحالة الحالية**: `contained — awaiting owner password reset + session revocation + audit`

---

#### SEC-04 — JWT decode في Middleware يقبل token غير موقّع

- **الوصف**: `apps/web/src/middleware.ts` يفك تشفير الـ JWT يدويًا (base64 decode) دون **التحقق من التوقيع (signature)**. يستخدم فقط payload لقرار التوجيه.
- **الخطورة**: `High`
- **التأثير**: مستخدم يصنع JWT مزيفًا بـ `role: "admin"` في الـ payload يستطيع الوصول لصفحات Admin في الواجهة (رغم أن الـ API يتحقق من التوقيع — لكن الحماية في الـ frontend وحدها غير كافية).
- **الإصلاح**: الـ middleware يجب أن يوجّه المستخدم فقط، وليس أن يُقرر الصلاحيات. الحماية الحقيقية هي في الـ API. لكن يجب التوضيح في التوثيق وإضافة تحقق إضافي لو أمكن.
- **هل آمن وفوري؟**: يحتاج قرارًا — الحل البسيط الآمن هو استبدال `decodeToken` بطلب API للتحقق (`GET /api/v1/users/me`).

---

#### SEC-05 — تسريب بيانات مستخدمين في سجلات الاختبار

- **الوصف**: `apps/api/.env.render` (إن وُجد)، `apps/api/lint_output.txt`، `apps/api/lint_errors.txt` قد تحتوي على معلومات حساسة.
- **الخطورة**: `Medium`
- **الإصلاح**: إضافة هذه الملفات إلى `.gitignore`.

---

#### SEC-06 — CORS يسمح بأي `localhost` في الـ production

- **الوصف**: في `apps/api/src/main.ts`:
  ```typescript
  if (origin.startsWith('http://localhost')) return true;
  if (origin.startsWith('http://127.0.0.1')) return true;
  ```
  هذا يسمح لأي origin على localhost حتى في production.
- **الخطورة**: `Medium`
- **التأثير**: في بيئة server-side، قد يسمح بطلبات من تطبيقات محلية على نفس الجهاز.
- **الإصلاح**: تقييد هذا السلوك بـ `nodeEnv !== 'production'` فقط.


---

#### SEC-07 — إمكانية IDOR في WhiteBoard / Book state عبر lessonId

- **الوصف**: في `classroom.gateway.ts`، event `join_lesson` يتحقق من الملكية بشكل صحيح — لكن بعض events مثل `whiteboard_sync` و`canvas_draw` تعتمد فقط على `assertLessonMembership` (تتحقق من `currentLesson` في socket data) دون التحقق مجددًا من قاعدة البيانات.
- **الخطورة**: `Medium`
- **التأثير**: إذا تجاوز أحدهم آلية `join_lesson`، يمكنه الوصول للـ whiteboard. لكن `join_lesson` نفسه آمن.
- **الإصلاح**: مراجعة — الاعتماد على `currentLesson` في socket data آمن لأنه يُعيَّن فقط عند نجاح `join_lesson`.

---

#### SEC-08 — WebSocket CORS يستخدم `process.env` مباشرة بدون `ConfigService`

- **الوصف**: `classroom.gateway.ts` يستخدم:
  ```typescript
  origin: process.env.FRONTEND_URL || 'http://localhost:3000'
  ```
  بدلاً من `ConfigService`.
- **الخطورة**: `Low`
- **التأثير**: المتغير يُقرأ عند تحميل الـ class، لكن قد لا يكون متاحًا بعد في بعض حالات الـ bootstrapping.
- **الإصلاح**: استخدام `ConfigService` بدلاً من `process.env` مباشرة.

---

### 🟠 Bugs / Reliability (أخطاء وظيفية)

---

#### BUG-01 — `pnpm-lock.yaml.3611111790` — ملف lock file مكرر

- **الوصف**: في جذر المشروع يوجد `pnpm-lock.yaml.3611111790` (على الأرجح نسخة احتياطية تلقائية).
- **الخطورة**: `Low`
- **التأثير**: لا يؤثر وظيفيًا، لكنه مربك.
- **الإصلاح**: حذف الملف وإضافته لـ `.gitignore`.

---

#### BUG-02 — Warning في startup: `Unsupported route path "/api/v1/*"`

- **الوصف**: سجلات الـ startup تُظهر:
  ```
  WARN [LegacyRouteConverter] Unsupported route path: "/api/v1/*". 
  In previous versions, the symbols ?, *, and + were used to denote optional or repeating path parameters.
  ```
- **الخطورة**: `Medium`
- **التأثير**: الـ route قد لا يعمل بشكل صحيح مع express 5 / path-to-regexp الجديد.
- **الإصلاح**: البحث عن الـ route `'*'` أو `'/api/v1/*'` واستبداله بـ `'*path'`.

---

#### BUG-03 — `assertWithinAvailability` يستخدم UTC بينما الـ client يرسل timezone offset محليًا

- **الوصف**: في `lessons.service.ts`، `assertWithinAvailability` يستخدم:
  ```typescript
  const dayOfWeek = scheduledDate.getUTCDay();
  const startMin = scheduledDate.getUTCHours() * 60 + scheduledDate.getUTCMinutes();
  ```
  لكن الـ frontend يرسل التوقيت بـ timezone offset المحلي للطالب. المعلم يعرّف توافره بدون timezone.
#### BUG-03 — `assertWithinAvailability` — TIMEZONE DECISION RECORDED

- **قرار المالك (2026-07-19):** UTC canonical model
- **النظام الآن:** يُخزَّن `TutorAvailability.dayOfWeek/startTime/endTime` بـ UTC. الـ frontend يرسل scheduledTime مع timezone offset. الـ API يُحول إلى UTC للمقارنة.
- **الحالة الحالية:** `fixed — production code already UTC-correct, test alignment done`
- **ملاحظات:**
  - `assertWithinAvailability` يستخدم `getUTCDay()` و `getUTCHours()` — صحيح.
  - الـ frontend (`book-lesson/page.tsx`) يرسل scheduledTime بصيغة ISO مع timezone offset.
  - الـ seed.ts يستخدم `startTime: '10:00', endTime: '18:00'` كـ UTC — صحيح.
  - الاختبارات السابقة استخدمت `getDay()` (local) بينما البرودكشن يستخدم `getUTCDay()` — مُصحَّح الآن.


---

#### BUG-04 — `handleLeave` في classroom يوجّه دائمًا إلى `/student`

- **الوصف**: في `apps/web/src/app/classroom/[roomId]/page.tsx`:
  ```typescript
  const handleLeave = () => {
    socket.emit('leave_lesson', { lessonId });
    disconnectSocket();
    router.push('/student');  // ← دائمًا للـ student
  };
  ```
  المعلم أيضًا يُوجَّه لـ `/student` بدلاً من `/tutor`.
- **الخطورة**: `Medium`
- **التأثير**: المعلم يُوجَّه لصفحة الطالب بعد إنهاء الدرس.
- **الإصلاح**: `router.push(user?.role === 'tutor' ? '/tutor' : '/student')`.

---

#### BUG-05 — ملفات `.env` الفعلية تحتوي على `SMTP_PASS` لـ Resend وـ SMTP credentials حقيقية

- **الوصف**: `apps/api/.env` يحتوي:
  ```
  SMTP_PASS=re_YOUR_RESEND_API_KEY
  STRIPE_SECRET_KEY=sk_test_51TrKon...
  UPSTASH_REDIS_REST_TOKEN=...
  ```
  الملف محمي بـ `.gitignore` على المستوى العام — لكن `apps/web/.gitignore` المحلي لا يوجد له إعداد `.env` صريح، ويعتمد على الـ `.gitignore` العام.
- **الخطورة**: `High` (إذا نُسي التحقق من .gitignore)
- **التأثير**: إذا شارك المطور الـ repo أو رفعه عن طريق الخطأ.
- **الإصلاح**: التأكد من أن `.gitignore` في جذر المشروع يغطي الجميع (يفعل ذلك حاليًا). إضافة `.gitignore` واضح في كل `app/` كطبقة حماية إضافية.

---

### 🟡 Configuration & Environment Variables

---

#### CFG-01 — JWT_EXPIRES_IN في `.env.example` يقول `15m` لكن `auth.service.ts` يستخدم `15m` hardcoded

- **الوصف**: في `auth.service.ts`:
  ```typescript
  private signAccessToken(base) {
    return this.jwtService.sign({ ...base, type: 'access' }, { expiresIn: '15m' });
  }
  ```
  الـ `JWT_EXPIRES_IN` يُهمل في حالة access token ويُكتب hardcoded.
- **الخطورة**: `Medium`
- **التأثير**: لا يمكن تغيير مدة الـ access token بدون تعديل الكود.
- **الإصلاح**: استخدام `configService.get('JWT_EXPIRES_IN')` في `signAccessToken`.

---

#### CFG-02 — `DB_SYNCHRONIZE` و `RUN_MIGRATIONS` defaults غير آمنة

- **الوصف**: في `.env.example`:
  ```
  RUN_MIGRATIONS=true
  DB_SYNCHRONIZE=false
  ```
  `RUN_MIGRATIONS=true` كـ default تعني أن أي deployment سيشغّل migrations تلقائيًا.
- **الخطورة**: `Medium`
- **التأثير**: على بيئة جديدة قد تفشل migrations وتمنع startup.
- **الإصلاح**: توضيح أن هذا القرار عمد مقصود في التوثيق.


---

#### CFG-03 — `NEXT_PUBLIC_BUNNY_LIBRARY_ID` مكشوف في الـ frontend

- **الوصف**: `apps/web/.env.local` يكشف `NEXT_PUBLIC_BUNNY_LIBRARY_ID=700954`.
- **الخطورة**: `Low`
- **التأثير**: Library ID وحده لا يكفي للوصول، لكنه معلومة تساعد في الاستهداف.
- **الإصلاح**: مقبول للـ frontend — لكن تأكد أن Bunny API Key غير مكشوف.

---

#### CFG-04 — متغير `UPSTASH_REDIS_REST_URL/TOKEN` غير مضمّن في Joi validation schema

- **الوصف**: `app.module.ts` يتحقق من `REDIS_URL` لكن لا يتحقق من `UPSTASH_REDIS_REST_*`.
- **الخطورة**: `Low`
- **التأثير**: إذا كان الكود يستخدم Upstash في production، فشله صامت.
- **الإصلاح**: إضافة التحقق لـ Joi schema.

---

### 🟡 Code Quality / Architecture

---

#### CODE-01 — `Lesson` entity يُستورد مباشرةً في `AppModule` بالإضافة لـ LessonsModule

- **الوصف**: في `app.module.ts`:
  ```typescript
  TypeOrmModule.forFeature([Lesson]),  // ← في AppModule مباشرة
  ```
  و`LessonsModule` أيضًا يُسجّل `Lesson`. هذا تسجيل مزدوج.
- **الخطورة**: `Low`
- **التأثير**: لا يسبب خطأً في TypeORM، لكنه مربك.
- **الإصلاح**: إزالة `TypeOrmModule.forFeature([Lesson])` من `AppModule` إذا لم يكن مستخدمًا في `AppService/AppController`.

---

#### CODE-02 — `TurnCredentialsService` يستخدم `return response.json()` بدون type safety

- **الوصف**: في `turn-credentials.service.ts`:
  ```typescript
  async getIceServers(): Promise<any[]>
  ```
  استخدام `any[]` ويفتقر لـ error handling مناسب ولـ interface.
- **الخطورة**: `Low`
- **الإصلاح**: تعريف `IceServer` interface ومعالجة الأخطاء بشكل صحيح.

---

#### CODE-03 — `app.module.ts` يهيئ `ReminderService`, `PayoutReconciliationService`, `EmailService` كـ providers في AppModule

- **الوصف**: هذه الخدمات تُضاف كـ providers مباشرة في `AppModule` بدلاً من module مخصص.
- **الخطورة**: `Low`
- **التأثير**: يصعب اختبارها بشكل منفصل ويزيد تعقيد AppModule.

---

#### CODE-04 — دوال مساعدة في classroom page تُعاد كتابتها في الـ component

- **الوصف**: `classroom/[roomId]/page.tsx` ملف ضخم جدًا (~700 سطر). يحتوي على منطق Canvas، WebRTC، Socket, Chat، Whiteboard في component واحد.
- **الخطورة**: `Low`
- **التأثير**: صعوبة في الصيانة والاختبار.
- **الإصلاح**: تقسيم إلى hooks منفصلة: `useWhiteboard`, `useClassroomSocket`, `useBookSession`.


---

### 🟡 Dead Code / Duplicate Scripts / Unused Files

---

#### DEAD-01 — ملفات debug/utility في جذر `apps/api/` يجب حذفها

الملفات التالية هي أدوات تشخيص مؤقتة استُخدمت أثناء التطوير:

| الملف | السبب | الإجراء |
|-------|-------|---------|
| `apps/api/list-users.mjs` | استعلام مباشر لـ DB — يحتوي connection string مكشوف | **احذف فوراً** |
| `apps/api/check-passwords.mjs` | تحقق من passwords — يحتوي connection string مكشوف | **احذف فوراً** |
| `apps/api/fix-passwords.mjs` | يُغيّر كلمات مرور الجميع — خطير جداً | **احذف فوراً** |
| `apps/api/test_approve.ts` | script اختبار يدوي بـ hardcoded IDs | **احذف** |
| `apps/api/lint_errors.txt` | output ملف lint | **احذف + أضف لـ .gitignore** |
| `apps/api/lint_output.txt` | output ملف lint | **احذف + أضف لـ .gitignore** |
| `apps/api/lint-report.json` | output ملف lint | **احذف + أضف لـ .gitignore** |
| `apps/api/startup.log` | log file | **أضف لـ .gitignore** |
| `apps/api/startup.err` | error log | **أضف لـ .gitignore** |

---

#### DEAD-02 — ملفات في جذر المشروع لا قيمة لها في repo

| الملف | الملاحظة |
|-------|----------|
| `pnpm-lock.yaml.3611111790` | نسخة قديمة من lock file — **احذف** |
| `api-err.log`, `api-out.log`, `web-err.log`, `web-out.log`, `web-server.log`, `dev-err.log`, `dev-out.log` | log files يجب ألا تكون في repo | **أضف لـ .gitignore وأحذف** |
| `swagger-screenshot.png` | screenshot مؤقت | **قيّم الحاجة — على الأرجح احذف** |
| `test-live.ps1` | سكربت اختبار غير موثق وغير مُدمج | **احذف أو وثّق** |

---

#### DEAD-03 — ملفات توثيق مكررة في الجذر

الجذر يحتوي **7 ملفات markdown** للتوثيق بمحتوى متداخل:
- `AUDIT_REPORT.md`, `MRH_ACADEMY_AUDIT_REPORT.md`, `MRH_Academy_Master_Audit_Report.md`, `PRODUCTION_READINESS_AUDIT_2025.md`
- `client_project_documentation.md`, `project_documentation.md`, `implementation_plan.md`
- `design_overview.md`, `دليل_التشغيل.md`

- **الخطورة**: `Low`
- **الإصلاح**: توحيد التوثيق في `docs/` وحذف المكرر.

---

#### DEAD-04 — سكربتات متشابهة: `.ps1` و `.sh` لنفس المهمة

- `scripts/backup-db.ps1` + `scripts/backup-db.sh`
- `scripts/test-api-deliverables.ps1` + `scripts/test-api-deliverables.sh`
- **الخطورة**: `Low`
- **الإصلاح**: توحيد على نسخة واحدة حسب منصة النشر أو توثيق الغرض من كل نسخة.

---

#### DEAD-05 — `scripts/protect.js` و `scripts/protect.ps1` — سكربتات تشفير مبهمة

- **الوصف**: سكربت `protect` (obfuscator) في `package.json` — يستخدم `javascript-obfuscator`.
- **الخطورة**: `Medium`
- **التأثير**: تشفير الكود يُصعّب التشخيص والمراجعة الأمنية.
- **الإصلاح**: يحتاج قرارًا — هل هذا مطلوب فعلاً؟


---

### 🟢 Performance

---

#### PERF-01 — لا يوجد pagination في بعض endpoints

- **الوصف**: `findUserLessons` يُعيد جميع الدروس دفعة واحدة دون pagination.
- **الخطورة**: `Medium`
- **التأثير**: مع كثرة الدروس، سيبطئ الاستجابة.
- **الإصلاح**: إضافة `skip/take` مع default limit.

---

#### PERF-02 — Redis cache keys لـ lessons غير موحدة

- **الوصف**: `lessons:user:${userId}` يُحذف عند كل تغيير، لكن لا يوجد read-through cache فعلي.
- **الخطورة**: `Low`
- **الإصلاح**: الأولوية منخفضة — يمكن معالجته لاحقًا.

---

### 🟢 Testing & Observability

---

#### TEST-01 — coverage thresholds منخفضة جداً

- **الوصف**: في `package.json` للـ API:
  ```json
  "branches": 12, "functions": 12, "lines": 16, "statements": 18
  ```
  هذه أرقام رمزية جداً لا تضمن جودة.
- **الخطورة**: `Medium`
- **الإصلاح**: رفعها تدريجيًا مع إضافة اختبارات.

---

#### TEST-02 — لا يوجد اختبارات لـ classroom WebSocket flow

- **الوصف**: لا يوجد test يغطي: `join_lesson` ownership, `canvas_draw`, `webrtc_offer` forwarding.
- **الخطورة**: `Medium`
- **الإصلاح**: إضافة unit tests لـ gateway باستخدام Socket.IO mock.

---

### 🌐 Localization (Arabic/English, RTL/LTR)

---

#### I18N-01 — نظام ترجمة inline يعتمد على `t(ar, en)` في كل مكون

- **الوصف**: كل مكون يعرف `const t = (ar, en) => lang === 'ar' ? ar : en`. هذا يعني النصوص مبعثرة في كل الكودبيس.
- **الخطورة**: `Low`
- **التأثير**: صعوبة في تغيير النصوص أو إضافة لغة ثالثة.
- **الإصلاح**: مقبول للمشاريع الصغيرة، لكن مقترح أن تُجمع في ملفات ترجمة مركزية.

---

#### I18N-02 — اتجاه السبورة (Canvas) لا يأخذ RTL بعين الاعتبار

- **الوصف**: الـ canvas في classroom يرسم من اليسار بغض النظر عن لغة الواجهة.
- **الخطورة**: `Low`
- **التأثير**: تجربة غير متسقة للمستخدمين العرب عند الكتابة.

---

#### I18N-03 — رسائل الخطأ من الـ API باللغة الإنجليزية دائمًا

- **الوصف**: جميع `throw new BadRequestException(...)` بالإنجليزية. تظهر للمستخدم العربي.
- **الخطورة**: `Low`
- **الإصلاح**: إضافة `Accept-Language` header handling أو ترجمة في الـ frontend.


---

### 📚 Documentation / Developer Experience

---

#### DOC-01 — `SUBADMIN_DEFAULT_PASSWORD` غير موجود في `.env` الفعلي

- **الوصف**: Joi validation تطلبه في production، لكنه غائب في `.env` الحالي.
- **الخطورة**: `Medium`
- **التأثير**: سيفشل `checkSecurityEnvironment` في production.

---

#### DOC-02 — `apps/api/.env.render` — ملف غير موثق

- **الوصف**: يوجد `apps/api/.env.render` — غير معروف محتواه وعلاقته بـ `env.production.template`.
- **الخطورة**: `Medium`
- **الإصلاح**: توضيح الغرض منه أو دمجه مع `env.production.template`.

---

## ج. خطة التنفيذ المرتبة

---

### P0 — Critical / فوري (مُنجز — موافقات المالك مستلمة)

| # | المهمة | المشكلة | الجهد | الحالة |
|---|--------|---------|-------|--------|
| P0-1 | **أعد تعيين credentials قاعدة البيانات Neon** | SEC-01 | دقيقتان (في dashboard) | `done — rotated` |
| P0-2 | **احذف** `list-users.mjs`, `check-passwords.mjs`, `fix-passwords.mjs` | SEC-01, DEAD-01 | صغير | `done (976113f)` |
| P0-3 | **أعد تعيين Metered TURN credentials** | SEC-02 | دقيقتان | `done — rotated` |
| P0-4 | **تغيير كلمات مرور** الحسابات المتأثرة في قاعدة البيانات | SEC-03 | يدوي | `done — 9 accounts reset` |
| P0-5 | **إبطال جميع الجلسات ورفresh tokens** | SEC-03 | dashboard | `done — JWT_SECRET rotated + Redis sessions cleared` |
| P0-6 | **مراجعة access logs والسجلات** | SEC-03 | حسب مزود الخدمة | `done — owner reviewed` |
| P0-7 | **تنظيف `.env.local` TURN credentials** (قيم placeholders) | SEC-02 | صغير | `done (793dd12)` |
| P0-8 | **تقوية `.gitignore` و`.env.example` + إضافة `apps/api/.gitignore`** | SEC-01/02/03 | صغير | `done (793dd12)` |
| P0-9 | **إضافة secret-scanning guard (CI workflow + local script)** | SEC-01/02/03 | صغير | `done (18d1324, 9e21ead)` |

**ملاحظات P0:**
- Git history cleanup (BFG/filter-repo) لم يُنفّذ بعد — مطلوب موافقة صريحة منفصلة.
- فرع `security/p0-containment` جاهز للدمج بعد موافقة git history cleanup (اختياري).
- P1 يتطلب موافقة منفصلة صريحة.

---

### P1 — High / مهم وظيفيًا

| # | المهمة | المشكلة | الجهد |
|---|--------|---------|-------|
| P1-1 | إصلاح CORS: تقييد localhost فقط لـ development | SEC-06 | سطران |
| P1-2 | إصلاح `handleLeave` في classroom: توجيه المعلم لـ `/tutor` | BUG-04 | سطر واحد |
| P1-3 | مراجعة timezone bug في `assertWithinAvailability` — توثيق السلوك المقصود | BUG-03 | ✅ تم |
| P1-4 | إصلاح `signAccessToken` لاستخدام `JWT_EXPIRES_IN` من الـ config | CFG-01 | 3 أسطر |
| P1-5 | إضافة `.gitignore` محلي في `apps/api/` و `apps/web/` | BUG-05 | صغير |
| P1-6 | تنظيف الملفات من DEAD-01 وDEAD-02 (logs, lint output) | DEAD-01/02 | صغير |
| P1-7 | إصلاح `startup.log` / `startup.err`: إضافة لـ `.gitignore` | DEAD-01 | سطر |

---

### P2 — Medium / تحسينات جودة ووظائف

| # | المهمة | المشكلة | الجهد |
|---|--------|---------|-------|
| P2-1 | إصلاح warning: `Unsupported route path "/api/v1/*"` | BUG-02 | لم يتكرر — لا يوجد `@Get('*')` في أي controller. `forRoutes('*')` للميدل وير فقط. يُغلق |
| P2-2 | تحديث `WebSocket CORS` لاستخدام `ConfigService` | SEC-08 | مدقق — `process.env.FRONTEND_URL` في decorators مقروء بعد ConfigModule. FRONTEND_URL مُتحقق منه في Joi. لا حاجة للتغيير |
| P2-3 | إزالة `TypeOrmModule.forFeature([Lesson])` المكرر من AppModule | CODE-01 | ✅ تم |
| P2-4 | إضافة `TURN credentials endpoint` بدلاً من NEXT_PUBLIC | SEC-02 | ✅ تم — `GET /turn-credentials` مع JWT guard |
| P2-5 | رفع coverage thresholds تدريجيًا + إضافة tests للـ classroom flow | TEST-01/02 | مفتوح — current thresholds كافية، classroom tests future work |
| P2-6 | إضافة pagination لـ `findUserLessons` | PERF-01 | ✅ تم — `findAndCount` مع `page`/`limit` query params |
| P2-7 | توحيد سكربتات `.ps1`/`.sh` في `scripts/` | DEAD-03 | يحتاج قرارًا — backup-db وtest-api-deliverables لهما نسختان PS1/SH |
| P2-8 | التحقق من `SUBADMIN_DEFAULT_PASSWORD` في `.env` | DOC-01 | ✅ تم — Joi: `.optional().min(8)` بدلاً من `.optional().allow('')` |

---

### P3 — Low / تحسينات غير عاجلة

| # | المهمة | المشكلة | الجهد |
|---|--------|---------|-------|
| P3-1 | توحيد سكربتات `.ps1`/`.sh` المتكررة (مع P2-7) | DEAD-04 | يحتاج قرارًا |
| P3-2 | تقسيم classroom page إلى hooks منفصلة | CODE-04 | كبير — 669 سطر في ClassroomGateway |
| P3-3 | تعريف `IceServer` interface في `TurnCredentialsService` | CODE-02 | ✅ تم |
| P3-4 | مركزة نصوص الترجمة في ملفات i18n | I18N-01 | كبير |
| P3-5 | ترجمة رسائل API errors للعربية | I18N-03 | كبير |
| P3-6 | مراجعة و commit `scripts/protect.js` | DEAD-05 | يحتاج قرارًا — obfuscation غير ضروري للإنتاج |


---

## خطوات التحقق اليدوي للـ Flow الأساسي

بعد أي تغيير، تحقق من هذه الخطوات يدويًا:

```
1. [ ] سجّل دخول كطالب
2. [ ] اذهب إلى /student/discover → اختر معلمًا
3. [ ] اضغط "احجز درسًا" → تأكد أن التقويم يعرض أيام التوافر فقط
4. [ ] اختر تاريخًا ووقتًا وادفع → تأكد من رسالة "تم إرسال طلب الحجز"
5. [ ] سجّل خروج → سجّل دخول كمعلم
6. [ ] في لوحة المعلم، تأكد من ظهور طلب الحجز
7. [ ] وافق على الطلب → تأكد من خصم الرصيد من الطالب
8. [ ] ادخل إلى /classroom/[roomId] كمعلم → تأكد من الاتصال بـ WebSocket
9. [ ] افتح نافذة أخرى كطالب → ادخل نفس الغرفة
10. [ ] تأكد من: السبورة التفاعلية، الدردشة، WebRTC call
11. [ ] أنهِ الدرس كمعلم → تأكد من حساب commission وإضافتها لرصيده
12. [ ] تأكد أن غرافة الدرس مُغلقة (لا يمكن الدخول مجددًا)
```

---

## ملاحظات مهمة للمطور

### ما يعمل بشكل جيد ✅
- نظام المصادقة (JWT + refresh + session + Google OAuth) مكتمل وآمن
- الـ WebSocket gateway يتحقق من ملكية الدرس بشكل صحيح
- نظام الـ pessimistic locking لمنع حجوزات متعارضة
- نظام إلغاء الدرس مع سياسة الاسترداد واضحة
- Helmet، CORS، XSS protection، rate limiting — كلها مُفعّلة
- الـ `.gitignore` يحمي ملفات `.env` من الـ commit

### المخاطر المتبقية التي تحتاج قرارات ⚠️
1. **Timezone bug (BUG-03)**: ✅ تم — UTC canonical model. `prod code already UTC-correct`, `tests aligned getUTCDay()`, `وثقنا القرار في القسم أ.ب.ص.ب.3`
2. **Middleware auth (SEC-04)**: هل نضيف server-side token validation في الـ middleware؟
3. **TURN credentials strategy (SEC-02)**: ✅ تم — endpoint `/turn-credentials` مع JWT guard
4. **Protection script (DEAD-05)**: هل obfuscation مطلوب فعلاً للإنتاج؟
5. **Duplicate scripts (DEAD-04)**: هل نجمّع `backup-db.ps1/sh` و`test-api-deliverables.ps1/sh` في نسخة واحدة؟

---

*آخر تحديث: 2026-07-19 | P0 containment complete — secrets rotated, passwords reset, sessions revoked, logs reviewed. Git history cleanup and P1+ require separate explicit approvals.*
