(function () {
  const pendingRequests = new Map();
  let socket;
  let messageHandler = () => {};
  let statusHandler = () => {};

  function getPlayerId() {
    let playerId = localStorage.getItem('g2ku_player_id');
    if (!playerId) {
      playerId = crypto.randomUUID();
      localStorage.setItem('g2ku_player_id', playerId);
    }
    return playerId;
  }

  function connect(onMessage, onStatus) {
    messageHandler = onMessage || (() => {});
    statusHandler = onStatus || (() => {});
    if (socket && socket.readyState === WebSocket.OPEN) return Promise.resolve();
    if (socket && socket.readyState === WebSocket.CONNECTING) {
      return new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', () => reject(new Error('Could not connect to the room service.')), { once: true });
      });
    }

    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${scheme}//${window.location.host}/ws`);
    statusHandler('connecting');

    return new Promise((resolve, reject) => {
      socket.addEventListener('open', () => {
        statusHandler('connected');
        resolve();
      }, { once: true });
      socket.addEventListener('error', () => {
        statusHandler('disconnected');
        reject(new Error('Could not connect to the room service. Check the server and try again.'));
      }, { once: true });
      socket.addEventListener('close', () => {
        statusHandler('disconnected');
        for (const pending of pendingRequests.values()) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('Connection to the room service was lost.'));
        }
        pendingRequests.clear();
      });
      socket.addEventListener('message', event => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          statusHandler('error');
          return;
        }

        if (message.requestId && pendingRequests.has(message.requestId)) {
          const pending = pendingRequests.get(message.requestId);
          pendingRequests.delete(message.requestId);
          clearTimeout(pending.timeout);
          if (message.type === 'error') pending.reject(new Error(message.message));
          else pending.resolve(message);
          return;
        }

        messageHandler(message);
      });
    });
  }

  function request(type, payload = {}) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Not connected to the room service.'));
    }

    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error('The room service did not respond. Please try again.'));
      }, 10000);
      pendingRequests.set(requestId, { resolve, reject, timeout });
      try {
        socket.send(JSON.stringify({ type, requestId, ...payload }));
      } catch (error) {
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        reject(new Error(`Could not send the room request: ${error.message}`));
      }
    });
  }

  window.G2KURoomClient = { connect, request, getPlayerId };
})();
