// Quick Binance WebSocket connectivity test
const url = 'wss://data-stream.binance.vision/ws';
const ws = new WebSocket(url);
let subscribed = false;

const timeout = setTimeout(() => {
  console.log('WS_TEST_TIMEOUT');
  process.exit(1);
}, 10000);

ws.onopen = () => {
  console.log('WS_OPEN_OK');
  ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: ['btcusdt@kline_1m', 'btcusdt@miniTicker'], id: 1 }));
};

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.result === null && msg.id === 1) { subscribed = true; console.log('SUBSCRIBE_OK'); return; }
  if (msg.e === 'kline') {
    console.log('KLINE_EVENT:', msg.s, msg.k.i, 'close=', msg.k.c, 'isFinal=', msg.k.x);
    clearTimeout(timeout);
    ws.close();
    process.exit(0);
  }
  if (msg.e === '24hrMiniTicker') {
    console.log('TICKER_EVENT:', msg.s, 'close=', msg.c);
  }
};

ws.onerror = (err) => { console.log('WS_ERROR', (err as Error).message || err); clearTimeout(timeout); process.exit(1); };
ws.onclose = () => { if (!subscribed) { console.log('WS_CLOSED_BEFORE_SUB'); clearTimeout(timeout); } };
