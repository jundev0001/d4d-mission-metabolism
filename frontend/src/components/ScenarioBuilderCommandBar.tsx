import { CheckCircle2, Download, Play, Route, Upload } from "lucide-react"
import { type ChangeEvent, useRef } from "react"

type CommandAction = () => Promise<void> | void

type ScenarioBuilderCommandBarProps = {
  readonly disabled: boolean
  readonly onAllocate: CommandAction
  readonly onApplyMission: CommandAction
  readonly onExport: () => void
  readonly onImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  readonly onRunFlow: CommandAction
}

export function ScenarioBuilderCommandBar({
  disabled,
  onAllocate,
  onApplyMission,
  onExport,
  onImport,
  onRunFlow,
}: ScenarioBuilderCommandBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="builder-command-row">
      <button className="button" type="button" onClick={onExport}>
        <Download size={15} />
        내보내기
      </button>
      <button className="button" type="button" onClick={() => fileInputRef.current?.click()}>
        <Upload size={15} />
        가져오기
      </button>
      <button
        className="button"
        type="button"
        disabled={disabled}
        onClick={() => void onApplyMission()}
      >
        <CheckCircle2 size={15} />
        임무 적용
      </button>
      <button
        className="button"
        type="button"
        disabled={disabled}
        onClick={() => void onAllocate()}
      >
        <Route size={15} />
        편성 승인
      </button>
      <button
        className="button primary"
        type="button"
        disabled={disabled}
        onClick={() => void onRunFlow()}
      >
        <Play size={15} />
        플로우 실행
      </button>
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        onChange={(event) => void onImport(event)}
      />
    </div>
  )
}
