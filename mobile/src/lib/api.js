/**
 * API + Socket.IO ক্লায়েন্ট (মোবাইল)
 * REST দিয়ে হিস্টরি, Socket.IO দিয়ে লাইভ আপডেট।
 */

import { io } from 'socket.io-client';
import { API_BASE, SOCKET_URL } from '../config';

let socket = null;
const klineHandlers = new Set();
const tickerHandlers = new Set();
const statusHandlers = new Set();
let current = null;

/** ঐতিহাসিক ক্যান্ডেল ডেটা */
export async function fetchKlines(symbol, interval, limit = 200) {
  const res = await fetch(
    `${API_BASE}/api/market/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'ডেটা লোড ব্যর্থ');
  return json.data; // [{time,open,high,low,close,volume}]
}

/** ২৪ঘ টিকার */
export async function fetchTicker(symbol) {
  const res = await fetch(`${API_BASE}/api/market/ticker?symbols=${symbol}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'টিকার লোড ব্যর্থ');
  return json.data[0];
}

/** Socket.IO সংযোগ ও সাবস্ক্রিপশন */
export function connectAndSubscribe(symbol, interval) {
  current = { symbol, interval };

  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      timeout: 10000,
    });

    socket.on('connect', () => {
      statusHandlers.forEach((h) => h('live'));
      if (current) socket.emit('market:subscribe', current);
    });

    socket.on('disconnect', () => statusHandlers.forEach((h) => h('connecting')));
    socket.on('connect_error', () => statusHandlers.forEach((h) => h('connecting')));

    socket.on('market:kline', (e) => klineHandlers.forEach((h) => h(e)));
    socket.on('market:ticker', (e) => tickerHandlers.forEach((h) => h(e)));
  }

  if (socket.connected && current) {
    socket.emit('market:subscribe', current);
  }
}

export function unsubscribe(symbol, interval) {
  if (socket?.connected) {
    socket.emit('market:unsubscribe', { symbol, interval });
  }
}

export function onKline(cb) {
  klineHandlers.add(cb);
  return () => klineHandlers.delete(cb);
}

export function onTicker(cb) {
  tickerHandlers.add(cb);
  return () => tickerHandlers.delete(cb);
}

export function onStatus(cb) {
  statusHandlers.add(cb);
  return () => statusHandlers.delete(cb);
}
