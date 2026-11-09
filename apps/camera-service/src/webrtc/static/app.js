'use strict';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(window.location.search);
const randomId = (prefix) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const test = {
  running: false,
  connected: false,
  mediaFlowing: false,
  relayOnly: params.get('relay') === '1',
  room: params.get('room') || randomId('room'),
  useWebcam: params.get('webcam') === '1',
  token: params.get('token') || '',
  config: null,
  diagnostics: null,
  events: [],
  camera: newPeer('camera'),
  viewer: newPeer('viewer'),
  selectedPairs: { camera: null, viewer: null },
  media: null,
  statsTimer: null,
  offerTimer: null,
  canvasStarted: false,
  startedAt: null,
};

function newPeer(role) {
  return {
    role,
    peerId: '',
    ws: null,
    pc: null,
    stream: null,
    candidates: new Map(),
    pendingCandidates: [],
    outbound: [],
    states: {
      iceGatheringState: 'new',
      iceConnectionState: 'new',
      connectionState: 'new',
      signalingState: 'stable',
    },
    errors: [],
  };
}

function log(level, message) {
  const entry = {
    at: new Date().toISOString(),
    level,
    message: String(message),
  };
  test.events.push(entry);
  if (test.events.length > 500) test.events.shift();

  const line = document.createElement('span');
  line.className = `log-${level}`;
  line.textContent = `[${entry.at.slice(11, 23)}] ${level.toUpperCase().padEnd(5)} ${entry.message}\n`;
  const output = $('event-log');
  output.appendChild(line);
  while (output.childElementCount > 500) output.firstElementChild.remove();
  output.scrollTop = output.scrollHeight;
}

function setHint(message, isError = false) {
  const hint = $('hint');
  hint.textContent = message || '';
  hint.className = isError ? 'hint error' : 'hint';
}

function updateBadge(id, value, prefix) {
  const element = $(id);
  if (!element) return;
  element.textContent = prefix ? `${prefix}: ${value}` : String(value);
  element.className = `badge state-${String(value).replace(/[^a-z0-9-]/gi, '-')}`;
}

function setPeerState(role, key, value) {
  const peer = test[role];
  const previous = peer.states[key];
  if (previous === value) return;
  peer.states[key] = value;
  updateBadge(`${role}-${key}`, value);
  if (previous !== undefined) {
    log('info', `${role}: ${key} ${previous} → ${value}`);
  }
  refreshOverallState();
}

function refreshOverallState() {
  const viewerConnection = test.viewer.states.connectionState;
  const cameraConnection = test.camera.states.connectionState;
  test.connected =
    ['connected', 'completed'].includes(viewerConnection) ||
    ['connected', 'completed'].includes(cameraConnection);

  const authFailed = [...test.camera.errors, ...test.viewer.errors].some(
    (error) => error.code === 401,
  );

  let state = 'idle';
  if (!test.running) state = 'idle';
  else if (
    authFailed ||
    viewerConnection === 'failed' ||
    cameraConnection === 'failed'
  )
    state = 'failed';
  else if (test.mediaFlowing) state = 'media';
  else if (test.connected) state = 'connected';
  else state = 'connecting';

  document.body.dataset.testState = state;
  const viewerPair = test.selectedPairs.viewer;
  document.body.dataset.relay = String(
    viewerPair?.local?.candidateType === 'relay' ||
      viewerPair?.remote?.candidateType === 'relay',
  );

  if (!test.running || test.hintState === state) return;
  test.hintState = state;
  if (state === 'media') {
    setHint('Connected — media is flowing. Inspect the selected pair and RTP counters.');
  } else if (state === 'connected') {
    setHint('ICE connected; waiting for RTP media…');
  } else if (state === 'failed') {
    setHint(
      authFailed
        ? 'TURN authentication failed (401). Check TURN_USERNAME/TURN_PASSWORD on camera-service and coturn.'
        : 'Connection failed — inspect the ICE errors and event log.',
      true,
    );
  } else if (state === 'connecting') {
    setHint('Waiting for ICE gathering and connectivity checks…');
  }
}

