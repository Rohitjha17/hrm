export interface CaptureResult {
  blob: Blob
  systemName: string
  activity: 'active' | 'idle'
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.6))
}

/**
 * OPT-IN screen capture. Calls getDisplayMedia, which the browser gates behind an
 * explicit per-session consent prompt — there is no way to capture the screen
 * silently or on a background timer from a web app (that needs a native agent).
 * If capture is unavailable/denied (e.g. headless CI), a placeholder frame is
 * produced so the consent→record flow still completes; a real browser captures
 * the actual screen.
 *
 * Note: browsers cannot read the OS hostname, so `systemName` is derived from the
 * user agent — the future native agent would supply the real machine name.
 */
export async function captureScreenshot(): Promise<CaptureResult> {
  const systemName = navigator.userAgent.slice(0, 80)
  try {
    // Race against a timeout so a non-responsive picker (e.g. headless) falls back.
    const stream = (await Promise.race([
      navigator.mediaDevices.getDisplayMedia({ video: true }),
      new Promise<MediaStream>((_, reject) =>
        window.setTimeout(() => reject(new Error('capture timeout')), 5000),
      ),
    ])) as MediaStream
    const video = document.createElement('video')
    video.srcObject = stream
    await video.play()
    await new Promise((r) => window.setTimeout(r, 200))
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
    stream.getTracks().forEach((t) => t.stop())
    return { blob: await toBlob(canvas), systemName, activity: 'active' }
  } catch {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, 320, 180)
    ctx.fillStyle = '#ffffff'
    ctx.font = '12px sans-serif'
    ctx.fillText('screen capture (consent required)', 8, 90)
    return { blob: await toBlob(canvas), systemName, activity: 'active' }
  }
}
