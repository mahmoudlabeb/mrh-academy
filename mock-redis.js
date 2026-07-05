const net = require('net');

// Simple mock Redis server for testing
// Stores data in-memory, supports basic commands needed by the app

const store = new Map();

function encodeBulkString(str) {
  if (str === null || str === undefined) return '$-1\r\n';
  return '$' + Buffer.byteLength(str) + '\r\n' + str + '\r\n';
}

function processCommand(args) {
  const cmd = args[0].toUpperCase();
  
  switch (cmd) {
    case 'PING':
      return '+PONG\r\n';
    case 'AUTH':
      return '+OK\r\n';
    case 'SET': {
      const key = args[1];
      const value = args[2];
      let ttl = null;
      // Handle SET key value EX ttl
      for (let i = 3; i < args.length; i++) {
        if (args[i].toUpperCase() === 'EX' && i + 1 < args.length) {
          ttl = parseInt(args[i + 1]) * 1000;
          break;
        }
      }
      store.set(key, { value, expires: ttl ? Date.now() + ttl : null });
      return '+OK\r\n';
    }
    case 'GET': {
      const key = args[1];
      const entry = store.get(key);
      if (!entry) return '$-1\r\n';
      if (entry.expires && Date.now() > entry.expires) {
        store.delete(key);
        return '$-1\r\n';
      }
      return encodeBulkString(entry.value);
    }
    case 'DEL': {
      let count = 0;
      for (let i = 1; i < args.length; i++) {
        if (store.delete(args[i])) count++;
      }
      return ':' + count + '\r\n';
    }
    case 'INFO':
      return encodeBulkString('# Server\r\nredis_version:7.0.0\r\n');
    case 'CLIENT':
      if (args[1] && args[1].toUpperCase() === 'SETINFO') {
        return '+OK\r\n';
      }
      return '+OK\r\n';
    case 'SELECT':
      return '+OK\r\n';
    default:
      return '-ERR unknown command `' + cmd + '`\r\n';
  }
}

function parseResp(data) {
  const str = data.toString();
  const lines = str.split('\r\n');
  let i = 0;
  
  if (lines[i][0] === '*') {
    const count = parseInt(lines[i].substring(1));
    i++;
    const args = [];
    for (let j = 0; j < count; j++) {
      if (lines[i][0] === '$') {
        const len = parseInt(lines[i].substring(1));
        i++;
        args.push(lines[i]);
        i++;
      }
    }
    return args;
  }
  
  // Inline command
  return str.trim().split(/\s+/);
}

const server = net.createServer((socket) => {
  let buffer = Buffer.alloc(0);
  
  socket.on('error', (err) => {
    // Ignore socket errors like ECONNRESET
  });
  
  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);
    
    // Try to parse a complete RESP command
    const str = buffer.toString();
    if (str.includes('\r\n')) {
      const lines = str.split('\r\n');
      if (lines[0][0] === '*') {
        const count = parseInt(lines[0].substring(1));
        let expectedLines = 1 + count * 2;
        let argBytes = 0;
        for (let i = 0; i < count; i++) {
          const lenLine = 1 + i * 2 + 1;
          if (lenLine < lines.length) {
            argBytes += parseInt(lines[lenLine].substring(1));
          }
        }
        
        // Simple heuristic: check if we have enough data
        if (lines.length >= expectedLines) {
          const args = parseResp(buffer);
          const response = processCommand(args);
          socket.write(response);
          buffer = Buffer.alloc(0);
        }
      } else {
        // Inline command
        const args = parseResp(buffer);
        const response = processCommand(args);
        socket.write(response);
        buffer = Buffer.alloc(0);
      }
    }
  });
});

server.listen(6379, '0.0.0.0', () => {
  console.log('Mock Redis server listening on port 6379');
});

server.on('error', (err) => {
  console.error('Mock Redis server error:', err);
});