function candidateInfo(candidate) {
  if (!candidate) return null;
  const raw = String(candidate.candidate || '');
  const parts = raw.trim().split(/\s+/);
  const typeIndex = parts.indexOf('typ');
  const relatedIndex = parts.indexOf('raddr');

  return {
    key: raw || JSON.stringify({ address: candidate.address, port: candidate.port }),
    raw,
    foundation: candidate.foundation || (parts[0] || '').replace(/^candidate:/, ''),
    component: candidate.component ?? (parts[1] || ''),
    protocol: String(candidate.protocol || parts[2] || '').toLowerCase(),
    priority: candidate.priority ?? (Number(parts[3]) || 0),
    address: candidate.address || parts[4] || '',
    port: candidate.port ?? (Number(parts[5]) || 0),
    type: candidate.type || (typeIndex >= 0 ? parts[typeIndex + 1] : 'unknown'),
    relatedAddress:
      candidate.relatedAddress || (relatedIndex >= 0 ? parts[relatedIndex + 1] : ''),
    relatedPort:
      candidate.relatedPort ??
      (relatedIndex >= 0 ? Number(parts[relatedIndex + 2]) || null : null),
    tcpType: candidate.tcpType || '',
  };
}

function addCandidate(role, info) {
  if (!info) return;
  const peer = test[role];
  if (peer.candidates.has(info.key)) return;
  peer.candidates.set(info.key, info);
  renderCandidates(role);
  const related = info.relatedAddress
    ? ` (related ${info.relatedAddress}:${info.relatedPort})`
    : '';
  log(
    'info',
    `${role}: ${info.type} ${info.protocol.toUpperCase()} ${info.address}:${info.port}${related}`,
  );
}

function createCell(text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  return cell;
}

function renderCandidates(role) {
  const container = $(`${role}-candidates`);
  container.textContent = '';
  const peer = test[role];
  if (!peer.candidates.size) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No candidates yet.';
    container.appendChild(empty);
    return;
  }

  const groups = { host: [], srflx: [], prflx: [], relay: [], unknown: [] };
  for (const candidate of peer.candidates.values()) {
    (groups[candidate.type] || groups.unknown).push(candidate);
  }

  for (const type of ['host', 'srflx', 'prflx', 'relay', 'unknown']) {
    const candidates = groups[type].sort((a, b) => b.priority - a.priority);
    if (!candidates.length) continue;

    const group = document.createElement('section');
    group.className = 'candidate-group';
    const heading = document.createElement('h3');
    heading.textContent = `${type.toUpperCase()} (${candidates.length})`;
    heading.className = `candidate-heading candidate-${type}`;
    group.appendChild(heading);

    const table = document.createElement('table');
    table.className = 'candidate-table';
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const label of [
      'Type',
      'Proto',
      'Address',
      'Port',
      'Related',
      'Foundation',
      'Priority',
    ]) {
      const th = document.createElement('th');
      th.textContent = label;
      headRow.appendChild(th);
    }
    head.appendChild(headRow);
    table.appendChild(head);

    const body = document.createElement('tbody');
    for (const candidate of candidates) {
      const row = document.createElement('tr');
      const typeCell = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `badge candidate-${candidate.type}`;
      badge.textContent = candidate.type;
      typeCell.appendChild(badge);
      row.appendChild(typeCell);
      row.appendChild(createCell(candidate.protocol.toUpperCase()));
      row.appendChild(createCell(candidate.address));
      row.appendChild(createCell(candidate.port));
      row.appendChild(
        createCell(
          candidate.relatedAddress
            ? `${candidate.relatedAddress}:${candidate.relatedPort}`
            : '—',
        ),
      );
      row.appendChild(createCell(candidate.foundation));
      row.appendChild(createCell(candidate.priority));
      body.appendChild(row);
    }
    table.appendChild(body);
    group.appendChild(table);
    container.appendChild(group);
  }
}

function plainStats(statsObject) {
  if (!statsObject) return null;
  const result = {};
  for (const key of Object.keys(statsObject)) {
    const value = statsObject[key];
    if (typeof value !== 'object' || value === null) result[key] = value;
  }
  return result;
}

function pcConfig() {
  return {
    iceServers: test.config?.iceServers || [],
    iceTransportPolicy: test.relayOnly ? 'relay' : 'all',
    bundlePolicy: 'max-bundle',
  };
}

