const { EventEmitter } = require('events');

const hub = new EventEmitter();
hub.setMaxListeners(0);

/**
 * Publica un evento a todos los clientes SSE conectados.
 * @param {{ type: string, caja_id?: string, [key: string]: unknown }} event
 */
function publish(event) {
  if (!event || typeof event.type !== 'string') return;
  hub.emit('message', {
    ...event,
    at: new Date().toISOString(),
  });
}

function publishPedidosChanged(cajaId) {
  if (!cajaId) return;
  publish({ type: 'pedidos_changed', caja_id: String(cajaId) });
}

/**
 * @param {(event: object) => void} listener
 * @returns {() => void} unsubscribe
 */
function subscribe(listener) {
  hub.on('message', listener);
  return () => hub.off('message', listener);
}

module.exports = {
  publish,
  publishPedidosChanged,
  subscribe,
};
