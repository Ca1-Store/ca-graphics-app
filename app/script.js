const input = document.getElementById("activationCode");
const statusText = document.getElementById("status");
const activateBtn = document.getElementById("activateBtn");

// زر التفعيل
activateBtn.addEventListener("click", async () => {
    const code = input.value.trim();
    const targetProduct = localStorage.getItem("activateFor");

    if (!targetProduct) {
        return showError("لم يتم اختيار نسخة للتفعيل");
    }

    if (code === "") {
        return showError("الرجاء إدخال كود التفعيل");
    }

    statusText.style.color = "#ffffff";
    statusText.innerText = "جاري التحقق...";

    // التحقق من الكود عبر Firebase
    const result = await window.api.checkActivationCode(code, targetProduct);

    if (!result.success) {
        return showError(result.message);
    }

    // حفظ التفعيل محليًا
    await window.api.saveActivation(targetProduct, code);

    // تنظيف التخزين
    localStorage.removeItem("activateFor");

    statusText.style.color = "#00ff9d";
    statusText.innerText = "تم التفعيل بنجاح ✔";

    // إشعار نجاح
    notify("تم تفعيل النسخة بنجاح", "success");

    setTimeout(() => {
        window.location.href = "versions.html";
    }, 700);
});

// دالة الخطأ
function showError(msg) {
    statusText.style.color = "#ff4d4d";
    statusText.innerText = msg;

    input.classList.add("error-flash");
    setTimeout(() => input.classList.remove("error-flash"), 400);

    notify(msg, "error");
}

// نظام الإشعارات الجديد
function notify(message, type = "info") {
    const box = document.getElementById("notify");
    if (!box) return;

    box.className = `notification ${type} show`;
    box.innerText = message;

    setTimeout(() => {
        box.classList.remove("show");
    }, 2500);
}
