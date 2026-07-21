# دليل إعداد MRH Academy

> دليل التثبيت والتشغيل باللغة العربية

## المتطلبات

- Node.js 18 أو أحدث
- pnpm
- PostgreSQL
- Redis

## خطوات التثبيت

### 1. تثبيت الحزم

```bash
pnpm install
```

### 2. إعداد المتغيرات البيئية

انسخ ملف `.env.example` إلى `.env` في جذر المشروع وعدّل:

| المتغير             | الوصف                                        |
| ------------------- | -------------------------------------------- |
| `DATABASE_URL`      | رابط PostgreSQL                              |
| `REDIS_URL`         | رابط Redis                                   |
| `JWT_SECRET`        | مفتاح سري عشوائي قوي (64+ حرف)               |
| `FRONTEND_URL`      | رابط الواجهة (مثال: `http://localhost:3000`) |
| `ADMIN_EMAILS`      | بريد المدير                                  |
| `GEMINI_API_KEY`    | لميزة المفردات الذكية                        |
| `STRIPE_SECRET_KEY` | للدفع بالبطاقة                               |

### 3. قاعدة البيانات

```bash
cd apps/api
pnpm run migration:run
pnpm run seed
```

### 4. تشغيل المشروع

```bash
pnpm run dev
```

- الواجهة: http://localhost:3000
- الـ API: http://localhost:4000

## حسابات تجريبية

لا تستخدم كلمة مرور ثابتة أو `123456`. عيّن `DEMO_SEED_PASSWORD` محلياً إلى
كلمة مرور قوية وعشوائية، ولا تضعها في Git أو في مستندات التسليم.

| الدور | البريد                    |
| ----- | ------------------------- |
| مدير  | admin@mrhacademy.com      |
| معلم  | Sarah.alazzeh87@gmail.com |
| طالب  | student@demo.com          |

## النشر للإنتاج

```bash
pnpm build
pm2 start ecosystem.config.js --env production
```

### نسخ احتياطي لقاعدة البيانات

```powershell
.\scripts\backup-db.ps1
```

### HTTPS (Let's Encrypt)

1. ثبّت Certbot على الخادم
2. احصل على شهادة لنطاقك
3. اضبط `FRONTEND_URL` و `GOOGLE_CALLBACK_URL` على `https://`

## التحقق من التكاملات

```bash
curl http://localhost:4000/api/v1/health/integrations
```

## الدعم

- الوثائق الإنجليزية: [README.md](../README.md)
- تقرير التسليم: [DELIVERY_REPORT.md](../DELIVERY_REPORT.md)
