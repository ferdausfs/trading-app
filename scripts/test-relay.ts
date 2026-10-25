// Socket.IO relay integration test — subscribes to BTCUSDT 1m and waits for a kline event
import { io } from 'socket.io-client';

const socket = io('http://localhost:3003', {
  path: '/',
  transports: ['websocket', 'polling'],
  timeout: 8000,
});

const timeout = setTimeout(() => {
  console.log('RELAY_TEST_TIMEOUT');
  process.exit(1);
}, 12000);

socket.on('connect', () => {
  console.log('RELAY_CONNECT_OK', socket.id);
  socket.emit('market:subscribe', { symbol: 'BTCUSDT', interval: '1m' });
});

socket.on('market:upstream', (d) => console.log('UPSTREAM_STATUS:', d.connected));

socket.on('market:ticker', (d) => {
  console.log('TICKER:', d.symbol, d.last.toFixed(2), d.changePercent.toFixed(2) + '%');
});

socket.on('market:kline', (d) => {
  console.log('KLINE:', d.symbol, d.interval, 'close=', d.kline.close, 'isClosed=', d.kline.isClosed);
  clearTimeout(timeout);
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (err) => {
  console.log('RELAY_CONNECT_ERROR:', err.message);
});
