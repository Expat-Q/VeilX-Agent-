"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  CandlestickSeries,
  AreaSeries,
  LineSeries,
  HistogramSeries,
  LineStyle,
  createSeriesMarkers,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  HistogramData,
  ColorType,
  Time,
} from "lightweight-charts";
import { AssetLogo } from "@/components/common/AssetLogo";
import { OrderHistoryItem } from "@/lib/trading-copilot";
import { StockAsset } from "@/lib/ondo-stocks";
import {
  Maximize2,
  Minimize2,
  BarChart2,
  TrendingUp,
  ChevronDown,
  Search,
  Check,
  Calendar,
  Sliders,
  Plus,
  Trash2,
  X,
  Layers,
  ArrowRight,
} from "lucide-react";

interface TradingChartProps {
  asset: StockAsset;
  allAssets?: StockAsset[];
  onSelectAsset?: (symbol: string) => void;
  orderHistory?: OrderHistoryItem[];
  className?: string;
}

export type Timeframe = "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "ALL";
type ChartType = "candlestick" | "area";

interface CustomPriceLine {
  id: string;
  price: number;
  title: string;
  color: string;
}

// Generate realistic synthetic historical candles grounded around current live oracle price
function generateCandles(currentPrice: number, timeframe: Timeframe): CandlestickData[] {
  let count = 96;
  let intervalSeconds = 15 * 60; // 15 mins for 1D

  switch (timeframe) {
    case "1D":
      count = 96;
      intervalSeconds = 15 * 60;
      break;
    case "5D":
      count = 120;
      intervalSeconds = 3600; // 1 hour
      break;
    case "1M":
      count = 120;
      intervalSeconds = 6 * 3600; // 6 hours
      break;
    case "3M":
      count = 90;
      intervalSeconds = 24 * 3600; // 1 day
      break;
    case "6M":
      count = 180;
      intervalSeconds = 24 * 3600;
      break;
    case "YTD":
      count = 250;
      intervalSeconds = 24 * 3600;
      break;
    case "1Y":
      count = 365;
      intervalSeconds = 24 * 3600;
      break;
    case "ALL":
      count = 450;
      intervalSeconds = 24 * 3600;
      break;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const data: CandlestickData[] = [];

  let runningClose = currentPrice;
  const volatility = currentPrice * (timeframe === "1D" ? 0.003 : 0.008);

  const rawPrices: { open: number; high: number; low: number; close: number }[] = [];
  for (let i = 0; i < count; i++) {
    const delta = (Math.random() - 0.49) * volatility;
    const open = runningClose - delta;
    const high = Math.max(open, runningClose) + Math.random() * (volatility * 0.5);
    const low = Math.min(open, runningClose) - Math.random() * (volatility * 0.5);
    const close = runningClose;

    rawPrices.unshift({
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
    });

    runningClose = open;
  }

  for (let i = 0; i < count; i++) {
    const time = (nowSec - (count - 1 - i) * intervalSeconds) as Time;
    data.push({
      time,
      open: rawPrices[i].open,
      high: rawPrices[i].high,
      low: rawPrices[i].low,
      close: rawPrices[i].close,
    });
  }

  if (data.length > 0) {
    data[data.length - 1].close = currentPrice;
    data[data.length - 1].high = Math.max(data[data.length - 1].high, currentPrice);
    data[data.length - 1].low = Math.min(data[data.length - 1].low, currentPrice);
  }

  return data;
}

// Indicator math helpers
function calculateSMA(data: CandlestickData[], period: number): LineData[] {
  const result: LineData[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += (data[i - j] as any).close;
    }
    result.push({
      time: data[i].time,
      value: Number((sum / period).toFixed(2)),
    });
  }
  return result;
}

function calculateEMA(data: CandlestickData[], period: number): LineData[] {
  const result: LineData[] = [];
  const k = 2 / (period + 1);
  let prevEma: number | null = null;

  for (let i = 0; i < data.length; i++) {
    const close = (data[i] as any).close;
    if (i < period - 1) continue;
    if (prevEma === null) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += (data[i - j] as any).close;
      }
      prevEma = sum / period;
    } else {
      prevEma = close * k + prevEma * (1 - k);
    }
    result.push({
      time: data[i].time,
      value: Number(prevEma.toFixed(2)),
    });
  }
  return result;
}

function calculateBollingerBands(data: CandlestickData[], period = 20, multiplier = 2) {
  const upper: LineData[] = [];
  const lower: LineData[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += (data[i - j] as any).close;
    }
    const mean = sum / period;
    let varianceSum = 0;
    for (let j = 0; j < period; j++) {
      varianceSum += Math.pow((data[i - j] as any).close - mean, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);
    upper.push({
      time: data[i].time,
      value: Number((mean + multiplier * stdDev).toFixed(2)),
    });
    lower.push({
      time: data[i].time,
      value: Number((mean - multiplier * stdDev).toFixed(2)),
    });
  }
  return { upper, lower };
}

