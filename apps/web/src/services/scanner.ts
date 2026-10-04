import QrScanner from "qr-scanner";
import type { Scanner } from "./types.ts";

/** The in-app QR scanner. It reads from the camera on the phone; nothing is uploaded anywhere. */
export class QrScannerAdapter implements Scanner {
  private scanner: QrScanner | null = null;

  async start(video: HTMLVideoElement, onCode: (code: string) => void): Promise<void> {
    this.stop();
    this.scanner = new QrScanner(video, (result) => onCode(result.data), {
      returnDetailedScanResult: true,
      preferredCamera: "environment",
      maxScansPerSecond: 8,
    });
    await this.scanner.start();
  }

  stop(): void {
    this.scanner?.stop();
    this.scanner?.destroy();
    this.scanner = null;
  }
}
