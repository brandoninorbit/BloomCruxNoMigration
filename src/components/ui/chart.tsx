"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"
import type { LegendPayload, LegendProps } from "recharts"
import { cn } from "@/lib/utils"

const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = { config: ChartConfig }
const ChartContext = React.createContext<ChartContextProps | null>(null)
function useChart() {
  const ctx = React.useContext(ChartContext)
  if (!ctx) throw new Error("useChart must be used within a <ChartContainer />")
  return ctx
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"]
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "Chart"

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, cfg]) => cfg.theme || cfg.color)
  if (!colorConfig.length) return null

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color
    return color ? `  --color-${key}: ${color};` : ""
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

// ---------- Tooltip Content ----------
// We define an explicit prop type to avoid version differences in Recharts TooltipProps.
type ChartTooltipContentProps = {
  // core (from recharts)
  active?: boolean
  payload?: readonly LegendPayload[]
  label?: unknown
  // DOM props
  className?: string
  // extras used by our UI
  indicator?: "dot" | "line" | "dashed"
  hideLabel?: boolean
  hideIndicator?: boolean
  labelClassName?: string
  color?: string
  nameKey?: string
  labelKey?: string
  formatter?: (
    value: number | string,
    name: string,
    item: LegendPayload,
    index: number,
    payload: unknown
  ) => React.ReactNode
  labelFormatter?: (value: React.ReactNode, items: LegendPayload[]) => React.ReactNode
}

const ChartTooltipContent: React.FC<ChartTooltipContentProps> = (props) => {
  const {
    payload,
    label,
    active,
    className,
    indicator = "dot",
    hideLabel = false,
    hideIndicator = false,
    labelFormatter,
    labelClassName,
    formatter,
    color,
    nameKey,
    labelKey,
  } = props

  const { config } = useChart()

  const items = React.useMemo<LegendPayload[]>(
    () => (Array.isArray(payload) ? (payload as LegendPayload[]) : []),
    [payload]
  )

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !items.length) return null
    const [item] = items
    const key = `${labelKey || item.dataKey || String(item.value ?? "value")}`
    const itemCfg = getPayloadConfigFromPayload(config, item, key)

    const value =
      !labelKey && typeof label === "string"
        ? config[label as keyof typeof config]?.label || label
        : itemCfg?.label

    if (labelFormatter) {
      return <div className={cn("font-medium", labelClassName)}>{labelFormatter(value ?? null, items)}</div>
    }
    if (!value) return null
    return <div className={cn("font-medium", labelClassName)}>{value}</div>
  }, [label, labelFormatter, items, hideLabel, labelClassName, config, labelKey])

  if (!active || !items.length) return null
  const nestLabel = items.length === 1 && indicator !== "dot"

  return (
    <div
      className={cn(
        "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
        className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {items.map((item, index) => {
          const labelCandidate =
            (nameKey && isRecord(item) && nameKey in item
              ? String((item as Record<string, unknown>)[nameKey] as string)
              : undefined) ||
            (typeof item.value === "string" ? item.value : undefined) ||
            (typeof item.dataKey === "string" ? item.dataKey : undefined) ||
            "value"

          const key = String(labelCandidate)
          const itemCfg = getPayloadConfigFromPayload(config, item, key)
          const indicatorColor =
            color ||
            (isRecord(item.payload) && typeof (item.payload as Record<string, unknown>).fill === "string"
              ? (item.payload as Record<string, unknown>).fill
              : undefined) ||
            item.color

          // normalize the numeric/string display value
          const rawVal = (item as { value?: unknown }).value
          const displayVal =
            typeof rawVal === "number" ? rawVal.toLocaleString() : rawVal != null ? String(rawVal) : null

          return (
            <div
              key={`${String(item.dataKey ?? key)}-${index}`}
              className={cn(
                "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                indicator === "dot" && "items-center"
              )}
            >
              {formatter && rawVal !== undefined ? (
                formatter(
                  typeof rawVal === "number" || typeof rawVal === "string" ? rawVal : String(rawVal),
                  String(labelCandidate),
                  item,
                  index,
                  (item as { payload?: unknown }).payload
                )
              ) : (
                <>
                  {itemCfg?.icon ? (
                    <itemCfg.icon />
                  ) : (
                    !hideIndicator && (
                      <div
                        className={cn(
                          "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                          indicator === "dot" && "h-2.5 w-2.5",
                          indicator === "line" && "w-1",
                          nestLabel && indicator === "dashed" && "w-0 border-[1.5px] border-dashed bg-transparent my-0.5"
                        )}
                        style={
                          {
                            "--color-bg": indicatorColor,
                            "--color-border": indicatorColor,
                          } as React.CSSProperties
                        }
                      />
                    )
                  )}

                  <div className={cn("flex flex-1 justify-between leading-none", nestLabel ? "items-end" : "items-center")}>
                    <div className="grid gap-1.5">
                      {nestLabel ? tooltipLabel : null}
                      <span className="text-muted-foreground">{itemCfg?.label ?? String(labelCandidate)}</span>
                    </div>
                    {displayVal !== null && (
                      <span className="font-mono font-medium tabular-nums text-foreground">{displayVal}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
ChartTooltipContent.displayName = "ChartTooltip"

// ---------- Legend ----------
const ChartLegend = RechartsPrimitive.Legend

type LegendLikeProps = {
  payload?: readonly LegendPayload[]
  verticalAlign?: LegendProps["verticalAlign"]
  hideIcon?: boolean
  nameKey?: string
} & React.HTMLAttributes<HTMLDivElement>

const ChartLegendContent: React.FC<LegendLikeProps> = (props) => {
  const { className, hideIcon = false, payload, verticalAlign = "bottom", nameKey, ...rest } = props
  const { config } = useChart()

  const items = React.useMemo<LegendPayload[]>(
    () => (Array.isArray(payload) ? (payload as LegendPayload[]) : []),
    [payload]
  )
  if (!items.length) return null

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
      {...rest}
    >
      {items.map((item, index) => {
        const labelCandidate =
          (nameKey && isRecord(item) && nameKey in item
            ? String((item as Record<string, unknown>)[nameKey] as string)
            : undefined) ||
          (typeof item.value === "string" ? item.value : undefined) ||
          (typeof item.dataKey === "string" ? item.dataKey : undefined) ||
          "value"
        const key = String(labelCandidate)
        const itemCfg = getPayloadConfigFromPayload(config, item, key)
        return (
          <div
            key={`${String(item.dataKey ?? key)}-${index}`}
            className={cn("flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground")}
          >
            {itemCfg?.icon && !hideIcon ? (
              <itemCfg.icon />
            ) : (
              <div className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
            )}
            {itemCfg?.label ?? String(labelCandidate)}
          </div>
        )
      })}
    </div>
  )
}
ChartLegendContent.displayName = "ChartLegend"

// ---------- Helpers ----------
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null
}

function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
  if (!isRecord(payload)) return undefined

  const inner = isRecord((payload as { payload?: unknown }).payload)
    ? ((payload as { payload?: Record<string, unknown> }).payload as Record<string, unknown>)
    : undefined

  let configLabelKey: string = key

  if (key in payload && typeof (payload as Record<string, unknown>)[key] === "string") {
    configLabelKey = (payload as Record<string, unknown>)[key] as string
  } else if (inner && key in inner && typeof inner[key] === "string") {
    configLabelKey = inner[key] as string
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : (config as Record<string, unknown>)[key] as ChartConfig[string] | undefined
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle }
