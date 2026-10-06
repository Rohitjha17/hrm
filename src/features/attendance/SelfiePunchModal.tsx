import { useEffect, useRef, useState } from 'react'
import { Camera, MapPin, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useAttendanceConfig, usePunch, type PunchResult } from './hooks'
import { getCurrentCoords, haversineMeters, todayInTz, type Coords } from './geo'

const REASON_TEXT: Record<string, string> = {
  out_of_radius:
    'Your device reports a location outside the office radius. If you are at the office, tap “Retry location” — the first reading is often imprecise.',
  already_punched_in: 'You are already punched in.',
  not_punched_in: 'You need to punch in first.',
  ip_not_allowed: 'Your network is not allowed for attendance.',
  previous_day_planning_incomplete:
    'Punching is locked: your last worked day isn’t fully planned. Cover all its working hours with slots, or ask an admin to unlock.',
}

async function captureSelfie(video: HTMLVideoElement | null): Promise<Blob> {
  const w = video?.videoWidth || 320
  const h = video?.videoHeight || 240
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  if (video && video.videoWidth) {
    ctx.drawImage(video, 0, 0, w, h)
  } else {
    // Fallback if the camera frame isn't ready — keeps the punch flow working.
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#fff'
    ctx.font = '14px sans-serif'
    ctx.fillText(`selfie ${new Date().toISOString()}`, 8, h / 2)
  }
  return new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.8),
  )
}

export function SelfiePunchModal({
  type,
  onClose,
  onSuccess,
}: {
  type: 'in' | 'out'
  onClose: () => void
  onSuccess: (result: PunchResult) => void
}) {
  const { user } = useAuth()
  const { data: config } = useAttendanceConfig()
  const punch = usePunch()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [coords, setCoords] = useState<Coords | null>(null)
  const [locating, setLocating] = useState(true)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [result, setResult] = useState<PunchResult | null>(null)

  // Start the camera (best-effort) and acquire location on open.
  useEffect(() => {
    let active = true
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play().catch(() => {})
        }
      })
      .catch(() => {
        /* camera unavailable — punch still proceeds with a fallback frame */
      })

    getCurrentCoords()
      .then((c) => active && setCoords(c))
      .catch((e: Error) => active && setGeoError(e.message))
      .finally(() => active && setLocating(false))

    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function retryLocation() {
    setLocating(true)
    setGeoError(null)
    setResult(null)
    getCurrentCoords()
      .then((c) => setCoords(c))
      .catch((e: Error) => setGeoError(e.message))
      .finally(() => setLocating(false))
  }

  const distance =
    coords && config
      ? haversineMeters(config.office_lat, config.office_lng, coords.latitude, coords.longitude)
      : null
  // Mirror of the server rule: an imprecise fix may be off by its own accuracy
  // radius, so allow for it up to the configured cap.
  const allowance =
    config && coords ? Math.min(coords.accuracy ?? 0, config.location_accuracy_cap_m) : 0
  const outOfRadius =
    distance != null && config != null && distance > config.radius_meters + allowance

  async function handlePunch() {
    if (!coords || !config) {
      setGeoError('Location is required to punch.')
      return
    }
    // Client-side gate (server independently re-validates and is authoritative).
    if (outOfRadius) {
      setResult({
        ok: false,
        reason: 'out_of_radius',
        distance_m: Math.round(distance!),
        radius_m: config.radius_meters,
      })
      return
    }
    setResult(null)
    const blob = await captureSelfie(videoRef.current)
    const workDate = todayInTz(config.timezone)
    const path = `${user!.id}/${workDate}/${crypto.randomUUID()}.jpg`
    const upload = await supabase.storage
      .from('selfies')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false })

    const res = await punch.mutateAsync({
      type,
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy,
      selfiePath: upload.error ? null : path,
    })
    setResult(res)
    if (res.ok) onSuccess(res)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={type === 'in' ? 'Punch In' : 'Punch Out'}
      testid="punch-modal"
    >
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-xl bg-slate-900">
          <video
            ref={videoRef}
            data-testid="punch-video"
            autoPlay
            playsInline
            muted
            aria-label="Live selfie preview"
            className="aspect-video w-full object-cover"
          />
          <div className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white">
            <Camera className="size-4" />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm" data-testid="punch-location">
          <MapPin className="size-4 text-slate-400" />
          {locating ? (
            <span className="flex items-center gap-2 text-slate-500">
              <Spinner className="size-3" /> Acquiring location…
            </span>
          ) : geoError ? (
            <span className="text-red-600">{geoError}</span>
          ) : distance != null ? (
            <span className={outOfRadius ? 'text-red-600' : 'text-emerald-700'}>
              {Math.round(distance)} m from office (max {config?.radius_meters} m)
              {coords?.accuracy != null && (
                <span className="text-slate-400"> · accuracy ±{Math.round(coords.accuracy)} m</span>
              )}
            </span>
          ) : null}
          {!locating && (
            <button
              type="button"
              data-testid="retry-location"
              onClick={retryLocation}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
            >
              <RefreshCw className="size-3" /> Retry location
            </button>
          )}
        </div>

        {result && !result.ok && (
          <div
            role="alert"
            data-testid="punch-error"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {REASON_TEXT[result.reason ?? ''] ?? 'Punch failed.'}
            {result.distance_m != null && ` (${result.distance_m} m away)`}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-testid="capture-punch-button"
            loading={punch.isPending}
            disabled={locating || !!geoError}
            onClick={handlePunch}
          >
            <Camera className="size-4" />
            Capture &amp; {type === 'in' ? 'Punch In' : 'Punch Out'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
