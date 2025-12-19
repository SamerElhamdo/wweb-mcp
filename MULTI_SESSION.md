# دليل الجلسات المتعددة مع MongoDB

هذا الدليل يشرح كيفية استخدام النظام مع دعم عدة جلسات WhatsApp باستخدام MongoDB.

## المميزات

- ✅ **عدة جلسات متزامنة**: إدارة عدة حسابات WhatsApp في نفس الوقت
- ✅ **MongoDB Storage**: تخزين الجلسات في MongoDB بشكل آمن
- ✅ **واجهة ويب**: واجهة بسيطة لإدارة الجلسات
- ✅ **QR Code**: عرض QR Code لكل جلسة في الواجهة
- ✅ **إدارة كاملة**: إضافة، حذف، ومتابعة حالة الجلسات

## المتطلبات

- MongoDB (محلي أو سحابي)
- Node.js 20+
- Docker (اختياري)

## التثبيت

### 1. تثبيت Dependencies

```bash
npm install
```

### 2. إعداد MongoDB

#### خيار 1: MongoDB محلي

```bash
# باستخدام Docker
docker run -d \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  --name mongodb \
  mongo:7
```

#### خيار 2: MongoDB Atlas (سحابي)

استخدم connection string من MongoDB Atlas.

## الاستخدام

### 1. تشغيل مع Docker Compose

```bash
# استخدام docker-compose.mongodb.yml
docker-compose -f docker-compose.mongodb.yml up -d
```

### 2. تشغيل محلي

```bash
# تشغيل مع MongoDB
npm start -- \
  --mode whatsapp-api \
  --api-port 3001 \
  --mongo-uri mongodb://admin:password@localhost:27017/whatsapp_sessions?authSource=admin \
  --enable-sessions
```

### 3. الوصول للواجهة

افتح المتصفح على: `http://localhost:3001`

## متغيرات البيئة

### MongoDB

```
MONGO_URI=mongodb://admin:password@mongodb:27017/whatsapp_sessions?authSource=admin
```

### التطبيق

```
MODE=whatsapp-api
ENABLE_SESSIONS=true
API_PORT=3001
```

## استخدام الواجهة

### إضافة جلسة جديدة

1. افتح `http://localhost:3001`
2. أدخل معرف الجلسة (مثال: `session1`, `user1`)
3. اضغط "إنشاء جلسة"
4. امسح QR Code بهاتفك

### إدارة الجلسات

- **عرض جميع الجلسات**: تظهر تلقائياً في الصفحة
- **حذف جلسة**: اضغط "حذف" على الجلسة
- **تحديث الحالة**: اضغط "تحديث" أو انتظر التحديث التلقائي (كل 5 ثوان)

## API Endpoints

### إدارة الجلسات

```
GET    /api/sessions              # قائمة جميع الجلسات
GET    /api/sessions/:sessionId   # معلومات جلسة محددة
POST   /api/sessions              # إنشاء جلسة جديدة
DELETE /api/sessions/:sessionId   # حذف جلسة
GET    /api/sessions/:sessionId/qr # QR Code للجلسة
```

### استخدام API مع جلسة محددة

```
GET /api/contacts?sessionId=session1
POST /api/send
{
  "sessionId": "session1",
  "number": "+1234567890",
  "message": "Hello"
}
```

## مثال على docker-compose.yml لـ Dokploy

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7
    restart: unless-stopped
    volumes:
      - mongodb-data:/data/db
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=your-secure-password

  wweb-mcp:
    build: .
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - DOCKER_CONTAINER=true
      - MONGO_URI=mongodb://admin:your-secure-password@mongodb:27017/whatsapp_sessions?authSource=admin
      - MODE=whatsapp-api
      - API_PORT=3001
      - ENABLE_SESSIONS=true
      - WEBHOOK_URL=https://your-webhook.com
      - WEBHOOK_AUTH_TOKEN=your-token
    depends_on:
      - mongodb

volumes:
  mongodb-data:
```

## ملاحظات مهمة

1. **الأمان**: استخدم كلمة مرور قوية لـ MongoDB
2. **النسخ الاحتياطي**: احرص على نسخ MongoDB بانتظام
3. **الأداء**: كل جلسة تستخدم موارد (ذاكرة، CPU)
4. **الحد الأقصى**: لا يوجد حد نظري، لكن يعتمد على موارد السيرفر

## استكشاف الأخطاء

### المشكلة: لا يتصل بـ MongoDB

**الحل**: 
- تأكد من أن MongoDB يعمل
- تحقق من connection string
- تأكد من صلاحيات المستخدم

### المشكلة: الجلسات لا تُحفظ

**الحل**:
- تأكد من `ENABLE_SESSIONS=true`
- تحقق من `MONGO_URI`
- راجع Logs للأخطاء

### المشكلة: QR Code لا يظهر

**الحل**:
- تأكد من أن الجلسة في حالة `authenticating`
- راجع Logs
- جرب تحديث الصفحة

