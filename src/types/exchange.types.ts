export interface OHLCVData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ExchangeConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface KuCoinCandleResponse {
  code: string;
  data: string[][];
}

export interface BinanceCandleResponse {
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  buyVolume: string;
  buyQuoteVolume: string;
  ignore: string;
}

export interface TabdealTickerResponse {
  symbol: string;
  lastPrice: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  priceChange24h: string;
}

export interface NobitexMarketStatsResponse {
  status: string;
  stats: {
    [key: string]: {
      latest: string;
      dayLow: string;
      dayHigh: string;
      volumeSrc: string;
      volumeDst: string;
      dayChange: string;
    };
  };
}

export interface FetchDataOptions {
  symbol: string;
  timeframe: string;
  limit?: number;
  startTime?: number;
  endTime?: number;
}

export interface CurrentPriceResponse {
  symbol: string;
  price: number;
  exchange: ExchangeType;
  timestamp: Date;
}

export enum ExchangeType {
  KUCOIN = 'KUCOIN',
  BINANCE = 'BINANCE',
  TABDEAL = 'TABDEAL',
  NOBITEX = 'NOBITEX',
  COINBASE = 'COINBASE',
  KRAKEN = 'KRAKEN',
  BYBIT = 'BYBIT',
  OKX = 'OKX',
  GATE = 'GATE',
}

export interface OHLCVData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FetchDataOptions {
  symbol: string;
  timeframe: string;
  limit?: number;
  startTime?: number;
  endTime?: number;
}

export interface CurrentPriceResponse {
  symbol: string;
  price: number;
  exchange: ExchangeType;
  timestamp: Date;
}

export interface KuCoinCandleResponse {
  code: string;
  data: string[][];
}

export const TIMEFRAME_MAPPING = {
  kucoin: {
    '1m': '1min',
    '3m': '3min',
    '5m': '5min',
    '15m': '15min',
    '30m': '30min',
    '1h': '1hour',
    '2h': '2hour',
    '4h': '4hour',
    '6h': '6hour',
    '8h': '8hour',
    '12h': '12hour',
    '1d': '1day',
    '1w': '1week',
  },
  binance: {
    '1m': '1m',
    '3m': '3m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '1h': '1h',
    '2h': '2h',
    '4h': '4h',
    '6h': '6h',
    '8h': '8h',
    '12h': '12h',
    '1d': '1d',
    '3d': '3d',
    '1w': '1w',
  },
};

export interface EnrichedOHLCVData extends OHLCVData {
  // Moving Averages
  SMA_5?: number;
  SMA_10?: number;
  SMA_20?: number;
  SMA_50?: number;
  SMA_100?: number;
  SMA_200?: number;
  EMA_5?: number;
  EMA_10?: number;
  EMA_12?: number;
  EMA_13?: number;
  EMA_20?: number;
  EMA_26?: number;
  EMA_50?: number;
  EMA_100?: number;
  EMA_200?: number;

  // MACD
  MACD?: number;
  MACD_signal?: number;
  MACD_histogram?: number;

  // RSI
  RSI?: number;

  // Stochastic
  STOCH_K?: number;
  STOCH_D?: number;

  // Bollinger Bands
  BB_upper?: number;
  BB_middle?: number;
  BB_lower?: number;
  BB_width?: number;
  BB_std?: number;

  // ATR
  ATR?: number;

  // Volume indicators
  OBV?: number;
  VWAP?: number;
  volume_sma?: number;

  // ADX
  ADX?: number;
  PLUS_DI?: number;
  MINUS_DI?: number;

  // CCI
  CCI?: number;

  // Williams %R
  WILLR?: number;

  // MFI
  MFI?: number;

  // CMF
  CMF?: number;

  // ROC
  ROC?: number;

  // Aroon
  AROON_UP?: number;
  AROON_DOWN?: number;

  // Elder Ray
  BULL_POWER?: number;
  BEAR_POWER?: number;

  // TSI
  TSI?: number;
  TSI_signal?: number;

  // Donchian
  DONCHIAN_HIGH?: number;
  DONCHIAN_LOW?: number;
  DONCHIAN_MID?: number;

  // Momentum
  MOMENTUM_5?: number;
  MOMENTUM_10?: number;

  // SAR
  SAR?: number;
}