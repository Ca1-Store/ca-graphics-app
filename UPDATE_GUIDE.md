# دليل التحديث التلقائي - CA Graphics App

## نظرة عامة
هذا المشروع يستخدم `electron-updater` لتوفير تحديثات تلقائية للمستخدمين دون الحاجة لإعادة تثبيت البرنامج.

## خطوات رفع التحديثات

### 1. تحديث رقم الإصدار
في ملف `package.json`، قم بزيادة رقم الإصدار:
```json
{
  "version": "1.1.6"  // زيادة الرقم
}
```

### 2. رفع التعديلات إلى GitHub
```bash
git add .
git commit -m "وصف التحديث"
git push origin main
```

### 3. بناء ونشر البرنامج
```bash
npm run publish
```

هذا الأمر سيقوم بـ:
- بناء البرنامج لـ Windows
- رفع ملف التثبيت إلى GitHub Releases
- إنشاء release tag جديد

### 4. التحقق من النشر
اذهب إلى GitHub Repository:
- https://github.com/Ca1-Store/ca-graphics-app/releases
- تأكد من ظهور release جديد مع ملف التثبيت

## كيف يعمل التحديث التلقائي

### عند المستخدم:
1. عند فتح البرنامج، يتحقق تلقائياً من التحديثات
2. إذا وجد تحديث، يظهر إشعار للمستخدم
3. يتم تحميل التحديث في الخلفية
4. بعد اكتمال التحميل، يطلب من المستخدم إعادة التشغيل
5. يتم تثبيت التحديث تلقائياً عند إعادة التشغيل

### في الكود:
- `main.js`: يحتوي على event handlers لـ autoUpdater
- `preload.js`: يوفر IPC للتواصل مع الواجهة الأمامية
- `package.json`: يحتوي على إعدادات النشر على GitHub

## استخدام API في الواجهة الأمامية

### التحقق من التحديث يدوياً
```javascript
await window.api.checkUpdate();
```

### الاستماع لحالة التحديث
```javascript
window.api.onUpdateStatus((data) => {
    console.log(data.status, data.message);
    // status: checking | available | none | error | downloaded
});
```

### الاستماع لتقدم التحميل
```javascript
window.api.onUpdateProgress((data) => {
    console.log(data.percent, data.speed);
});
```

## متطلبات النشر

### GitHub Token
تأكد من وجود `GH_TOKEN` في ملف `.env`:
```
GH_TOKEN=ghp_YOUR_TOKEN_HERE
```

### صلاحيات GitHub Token
يجب أن يمتلك الـ token صلاحيات:
- `repo` (full control)
- `releases` (write)

## استكشاف الأخطاء

### التحديث لا يظهر
- تأكد من زيادة رقم الإصدار في `package.json`
- تأكد من رفع التعديلات إلى GitHub
- تأكد من تشغيل `npm run publish`

### خطأ في النشر
- تحقق من صحة `GH_TOKEN`
- تأكد من اتصال الإنترنت
- تحقق من صلاحيات الـ token

### التحديث لا يعمل عند المستخدم
- تأكد من أن البرنامج مبني (not development mode)
- تحقق من إعدادات `publish` في `package.json`
- تحقق من أن release موجود على GitHub

## ملاحظات مهمة

- التحديثات تعمل فقط على النسخ المبنية (built versions)
- لا تعمل في وضع التطوير (development mode)
- يجب أن يكون البرنامج موقّع للتحديثات الآمنة (اختياري)
- يمكن تخصيص فترة التحقق من التحديثات
