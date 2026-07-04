# D4D Capability-Centric Mission Metabolism Project Context

이 저장소는 D4D | Deploy for Defense Hackathon APAC - SEOUL 24H에서 `1인 다중 무인기 동시 통제 (Multi-UxV Control)` 문제를 풀기 위한 개발 작업 공간이다. 현재 개발 방향의 기준 문서는 [deep-research-report.md](deep-research-report.md)이며, 이 `AGENTS.md`는 future agent가 구현·문서화·데모 작업을 할 때 따라야 하는 압축 운영 지침이다.

## Event Context

- 행사: D4D | Deploy for Defense Hackathon APAC - SEOUL
- 일정: 2026-07-03 ~ 2026-07-05
- 성격: 국방과 안보 문제를 해결하는 APAC 디펜스 테크 해커톤
- 관련 트랙:
  - T1. Autonomy, Unmanned Systems & Counter-UAS
  - T3. Battle Network, C2 & Sustainment
  - Simulation / Training / Battle Network 성격의 산출물도 방어 가능
- 심사 기준상 중요한 축:
  - 문제 적합성
  - 군 적용 가능성
  - 기술 구현
  - 창의성
  - 임팩트 및 확장성
  - 글로벌 확장 가능성
  - 기술 난이도 및 차별성

## Updated Problem Framing

문제명: `1인 다중 무인기 동시 통제 (Multi-UxV Control)`

이 프로젝트의 핵심 문제는 "한 사람이 여러 기체를 직접 조종하게 만드는 것"이 아니다. 미래 전장의 병목은 더 많은 드론을 띄우는 능력보다, 자주 손실되고 자주 교란되며 계속 재구성되는 다중 UxV 전력을 1명의 운용자가 임무 능력 단위로 유지하는 능력이다.

기존의 `Health-Aware Mission Orchestrator` 방향은 폐기하지 않고 확장한다. 새 방향은 기체 중심(vehicle-centric) 관제나 단순 건강 상태 기반 재할당이 아니라, **Capability-centric Mission Metabolism**이다.

권장 한 줄 정의:

```text
One operator maintains mission capability across many attritable UxVs through capability-centric orchestration, mission collapse prediction, and exception-based human approval.
```

한국어 발표 표현:

```text
우리는 더 많은 드론을 직접 조종하게 만드는 UI가 아니라, 자주 손실되고 교란되는 다중 UxV 전력을 한 명이 임무 능력 단위로 유지하도록 만드는 capability-centric mission OS를 만든다.
```

## Product Direction

제품 컨셉명은 다음 방향으로 잡는다.

```text
Capability-centric Mission Metabolism for Multi-UxV
```

핵심 가설:

- 운용자는 개별 UxV가 아니라 정찰, 릴레이, 감시, 예비 능력의 현재·미래 가용성을 본다.
- 시스템은 상태가 나빠진 기체 하나를 단순 대체하는 것이 아니라, 임무 capability budget이 붕괴하지 않도록 조합을 계속 재구성한다.
- 데모의 novelty는 새 비행제어 알고리즘보다 새 운용 abstraction과 KPI에 있다.
- 24시간 해커톤에서는 PX4/Gazebo 완성도보다 2D mixed-fidelity 시뮬레이터에서 mission-level logic을 끝까지 보여주는 것이 우선이다.

핵심 기능:

- Mission Intent Card로 임무 목표, 구역, 제약, 자동화 레벨, human approval policy를 입력한다.
- Capability Fabric이 각 UxV를 기체 ID가 아니라 capability vector로 표현한다.
- Mission Capability Coverage(MCC)가 현재 임무 요구 대비 capability coverage를 계산한다.
- Mission Metabolism이 짧은 horizon 내 Mission Collapse Probability를 예측한다.
- Autonomy Debt가 현재 자동화 선택 때문에 미래에 인간이 갚아야 할 판단 부채를 추적한다.
- Tactical Immune System이 재밍, 배터리 급락, GPS drop, 센서 실패, 기체 손실, alert flood에 대해 국소 복구안을 만든다.
- Recommendation Card + Approval Gate가 원인, 권고 조치, 예상 효과, 승인/거절/수동 개입을 제시한다.
- Command Compression Ratio(CCR)가 baseline 대비 운용자 조작 감소와 human intent 대비 system micro-action 전개량을 측정한다.
- Mission Black Box가 이벤트, 상태, 계산된 KPI, 추천안, 인간 결정, 결과를 재생 가능하게 기록한다.

## Design Principles

1. Capability-level control over vehicle-level piloting
   - UI와 API는 "UxV-03을 어디로 보낼까?"보다 "현재 편대가 정찰·릴레이·감시·예비 능력을 몇 분 더 유지할 수 있는가?"를 우선한다.

2. Mission metabolism, not static task allocation
   - 배정 결과를 한 번 만들고 끝내지 않는다. 임무 능력 수요와 공급이 시간에 따라 소모·회복·붕괴하는 흐름을 계속 계산한다.

3. Attrition and EW are default assumptions
   - 배터리 저하, 링크 약화, GPS drop, 센서 실패, jammer zone, no-go zone, 기체 손실을 예외가 아니라 기본 시나리오로 둔다.

4. Supervisory control, not full autonomy
   - 시스템은 사람을 제거하지 않는다. 평상시에는 자동 복구안을 만들고, 고위험 replan, no-go 관련 변경, 임무 우선순위 충돌에는 human gate를 둔다.

5. Attention management by decision cards
   - 모든 telemetry를 동일하게 보여주지 않는다. 화면 중심은 Mission Metabolism gauge, Recommendation Card, 승인 대기 항목, black box log다.

6. Explainable capability recomposition
   - 각 추천안은 "왜 이 자산/역할/복구안이 선택되었는지"와 "MCC, collapse probability, autonomy debt가 어떻게 변하는지"를 함께 보여준다.

7. Mixed-fidelity first
   - P0는 2D simulator + synthetic wingman으로 end-to-end를 보장한다. PX4/Gazebo, ROS 2, MAVSDK bridge는 P1 확장으로 둔다.

8. Protocol adapter boundary
   - core logic을 MAVLink, PX4, ROS 2 raw message에 직접 묶지 않는다. 내부 모델은 Mission, Vehicle/Asset, Capability, Event, Recommendation, Decision, MetricEvent 중심으로 둔다.

## Core Concepts

### Capability Fabric

각 UxV를 "드론 1대"가 아니라 capability vector로 표현한다. 최소 capability 축은 다음을 사용한다.

- `visual_recon`
- `relay`
- `overwatch`
- `gps_denied_nav`
- `reserve`

각 asset은 원시 capability 값과 상태 기반 availability를 가진다. effective capability는 원시 capability에 battery, comm, nav, sensor, health 품질을 반영해 계산한다.

### Mission Capability Coverage

Mission Capability Coverage(MCC)는 임무 요구 capability 대비 현재 fleet이 제공하는 effective capability의 충족도를 나타낸다. 데모에서는 task별/area별 bar와 전체 score를 함께 보여준다.

### Mission Metabolism

Mission Metabolism은 특정 기체의 경고가 아니라 "현재 구성 유지 시 임무가 살아남는가"를 보는 지표다. 짧은 horizon에서 capability demand와 supply를 비교하고, EW pressure, comm saturation, operator load, attrition risk, redundancy를 합쳐 Mission Collapse Probability를 계산한다.

MVP에서 collapse probability는 학습 모델이 아니라 heuristic operational risk score로 둔다. 절대값보다 baseline 대비 assisted mode의 상대 개선이 중요하다.

### Autonomy Debt

Autonomy Debt는 현재 자동화 구성 때문에 미래에 인간이 갚아야 할 판단 부채다. 승인 대기 카드 수, single-point risk, uncertainty × autonomy level, alert backlog, capability deficit은 debt를 올리고, recovery actions는 debt를 낮춘다.

### Tactical Immune System

Tactical Immune System은 교란·손실·고장 발생 시 전체 플랜을 매번 새로 짜기보다 국소 복구를 수행하는 규칙 + 점수화 엔진이다.

| 이벤트 | 후보 반응 |
|---|---|
| `comm_jam` | relay 재배치, 저대역폭 모드, 해당 기체 임무 축소 |
| `gps_drop` | 저속 모드, hold, GPS-dependent task 배제 |
| `battery_drop` | 귀환, 근거리 task로 축소, reserve 치환 |
| `sensor_fail` | scout를 relay/reserve로 전환 |
| `vehicle_lost` | nearest reserve 투입, coverage 재분배 |
| `alert_flood` | low-priority suppression, 카드 병합 |

### Command Compression Ratio

CCR은 "한 개의 운용자 intent 또는 승인으로 시스템이 몇 개의 실행 가능한 micro-action을 전개했는가"를 나타낸다.

- `CCR_ext = Baseline operator actions / Assisted operator actions`
- `CCR_int = System micro-actions executed / Human intents or approvals`

해커톤 발표에서는 operator actions, replan time, collapse probability, autonomy debt와 함께 가장 강한 수치로 사용한다.

## Suggested Architecture

