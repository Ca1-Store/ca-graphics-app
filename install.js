const bar = document.getElementById("installBar");
let p = 0;
const timer = setInterval(() => {
    p = Math.min(100, p + 2);
    bar.style.width = p + "%";
    if (p === 100) {
        clearInterval(timer);
        setTimeout(() => window.api.openPage("index.html"), 600);
    }
}, 80);
