# دليل إعداد MRH Academy على جهاز جديد

هذا الدليل مخصص لـ Windows وPowerShell، ويمكن تنفيذ الخطوات نفسها على Linux/macOS باستبدال `pnpm.cmd` بـ `pnpm`.

## المتطلبات

- Node.js 24 أو أحدث.
- PostgreSQL 15 أو أحدث، محلياً أو عبر رابط `DATABASE_URL`.
- Redis محلي أو خدمة Redis متوافقة.
- Git وPowerShell على Windows.

## 1. تثبيت pnpm والحزم

من جذر المشروع افتح PowerShell ونفّذ:

```powershell
corepack enable
corepack prepare pnpm@11.0.0 --activate
pnpm.cmd install --frozen-lockfile
```

تحقق من الإصدارات:

```powershell
node --version
pnpm.cmd --version
```

يجب أن يكون Node بالإصدار 24 أو أحدث وpnpm بالإصدار 11.

## 2. إنشاء ملفات البيئة

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

إن لم يوجد `apps/web/.env.example`، أنشئ `apps/web/.env.local` وضع فيه:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

عدّل `apps/api/.env`، ويجب على الأقل ضبط PostgreSQL وRedis وJWT:

```env
DATABASE_URL=postgresql://mrh_admin:your_password@localhost:5432/mrh_academy_db
DATABASE_SSL=false
REDIS_URL=redis://localhost:6379
JWT_SECRET=ضع_هنا_قيمة_عشوائية_من_64_حرفاً_على_الأقل
FRONTEND_URL=http://localhost:3000
GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/callback
```

لتوليد `JWT_SECRET` آمن:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

لا ترفع ملفات `.env` إلى Git، ولا تستخدم كلمة مرور ثابتة مثل `123456`.

## 3. إنشاء قاعدة البيانات وتشغيل الترحيلات

أنشئ قاعدة PostgreSQL باسم `mrh_academy_db`، ثم من جذر المشروع نفّذ:

```powershell
pnpm.cmd --filter @mrh/api migration:run
pnpm.cmd --filter @mrh/api migration:validate
```

بيانات العرض اختيارية وممنوعة في بيئة الإنتاج. لاستخدامها محلياً فقط، ضع كلمة مرور قوية من 15 حرفاً أو أكثر في `DEMO_SEED_PASSWORD` ثم نفّذ:

```powershell
pnpm.cmd --filter @mrh/api db:seed:demo
```

## 4. تشغيل المشروع

تأكد أولاً أن PostgreSQL وRedis يعملان، ثم نفّذ:

```powershell
pnpm.cmd dev
```

- الموقع: `http://localhost:3000`
- واجهة API: `http://localhost:4000/api/v1`
- فحص الصحة: `http://localhost:4000/api/v1/health`

## 5. التحقق قبل التسليم

```powershell
pnpm.cmd format:check
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
pnpm.cmd --filter @mrh/api test:e2e
```

اختبار الجاهزية المحلي على Windows:

```powershell
pnpm.cmd test:local
```

## 6. الخدمات الخارجية المطلوبة للإنتاج

يجب إدخال مفاتيح حقيقية قبل اختبار الميزات المرتبطة بها:

- Google OAuth وGoogle Calendar/Meet.
- Stripe مع `STRIPE_WEBHOOK_SECRET`.
- PayPal مع `PAYPAL_CLIENT_ID` و`PAYPAL_CLIENT_SECRET` وتغيير `PAYPAL_BASE_URL` إلى `https://api-m.paypal.com` للإنتاج.
- Bunny Stream لحماية الفيديو.
- Cloudinary أو مخزن الملفات المعتمد.
- SMTP للبريد.
- Metered لخوادم TURN عند الحاجة.

إذا كانت أي خدمة غير مهيأة، يفشل المسار المرتبط بها بشكل آمن ولا يضيف رصيداً أو ينشئ رابطاً وهمياً.

## 7. النسخ الاحتياطي

نفّذ نسخة احتياطية يدوية للتأكد من صلاحية إعداد PostgreSQL:

```powershell
pnpm.cmd db:backup
```

في الإنتاج يجب أيضاً جدولة الأمر يومياً عبر Task Scheduler على Windows أو Cron في Linux، مع حفظ النسخ في موقع منفصل ومشفّر واختبار الاستعادة دورياً.

## مشكلات Windows الشائعة

- استخدم `pnpm.cmd` داخل PowerShell إذا منعت سياسة التنفيذ ملف `pnpm.ps1`.
- تجنب تشغيل المشروع من مسار متزامن مع OneDrive.
- إذا كان المنفذ مستخدماً: `Get-NetTCPConnection -LocalPort 3000,4000`.
- تأكد أن خدمة PostgreSQL وRedis تعمل قبل تشغيل API.
- بعد تغيير `.env` أوقف الخادم وأعد تشغيله؛ التغييرات لا تُحمّل تلقائياً دائماً.