function bindPeerConnection(role) {
  const peer = test[role];
  const pc = peer.pc;

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addCandidate(role, candidateInfo(event.candidate));
      sendSignal(role, {
        type: 'ice-candidate',
        candidate: event.candidate.toJSON
          ? event.candidate.toJSON()
          : { candidate: event.candidate.candidate },
      });
    } else {
      log('info', `${role}: ICE candidate gathering complete`);
      sendSignal(role, { type: 'ice-candidate', candidate: null });
    }
  };

  pc.onicecandidateerror = (event) => {
    const error = {
      at: new Date().toISOString(),
      code: event.errorCode ?? null,
      text: event.errorText || '',
      address: event.address || '',
      port: event.port ?? null,
      url: event.url || '',
    };
    peer.errors.push(error);
    log(
      'warn',
      `${role}: ICE server error code=${error.code ?? '?'} ` +
        `text=${error.text || '(none)'} address=${error.address || '?'} port=${error.port ?? '?'}`,
    );
    if (error.code === 401) {
      setHint(
        'TURN authentication failed (401 Unauthorized) — TURN_USERNAME/TURN_PASSWORD ' +
          'on camera-service do not match coturn.',
        true,
      );
    }
    refreshOverallState();
  };

  pc.onicegatheringstatechange = () =>
    setPeerState(role, 'iceGatheringState', pc.iceGatheringState);
  pc.oniceconnectionstatechange = () =>
    setPeerState(role, 'iceConnectionState', pc.iceConnectionState);
  pc.onconnectionstatechange = () =>
    setPeerState(role, 'connectionState', pc.connectionState);
  pc.onsignalingstatechange = () =>
    setPeerState(role, 'signalingState', pc.signalingState);

  pc.ontrack = (event) => {
    if (role !== 'viewer') return;
    const [stream] = event.streams;
    if (stream) {
      $('remote-video').srcObject = stream;
      $('remote-status').textContent = 'Receiving media from the sender.';
    }
    log('info', `viewer: received ${event.track.kind} track`);
  };
}

function closePeerConnection(peer) {
  if (peer.pc) {
    peer.pc.onicecandidate = null;
    peer.pc.onicegatheringstatechange = null;
    peer.pc.oniceconnectionstatechange = null;
    peer.pc.onconnectionstatechange = null;
    peer.pc.onsignalingstatechange = null;
    peer.pc.ontrack = null;
    peer.pc.close();
    peer.pc = null;
  }
  peer.pendingCandidates = [];
  peer.states = {
    iceGatheringState: 'new',
    iceConnectionState: 'new',
    connectionState: 'new',
    signalingState: 'stable',
  };
  for (const key of Object.keys(peer.states)) {
    updateBadge(`${peer.role}-${key}`, peer.states[key]);
  }
}

function createCameraPeerConnection() {
  const peer = test.camera;
  closePeerConnection(peer);
  peer.candidates.clear();
  renderCandidates('camera');
  peer.pc = new RTCPeerConnection(pcConfig());
  bindPeerConnection('camera');
  for (const track of peer.stream.getTracks()) {
    peer.pc.addTrack(track, peer.stream);
  }
  log('info', 'camera: RTCPeerConnection created');
}

function createViewerPeerConnection() {
  const peer = test.viewer;
  closePeerConnection(peer);
  peer.candidates.clear();
  renderCandidates('viewer');
  peer.pc = new RTCPeerConnection(pcConfig());
  bindPeerConnection('viewer');
  $('remote-video').srcObject = null;
  $('remote-status').textContent = 'Waiting for the sender stream…';
  log('info', 'viewer: RTCPeerConnection created');
}

function signalingUrl(role) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const query = new URLSearchParams({
    room: test.room,
    peer: test[role].peerId,
    role,
  });
  if (test.token) query.set('token', test.token);
  return `${protocol}://${window.location.host}/webrtc/signaling?${query.toString()}`;
}

function connectSignaling(role) {
  const peer = test[role];
  if (peer.ws) {
    peer.ws.onclose = null;
    peer.ws.close();
  }
  const ws = new WebSocket(signalingUrl(role));
  peer.ws = ws;

  ws.onopen = () => {
    updateBadge(`${role}-ws`, 'open', 'signaling');
    log('info', `${role}: signaling connected`);
    for (const message of peer.outbound.splice(0)) {
      ws.send(message);
    }
  };
  ws.onclose = (event) => {
    updateBadge(`${role}-ws`, 'closed', 'signaling');
    log('warn', `${role}: signaling closed code=${event.code} reason=${event.reason || '(none)'}`);
  };
  ws.onerror = () => log('warn', `${role}: signaling socket error`);
  ws.onmessage = (event) => {
    void handleSignalMessage(role, event.data);
  };
}

function sendSignal(role, message) {
  const peer = test[role];
  const encoded = JSON.stringify(message);
  if (peer.ws?.readyState === WebSocket.OPEN) {
    peer.ws.send(encoded);
  } else {
    peer.outbound.push(encoded);
  }
}

