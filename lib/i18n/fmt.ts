/** Fill `{name}` placeholders in a translated string: fmt(t('x'), { city: 'Utrecht' }). */
export function fmt(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}
