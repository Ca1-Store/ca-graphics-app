const fs = require("fs");

function randomBlock(len) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < len; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}

function generateCode(product) {
    const prefix = "CA";
    const part1 = randomBlock(6);
    const part2 = randomBlock(6);

    return `${prefix}-${part1}-${part2}`;
}

function addCode(product) {
    const file = JSON.parse(fs.readFileSync("keys.json", "utf8"));

    const code = generateCode(product);

    file.push({
        code: code,
        product: product,
        used: false
    });

    fs.writeFileSync("keys.json", JSON.stringify(file, null, 2));

    console.log("✔ تم توليد الكود:");
    console.log(code);
}

const product = process.argv[2];

if (!product || !["CA-1-PACK", "CA-2-PACK", "CA-3-PACK"].includes(product)) {
    console.log("❌ اكتب المنتج: CA-1-PACK أو CA-2-PACK أو CA-3-PACK");
    process.exit();
}

addCode(product);
