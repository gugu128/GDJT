const INITIAL_CLOCK = new Date("2026-05-23T10:21:36");

const STATUS_LABEL = {
  open: "开放",
  closed: "关闭",
  fault: "熄灭",
  positioned: "定位",
  reverse: "反位",
  free: "空闲",
  occupied: "占用",
  locked: "锁闭",
  blocked: "封锁",
  singleLocked: "单锁",
};

const STATUS_CLASS = {
  open: "open",
  closed: "closed",
  fault: "closed",
  positioned: "positioned",
  reverse: "reverse",
  free: "free",
  occupied: "occupied",
  locked: "locked",
  blocked: "blocked",
  singleLocked: "locked",
};

const trackElements = {
  "1G": ["track-1G"],
  "2G": ["track-2G"],
  "3G": ["track-3G"],
  "4G": ["track-4G"],
  "5G": ["track-5G"],
  "6G": ["track-6G"],
  "7G": ["track-7G"],
  "8G": ["track-8G"],
  "9G": ["track-9G"],
};

const turnoutRouteElements = {
  1: {
    positioned: "route-throat-left-up",
  },
  3: {
    reverse: "route-throat-left-down",
  },
  5: {
    positioned: "route-throat-right-down",
    reverse: "route-throat-right-up",
  },
};

function cloneState(source) {
  return JSON.parse(JSON.stringify(source));
}

const defaultState = window.InterlockingCore?.createInitialState
  ? window.InterlockingCore.createInitialState()
  : {
  mode: "仿真运行",
  systemState: "正常",
  operator: "学生演示账号",
  countdown: 28,
  selectedSection: "3G",
  signals: {
    X1: { id: "X1", status: "open", description: "进站信号机" },
    S1: { id: "S1", status: "closed", description: "出站信号机" },
    D1: { id: "D1", status: "closed", description: "调车信号机" },
  },
  switches: {
    1: { id: "1", name: "1#道岔", position: "positioned", lock: "locked", description: "开通直向" },
    3: { id: "3", name: "3#道岔", position: "reverse", lock: "blocked", description: "侧向封锁" },
    5: { id: "5", name: "5#道岔", position: "positioned", lock: "free", description: "可用" },
  },
  tracks: {
    "1G": { id: "1G", status: "free", description: "进站接近区段" },
    "2G": { id: "2G", status: "route", description: "I道接车进路" },
    "3G": { id: "3G", status: "occupied", description: "I道中段" },
    "4G": { id: "4G", status: "free", description: "I道出站区段" },
    "5G": { id: "5G", status: "free", description: "II道调车线" },
    "6G": { id: "6G", status: "occupied", description: "III道中段" },
    "7G": { id: "7G", status: "free", description: "出站接近区段" },
    "8G": { id: "8G", status: "free", description: "II道中段" },
    "9G": { id: "9G", status: "free", description: "牵出线右端" },
  },
  logs: [
    { time: "10:21:03", type: "success", message: "接车进路建立成功，X1信号机开放" },
    { time: "10:21:10", type: "info", message: "1#道岔已锁闭，定位" },
    { time: "10:21:18", type: "danger", message: "3G轨道区段占用" },
    { time: "10:21:25", type: "info", message: "发车进路解锁，S1信号机关闭" },
    { time: "10:21:36", type: "warn", message: "人工解锁倒计时 28 秒" },
    { time: "10:21:39", type: "info", message: "5#道岔状态校核完成，定位" },
    { time: "10:21:42", type: "success", message: "站场设备状态刷新完成" },
    { time: "10:21:44", type: "info", message: "系统进入联锁仿真监控状态" },
  ],
};

let appState = cloneState(defaultState);
let simulationClock = new Date(INITIAL_CLOCK);
let countdownTimer = null;
let demoTimer = null;
const coreSystem = window.InterlockingCore?.createSystem
  ? window.InterlockingCore.createSystem(appState, { clone: false })
  : null;