async function handleSignalMessage(role, data) {
  let message;
  try {
    message = JSON.parse(data);
  } catch {
    log('warn', `${role}: received invalid signaling JSON`);
    return;
  }

  switch (message.type) {
    case 'welcome':
      log(
        'info',
        `${role}: joined room "${message.room}" (${message.peers.length} peer(s))`,
      );
      if (
        role === 'camera' &&
        message.peers.some((entry) => entry.role === 'viewer')
      ) {
        scheduleOffer();
      }
      break;
    case 'peer-joined':
      log('info', `${role}: peer ${message.peer} (${message.role}) joined`);
      if (role === 'camera' && message.role === 'viewer') scheduleOffer();
      break;
    case 'peer-left':
      log('info', `${role}: peer ${message.peer} (${message.role}) left`);
      if (role === 'camera' && message.role === 'viewer') createCameraPeerConnection();
      if (role === 'viewer' && message.role === 'camera') createViewerPeerConnection();
      break;
    case 'offer':
      if (role === 'viewer') await acceptOffer(message);
      break;
    case 'answer':
      if (role === 'camera') await acceptAnswer(message);
      break;
    case 'ice-candidate':
      await addRemoteCandidate(role, message.candidate);
      break;
    case 'restart':
      log('info', `${role}: peer requested an ICE restart`);
      if (role === 'viewer') createViewerPeerConnection();
      break;
    case 'error':
      log('warn', `${role}: server: ${message.message}`);
      break;
    case 'pong':
      break;
    default:
      log('warn', `${role}: unknown signaling message ${message.type}`);
  }
}

function scheduleOffer() {
  window.clearTimeout(test.offerTimer);
  test.offerTimer = window.setTimeout(() => {
    void makeOffer();
  }, 200);
}

async function makeOffer() {
  const peer = test.camera;
  if (!peer.pc || peer.pc.signalingState !== 'stable') return;
  try {
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    sendSignal('camera', {
      type: 'offer',
      sdp: {
        type: peer.pc.localDescription.type,
        sdp: peer.pc.localDescription.sdp,
      },
    });
    log('info', 'camera: offer sent');
  } catch (error) {
    log('error', `camera: createOffer failed: ${error.message}`);
  }
}

async function acceptOffer(message) {
  const peer = test.viewer;
  if (!peer.pc) createViewerPeerConnection();
  try {
    await peer.pc.setRemoteDescription(message.sdp);
    await flushPendingCandidates('viewer');
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);
    sendSignal('viewer', {
      type: 'answer',
      sdp: {
        type: peer.pc.localDescription.type,
        sdp: peer.pc.localDescription.sdp,
      },
    });
    log('info', 'viewer: answer sent');
  } catch (error) {
    log('error', `viewer: acceptOffer failed: ${error.message}`);
  }
}

async function acceptAnswer(message) {
  const peer = test.camera;
  if (!peer.pc) return;
  try {
    await peer.pc.setRemoteDescription(message.sdp);
    await flushPendingCandidates('camera');
    log('info', 'camera: answer applied');
  } catch (error) {
    log('error', `camera: acceptAnswer failed: ${error.message}`);
  }
}

async function addRemoteCandidate(role, candidate) {
  const peer = test[role];
  if (!peer.pc) return;
  if (candidate === null) {
    if (peer.pc.remoteDescription) {
      try {
        await peer.pc.addIceCandidate(null);
      } catch (error) {
        log('warn', `${role}: end-of-candidates failed: ${error.message}`);
      }
    }
    return;
  }
  if (!peer.pc.remoteDescription?.type) {
    peer.pendingCandidates.push(candidate);
    return;
  }
  try {
    await peer.pc.addIceCandidate(candidate);
  } catch (error) {
    log('warn', `${role}: addIceCandidate failed: ${error.message}`);
  }
}

async function flushPendingCandidates(role) {
  const peer = test[role];
  const pending = peer.pendingCandidates.splice(0);
  for (const candidate of pending) {
    try {
      await peer.pc.addIceCandidate(candidate);
    } catch (error) {
      log('warn', `${role}: queued addIceCandidate failed: ${error.message}`);
    }
  }
}

