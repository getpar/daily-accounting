import { View, Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { PieChart, BarChart, LineChart } from 'echarts/charts'
import {
  TitleComponent, TooltipComponent, LegendComponent, GridComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  PieChart, BarChart, LineChart,
  TitleComponent, TooltipComponent, LegendComponent, GridComponent,
  CanvasRenderer,
])

// 禁用渐进渲染（微信 Canvas 不支持）
echarts.registerPreprocessor((opt: any) => {
  if (opt && opt.series) {
    (Array.isArray(opt.series) ? opt.series : [opt.series]).forEach((s: any) => {
      s.progressive = 0
    })
  }
})

/** 微信 Canvas 2D → 标准 Canvas 的最小适配壳 */
class WxCanvasBridge {
  ctx: any
  canvasNode: any
  chart: any = null

  constructor(ctx: any, canvasNode: any) {
    this.ctx = ctx
    this.canvasNode = canvasNode
  }

  getContext(type: string) {
    return type === '2d' ? this.ctx : null
  }

  setChart(chart: any) {
    this.chart = chart
  }

  get width()  { return this.canvasNode?.width  ?? 0 }
  set width(w) { if (this.canvasNode) this.canvasNode.width  = w }
  get height() { return this.canvasNode?.height ?? 0 }
  set height(h){ if (this.canvasNode) this.canvasNode.height = h }
}

let uid = 0

interface EChartProps {
  option: any
  height?: number
}

export default function EChart({ option, height = 400 }: EChartProps): JSX.Element {
  const cls = useRef(`_ec_${++uid}`)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const inited = useRef(false)

  function initChart(): void {
    if (inited.current) return
    const selector = `.${cls.current}`
    const query = Taro.createSelectorQuery()
    query.select(selector)
      .fields({ node: true, size: true })
      .exec((res: any[]) => {
        try {
          if (!res?.[0]?.node) {
            setTimeout(() => { inited.current = false; initChart() }, 600)
            return
          }
          const canvasNode = res[0].node
          const dpr = Taro.getSystemInfoSync().pixelRatio || 2
          const w = res[0].width  || 350
          const h = res[0].height || height

          // 关键：用 echarts.setCanvasCreator 装配适配壳
          const bridge = new WxCanvasBridge(canvasNode.getContext('2d'), canvasNode)
          echarts.setCanvasCreator(() => bridge as any)

          const chart = echarts.init(bridge as any, null, {
            width: w, height: h, devicePixelRatio: dpr,
          })
          bridge.setChart(chart)
          chart.setOption(option)
          chartRef.current = chart
          inited.current = true
        } catch (e) {
          console.error('EChart init error:', e)
        }
      })
  }

  useEffect(() => {
    const timer = setTimeout(initChart, 300)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (chartRef.current && !chartRef.current.isDisposed()) {
      chartRef.current.setOption(option, true)
    }
  }, [option])

  useEffect(() => () => {
    if (chartRef.current && !chartRef.current.isDisposed()) {
      chartRef.current.dispose()
    }
  }, [])

  return (
    <View style={{ width: '100%', height: `${height}px` }}>
      {/* @ts-ignore */}
      <Canvas
        type="2d"
        className={cls.current}
        style={{ width: '100%', height: `${height}px` }}
      />
    </View>
  )
}