const elements = {
  clock: document.querySelector("#systemClock"),
  statusBody: document.querySelector("#deviceStatusBody"),
  logWindow: document.querySelector("#logWindow"),
  modeText: document.querySelector("#modeText"),
  countdownText: document.querySelector("#countdownText"),
  systemStateText: document.querySelector("#systemStateText"),
  operatorText: document.querySelector("#operatorText"),
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateTime(date) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const sec = pad(date.getSeconds());
  return `${y}-${m}-${d}&nbsp;&nbsp;${h}:${min}:${sec}`;
}

function formatClockTime(date = simulationClock) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function setTrackState(trackId, status) {
  const track = appState.tracks[trackId];
  if (!track) return;
  track.status = status;
  const cssStatus = status === "route" ? "route" : STATUS_CLASS[status] || status;
  const ids = trackElements[trackId] || [];
  ids.forEach((elementId) => {
    const node = document.querySelector(`#${elementId}`);
    if (!node) return;
    node.classList.remove("free", "route", "occupied", "locked", "blocked");
    node.classList.add(cssStatus);
  });
  renderTurnoutRoutes();
}

function setSignalState(signalId, status) {
  const signal = appState.signals[signalId];
  const node = document.querySelector(`#signal-${signalId}`);
  if (!signal || !node) return;
  signal.status = status;
  node.classList.remove("signal-open", "signal-closed", "signal-fault");
  node.querySelectorAll(".lamp").forEach((lamp) => {
    lamp.classList.remove("green-lamp", "red-lamp", "off-lamp");
    lamp.classList.add("off-lamp");
  });
  if (status === "open") {
    node.classList.add("signal-open");
    const firstLamp = node.querySelector(".lamp");
    firstLamp.classList.remove("off-lamp");
    firstLamp.classList.add("green-lamp");
  } else if (status === "fault") {
    node.classList.add("signal-fault");
  } else {
    node.classList.add("signal-closed");
    const firstLamp = node.querySelector(".lamp");
    firstLamp.classList.remove("off-lamp");
    firstLamp.classList.add("red-lamp");
  }
}

function setSwitchPosition(switchId, position) {
  const item = appState.switches[switchId];
  const node = document.querySelector(`#switch-${switchId}`);
  if (!item || !node) return;
  if (["locked", "single", "blocked"].includes(item.lock) && item.position !== position) {
    addLog("warn", `${switchId}#道岔已锁闭，禁止转换`);
    return;
  }
  item.position = position;
  item.description = position === "positioned" ? "开通直向" : "开通侧向";
  node.classList.remove("positioned", "reverse");
  node.classList.add(position);
  renderTurnoutRoutes();
  renderDeviceStatus();
  addLog("info", `${switchId}#道岔转换至${STATUS_LABEL[position]}`);
}

function setSwitchLock(switchId, lock) {
  const item = appState.switches[switchId];
  const node = document.querySelector(`#switch-${switchId}`);
  if (!item || !node) return;
  item.lock = lock;
  node.classList.remove("locked", "blocked");
  if (lock === "single" || lock === "locked") {
    node.classList.add("locked");
    item.description = lock === "single" ? "单独锁闭" : "进路锁闭";
    addLog("info", `${switchId}#道岔已${lock === "single" ? "单锁" : "锁闭"}`);
  } else if (lock === "blocked") {
    node.classList.add("blocked");
    item.description = "设备封锁";
    addLog("warn", `${switchId}#道岔已封锁`);
  } else {
    item.description = item.position === "positioned" ? "开通直向" : "开通侧向";
    addLog("success", `${switchId}#道岔已解锁`);
  }
  renderTurnoutRoutes();
  renderDeviceStatus();
}

function renderTurnoutRoutes() {
  document.querySelectorAll(".turnout-route").forEach((node) => {
    node.classList.remove("active", "locked", "blocked");
    node.classList.add("inactive");
  });

  const activeRoutes = [
    appState.switches[1]?.position === "positioned" && appState.tracks["2G"]?.status === "route"
      ? turnoutRouteElements[1].positioned
      : null,
    appState.switches[3]?.position === "reverse" && appState.tracks["6G"]?.status === "route"
      ? turnoutRouteElements[3].reverse
      : null,
    appState.switches[5]?.position === "reverse" && appState.tracks["4G"]?.status === "route"
      ? turnoutRouteElements[5].reverse
      : null,
    appState.switches[5]?.position === "positioned"
      ? turnoutRouteElements[5].positioned
      : null,
  ].filter(Boolean);

  activeRoutes.forEach((routeId) => {
    const node = document.querySelector(`#${routeId}`);
    if (!node) return;
    node.classList.remove("inactive");
    node.classList.add("active");
  });
}

