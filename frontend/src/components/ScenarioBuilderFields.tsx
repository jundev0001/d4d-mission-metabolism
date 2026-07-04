import type { ReactNode } from "react"

export function EditorHeader({
  icon,
  label,
}: {
  readonly icon: ReactNode
  readonly label: string
}) {
  return (
    <div className="builder-editor-title">
      {icon}
      <span>{label}</span>
    </div>
  )
}

export function RangeField({
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  readonly label: string
  readonly max: number
  readonly min: number
  readonly onChange: (value: number) => void
  readonly step: number
  readonly value: number
}) {
  return (
    <label className="builder-field range-field">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <b>{Number.isInteger(value) ? value : value.toFixed(2)}</b>
    </label>
  )
}
