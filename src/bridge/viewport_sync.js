// Dual-viewport telemetry bus. One publisher, two domains:
//
//   Luminous domain (UDP, default 127.0.0.1:9021 -> PrimordiaUnreal): fire-and-forget JSON
//   datagrams, each <= `mtu` bytes. Lossy by design; UE5 reassembles by (s, i, n).
//     {"t":"mesh","s":seq,"i":idx,"n":total,"p":[x,y,z,...]}     surface points
//     {"t":"pose","s":seq,"x":..,"y":..,"z":..,"b":tilt,"c":..,"n":[nx,ny,nz]}  live tool pose
//
//   Precision domain (WebSocket, default 127.0.0.1:9022 -> WebGL/Three.js client): reliable,
//   ordered JSON text frames. A late-joining client is replayed the stored scene.
//     {"type":"hello","protocol":"primordia.viewport/1"}
//     {"type":"mesh","part":i,"parts":n,"points":[...],"normals":[...]}
//     {"type":"toolpath","index":i,"polyline":[x,y,z,...],"rotary":[tilt,c,...]}
//     {"type":"pose","seq":n,"x":..,"y":..,"z":..,"tilt":..,"c":..}
//   A client may send {"type":"get_scene"} to have the scene replayed.
//
// The WebSocket server is a minimal RFC 6455 implementation on node:http (server -> client
// text frames, masked client frames, ping/pong, close), so the bridge needs no dependencies.

import dgram from 'node:dgram';
import http from 'node:http';
import crypto from 'node:crypto';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const PROTOCOL = 'primordia.viewport/1';
const r3 = v => Math.round(v * 1000) / 1000;