async function inspectPeer(role) {
  const peer = test[role];
  if (!peer.pc || peer.pc.connectionState === 'closed') {
    return { pair: null, media: null };
  }

  let stats;
  try {
    stats = await peer.pc.getStats();
  } catch {
    return { pair: null, media: null };
  }

  let transport = null;
  stats.forEach((report) => {
    if (report.type === 'transport' && report.selectedCandidatePairId) {
      transport = report;
    }
  });

  let pair = transport ? stats.get(transport.selectedCandidatePairId) : null;
  if (!pair) {
    stats.forEach((report) => {
      if (
        report.type === 'candidate-pair' &&
        report.state === 'succeeded' &&
        (report.nominated || report.selected)
      ) {
        pair = report;
      }
    });
  }
  if (!pair) {
    stats.forEach((report) => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded' && !pair) {
        pair = report;
      }
    });
  }

  const selected = pair
    ? {
        pair: plainStats(pair),
        transport: plainStats(transport),
        local: plainStats(stats.get(pair.localCandidateId)),
        remote: plainStats(stats.get(pair.remoteCandidateId)),
      }
    : null;

  const media = {
    inbound: null,
    outbound: null,
    remoteInbound: null,
  };

  stats.forEach((report) => {
    if (report.type === 'inbound-rtp' && report.kind === 'video') {
      media.inbound = {
        bytesReceived: report.bytesReceived ?? 0,
        packetsReceived: report.packetsReceived ?? 0,
        packetsLost: report.packetsLost ?? 0,
        framesDecoded: report.framesDecoded ?? 0,
        jitter: report.jitter ?? null,
        frameWidth: report.frameWidth ?? null,
        frameHeight: report.frameHeight ?? null,
      };
    } else if (report.type === 'outbound-rtp' && report.kind === 'video') {
      media.outbound = {
        bytesSent: report.bytesSent ?? 0,
        packetsSent: report.packetsSent ?? 0,
        framesEncoded: report.framesEncoded ?? 0,
      };
    } else if (
      report.type === 'remote-inbound-rtp' &&
      report.kind === 'video' &&
      report.roundTripTime != null
    ) {
      media.remoteInbound = { roundTripTime: report.roundTripTime };
    }
  });

  return { pair: selected, media };
}

function candidateSummary(candidate) {
  if (!candidate) return '—';
  const type = candidate.candidateType || candidate.type || 'unknown';
  return `${type} ${candidate.protocol || '?'} ${candidate.address || candidate.ip || '?'}:${
    candidate.port ?? '?'
  }`;
}

