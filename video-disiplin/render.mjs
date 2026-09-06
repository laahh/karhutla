import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { spawn } from "child_process";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fps = 30;
const duration = 24;
const total = fps * duration;
const framesDir = path.join(__dirname, "frames");
const outFile = path.join(__dirname, "disiplin-1-persen.mp4");
const html = pathToFileURL(path.join(__dirname, "index.html")).href + "?render=1";
const chrome =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

fs.mkdirSync(framesDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: [
    "--hide-scrollbars",
    "--font-render-hinting=none",
    "--disable-lcd-text",
    "--allow-file-access-from-files",
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.goto(html, { waitUntil: "networkidle0", timeout: 120000 });
await page.waitForFunction(() => window.ready === true, { timeout: 30000 });
await page.evaluate(() => window.seek(0));

for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.seek(t), i / fps);
  await page.screenshot({
    path: path.join(framesDir, `f${String(i).padStart(5, "0")}.jpg`),
    type: "jpeg",
    quality: 92,
  });
  if (i % 30 === 0) console.log(`frame ${i}/${total}`);
}

await browser.close();

await new Promise((resolve, reject) => {
  const ff = spawn(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      String(fps),
      "-i",
      path.join(framesDir, "f%05d.jpg"),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "17",
      "-movflags",
      "+faststart",
      outFile,
    ],
    { stdio: "inherit" }
  );
  ff.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg " + code))));
});

console.log("wrote", outFile);