function addLog(type, message) {
  appState.logs.push({
    time: formatClockTime(),
    type,
    message,
  });
  if (appState.logs.length > 50) {
    appState.logs = appState.logs.slice(-50);
  }
  renderLogs();
}

function renderLogs() {
  elements.logWindow.innerHTML = appState.logs
    .map((log) => {
      return `<div class="log-line ${log.type}"><span class="time">[${log.time}]</span><span class="msg">${log.message}</span></div>`;
    })
    .join("");
  elements.logWindow.scrollTop = elements.logWindow.scrollHeight;
}

function getSwitchStatusDisplay(item) {
  if (item.lock === "locked") return { label: "锁闭", className: "locked" };
  if (item.lock === "single") return { label: "单锁", className: "locked" };
  if (item.lock === "blocked") return { label: "封锁", className: "blocked" };
  return {
    label: STATUS_LABEL[item.position],
    className: STATUS_CLASS[item.position],
  };
}

function renderDeviceStatus() {
  const rows = [
    ...Object.values(appState.signals).map((signal) => ({
      device: `${signal.id}信号机`,
      status: STATUS_LABEL[signal.status],
      className: STATUS_CLASS[signal.status],
      description: signal.description,
    })),
    ...Object.values(appState.switches).map((item) => {
      const display = getSwitchStatusDisplay(item);
      return {
        device: `${item.id}#道岔`,
        status: display.label,
        className: display.className,
        description: item.description,
      };
    }),
    ...["3G", "6G"].map((trackId) => {
      const track = appState.tracks[trackId];
      return {
        device: `${track.id}轨道`,
        status: STATUS_LABEL[track.status] || track.status,
        className: STATUS_CLASS[track.status] || track.status,
        description: track.description,
      };
    }),
  ];

  elements.statusBody.innerHTML = rows
    .map((row) => {
      return `
        <tr>
          <td>${row.device}</td>
          <td>
            <span class="status-pill">
              <span class="status-dot ${row.className}"></span>
              <span class="status-text ${row.className}">${row.status}</span>
            </span>
          </td>
          <td>${row.description}</td>
        </tr>
      `;
    })
    .join("");
}

function renderInfo() {
  elements.modeText.textContent = appState.mode;
  elements.countdownText.textContent = appState.countdown;
  elements.systemStateText.textContent = appState.systemState;
  elements.operatorText.textContent = appState.operator;
}

function renderAll() {
  Object.entries(appState.tracks).forEach(([trackId, track]) => {
    setTrackState(trackId, track.status);
  });
  Object.entries(appState.signals).forEach(([signalId, signal]) => {
    setSignalState(signalId, signal.status);
  });
  Object.entries(appState.switches).forEach(([switchId, item]) => {
    const node = document.querySelector(`#switch-${switchId}`);
    if (!node) return;
    node.classList.remove("positioned", "reverse", "locked", "blocked");
    node.classList.add(item.position);
    if (item.lock === "single" || item.lock === "locked") node.classList.add("locked");
    if (item.lock === "blocked") node.classList.add("blocked");
  });
  renderTurnoutRoutes();
  renderDeviceStatus();
  renderInfo();
  renderLogs();
}

function getActiveRouteId() {
  return Object.entries(appState.activeRoutes || {}).find(([, route]) => {
    return route.status === "active" || route.status === "canceling";
  })?.[0];
}

function runCoreCommand(command) {
  return dispatchCommand(command);
}

function resetRouteTracks() {
  Object.keys(appState.tracks).forEach((trackId) => {
    const nextStatus = ["3G", "6G"].includes(trackId) ? "occupied" : "free";
    setTrackState(trackId, nextStatus);
  });
}