function renderCandidateDetails(parent, title, candidate) {
  const block = document.createElement('div');
  block.className = 'pair-candidate';
  const heading = document.createElement('h4');
  heading.textContent = title;
  block.appendChild(heading);

  const list = document.createElement('dl');
  const rows = candidate
    ? [
        ['type', candidate.candidateType || candidate.type || '—'],
        ['protocol', (candidate.protocol || '—').toUpperCase()],
        ['address', candidate.address || candidate.ip || '—'],
        ['port', candidate.port ?? '—'],
        [
          'related',
          candidate.relatedAddress
            ? `${candidate.relatedAddress}:${candidate.relatedPort ?? ''}`
            : '—',
        ],
        ['foundation', candidate.foundation || '—'],
        ['priority', candidate.priority ?? '—'],
      ]
    : [['candidate', 'not available']];
  for (const [key, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = key;
    const dd = document.createElement('dd');
    dd.textContent = String(value);
    list.append(dt, dd);
  }
  block.appendChild(list);
  parent.appendChild(block);
}

function renderSelectedPair(selected) {
  const container = $('selected-pair');
  container.textContent = '';
  if (!selected) {
    container.className = 'empty';
    container.textContent = 'No selected pair yet.';
    return;
  }
  container.className = '';

  const summary = document.createElement('div');
  summary.className = 'pair-summary';
  const rtt = selected.pair.currentRoundTripTime;
  summary.textContent =
    `state=${selected.pair.state} · nominated=${Boolean(selected.pair.nominated)} · ` +
    `protocol=${(selected.local?.protocol || selected.remote?.protocol || '?').toUpperCase()} · ` +
    `rtt=${rtt == null ? '—' : `${(rtt * 1000).toFixed(1)} ms`} · ` +
    `bytesSent=${selected.pair.bytesSent ?? 0} · bytesReceived=${selected.pair.bytesReceived ?? 0}`;
  container.appendChild(summary);

  const grid = document.createElement('div');
  grid.className = 'pair-grid';
  renderCandidateDetails(grid, 'Local candidate', selected.local);
  renderCandidateDetails(grid, 'Remote candidate', selected.remote);
  container.appendChild(grid);
}

function renderMedia(media) {
  const container = $('media-stats');
  container.textContent = '';
  if (!media || (!media.viewer?.inbound && !media.camera?.outbound)) {
    container.className = 'empty';
    container.textContent = 'No RTP stats yet.';
    return;
  }
  container.className = '';

  const table = document.createElement('table');
  table.className = 'stats-table';
  const body = document.createElement('tbody');
  const rows = [
    ['Viewer bytes received', media.viewer?.inbound?.bytesReceived ?? '—'],
    ['Viewer packets received', media.viewer?.inbound?.packetsReceived ?? '—'],
    ['Viewer packets lost', media.viewer?.inbound?.packetsLost ?? '—'],
    ['Viewer frames decoded', media.viewer?.inbound?.framesDecoded ?? '—'],
    [
      'Viewer resolution',
      media.viewer?.inbound?.frameWidth
        ? `${media.viewer.inbound.frameWidth}×${media.viewer.inbound.frameHeight}`
        : '—',
    ],
    ['Sender bytes sent', media.camera?.outbound?.bytesSent ?? '—'],
    ['Sender packets sent', media.camera?.outbound?.packetsSent ?? '—'],
    ['Sender frames encoded', media.camera?.outbound?.framesEncoded ?? '—'],
    [
      'Remote RTT',
      media.viewer?.remoteInbound?.roundTripTime != null
        ? `${(media.viewer.remoteInbound.roundTripTime * 1000).toFixed(1)} ms`
        : '—',
    ],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = label;
    const td = document.createElement('td');
    td.textContent = String(value);
    row.append(th, td);
    body.appendChild(row);
  }
  table.appendChild(body);
  container.appendChild(table);
}

async function collectStats() {
  if (!test.running) return;
  const [camera, viewer] = await Promise.all([
    inspectPeer('camera'),
    inspectPeer('viewer'),
  ]);
  test.selectedPairs = { camera: camera.pair, viewer: viewer.pair };
  test.media = { camera: camera.media, viewer: viewer.media };

  renderSelectedPair(viewer.pair);
  renderMedia(test.media);

  const bytesReceived = viewer.media?.inbound?.bytesReceived ?? 0;
  const bytesSent = camera.media?.outbound?.bytesSent ?? 0;
  test.mediaFlowing = bytesReceived > 0 || bytesSent > 0;
  document.body.dataset.media = String(test.mediaFlowing);
  refreshOverallState();
}

function renderIceConfig() {
  const container = $('config-panel');
  container.textContent = '';
  if (!test.config) {
    container.className = 'empty';
    container.textContent = 'Configuration unavailable.';
    return;
  }
  container.className = '';

  const servers = (test.config.iceServers || []).map((server) => ({
    urls: Array.isArray(server.urls) ? server.urls : [server.urls],
    username: server.username || null,
    credential: server.credential ? '••••••' : null,
  }));

  const list = document.createElement('dl');
  const rows = [
    ['enabled', String(test.config.enabled)],
    ['iceTransportPolicy', test.config.iceTransportPolicy],
    ['STUN configured', String(test.config.stun?.configured)],
    ['TURN configured', String(test.config.turn?.configured)],
    ['TURN relay range', test.config.turn?.relayPortRange || '—'],
    ['TURN realm', test.config.turn?.realm || '—'],
    ['signaling path', test.config.signalingPath],
  ];
  for (const [key, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = key;
    const dd = document.createElement('dd');
    dd.textContent = value;
    list.append(dt, dd);
  }
  container.appendChild(list);

  const heading = document.createElement('h3');
  heading.textContent = 'iceServers';
  container.appendChild(heading);
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(servers, null, 2);
  container.appendChild(pre);
}

function renderDiagnostics() {
  const container = $('diagnostics-panel');
  container.textContent = '';
  if (!test.diagnostics) {
    container.className = 'empty';
    container.textContent = 'Diagnostics unavailable.';
    return;
  }
  container.className = '';

  const sections = [
    ['STUN reachability', test.diagnostics.stun?.results || []],
    ['TURN TCP reachability', test.diagnostics.turn?.results || []],
  ];

  for (const [title, results] of sections) {
    const heading = document.createElement('h3');
    heading.textContent = title;
    container.appendChild(heading);

    if (!results.length) {
      const empty = document.createElement('p');
      empty.className = 'muted small';
      empty.textContent = 'No endpoints configured.';
      container.appendChild(empty);
      continue;
    }

    const list = document.createElement('ul');
    list.className = 'diagnostic-list';
    for (const result of results) {
      const item = document.createElement('li');
      const badge = document.createElement('span');
      const ok = result.reachable === true;
      badge.className = `badge ${ok ? 'state-connected' : 'state-failed'}`;
      badge.textContent = ok ? 'reachable' : 'unreachable';
      item.appendChild(badge);
      const text = document.createElement('span');
      const mapped = result.address
        ? ` → ${result.address}:${result.port} (${result.attribute}, ${result.rttMs} ms)`
        : '';
      text.textContent = `${result.url}${mapped}${result.error ? ` — ${result.error}` : ''}`;
      item.appendChild(text);
      list.appendChild(item);
    }
    container.appendChild(list);
  }

  const note = document.createElement('p');
  note.className = 'muted small';
  note.textContent = test.diagnostics.turn?.note || '';
  container.appendChild(note);
}

async function loadConfig() {
  const response = await fetch('/webrtc/config', { cache: 'no-store' });
  if (!response.ok) throw new Error(`config HTTP ${response.status}`);
  test.config = await response.json();
  renderIceConfig();
}

async function loadDiagnostics() {
  const response = await fetch('/webrtc/diagnostics', { cache: 'no-store' });
  if (!response.ok) throw new Error(`diagnostics HTTP ${response.status}`);
  test.diagnostics = await response.json();
  renderDiagnostics();
}

function startCanvasAnimation() {
  if (test.canvasStarted) return;
  test.canvasStarted = true;
  const canvas = $('source-canvas');
  const context = canvas.getContext('2d');
  let frame = 0;

  const draw = () => {
    frame += 1;
    const now = Date.now();
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#071a2b');
    gradient.addColorStop(1, '#123c4a');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const x = (Math.sin(now / 900) * 0.5 + 0.5) * (canvas.width - 120) + 60;
    const y = (Math.cos(now / 700) * 0.5 + 0.5) * (canvas.height - 120) + 60;
    context.beginPath();
    context.arc(x, y, 42, 0, Math.PI * 2);
    context.fillStyle = '#39d98a';
    context.fill();

    context.fillStyle = '#e6f1ff';
    context.font = 'bold 28px ui-monospace, monospace';
    context.fillText('MRUN WebRTC test', 32, 52);
    context.font = '18px ui-monospace, monospace';
    context.fillText(new Date(now).toISOString(), 32, 84);
    context.fillText(`frame ${frame}`, 32, canvas.height - 28);
    window.requestAnimationFrame(draw);
  };
  window.requestAnimationFrame(draw);
}

async function createCameraStream() {
  if (test.useWebcam) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 360 } },
      audio: false,
    });
    log('info', 'camera: using webcam stream');
    return stream;
  }
  startCanvasAnimation();
  log('info', 'camera: using generated canvas stream');
  return $('source-canvas').captureStream(15);
}