function wsFrame(opcode, payload) {
  const n = payload.length;
  let head;
  if (n < 126) head = Buffer.from([0x80 | opcode, n]);
  else if (n < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(n, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([head, payload]);
}

export class ViewportSync {
  /**
   * @param {{udpHost?:string, udpPort?:number, wsHost?:string, wsPort?:number, mtu?:number}} opts
   * Use wsPort: 0 for an ephemeral port (read the real one from start()).
   */
  constructor({ udpHost = '127.0.0.1', udpPort = 9021, wsHost = '127.0.0.1', wsPort = 9022, mtu = 1200 } = {}) {
    this.udpHost = udpHost; this.udpPort = udpPort;
    this.wsHost = wsHost; this.wsPort = wsPort;
    this.mtu = mtu;
    this.clients = new Set();
    this.scene = [];                 // stored WS frames replayed to late joiners
    this.seq = 0;
    this.stats = { udpDatagrams: 0, udpErrors: 0, wsMessages: 0 };
    this.timer = null;
    this.udp = dgram.createSocket('udp4');
    this.udp.on('error', () => { this.stats.udpErrors++; }); // e.g. ICMP unreachable when UE5 is not listening
    this.server = http.createServer((req, res) => { res.writeHead(426, { Upgrade: 'websocket' }); res.end('WebSocket only'); });
    this.server.on('upgrade', (req, socket) => this._upgrade(req, socket));
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.wsPort, this.wsHost, () => {
        this.wsPort = this.server.address().port;
        resolve({ wsPort: this.wsPort, udpHost: this.udpHost, udpPort: this.udpPort });
      });
    });
  }

  _upgrade(req, socket) {
    const key = req.headers['sec-websocket-key'];
    if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const client = { socket, buf: Buffer.alloc(0) };
    this.clients.add(client);
    socket.on('data', d => { client.buf = Buffer.concat([client.buf, d]); this._drain(client); });
    socket.on('close', () => this.clients.delete(client));
    socket.on('error', () => this.clients.delete(client));
    this._sendScene(client);
  }

  _sendScene(client) {
    client.socket.write(wsFrame(1, Buffer.from(JSON.stringify({ type: 'hello', protocol: PROTOCOL }))));
    for (const frame of this.scene) client.socket.write(frame);
  }

  // Parses masked client frames; only close, ping and the get_scene text request are acted on.
  _drain(client) {
    for (;;) {
      const b = client.buf;
      if (b.length < 2) return;
      const op = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      if (len > (1 << 20)) { client.socket.destroy(); return; }
      const need = off + (masked ? 4 : 0) + len;
      if (b.length < need) return;
      let payload = b.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const mask = b.subarray(off, off + 4); payload = Buffer.from(payload.map((v, i) => v ^ mask[i % 4])); }
      client.buf = b.subarray(need);
      if (op === 8) { client.socket.end(wsFrame(8, Buffer.alloc(0))); return; }
      if (op === 9) client.socket.write(wsFrame(10, payload));
      if (op === 1) {
        try { if (JSON.parse(payload.toString()).type === 'get_scene') this._sendScene(client); } catch { /* ignore junk */ }
      }
    }
  }

  _broadcast(obj, store) {
    const frame = wsFrame(1, Buffer.from(JSON.stringify(obj)));
    if (store) this.scene.push(frame);
    for (const c of this.clients) c.socket.write(frame);
    this.stats.wsMessages++;
  }

  _udp(obj) {
    const buf = Buffer.from(JSON.stringify(obj));
    this.udp.send(buf, this.udpPort, this.udpHost, err => { if (err) this.stats.udpErrors++; });
    this.stats.udpDatagrams++;
  }

  /**
   * Publishes a scene to both domains.
   * @param {{mesh?:{points:ArrayLike<number>, normals:ArrayLike<number>}, toolpaths?:Array<Array<{x,y,z,tilt,c}>>}} scene
   * UDP carries mesh points only; WebSocket carries mesh nodes, normals and toolpath polylines.
   */
  publishScene({ mesh, toolpaths = [] }) {
    this.scene = [];
    if (mesh) {
      // Worst case a point is 3 numbers of 11 chars ("-12345.678,"), so 36 bytes is a safe per-point budget.
      const perDatagram = Math.max(1, Math.floor((this.mtu - 64) / 36));
      const count = mesh.points.length / 3;
      const total = Math.max(1, Math.ceil(count / perDatagram));
      const seq = ++this.seq;
      for (let i = 0; i < total; i++) {
        const p = Array.from(mesh.points.slice(i * perDatagram * 3, (i + 1) * perDatagram * 3), r3);
        this._udp({ t: 'mesh', s: seq, i, n: total, p });
      }
      const perPart = 4000, parts = Math.max(1, Math.ceil(count / perPart));
      for (let i = 0; i < parts; i++) {
        this._broadcast({
          type: 'mesh', part: i, parts,
          points: Array.from(mesh.points.slice(i * perPart * 3, (i + 1) * perPart * 3), r3),
          normals: Array.from(mesh.normals.slice(i * perPart * 3, (i + 1) * perPart * 3), v => Math.round(v * 10000) / 10000),
        }, true);
      }
    }
    toolpaths.forEach((pass, index) => {
      const polyline = [], rotary = [];
      for (const q of pass) { polyline.push(r3(q.x), r3(q.y), r3(q.z)); rotary.push(r3(q.tilt), r3(q.c)); }
      this._broadcast({ type: 'toolpath', index, polyline, rotary }, true);
    });
  }

  /** Streams tool poses to both domains at roughly `hz` poses per second. Resolves when done. */
  streamPoses(poses, { hz = 200 } = {}) {
    return new Promise(resolve => {
      let i = 0;
      const tickMs = 5, perTick = Math.max(1, Math.round(hz * tickMs / 1000));
      this.timer = setInterval(() => {
        for (let k = 0; k < perTick && i < poses.length; k++, i++) {
          const q = poses[i], seq = ++this.seq;
          this._udp({ t: 'pose', s: seq, x: r3(q.x), y: r3(q.y), z: r3(q.z), b: r3(q.tilt), c: r3(q.c), n: [r3(q.nx), r3(q.ny), r3(q.nz)] });
          this._broadcast({ type: 'pose', seq, x: r3(q.x), y: r3(q.y), z: r3(q.z), tilt: r3(q.tilt), c: r3(q.c) }, false);
        }
        if (i >= poses.length) { clearInterval(this.timer); this.timer = null; resolve(); }
      }, tickMs);
    });
  }

  close() {
    if (this.timer) clearInterval(this.timer);
    for (const c of this.clients) c.socket.destroy();
    this.clients.clear();
    try { this.udp.close(); } catch { /* already closed */ }
    return new Promise(resolve => this.server.close(() => resolve()));
  }
}
