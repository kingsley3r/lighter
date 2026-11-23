import Autocomplete from './Autocomplete'
import { matchScore } from '../data/common-foods'

/** Comma separated list input that suggests the word being typed from `options`. */
export default function ListInput({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <Autocomplete
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      suggest={(t) => {
        const cut = t.lastIndexOf(',') + 1
        const head = t.slice(0, cut)
        const cur = t.slice(cut).trim()
        if (cur.length < 2) return []
        const have = new Set(head.split(',').map((x) => x.trim().toLowerCase()))
        return [...new Set(options)]
          .filter((o) => !have.has(o.toLowerCase()))
          .map((o) => ({ o, s: matchScore(o, cur) }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s)
          .slice(0, 6)
          .map(({ o }) => ({ key: o, label: o, onPick: () => onChange(`${head}${head ? ' ' : ''}${o.toLowerCase()}, `) }))
      }}
    />
  )
}