function stopTest() {
  test.running = false;
  test.connected = false;
  test.mediaFlowing = false;
  window.clearInterval(test.statsTimer);
  window.clearTimeout(test.offerTimer);
  test.statsTimer = null;
  test.offerTimer = null;

  for (const role of ['camera', 'viewer']) {
    const peer = test[role];
    closePeerConnection(peer);
    if (peer.ws) {
      peer.ws.onclose = null;
      peer.ws.onopen = null;
      peer.ws.close();
      peer.ws = null;
    }
    if (peer.stream) {
      for (const track of peer.stream.getTracks()) track.stop();
    }
    peer.outbound = [];
  }
  $('remote-video').srcObject = null;
  $('remote-status').textContent = 'Waiting for the sender stream…';
  updateBadge('camera-ws', 'closed', 'signaling');
  updateBadge('viewer-ws', 'closed', 'signaling');
  refreshOverallState();
}

async function startTest() {
  stopTest();
  test.room = ($('room').value || '').trim() || randomId('room');
  $('room').value = test.room;
  test.relayOnly = $('force-relay').checked;
  test.useWebcam = $('use-webcam').checked;
  test.hintState = null;
  test.events = [];
  $('event-log').textContent = '';
  $('selected-pair').textContent = 'No selected pair yet.';
  $('selected-pair').className = 'empty';
  $('media-stats').textContent = 'No RTP stats yet.';
  $('media-stats').className = 'empty';
  setHint('Loading ICE configuration…');

  try {
    await Promise.all([loadConfig(), loadDiagnostics()]);
  } catch (error) {
    setHint(`Could not load WebRTC configuration: ${error.message}`, true);
    log('error', `config: ${error.message}`);
    return;
  }

  if (!test.config?.enabled) {
    setHint('WebRTC is disabled on the server (WEBRTC_ENABLED=false).', true);
    return;
  }
  if (test.relayOnly && !test.config.turn?.configured) {
    setHint(
      'Force relay is enabled but TURN is not configured (TURN_URLS/TURN_USERNAME/TURN_PASSWORD).',
      true,
    );
    return;
  }

  test.running = true;
  test.startedAt = new Date().toISOString();
  test.camera = newPeer('camera');
  test.viewer = newPeer('viewer');
  test.camera.peerId = randomId('cam');
  test.viewer.peerId = randomId('view');
  test.selectedPairs = { camera: null, viewer: null };
  test.media = null;
  renderCandidates('camera');
  renderCandidates('viewer');

  try {
    test.camera.stream = await createCameraStream();
  } catch (error) {
    test.running = false;
    setHint(`Could not create camera stream: ${error.message}`, true);
    log('error', `camera: ${error.message}`);
    return;
  }

  createCameraPeerConnection();
  createViewerPeerConnection();
  connectSignaling('camera');
  connectSignaling('viewer');
  test.statsTimer = window.setInterval(() => {
    void collectStats();
  }, 2000);

  setHint(
    test.relayOnly
      ? 'Relay-only test started. Waiting for TURN allocations and connectivity checks…'
      : 'Test started. Waiting for ICE gathering and connectivity checks…',
  );
  log(
    'info',
    `test: room=${test.room} relayOnly=${test.relayOnly} peers=${test.camera.peerId}/${test.viewer.peerId}`,
  );
  refreshOverallState();
}

