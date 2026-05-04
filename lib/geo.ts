export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const r = (d: number) => (d * Math.PI) / 180
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180
  const y = Math.sin(r(lng2 - lng1)) * Math.cos(r(lat2))
  const x = Math.cos(r(lat1)) * Math.sin(r(lat2)) -
            Math.sin(r(lat1)) * Math.cos(r(lat2)) * Math.cos(r(lng2 - lng1))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}