```text
Mission Intent Layer
  -> objective, areas, constraints, autonomy level, approval policy

Capability Fabric
  -> raw capability vectors
  -> state-weighted effective capability
  -> mission capability coverage

Mission Metabolism Engine
  -> demand/supply horizon evaluation
  -> mission strain
  -> collapse probability
  -> autonomy debt

Tactical Immune System
  -> event classification
  -> local recovery candidate generation
  -> expected KPI delta scoring

Recommendation & Human Gate
  -> cause summary
  -> recommended actions
  -> MCC / collapse / debt effect
  -> approve / reject / manual

2D Mixed-Fidelity Simulator
  -> map, areas, routes, jammer/no-go/comm zones
  -> physical-like assets and synthetic wingman tokens
  -> event injection

Mission Black Box & Evaluation
  -> timeline
  -> decisions
  -> baseline vs assisted paired runs
  -> CCR / AD / MCC / replan metrics

Optional Protocol Adapters
  -> PX4/Gazebo
  -> MAVSDK
  -> ROS 2
  -> future MAVLink/STANAG integrations
```

## Domain Model Guidelines

Prefer these concepts when designing APIs, database tables, simulation state, or frontend state.

- `Vehicle` / `Asset`: one UAV, UGV, USV, relay, sensor node, or synthetic wingman.
- `CapabilityVector`: normalized capability values such as `visual_recon`, `relay`, `overwatch`, `gps_denied_nav`, `reserve`.
- `HealthState`: battery/fuel, link quality, nav quality, sensor status, mobility, confidence, degradation reason.
- `Mission`: operator-level intent, areas, requirements, constraints, approval policy.
- `CapabilityDemand`: per-area or per-task required capability budget.
- `Assignment`: asset-to-role or asset-to-area allocation.
- `Event`: jammer, battery drop, GPS drop, comm degradation, sensor failure, no-go update, vehicle loss, alert flood.
- `RecommendationCard`: cause list, proposed actions, expected KPI effect, approval state.
- `HumanGate`: explicit approval point for high-risk or policy-sensitive changes.
- `MetricEvent`: logged event for MCC, collapse probability, autonomy debt, CCR, operator actions, replan time.
- `BlackBoxEntry`: timestamped state, recommendation, decision, and outcome record for replay and audit.

## MVP Scenario

Use a scenario that demonstrates workload reduction, mission continuity, and capability recovery rather than vehicle movement.

Recommended baseline:

- Assets:
  - `UAV 4 + UGV 2`
  - optional `Synthetic Wingman 12~24`
  - optional high-fidelity `PX4/Gazebo 2~4` only after P0 is stable
- Mission:
  - A/B/C ISR continuity 유지
  - B구역 relay redundancy 최소 1 유지
  - battery 20% 이하 귀환
  - target MCC 0.80 이상 유지
- Injected events:
  - T+90s: B구역 jammer zone
  - T+120s: UxV-02 battery drop
  - T+150s: UxV-03 comm degradation
  - T+180s: no-go zone 생성 또는 priority shift

Expected system behavior:

- Capability Fabric이 상태 저하를 effective capability 감소로 반영한다.
- Mission Metabolism이 MCC 하락, collapse probability 상승, autonomy debt 상승을 계산한다.
- Tactical Immune System이 UxV-02 귀환, UxV-06 대체 투입, UxV-04 relay 재배치 같은 국소 복구안을 만든다.
- Recommendation Card가 원인, 권고, 예상 효과를 보여주고 human approval을 받는다.
- 승인 후 MCC, collapse probability, autonomy debt가 회복된다.
- Evaluation Dashboard가 baseline 대비 assisted mode의 operator actions, replan time, collapse probability, CCR 개선을 보여준다.

## UI/UX Guidance

화면은 telemetry dashboard가 아니라 decision surface여야 한다.

권장 메인 화면:

```text
Top
  Mission Intent Card
  Mission Metabolism Gauge: MCC / Collapse Probability / Autonomy Debt

Center
  2D COP / Map
  Areas, routes, jammer zones, no-go zones, comm shadows, asset icons, synthetic wingman tokens

Bottom or Right
  Capability Fabric Panel
  Recommendation Cards
  Mission Black Box / Metrics / Replay
```

Recommendation Card에는 반드시 다음을 포함한다.

- severity와 제목
- 원인: battery, comm, relay redundancy, capability deficit 등
- 권고: 구체적 action list
- 예상 변화: MCC, collapse probability, autonomy debt, operator actions
- `Approve`, `Reject`, `Manual` decision controls

## Metrics

Track metrics across three categories.

Mission performance:

- Mission Capability Coverage
- Mission Collapse Probability
- Recovery Success
- Replan Time
- Reserve Preservation

Human factors:

