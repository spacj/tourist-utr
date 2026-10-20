'use client'
import { useEffect, useMemo, useState } from 'react'
import { Compass, MapPin, MapPinOff } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { ProximityRing } from '@/components/ProximityRing'
import { haversineM, bearingDeg } from '@/lib/geo'
import type { GpsError, GpsFix } from '@/hooks/useGPS'
import { arrivalRadiusM, warmthFor, type ActiveClueView, type Warmth } from '@/types'

export interface NavReadout {
  mode: ActiveClueView['navigation']
  distanceM: number | null
  bearing: number | null
  warmth: Warmth | null
}

/**
 * What the dial shows. With a known target the readout is computed live from
 * the GPS fix; otherwise it comes from the last server reply. In warmth mode
 * no distance or direction is ever shown.
 */
export function useNavReadout(
  clue: ActiveClueView,
  fix: GpsFix | null,
  server: { warmth: Warmth | null; distanceM: number | null; bearing: number | null },
): NavReadout {
  return useMemo(() => {
    const t = clue.target
    if (t && fix) {
      const d = Math.round(haversineM(fix.lat, fix.lng, t.lat, t.lng))
      if (clue.navigation === 'compass') {
        return { mode: 'compass', distanceM: d, bearing: bearingDeg(fix.lat, fix.lng, t.lat, t.lng), warmth: warmthFor(d) }
      }
      return { mode: 'warmth', distanceM: null, bearing: null, warmth: warmthFor(d) }
    }
    if (clue.navigation === 'compass') {
      return { mode: 'compass', distanceM: server.distanceM, bearing: server.bearing, warmth: server.warmth }
    }
    return { mode: 'warmth', distanceM: null, bearing: null, warmth: server.warmth }
  }, [clue.target, clue.navigation, fix, server.warmth, server.distanceM, server.bearing])
}

/**
 * GPS is "poor" when accuracy is worse than the stop's arrival radius; after
 * 20 s of that (or with no GPS at all) the "I'm here" check-in is offered —
 * but only on stops with a verified on-site question.
 */
export function useCheckInAvailable(clue: ActiveClueView, fix: GpsFix | null, gpsError: GpsError | null) {
  const radius = clue.target?.radiusM ?? 40
  const poor = !!fix && fix.accuracy > arrivalRadiusM(radius, 0)
  const [poorLong, setPoorLong] = useState(false)
  useEffect(() => {
    setPoorLong(false)
    if (!poor) return
    const id = setTimeout(() => setPoorLong(true), 20_000)
    return () => clearTimeout(id)
  }, [poor, clue.id])
  const noGps = gpsError === 'denied' || gpsError === 'unavailable' || gpsError === 'unsupported' ||
    (gpsError === 'timeout' && !fix)
  return { poor, available: clue.hasOnSite && (noGps || poorLong) }
}

function platform(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

/** Full help panel when location is blocked or unavailable. */
export function GpsHelp({
  error, onRetry, canCheckIn, onCheckIn,
}: {
  error: GpsError
  onRetry: () => void
  canCheckIn: boolean
  onCheckIn: () => void
}) {
  const { t } = useI18n()
  const [os, setOs] = useState<'ios' | 'android' | 'other'>('other')
  useEffect(() => setOs(platform()), [])
  const steps = error === 'denied'
    ? (os === 'ios' ? ['gpsHelpIos1', 'gpsHelpIos2', 'gpsHelpIos3']
      : os === 'android' ? ['gpsHelpAndroid1', 'gpsHelpAndroid2', 'gpsHelpAndroid3']
      : ['gpsHelpOther1', 'gpsHelpOther2'])
    : ['gpsHelpSignal1', 'gpsHelpSignal2']
  const titleKey = error === 'denied' ? 'gpsDeniedTitle'
    : error === 'unsupported' ? 'gpsUnsupported'
    : error === 'timeout' ? 'gpsTimeout' : 'gpsUnavailable'

  return (
    <div className="gps-help" role="alert">
      <div className="gps-help-title"><MapPinOff size={18} strokeWidth={1.75} aria-hidden /> {t(titleKey)}</div>
      <ol className="gps-help-steps">
        {steps.map(k => <li key={k}>{t(k)}</li>)}
      </ol>
      <div className="gps-help-actions">
        <button type="button" className="btn-secondary" onClick={onRetry}>{t('retry')}</button>
        {canCheckIn && (
          <button type="button" className="btn-primary" onClick={onCheckIn}>{t('imHereCta')}</button>
        )}
      </div>
    </div>
  )
}

/** Dial + GPS notices + compass permission + "I'm here". */
export function ClueNavigator({
  readout, fix, gpsError, onRetryGps, heading, compassNeedsPermission, onEnableCompass,
  poorAccuracy, canCheckIn, onCheckIn,
}: {
  readout: NavReadout
  fix: GpsFix | null
  gpsError: GpsError | null
  onRetryGps: () => void
  heading: number | null
  compassNeedsPermission: boolean
  onEnableCompass: () => void
  poorAccuracy: boolean
  canCheckIn: boolean
  onCheckIn: () => void
}) {
  const { t } = useI18n()
  const blocked = gpsError && !(gpsError === 'timeout' && fix)

  return (
    <div className="ring-stats game-navigator">
      {blocked ? (
        <GpsHelp error={gpsError!} onRetry={onRetryGps} canCheckIn={canCheckIn} onCheckIn={onCheckIn} />
      ) : (
        <>
          <ProximityRing
            mode={readout.mode}
            distanceM={readout.distanceM}
            bearing={readout.bearing}
            warmth={readout.warmth}
            accuracy={fix?.accuracy ?? null}
            heading={heading}
          />
          <div className="game-nav-notes">
            {readout.mode === 'warmth' && <p className="game-nav-note">{t('warmthModeNote')}</p>}
            {poorAccuracy && (
              <p className="game-nav-note game-nav-warn" role="status">{t('gpsImprecise')}</p>
            )}
            {readout.mode === 'compass' && compassNeedsPermission && (
              <button type="button" className="btn-secondary game-nav-btn" onClick={onEnableCompass}>
                <Compass size={18} strokeWidth={1.75} aria-hidden /> {t('enableCompass')}
              </button>
            )}
            {canCheckIn && (
              <button type="button" className="btn-secondary game-nav-btn" onClick={onCheckIn}>
                <MapPin size={18} strokeWidth={1.75} aria-hidden /> {t('imHereCta')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