function establishRoute(routeType) {
  resetRouteTracks();
  if (routeType === "receive") {
    ["2G", "5G"].forEach((trackId) => setTrackState(trackId, "route"));
    setSignalState("X1", "open");
    setSignalState("S1", "closed");
    addLog("success", "接车进路建立成功，X1信号机开放");
    return;
  }
  if (routeType === "depart") {
    ["8G", "7G"].forEach((trackId) => setTrackState(trackId, "route"));
    setSignalState("S1", "open");
    setSignalState("X1", "closed");
    addLog("success", "发车进路建立成功，S1信号机开放");
    return;
  }
  if (routeType === "through") {
    ["1G", "5G", "8G", "7G"].forEach((trackId) => setTrackState(trackId, "route"));
    setSignalState("X1", "open");
    setSignalState("S1", "open");
    addLog("success", "通过进路建立成功，X1/S1信号机开放");
  }
}

function cancelRoute() {
  resetRouteTracks();
  setSignalState("X1", "closed");
  setSignalState("S1", "closed");
  setSignalState("D1", "closed");
  addLog("warn", "进路取消，相关信号机关闭");
}

function startManualUnlock() {
  clearInterval(countdownTimer);
  appState.countdown = 30;
  renderInfo();
  addLog("warn", "人工解锁倒计时 30 秒");
  countdownTimer = setInterval(() => {
    appState.countdown = Math.max(0, appState.countdown - 1);
    renderInfo();
    if (appState.countdown === 0) {
      clearInterval(countdownTimer);
      addLog("success", "人工解锁完成，进路已释放");
      resetRouteTracks();
    }
  }, 1000);
}

function routeUnlock() {
  clearInterval(countdownTimer);
  appState.countdown = 0;
  resetRouteTracks();
  setSignalState("X1", "closed");
  setSignalState("S1", "closed");
  addLog("info", "进路解锁完成，轨道区段恢复空闲显示");
  renderInfo();
}

function shuntRoute() {
  resetRouteTracks();
  ["9G", "5G"].forEach((trackId) => setTrackState(trackId, "route"));
  setSignalState("D1", "open");
  addLog("success", "调车进路建立成功，D1信号机开放");
}

function toggleOccupy() {
  const track = appState.tracks[appState.selectedSection];
  const next = track.status === "occupied" ? "free" : "occupied";
  setTrackState(track.id, next);
  addLog(next === "occupied" ? "danger" : "info", `${track.id}轨道区段${STATUS_LABEL[next]}`);
  appState.selectedSection = appState.selectedSection === "3G" ? "6G" : "3G";
}

function enterSection() {
  setTrackState("1G", "occupied");
  setTrackState("2G", "route");
  addLog("danger", "列车进入1G接近区段，接车进路保持锁闭");
}

function signalFault() {
  const current = appState.signals.X1.status;
  setSignalState("X1", current === "fault" ? "open" : "fault");
  addLog(current === "fault" ? "success" : "danger", current === "fault" ? "X1信号机恢复开放显示" : "X1信号机断丝，灯位熄灭");
  renderDeviceStatus();
}

function resetDevices() {
  clearInterval(countdownTimer);
  clearInterval(demoTimer);
  appState = cloneState(defaultState);
  coreSystem?.replaceState(appState);
  if (window.InterlockingAPI) {
    window.InterlockingAPI.state = appState;
  }
  simulationClock = new Date(INITIAL_CLOCK);
  elements.clock.innerHTML = formatDateTime(simulationClock);
  renderAll();
}

function autoDemo() {
  clearInterval(demoTimer);
  const steps = [
    () => runCoreCommand({ type: "RESET" }),
    () => runCoreCommand({ type: "REQUEST_ROUTE", routeId: "receive" }),
    () => runCoreCommand({ type: "SET_TRACK_OCCUPANCY", trackId: "1G", occupied: true }),
    () => runCoreCommand({ type: "UNLOCK_ROUTE", routeId: "receive" }),
    () => runCoreCommand({ type: "REQUEST_ROUTE", routeId: "shunt" }),
    () => runCoreCommand({ type: "CANCEL_ROUTE", routeId: "shunt" }),
  ];
  let index = 0;
  addLog("info", "自动演示启动");
  steps[index]();
  index += 1;
  demoTimer = setInterval(() => {
    steps[index % steps.length]();
    index += 1;
  }, 1800);
}