- Operator Actions
- Alert Backlog
- Approval Count
- Acknowledgement Time
- Autonomy Debt

Operational efficiency:

- Command Compression Ratio external/internal
- Assets supervised per operator
- System micro-actions per human intent
- Failure recovery time
- Mission Black Box replay completeness

For hackathon judging, the most useful A/B comparison is:

```text
Baseline: operator manually monitors vehicle telemetry and reallocates assets after events.
Assisted: Capability Fabric + Mission Metabolism + Tactical Immune System recommends recovery cards, and the operator approves only key changes.
```

Show paired runs with the same seeds when possible. The strongest claims are fewer operator actions, shorter replan time, lower collapse probability, lower autonomy debt, and higher CCR.

## Recommended Technical Direction

P0 stack:

- Frontend: React + TypeScript + Vite + Zustand
- Backend: Python FastAPI
- 2D simulator: custom canvas, MapLibre, or Leaflet
- Data bus: WebSocket + REST
- Logs: SQLite or JSONL

P1 optional stack:

- PX4 SITL + Gazebo for 2~4 high-fidelity vehicles
- MAVSDK for telemetry/state query
- ROS 2 bridge only if team capacity allows
- LLM intent parser only for Mission Intent JSON generation and explanation text

Implementation priority:

1. 2D simulator + vehicle state model
2. Capability Fabric + MCC calculation
3. Mission Intent Card
4. Initial allocation
5. Event simulator
6. Mission Metabolism / collapse probability
7. Tactical Immune System
8. Recommendation Card + approval gate
9. Autonomy Debt + CCR logs
10. A/B evaluation dashboard
11. Optional PX4/Gazebo or LLM parser

## API Sketch

Use these endpoint shapes as a starting contract.

| Endpoint | Method | Purpose |
|---|---|---|
| `/mission` | `POST` | Create mission intent and constraints |
| `/fleet/state` | `GET` | Read current asset state |
| `/capability/compute` | `POST` | Compute effective capabilities and MCC |
| `/allocate` | `POST` | Produce initial assignments and explanations |
| `/event/inject` | `POST` | Inject jammer, battery, GPS, loss, no-go, priority events |
| `/metabolism/evaluate` | `POST` | Return MCC, strain, collapse probability, autonomy debt |
| `/immune/respond` | `POST` | Generate recommendation card from state and event |
| `/decision` | `POST` | Approve, reject, or manually override a recommendation |
| `/metrics` | `GET` | Return CCR, AD, MCC, operator actions, replan metrics |
| `/replay` | `GET` | Return black box timeline and counterfactual data |

## Safety and Ethics

- Position the prototype as ISR, supervision, resilience, and decision support, not weapon automation.
- LLM usage, if any, is limited to Mission Intent JSON generation, recommendation explanation, and after-action summary.
- Never let LLM output directly command a vehicle. Use `LLM -> schema validator -> rule/safety filter -> planner -> human approval -> simulator`.
- Human approval is mandatory for high-risk replans, no-go changes, mission abort/resume, and priority conflicts.
- Mission Black Box must make recommendations and decisions replayable.

## Non-Goals

Avoid spending the project on:

- manual joystick-style piloting for every vehicle
- a generic telemetry card dashboard
- photorealistic simulation unless perception is the main demo
- pretending the system is fully autonomous without human oversight
- hard-coding core logic directly to one simulator or one vehicle protocol
- overclaiming statistical or operational validity from a small hackathon run
- making PX4/Gazebo integration a blocker for the P0 demo

## Agent Implementation Guidance

When future agents work in this repository:

1. Treat `deep-research-report.md` as the source of truth for the changed project direction.
2. Preserve the Capability-centric Mission Metabolism framing.
3. Prioritize observable mission supervision behavior over simulator polish.
4. Keep core domain logic protocol-independent.
5. Implement and display MCC, Mission Collapse Probability, Autonomy Debt, and CCR wherever possible.
6. Make every recommendation explainable with expected KPI deltas.
7. Include black box logs or metric events for every scenario.
8. Treat human-in-the-loop points as first-class product behavior.
9. Prefer 2D mixed-fidelity simulation and synthetic wingman for P0.
10. Use PX4/Gazebo, MAVSDK, ROS 2, or LLM only when they support the core demo rather than distract from it.
11. When choosing between features, prioritize anything that demonstrates "one operator maintains more mission capability with lower cognitive load."

## Source Notes

- Current source of truth: `deep-research-report.md`
- User-provided problem statement and project brief remain relevant, but the product direction is now capability-centric rather than generic health-aware orchestration.
- Luma event page checked on 2026-07-04: https://luma.com/2ew4xn7b?tk=RJeTgu