function redactedIceServers() {
  return (test.config?.iceServers || []).map((server) => ({
    urls: server.urls,
    username: server.username || null,
    credential: server.credential ? '***' : null,
  }));
}

function peerReport(role) {
  const peer = test[role];
  return {
    peerId: peer.peerId,
    wsState: peer.ws ? ['connecting', 'open', 'closing', 'closed'][peer.ws.readyState] : 'closed',
    states: { ...peer.states },
    candidates: [...peer.candidates.values()],
    candidateCounts: [...peer.candidates.values()].reduce((counts, candidate) => {
      counts[candidate.type] = (counts[candidate.type] || 0) + 1;
      return counts;
    }, {}),
    errors: peer.errors,
  };
}

function buildReport() {
  return {
    generatedAt: new Date().toISOString(),
    startedAt: test.startedAt,
    room: test.room,
    relayOnly: test.relayOnly,
    state: document.body.dataset.testState,
    mediaFlowing: test.mediaFlowing,
    iceTransportPolicy: test.config?.iceTransportPolicy,
    iceServers: redactedIceServers(),
    diagnostics: test.diagnostics,
    peers: {
      camera: peerReport('camera'),
      viewer: peerReport('viewer'),
    },
    selectedPairs: test.selectedPairs,
    media: test.media,
    events: test.events.slice(-200),
  };
}

async function copyReport() {
  const text = JSON.stringify(buildReport(), null, 2);
  try {
    await navigator.clipboard.writeText(text);
    setHint('Report copied to the clipboard.');
  } catch {
    setHint('Clipboard unavailable — use window.__webrtcTest.getReport() in the console.', true);
  }
}

function initialize() {
  $('room').value = test.room;
  $('force-relay').checked = test.relayOnly;
  $('use-webcam').checked = test.useWebcam;

  $('start').addEventListener('click', () => void startTest());
  $('restart').addEventListener('click', () => void startTest());
  $('copy-report').addEventListener('click', () => void copyReport());
  $('clear-log').addEventListener('click', () => {
    test.events = [];
    $('event-log').textContent = '';
  });
  $('run-diagnostics').addEventListener('click', () => void loadDiagnostics());
  $('force-relay').addEventListener('change', () => {
    if (test.running) setHint('Restart the test to apply the new ICE transport policy.');
  });

  renderCandidates('camera');
  renderCandidates('viewer');
  void loadConfig().catch((error) => {
    $('config-panel').textContent = `Configuration error: ${error.message}`;
  });
  void loadDiagnostics().catch((error) => {
    $('diagnostics-panel').textContent = `Diagnostics error: ${error.message}`;
  });

  if (params.get('auto') === '1') {
    window.setTimeout(() => void startTest(), 150);
  }
}

window.__webrtcTest = {
  getReport: buildReport,
  start: startTest,
  stop: stopTest,
  get state() {
    return document.body.dataset.testState;
  },
  get connected() {
    return test.connected;
  },
  get mediaFlowing() {
    return test.mediaFlowing;
  },
};

initialize();
