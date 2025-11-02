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

export enum ExchangeType {
  KUCOIN = 'kucoin',
  BINANCE = 'binance',
  TABDEAL = 'tabdeal',
  NOBITEX = 'nobitex',
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