const actions = {
  receiveRoute: () => runCoreCommand({ type: "REQUEST_ROUTE", routeId: "receive" }),
  departRoute: () => runCoreCommand({ type: "REQUEST_ROUTE", routeId: "depart" }),
  throughRoute: () => runCoreCommand({ type: "REQUEST_ROUTE", routeId: "through" }),
  cancelRoute: () => runCoreCommand({ type: "CANCEL_ROUTE", routeId: getActiveRouteId() }),
  manualUnlock: () => runCoreCommand({ type: "MANUAL_UNLOCK", routeId: getActiveRouteId(), seconds: 30 }),
  routeUnlock: () => runCoreCommand({ type: "UNLOCK_ROUTE", routeId: getActiveRouteId() }),
  shuntRoute: () => runCoreCommand({ type: "REQUEST_ROUTE", routeId: "shunt" }),
  shuntCancel: () => runCoreCommand({ type: "CANCEL_ROUTE", routeId: "shunt" }),
  openShuntSignal: () => {
    runCoreCommand({ type: "SET_SIGNAL_STATUS", signalId: "D1", status: "open" });
  },
  enterSection: () => runCoreCommand({ type: "SET_TRACK_OCCUPANCY", trackId: "1G", occupied: true }),
  toggleOccupy: () => {
    const track = appState.tracks[appState.selectedSection];
    runCoreCommand({ type: "SET_TRACK_OCCUPANCY", trackId: track.id, occupied: track.status !== "occupied" });
    appState.selectedSection = appState.selectedSection === "3G" ? "6G" : "3G";
  },
  signalFault: () => {
    const current = appState.signals.X1.status;
    runCoreCommand({ type: "SET_SIGNAL_STATUS", signalId: "X1", status: current === "fault" ? "closed" : "fault" });
  },
  resetDevices: () => {
    clearInterval(countdownTimer);
    clearInterval(demoTimer);
    runCoreCommand({ type: "RESET" });
    simulationClock = new Date(INITIAL_CLOCK);
    elements.clock.innerHTML = formatDateTime(simulationClock);
  },
  autoDemo,
};

function bindEvents() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = actions[button.dataset.action];
      if (action) action();
      renderDeviceStatus();
    });
  });

  document.querySelectorAll("[data-switch]").forEach((button) => {
    button.addEventListener("click", () => {
      runCoreCommand({
        type: "SET_SWITCH_POSITION",
        switchId: button.dataset.switch,
        position: button.dataset.position,
      });
    });
  });

  document.querySelectorAll("[data-switch-lock]").forEach((button) => {
    button.addEventListener("click", () => {
      runCoreCommand({
        type: "SET_SWITCH_LOCK",
        switchId: button.dataset.switchLock,
        lock: button.dataset.lock,
      });
    });
  });
}

setInterval(() => {
  simulationClock = new Date(simulationClock.getTime() + 1000);
  elements.clock.innerHTML = formatDateTime(simulationClock);
}, 1000);

bindEvents();
renderAll();

function dispatchCommand(command) {
  if (!coreSystem) {
    return { ok: false, code: "CORE_NOT_READY", message: "联锁核心尚未加载" };
  }
  const result = coreSystem.dispatch(command);
  if (result.message) {
    addLog(result.ok ? "success" : "danger", result.message);
  }
  appState = coreSystem.getState();
  if (window.InterlockingAPI) {
    window.InterlockingAPI.state = appState;
  }
  renderAll();
  return result;
}

window.InterlockingAPI = {
  state: appState,
  core: coreSystem,
  enums: window.InterlockingCore?.Enums,
  stationData: window.InterlockingCore?.StationData,
  routeAlias: window.InterlockingCore?.RouteAlias,
  dispatchCommand,
  setTrackState,
  setSignalState,
  setSwitchPosition,
  setSwitchLock,
  establishRoute,
  cancelRoute,
  routeUnlock,
  startManualUnlock,
  addLog,
  renderAll,
};
