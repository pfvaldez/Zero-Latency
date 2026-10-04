// A fake camera feed for the scanner test: a short YUV4MPEG2 video that shows one QR code, which
// Chromium plays as the camera (--use-file-for-fake-video-capture). No image library: the QR
// modules are drawn straight into the luma plane.

import { writeFileSync } from "node:fs";
import QRCode from "qrcode";

const W = 640;
const H = 480;
const FRAMES = 15;

export function writeQrVideo(path: string, text: string): void {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const scale = Math.floor(Math.min(W, H) / (n + 8)); // 4 modules of quiet zone on each side
  const size = n * scale;
  const x0 = Math.floor((W - size) / 2);
  const y0 = Math.floor((H - size) / 2);
  const luma = Buffer.alloc(W * H, 255); // white
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!qr.modules.get(row, col)) continue;
      for (let dy = 0; dy < scale; dy++) {
        const start = (y0 + row * scale + dy) * W + x0 + col * scale;
        luma.fill(0, start, start + scale);
      }
    }
  }
  const chroma = Buffer.alloc((W / 2) * (H / 2), 128);
  const parts: Buffer[] = [Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`)];
  for (let i = 0; i < FRAMES; i++) parts.push(Buffer.from("FRAME\n"), luma, chroma, chroma);
  writeFileSync(path, Buffer.concat(parts));
}
