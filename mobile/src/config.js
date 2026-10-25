/**
 * TradeLite মোবাইল কনফিগ
 * ------------------------
 * API_BASE  : Next.js ব্যাকএন্ডের বেস URL (REST)
 * SOCKET_URL: market-relay Socket.IO সার্ভারের URL
 *
 * লোকাল টেস্টিং: একই Wi-Fi এ থাকলে কম্পিউটারের LAN IP দিন (যেমন http://192.168.1.10:3000)
 * প্রোডাকশন: নিজের ডোমেইন/হোস্ট দিন (https://your-app.onrender.com)
 */

export const API_BASE = 'http://10.0.2.2:3000'; // Android Emulator → হোস্ট মেশিনের localhost
export const SOCKET_URL = 'http://10.0.2.2:3003'; // relay সার্ভিস সরাসরি (লোকাল)

export const DEFAULT_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT',
  'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT',
  'LINKUSDT', 'TRXUSDT', 'DOTUSDT', 'LTCUSDT',
];

export const SYMBOL_LABELS = {
  BTCUSDT: 'Bitcoin', ETHUSDT: 'Ethereum', BNBUSDT: 'BNB', SOLUSDT: 'Solana',
  XRPUSDT: 'XRP', DOGEUSDT: 'Dogecoin', ADAUSDT: 'Cardano', AVAXUSDT: 'Avalanche',
  LINKUSDT: 'Chainlink', TRXUSDT: 'TRON', DOTUSDT: 'Polkadot', LTCUSDT: 'Litecoin',
};

export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

export const COLORS = {
  bg: '#0B0D10',
  panel: '#12151A',
  border: '#1F242B',
  text: '#EAECEF',
  muted: '#8A94A0',
  up: '#0ECB81',
  down: '#F6465D',
  accent: '#FCD535',
  ema1: '#FCD535',
  ema2: '#C77DFF',
  bb: '#2DD4BF',
};
