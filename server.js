const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10gb" }));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

/* =========================
   رفع chunk
========================= */
app.post("/upload-chunk", (req, res) => {
    const fileName = req.query.fileName;
    const chunkIndex = req.query.chunkIndex;

    const chunkPath = path.join(uploadDir, `${fileName}.part${chunkIndex}`);

    const writeStream = fs.createWriteStream(chunkPath);

    req.on("data", (chunk) => {
        writeStream.write(chunk);
    });

    req.on("end", () => {
        writeStream.end();
        res.json({ success: true });
    });

    req.on("error", () => {
        res.status(500).json({ success: false });
    });
});
/* =========================
   دمج الملفات
========================= */
app.post("/merge", (req, res) => {
    const { fileName, totalChunks } = req.body;

    const finalPath = path.join(uploadDir, fileName);

    const writeStream = fs.createWriteStream(finalPath);

    let current = 0;

    function appendChunk() {
        const chunkPath = path.join(uploadDir, fileName + ".part" + current);

        if (!fs.existsSync(chunkPath)) {
            return res.status(400).json({
                success: false,
                message: "Missing chunk " + current
            });
        }

        const data = fs.readFileSync(chunkPath);
        writeStream.write(data);

        fs.unlinkSync(chunkPath);

        current++;

        if (current < totalChunks) {
            appendChunk();
        } else {
            writeStream.end();
            res.json({ success: true, file: fileName });
        }
    }

    appendChunk();
});

/* =========================
   تحميل الملف
========================= */
app.get("/files/:name", (req, res) => {
    const filePath = path.join(uploadDir, req.params.name);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("Not found");
    }

    const stat = fs.statSync(filePath);

    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Type", "application/octet-stream");

    fs.createReadStream(filePath).pipe(res);
});

app.listen(3000, () => {
    console.log("🚀 Chunk Upload Server running on http://localhost:3000");
});