function generateVolume(data: CandlestickData[]): HistogramData[] {
  return data.map((c) => {
    const isUp = c.close >= c.open;
    const vol = Math.floor(Math.abs(c.close - c.open) * 15000 + 5000);
    return {
      time: c.time,
      value: vol,
      color: isUp ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)",
    };
  });
}

export function TradingChart({
  asset,
  allAssets = [],
  onSelectAsset,
  orderHistory = [],
  className = "",
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const currentSymbolRef = useRef<string>(asset.symbol);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sma20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sma50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const upperBollingerRef = useRef<ISeriesApi<"Line"> | null>(null);
  const lowerBollingerRef = useRef<ISeriesApi<"Line"> | null>(null);
  const seriesMarkersRef = useRef<any>(null);
  const priceLineHandlesRef = useRef<any[]>([]);
  const candleDataRef = useRef<CandlestickData[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentChartTypeRef = useRef<ChartType>(chartType);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const indicatorsRef = useRef<HTMLDivElement>(null);

  // Dropdown & Popover States
  const [isAssetDropdownOpen, setIsAssetDropdownOpen] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);

  // Custom Date Picker inputs
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Technical Indicators Toggles
  const [showSma20, setShowSma20] = useState(true);
  const [showSma50, setShowSma50] = useState(false);
  const [showEma20, setShowEma20] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showVolume, setShowVolume] = useState(true);

  // User-defined Support & Resistance Price Lines
  const [priceLines, setPriceLines] = useState<CustomPriceLine[]>([
    { id: "line_1", price: Number((asset.price * 0.96).toFixed(2)), title: "Key Support", color: "#3B82F6" },
    { id: "line_2", price: Number((asset.price * 1.04).toFixed(2)), title: "Resistance", color: "#EC4899" },
  ]);
  const [newLinePrice, setNewLinePrice] = useState("");
  const [newLineTitle, setNewLineTitle] = useState("Support");

  // Strict Filter: Only show the 17 tokenized US Equities, ETFs & Commodities in the stock selector
  const stockAssetsOnly = useMemo(() => {
    const list = allAssets.length > 0 ? allAssets : [asset];
    return list.filter((a) => a.category !== "crypto");
  }, [allAssets, asset]);

  // Close popovers on click outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsAssetDropdownOpen(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setIsDatePickerOpen(false);
      }
      if (indicatorsRef.current && !indicatorsRef.current.contains(e.target as Node)) {
        setIsIndicatorsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Handle ESC key for True Fullscreen exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Helper: Render Support & Resistance lines without recreating the chart
  const renderPriceLines = React.useCallback((series: ISeriesApi<any>) => {
    priceLineHandlesRef.current.forEach((handle) => {
      try {
        series.removePriceLine(handle);
      } catch {}
    });
    priceLineHandlesRef.current = [];

    priceLines.forEach((pl) => {
      try {
        const handle = series.createPriceLine({
          price: pl.price,
          color: pl.color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: pl.title,
        });
        if (handle) {
          priceLineHandlesRef.current.push(handle);
        }
      } catch {}
    });
  }, [priceLines]);

  // Helper: Render Order History Markers on candlestick series without recreating the chart
  const renderOrderMarkers = React.useCallback((series: ISeriesApi<any>) => {
    if (chartType !== "candlestick") {
      if (seriesMarkersRef.current) {
        try {
          seriesMarkersRef.current.setMarkers([]);
        } catch {}
      }
      return;
    }
    const candleData = candleDataRef.current;
    const relevantOrders = orderHistory.filter(
      (o) => o.symbol.toLowerCase() === asset.symbol.toLowerCase() && o.status === "filled"
    );
    if (relevantOrders.length > 0 && candleData.length > 0) {
      const markers = relevantOrders.slice(0, 8).map((ord, idx) => {
        const candleIndex = Math.max(0, candleData.length - 1 - idx * 4);
        const time = candleData[candleIndex]?.time || candleData[candleData.length - 1].time;
        return {
          time,
          position: ord.side === "buy" ? ("belowBar" as const) : ("aboveBar" as const),
          color: ord.side === "buy" ? "#10B981" : "#EF4444",
          shape: ord.side === "buy" ? ("arrowUp" as const) : ("arrowDown" as const),
          text: `${ord.side.toUpperCase()} $${ord.amountUsd.toFixed(0)}`,
        };
      });
      if (seriesMarkersRef.current) {
        seriesMarkersRef.current.setMarkers(markers);
      } else {
        seriesMarkersRef.current = createSeriesMarkers(series, markers as any);
      }
    } else if (seriesMarkersRef.current) {
      seriesMarkersRef.current.setMarkers([]);
    }
  }, [chartType, orderHistory, asset.symbol]);

  // Main Chart Creation: ONLY recreated on mount or when asset symbol or timeframe switches
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    currentSymbolRef.current = asset.symbol;
    mainSeriesRef.current = null;
    volumeSeriesRef.current = null;
    sma20SeriesRef.current = null;
    sma50SeriesRef.current = null;
    ema20SeriesRef.current = null;
    upperBollingerRef.current = null;
    lowerBollingerRef.current = null;
    seriesMarkersRef.current = null;
    priceLineHandlesRef.current = [];

    const container = chartContainerRef.current;
    const chartHeight = isFullscreen ? container.clientHeight || 650 : 340;

    const chart = createChart(container, {
      width: container.clientWidth || 600,
      height: chartHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#FFFFFF" },
        textColor: "#6B5A4E",
        fontSize: 11,
        fontFamily: "'Inter', sans-serif, -apple-system",
      },
      grid: {
        vertLines: { color: "#F4EFE6" },
        horzLines: { color: "#F4EFE6" },
      },
      crosshair: {
        vertLine: { color: "#1E1315", width: 1, style: LineStyle.Dotted, labelBackgroundColor: "#1E1315" },
        horzLine: { color: "#1E1315", width: 1, style: LineStyle.Dotted, labelBackgroundColor: "#1E1315" },
      },
      rightPriceScale: {
        borderColor: "#EBE3D5",
        scaleMargins: { top: 0.12, bottom: showVolume ? 0.22 : 0.12 },
      },
      timeScale: {
        borderColor: "#EBE3D5",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: { axisPressedMouseMove: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
    });

    chartRef.current = chart;
    const candleData = generateCandles(asset.price, timeframe);
    candleDataRef.current = candleData;
    currentChartTypeRef.current = chartType;

    // Primary Price Series (Candles or Area)
    let mainSeries: any = null;
    if (chartType === "candlestick") {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#10B981",
        downColor: "#EF4444",
        borderVisible: false,
        wickUpColor: "#10B981",
        wickDownColor: "#EF4444",
      });
      mainSeries.setData(candleData);
      mainSeriesRef.current = mainSeries;
      renderOrderMarkers(mainSeries);
    } else {
      mainSeries = chart.addSeries(AreaSeries, {
        topColor: "rgba(16, 185, 129, 0.28)",
        bottomColor: "rgba(16, 185, 129, 0.01)",
        lineColor: "#10B981",
        lineWidth: 2,
      });
      const areaData: LineData[] = candleData.map((c) => ({
        time: c.time,
        value: c.close,
      }));
      mainSeries.setData(areaData);
      mainSeriesRef.current = mainSeries;
    }

    // 1. Technical Indicator: Volume Histogram
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "", // Overlay on separate internal scale
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });
      volumeSeries.setData(generateVolume(candleData));
      volumeSeriesRef.current = volumeSeries;
    }

    // 2. Technical Indicator: 20-SMA (Cyan)
    if (showSma20) {
      const smaSeries = chart.addSeries(LineSeries, {
        color: "#06B6D4",
        lineWidth: 2,
        title: "SMA 20",
      });
      smaSeries.setData(calculateSMA(candleData, 20));
      sma20SeriesRef.current = smaSeries;
    }

    // 3. Technical Indicator: 50-SMA (Amber)
    if (showSma50) {
      const sma50Series = chart.addSeries(LineSeries, {
        color: "#F59E0B",
        lineWidth: 2,
        title: "SMA 50",
      });
      sma50Series.setData(calculateSMA(candleData, 50));
      sma50SeriesRef.current = sma50Series;
    }

    // 4. Technical Indicator: 20-EMA (Emerald)
    if (showEma20) {
      const emaSeries = chart.addSeries(LineSeries, {
        color: "#10B981",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: "EMA 20",
      });
      emaSeries.setData(calculateEMA(candleData, 20));
      ema20SeriesRef.current = emaSeries;
    }

    // 5. Technical Indicator: Bollinger Bands (Indigo)
    if (showBollinger) {
      const { upper, lower } = calculateBollingerBands(candleData, 20, 2);
      const upperSeries = chart.addSeries(LineSeries, {
        color: "rgba(99, 102, 241, 0.7)",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        title: "Upper BB",
      });
      const lowerSeries = chart.addSeries(LineSeries, {
        color: "rgba(99, 102, 241, 0.7)",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        title: "Lower BB",
      });
      upperSeries.setData(upper);
      lowerSeries.setData(lower);
      upperBollingerRef.current = upperSeries;
      lowerBollingerRef.current = lowerSeries;
    }

    // 6. User-Configured Support & Resistance Price Lines
    if (mainSeries && priceLines.length > 0) {
      renderPriceLines(mainSeries);
    }

    chart.timeScale().fitContent();

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      sma20SeriesRef.current = null;
      sma50SeriesRef.current = null;
      ema20SeriesRef.current = null;
      upperBollingerRef.current = null;
      lowerBollingerRef.current = null;
      seriesMarkersRef.current = null;
      priceLineHandlesRef.current = [];
    };
  }, [asset.symbol, timeframe]);

  // Handle container resize & fullscreen toggling WITHOUT chart recreation
  useEffect(() => {
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const newHeight = isFullscreen ? window.innerHeight - 110 : 340;
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: newHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    const timer = setTimeout(handleResize, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [isFullscreen]);

  // Handle tick arrival / interval refresh for the SAME asset: NO chart teardown
  useEffect(() => {
    if (!chartRef.current || !mainSeriesRef.current) return;
    if (currentSymbolRef.current !== asset.symbol) return;
    const candles = candleDataRef.current;
    if (!candles || candles.length === 0) return;

    const lastIndex = candles.length - 1;
    const lastCandle = candles[lastIndex];
    const newPrice = asset.price;

    const updatedCandle: CandlestickData = {
      time: lastCandle.time,
      open: (lastCandle as any).open,
      high: Math.max((lastCandle as any).high, newPrice),
      low: Math.min((lastCandle as any).low, newPrice),
      close: newPrice,
    };
    candles[lastIndex] = updatedCandle;

    if (chartType === "candlestick") {
      mainSeriesRef.current.update(updatedCandle);
    } else {
      mainSeriesRef.current.update({
        time: updatedCandle.time,
        value: newPrice,
      });
    }

    // Smoothly update indicators via setData() without tearing down canvas
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(generateVolume(candles));
    }
    if (sma20SeriesRef.current) {
      sma20SeriesRef.current.setData(calculateSMA(candles, 20));
    }
    if (sma50SeriesRef.current) {
      sma50SeriesRef.current.setData(calculateSMA(candles, 50));
    }
    if (ema20SeriesRef.current) {
      ema20SeriesRef.current.setData(calculateEMA(candles, 20));
    }
    if (upperBollingerRef.current && lowerBollingerRef.current) {
      const { upper, lower } = calculateBollingerBands(candles, 20, 2);
      upperBollingerRef.current.setData(upper);
      lowerBollingerRef.current.setData(lower);
    }
  }, [asset.price, asset.symbol, chartType]);

  // Live Micro-Tick Engine: updates the active candle every 2.2s so the chart breathes in real-time
  useEffect(() => {
    const liveTickInterval = setInterval(() => {
      if (!mainSeriesRef.current || candleDataRef.current.length === 0) return;
      const candles = candleDataRef.current;
      const lastIndex = candles.length - 1;
      const lastCandle = candles[lastIndex];
      if (!lastCandle) return;

      const currentClose = (lastCandle as any).close || asset.price;
      const deltaPercent = (Math.random() - 0.49) * 0.0007;
      const livePrice = Number((currentClose * (1 + deltaPercent)).toFixed(2));
      const newHigh = Number(Math.max((lastCandle as any).high, livePrice).toFixed(2));
      const newLow = Number(Math.min((lastCandle as any).low, livePrice).toFixed(2));

      const updatedCandle: CandlestickData = {
        time: lastCandle.time,
        open: (lastCandle as any).open,
        high: newHigh,
        low: newLow,
        close: livePrice,
      };
      candles[lastIndex] = updatedCandle;

      if (chartType === "candlestick") {
        mainSeriesRef.current.update(updatedCandle);
      } else {
        mainSeriesRef.current.update({
          time: lastCandle.time,
          value: livePrice,
        });
      }
    }, 2200);

    return () => clearInterval(liveTickInterval);
  }, [chartType, asset.price]);

  // Chart type switch (candlestick vs area) without recreating the chart instance
  useEffect(() => {
    if (!chartRef.current) return;
    if (currentChartTypeRef.current === chartType && mainSeriesRef.current) return;
    currentChartTypeRef.current = chartType;

    if (mainSeriesRef.current) {
      try {
        chartRef.current.removeSeries(mainSeriesRef.current);
      } catch {}
      mainSeriesRef.current = null;
    }
    seriesMarkersRef.current = null;

    const candleData = candleDataRef.current;
    if (chartType === "candlestick") {
      const s = chartRef.current.addSeries(CandlestickSeries, {
        upColor: "#10B981",
        downColor: "#EF4444",
        borderVisible: false,
        wickUpColor: "#10B981",
        wickDownColor: "#EF4444",
      });
      s.setData(candleData);
      mainSeriesRef.current = s;
      renderOrderMarkers(s);
    } else {
      const s = chartRef.current.addSeries(AreaSeries, {
        topColor: "rgba(16, 185, 129, 0.28)",
        bottomColor: "rgba(16, 185, 129, 0.01)",
        lineColor: "#10B981",
        lineWidth: 2,
      });
      const areaData: LineData[] = candleData.map((c) => ({
        time: c.time,
        value: c.close,
      }));
      s.setData(areaData);
      mainSeriesRef.current = s;
    }
    if (mainSeriesRef.current) {
      renderPriceLines(mainSeriesRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType]);

  // Indicator Toggle: Volume Histogram
  useEffect(() => {
    if (!chartRef.current) return;
    if (showVolume) {
      if (!volumeSeriesRef.current) {
        const vs = chartRef.current.addSeries(HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "",
        });
        vs.priceScale().applyOptions({
          scaleMargins: { top: 0.82, bottom: 0 },
        });
        vs.setData(generateVolume(candleDataRef.current));
        volumeSeriesRef.current = vs;
      }
    } else {
      if (volumeSeriesRef.current) {
        try {
          chartRef.current.removeSeries(volumeSeriesRef.current);
        } catch {}
        volumeSeriesRef.current = null;
      }
    }
    chartRef.current.applyOptions({
      rightPriceScale: {
        scaleMargins: { top: 0.12, bottom: showVolume ? 0.22 : 0.12 },
      },
    });
  }, [showVolume]);

  // Indicator Toggle: SMA 20
  useEffect(() => {
    if (!chartRef.current) return;
    if (showSma20) {
      if (!sma20SeriesRef.current) {
        const s = chartRef.current.addSeries(LineSeries, {
          color: "#06B6D4",
          lineWidth: 2,
          title: "SMA 20",
        });
        s.setData(calculateSMA(candleDataRef.current, 20));
        sma20SeriesRef.current = s;
      }
    } else {
      if (sma20SeriesRef.current) {
        try {
          chartRef.current.removeSeries(sma20SeriesRef.current);
        } catch {}
        sma20SeriesRef.current = null;
      }
    }
  }, [showSma20]);

  // Indicator Toggle: SMA 50
  useEffect(() => {
    if (!chartRef.current) return;
    if (showSma50) {
      if (!sma50SeriesRef.current) {
        const s = chartRef.current.addSeries(LineSeries, {
          color: "#F59E0B",
          lineWidth: 2,
          title: "SMA 50",
        });
        s.setData(calculateSMA(candleDataRef.current, 50));
        sma50SeriesRef.current = s;
      }
    } else {
      if (sma50SeriesRef.current) {
        try {
          chartRef.current.removeSeries(sma50SeriesRef.current);
        } catch {}
        sma50SeriesRef.current = null;
      }
    }
  }, [showSma50]);

  // Indicator Toggle: EMA 20
  useEffect(() => {
    if (!chartRef.current) return;
    if (showEma20) {
      if (!ema20SeriesRef.current) {
        const s = chartRef.current.addSeries(LineSeries, {
          color: "#10B981",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          title: "EMA 20",
        });
        s.setData(calculateEMA(candleDataRef.current, 20));
        ema20SeriesRef.current = s;
      }
    } else {
      if (ema20SeriesRef.current) {
        try {
          chartRef.current.removeSeries(ema20SeriesRef.current);
        } catch {}
        ema20SeriesRef.current = null;
      }
    }
  }, [showEma20]);

  // Indicator Toggle: Bollinger Bands
  useEffect(() => {
    if (!chartRef.current) return;
    if (showBollinger) {
      if (!upperBollingerRef.current) {
        const { upper, lower } = calculateBollingerBands(candleDataRef.current, 20, 2);
        const upperSeries = chartRef.current.addSeries(LineSeries, {
          color: "rgba(99, 102, 241, 0.7)",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          title: "Upper BB",
        });
        const lowerSeries = chartRef.current.addSeries(LineSeries, {
          color: "rgba(99, 102, 241, 0.7)",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          title: "Lower BB",
        });
        upperSeries.setData(upper);
        lowerSeries.setData(lower);
        upperBollingerRef.current = upperSeries;
        lowerBollingerRef.current = lowerSeries;
      }
    } else {
      if (upperBollingerRef.current) {
        try {
          chartRef.current.removeSeries(upperBollingerRef.current);
        } catch {}
        upperBollingerRef.current = null;
      }
      if (lowerBollingerRef.current) {
        try {
          chartRef.current.removeSeries(lowerBollingerRef.current);
        } catch {}
        lowerBollingerRef.current = null;
      }
    }
  }, [showBollinger]);

  // Support & Resistance Price Lines update
  useEffect(() => {
    if (mainSeriesRef.current) {
      renderPriceLines(mainSeriesRef.current);
    }
  }, [renderPriceLines]);

  // Order history markers update
  useEffect(() => {
    if (mainSeriesRef.current) {
      renderOrderMarkers(mainSeriesRef.current);
    }
  }, [renderOrderMarkers]);

  // Apply Custom Date Range to Chart
  const handleApplyCustomDateRange = () => {
    if (!customStartDate || !chartRef.current) return;
    const startSec = Math.floor(new Date(customStartDate).getTime() / 1000);
    const endSec = customEndDate
      ? Math.floor(new Date(customEndDate).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    if (startSec >= endSec) return;

    chartRef.current.timeScale().setVisibleRange({
      from: startSec as Time,
      to: endSec as Time,
    });
    setIsDatePickerOpen(false);
  };

  // Quick Preset Date Jump
  const handleQuickDatePreset = (daysBack: number) => {
    if (!chartRef.current) return;
    const nowSec = Math.floor(Date.now() / 1000);
    const fromSec = nowSec - daysBack * 86400;
    chartRef.current.timeScale().setVisibleRange({
      from: fromSec as Time,
      to: nowSec as Time,
    });
    setIsDatePickerOpen(false);
  };

  // Add User Price Line
  const handleAddPriceLine = () => {
    const p = parseFloat(newLinePrice);
    if (isNaN(p) || p <= 0) return;
    const newLine: CustomPriceLine = {
      id: `pl_${Date.now()}`,
      price: Number(p.toFixed(2)),
      title: newLineTitle || "Price Line",
      color: newLineTitle.toLowerCase().includes("support") ? "#3B82F6" : "#EC4899",
    };
    setPriceLines([...priceLines, newLine]);
    setNewLinePrice("");
  };

  const isPositive = asset.change24h >= 0;

  return (
    <div
      className={`transition-all duration-150 ${
        isFullscreen
          ? "fixed inset-0 z-[100] w-screen h-screen bg-[#FAF7F0] p-4 sm:p-6 flex flex-col overflow-hidden"
          : `bg-white border border-[#EBE3D5] rounded-3xl p-3.5 sm:p-4 shadow-2xs space-y-3 ${className}`
      }`}
    >
      {/* Top Header Bar: Asset Info, Strict Stocks Dropdown, Timeframes, Indicators & Fullscreen */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#F4EFE6] shrink-0">
        {/* Left: Asset Selector with strictly 17 US Equities & ETFs */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsAssetDropdownOpen(!isAssetDropdownOpen)}
            className="flex items-center gap-2.5 p-1 -ml-1 rounded-2xl hover:bg-[#FAF7F0] border border-transparent hover:border-[#EBE3D5] transition cursor-pointer text-left"
            title="Click to select from 17 Ondo Tokenized US Equities & ETFs"
          >
            <AssetLogo symbol={asset.symbol} className="w-8 h-8 rounded-full shadow-2xs shrink-0" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif text-sm font-bold text-[#1E1315]">{asset.symbol}</span>
                <span className="text-[11px] text-[#7A6A5E] truncate max-w-[130px] sm:max-w-none">
                  {asset.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#7A6A5E]" />
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="font-bold text-[#1E1315]">${asset.price.toFixed(2)}</span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${
                    isPositive
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {asset.change24h}%
                </span>
              </div>
            </div>
          </button>

          {/* Interactive Dropdown Menu (Strictly 17 Tokenized Stocks & ETFs, Zero Crypto) */}
          {isAssetDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-[#EBE3D5] rounded-2xl shadow-xl z-50 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between px-1 text-[11px] font-mono text-[#6E5D4F]">
                <span>Tokenized Equities &amp; ETFs</span>
                <span className="font-bold text-[#1E1315]">{stockAssetsOnly.length} Assets</span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6E5D4F]" />
                <input
                  type="text"
                  value={assetSearchQuery}
                  onChange={(e) => setAssetSearchQuery(e.target.value)}
                  placeholder="Search stock ticker (TSLA, NVDA)..."
                  className="w-full bg-[#FAF7F0] border border-[#EBE3D5] rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-[#1E1315] outline-none placeholder-[#6E5D4F]"
                  autoFocus
                />
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                {stockAssetsOnly
                  .filter(
                    (item) =>
                      item.symbol.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
                      item.name.toLowerCase().includes(assetSearchQuery.toLowerCase())
                  )
                  .map((item) => {
                    const isSelected = item.symbol === asset.symbol;
                    const itemPositive = item.change24h >= 0;
                    return (
                      <div
                        key={item.symbol}
                        onClick={() => {
                          onSelectAsset?.(item.symbol);
                          setIsAssetDropdownOpen(false);
                          setAssetSearchQuery("");
                        }}
                        className={`flex items-center justify-between p-2 rounded-xl transition cursor-pointer text-xs ${
                          isSelected ? "bg-[#FAF7F0] border border-[#EBE3D5]" : "hover:bg-[#FAF7F0]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AssetLogo symbol={item.symbol} className="w-6 h-6 rounded-full shrink-0" />
                          <div className="truncate">
                            <span className="font-bold text-[#1E1315] block">{item.symbol}</span>
                            <span className="text-[10px] text-[#7A6A5E] truncate block">
                              {item.name}
                            </span>
                          </div>
                        </div>
                        <div className="text-right font-mono shrink-0 pl-2">
                          <span className="font-bold text-[#1E1315] block">
                            ${item.price.toFixed(2)}
                          </span>
                          <span
                            className={`text-[9px] font-semibold ${
                              itemPositive ? "text-emerald-700" : "text-rose-700"
                            }`}
                          >
                            {itemPositive ? "+" : ""}
                            {item.change24h}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Right Toolbar: Timeframe Horizons, Date Picker, Technical Indicators & Fullscreen */}
        <div className="flex items-center gap-1.5 max-w-full overflow-x-auto no-scrollbar py-0.5 shrink-0">
          {/* Expanded Timeframe Horizon Buttons */}
          <div className="flex items-center bg-[#FAF7F0] border border-[#EBE3D5] rounded-xl p-0.5 shrink-0">
            {(["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "ALL"] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer whitespace-nowrap ${
                  timeframe === tf
                    ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs"
                    : "text-[#7A6A5E] hover:text-[#1E1315]"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Date Picker Button & Popover */}
          <div className="relative shrink-0" ref={datePickerRef}>
            <button
              type="button"
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              title="Custom Date Range / Historical Date Picker"
              className={`p-1.5 rounded-xl border transition cursor-pointer flex items-center gap-1 ${
                isDatePickerOpen
                  ? "bg-[#1E1315] text-[#FAF7F0] border-[#1E1315]"
                  : "bg-[#FAF7F0] hover:bg-[#EFE8D8] border-[#EBE3D5] text-[#7A6A5E] hover:text-[#1E1315]"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>

            {isDatePickerOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#EBE3D5] rounded-2xl shadow-xl z-50 p-3 space-y-3 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#F4EFE6]">
                  <span className="text-xs font-bold text-[#1E1315]">Date Range Picker</span>
                  <button
                    type="button"
                    onClick={() => chartRef.current?.timeScale().fitContent()}
                    className="text-[10px] font-mono font-semibold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Reset Fit
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono text-[#6E5D4F] block">Quick Presets</span>
                  <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => handleQuickDatePreset(7)}
                      className="p-1.5 rounded-lg border border-[#EBE3D5] bg-[#FAF7F0] hover:bg-white text-left transition cursor-pointer"
                    >
                      Past 7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDatePreset(30)}
                      className="p-1.5 rounded-lg border border-[#EBE3D5] bg-[#FAF7F0] hover:bg-white text-left transition cursor-pointer"
                    >
                      Past 30 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDatePreset(90)}
                      className="p-1.5 rounded-lg border border-[#EBE3D5] bg-[#FAF7F0] hover:bg-white text-left transition cursor-pointer"
                    >
                      Past 90 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDatePreset(180)}
                      className="p-1.5 rounded-lg border border-[#EBE3D5] bg-[#FAF7F0] hover:bg-white text-left transition cursor-pointer"
                    >
                      Past 6 Months
                    </button>
                  </div>
                </div>

                {/* Custom Start & End Date Inputs */}
                <div className="space-y-2 pt-1 border-t border-[#F4EFE6]">
                  <span className="text-[10px] uppercase font-mono text-[#6E5D4F] block">Custom Calendar Window</span>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <label className="text-[10px] font-semibold text-[#7A6A5E] block mb-0.5">Start Date</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full bg-[#FAF7F0] border border-[#EBE3D5] rounded-xl px-2.5 py-1 text-xs text-[#1E1315] font-mono outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[#7A6A5E] block mb-0.5">End Date</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full bg-[#FAF7F0] border border-[#EBE3D5] rounded-xl px-2.5 py-1 text-xs text-[#1E1315] font-mono outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustomDateRange}
                    className="w-full py-1.5 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] text-xs font-mono font-bold transition shadow-2xs cursor-pointer mt-1"
                  >
                    Apply Date Range
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Technical Analysis / Indicators Button & Menu */}
          <div className="relative shrink-0" ref={indicatorsRef}>
            <button
              type="button"
              onClick={() => setIsIndicatorsOpen(!isIndicatorsOpen)}
              title="Technical Indicators (SMA, EMA, Bollinger, Volume, Support/Resistance)"
              className={`p-1.5 rounded-xl border transition cursor-pointer flex items-center gap-1 ${
                isIndicatorsOpen || showSma20 || showBollinger || showVolume
                  ? "bg-[#1E1315] text-[#FAF7F0] border-[#1E1315]"
                  : "bg-[#FAF7F0] hover:bg-[#EFE8D8] border-[#EBE3D5] text-[#7A6A5E] hover:text-[#1E1315]"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono font-bold hidden sm:inline">Indicators</span>
            </button>

            {isIndicatorsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#EBE3D5] rounded-2xl shadow-xl z-50 p-3 space-y-3 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#F4EFE6]">
                  <span className="text-xs font-bold text-[#1E1315]">Technical Indicators</span>
                  <span className="text-[10px] font-mono text-[#6E5D4F]">TradingView Canvas</span>
                </div>

                {/* Overlays Toggles */}
                <div className="space-y-1.5 text-xs font-mono">
                  <label className="flex items-center justify-between p-1.5 rounded-xl hover:bg-[#FAF7F0] cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#06B6D4]" />
                      <span>20-SMA (Short-term)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={showSma20}
                      onChange={(e) => setShowSma20(e.target.checked)}
                      className="cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-xl hover:bg-[#FAF7F0] cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                      <span>50-SMA (Medium-term)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={showSma50}
                      onChange={(e) => setShowSma50(e.target.checked)}
                      className="cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-xl hover:bg-[#FAF7F0] cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                      <span>20-EMA (Fast Reaction)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={showEma20}
                      onChange={(e) => setShowEma20(e.target.checked)}
                      className="cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-xl hover:bg-[#FAF7F0] cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                      <span>Bollinger Bands (20, 2)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={showBollinger}
                      onChange={(e) => setShowBollinger(e.target.checked)}
                      className="cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-xl hover:bg-[#FAF7F0] cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>Volume Histogram</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={showVolume}
                      onChange={(e) => setShowVolume(e.target.checked)}
                      className="cursor-pointer"
                    />
                  </label>
                </div>

                {/* Support & Resistance Price Lines Section */}
                <div className="pt-2 border-t border-[#F4EFE6] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#1E1315]">Support &amp; Resistance Levels</span>
                    <span className="text-[10px] font-mono text-[#6E5D4F]">{priceLines.length} Active</span>
                  </div>

                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {priceLines.map((pl) => (
                      <div
                        key={pl.id}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-[#FAF7F0] text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pl.color }} />
                          <span className="text-[#1E1315] font-semibold">{pl.title}</span>
                          <span className="text-[#7A6A5E]">${pl.price.toFixed(2)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPriceLines(priceLines.filter((l) => l.id !== pl.id))}
                          className="text-[#6E5D4F] hover:text-red-700 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Price Line Form */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="number"
                      step="any"
                      placeholder="Price (e.g. 365)"
                      value={newLinePrice}
                      onChange={(e) => setNewLinePrice(e.target.value)}
                      className="w-24 bg-[#FAF7F0] border border-[#EBE3D5] rounded-xl px-2 py-1 text-xs text-[#1E1315] font-mono outline-none"
                    />
                    <select
                      value={newLineTitle}
                      onChange={(e) => setNewLineTitle(e.target.value)}
                      className="bg-[#FAF7F0] border border-[#EBE3D5] rounded-xl px-2 py-1 text-xs text-[#1E1315] font-mono outline-none cursor-pointer"
                    >
                      <option value="Support">Support</option>
                      <option value="Resistance">Resistance</option>
                      <option value="Breakout">Breakout</option>
                      <option value="Stop Target">Stop Target</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddPriceLine}
                      disabled={!newLinePrice}
                      className="p-1 rounded-xl bg-[#1E1315] text-[#FAF7F0] hover:bg-[#2C1D20] disabled:opacity-40 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chart Type Toggle (Candlestick / Area) */}
          <div className="flex items-center bg-[#FAF7F0] border border-[#EBE3D5] rounded-xl p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setChartType("candlestick")}
              title="Candlestick Chart"
              className={`p-1 rounded-lg transition cursor-pointer ${
                chartType === "candlestick"
                  ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs"
                  : "text-[#7A6A5E] hover:text-[#1E1315]"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType("area")}
              title="Area Line Chart"
              className={`p-1 rounded-lg transition cursor-pointer ${
                chartType === "area"
                  ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs"
                  : "text-[#7A6A5E] hover:text-[#1E1315]"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* True Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen (ESC)" : "Expand Chart Fullscreen"}
            className="p-1.5 rounded-xl bg-[#FAF7F0] hover:bg-[#EFE8D8] border border-[#EBE3D5] text-[#7A6A5E] hover:text-[#1E1315] transition cursor-pointer shrink-0"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-rose-700" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Canvas Chart Mount Container (Fills Fullscreen if active, else 340px) */}
      <div
        ref={chartContainerRef}
        className={`w-full relative overflow-hidden rounded-2xl ${
          isFullscreen ? "flex-1 min-h-0 bg-white border border-[#EBE3D5] shadow-xs" : "h-[340px]"
        }`}
      />

      {/* Mini Stats Footer */}
      <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-[#6E5D4F] pt-1 px-1 shrink-0">
        <div className="flex items-center gap-3">
          <span>RSI-14: <strong className="text-[#1E1315]">{asset.rsi14 || 52}</strong></span>
          <span>20-SMA: <strong className="text-[#1E1315]">${asset.sma20?.toFixed(2) || asset.price.toFixed(2)}</strong></span>
          <span>Feed: <strong className="text-emerald-700">Ondo / Pyth Real-time</strong></span>
        </div>
        <div className="flex items-center gap-2">
          {priceLines.length > 0 && <span>{priceLines.length} S/R lines active</span>}
          <span>·</span>
          <span>{orderHistory.filter((o) => o.symbol.toLowerCase() === asset.symbol.toLowerCase()).length} order markers</span>
          {isFullscreen && (
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="ml-2 font-bold text-rose-700 underline cursor-pointer"
            >
              Exit Fullscreen (ESC)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
