# دليل تشغيل wweb-mcp على Dokploy

هذا الدليل يشرح كيفية تشغيل wweb-mcp على Dokploy باستخدام docker-compose.

## المتطلبات

- Dokploy مثبت ومشغل
- وصول SSH إلى السيرفر (إذا كان Dokploy على سيرفر)

## خطوات التثبيت

### 1. إعداد المشروع في Dokploy

1. افتح Dokploy Dashboard
2. اذهب إلى **Projects** → **New Project**
3. اختر **Docker Compose** كطريقة النشر
4. اربط المستودع (Repository) أو ارفع ملفات المشروع

### 2. إعداد متغيرات البيئة

في صفحة إعدادات المشروع، أضف المتغيرات التالية:

#### متغيرات الويبهوك (مطلوبة)

```
WEBHOOK_URL=https://your-server.com/webhook/incoming
WEBHOOK_AUTH_TOKEN=your-secret-token-here
```

#### متغيرات الويبهوك (اختيارية)

```
WEBHOOK_ALLOWED_NUMBERS=+1234567890,+0987654321
WEBHOOK_ALLOW_PRIVATE=true
WEBHOOK_ALLOW_GROUPS=true
```

#### متغيرات التطبيق

```
MODE=mcp
MCP_MODE=standalone
TRANSPORT=sse
SSE_PORT=3002
AUTH_STRATEGY=local
LOG_LEVEL=info
```

### 3. إعداد docker-compose.yml

استخدم ملف `docker-compose.yml` الموجود في المشروع. تأكد من:

- المنفذ متطابق مع `SSE_PORT`
- Volume `wweb-auth` محفوظ بشكل دائم

### 4. تشغيل المشروع

1. اضغط **Deploy** في Dokploy
2. انتظر حتى يكتمل البناء والتشغيل
3. راجع الـ Logs لرؤية QR Code للمصادقة

## المصادقة الأولية

عند أول تشغيل:

1. افتح Logs في Dokploy
2. ستجد QR Code مطبوع في الـ Logs
3. امسح QR Code بهاتفك عبر تطبيق WhatsApp
4. بعد المصادقة، سيتم حفظ البيانات في Volume `wweb-auth`

## متغيرات البيئة المتاحة

### متغيرات الويبهوك

| المتغير | الوصف | مطلوب | القيمة الافتراضية |
|---------|-------|-------|-------------------|
| `WEBHOOK_URL` | رابط الويبهوك لإرسال الرسائل الواردة | نعم | - |
| `WEBHOOK_AUTH_TOKEN` | Token للمصادقة في طلبات الويبهوك | لا | - |
| `WEBHOOK_ALLOWED_NUMBERS` | قائمة الأرقام المسموحة (مفصولة بفواصل) | لا | - |
| `WEBHOOK_ALLOW_PRIVATE` | السماح بالرسائل الخاصة | لا | `true` |
| `WEBHOOK_ALLOW_GROUPS` | السماح برسائل المجموعات | لا | `true` |

### متغيرات التطبيق

| المتغير | الوصف | القيم المتاحة | القيمة الافتراضية |
|---------|-------|--------------|-------------------|
| `MODE` | وضع التشغيل | `mcp`, `whatsapp-api` | `mcp` |
| `MCP_MODE` | وضع اتصال MCP | `standalone`, `api` | `standalone` |
| `TRANSPORT` | طريقة النقل | `sse`, `command` | `sse` |
| `SSE_PORT` | منفذ SSE | أي رقم | `3002` |
| `AUTH_STRATEGY` | استراتيجية المصادقة | `local`, `none` | `local` |
| `LOG_LEVEL` | مستوى السجلات | `error`, `warn`, `info`, `http`, `debug` | `info` |

## مثال على إعدادات Dokploy

### Environment Variables في Dokploy:

```
WEBHOOK_URL=https://api.example.com/webhook
WEBHOOK_AUTH_TOKEN=my-secret-token-12345
WEBHOOK_ALLOW_PRIVATE=true
WEBHOOK_ALLOW_GROUPS=false
MODE=mcp
MCP_MODE=standalone
TRANSPORT=sse
SSE_PORT=3002
AUTH_STRATEGY=local
LOG_LEVEL=info
```

## استكشاف الأخطاء

### المشكلة: لا يتم حفظ المصادقة

**الحل**: تأكد من أن Volume `wweb-auth` محفوظ بشكل دائم في Dokploy.

### المشكلة: الويبهوك لا يعمل

**الحل**: 
1. تأكد من أن `WEBHOOK_URL` مضبوط بشكل صحيح
2. تحقق من أن السيرفر المستلم للويبهوك متاح من الإنترنت
3. راجع Logs للبحث عن أخطاء

### المشكلة: QR Code لا يظهر

**الحل**:
1. تأكد من أن `LOG_LEVEL=info` أو `LOG_LEVEL=debug`
2. راجع Logs في Dokploy
3. تأكد من أن Container يعمل بشكل صحيح

## ملاحظات مهمة

1. **حفظ البيانات**: البيانات محفوظة في Volume `wweb-auth`، لذا لن تحتاج لمسح QR Code مرة أخرى بعد المصادقة الأولى
2. **الأمان**: استخدم `WEBHOOK_AUTH_TOKEN` قوي لحماية الويبهوك
3. **المنافذ**: تأكد من فتح المنفذ المحدد في `SSE_PORT` في Firewall
4. **الموارد**: تأكد من تخصيص موارد كافية للـ Container (خاصة الذاكرة)

## الدعم

للمزيد من المعلومات، راجع:
- [README.md](README.md)
- [GitHub Repository](https://github.com/pnizer/wweb-mcp)

