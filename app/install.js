const bar = document.getElementById("installBar");

let p = 0;

const timer = setInterval(() => {
    p += 2;
    if (p > 100) p = 100;

    bar.style.width = p + "%";

    if (p === 100) {
        clearInterval(timer);
        setTimeout(() => {
            window.api.openPage("index.html");
        }, 600);
    }
}, 80);
