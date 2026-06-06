(function initInterlockingCore(global) {
  "use strict";

  const Enums = {
    SignalStatus: {
      OPEN: "open",
      CLOSED: "closed",
      FAULT: "fault",
    },
    TrackStatus: {
      FREE: "free",
      ROUTE: "route",
      OCCUPIED: "occupied",
      LOCKED: "locked",
      BLOCKED: "blocked",
    },
    SwitchPosition: {
      POSITIONED: "positioned",
      REVERSE: "reverse",
    },
    SwitchLock: {
      FREE: "free",
      LOCKED: "locked",
      SINGLE: "single",
      BLOCKED: "blocked",
    },
    RouteStatus: {
      IDLE: "idle",
      ACTIVE: "active",
      CANCELING: "canceling",
      UNLOCKED: "unlocked",
    },
    CommandType: {
      REQUEST_ROUTE: "REQUEST_ROUTE",
      CANCEL_ROUTE: "CANCEL_ROUTE",
      MANUAL_UNLOCK: "MANUAL_UNLOCK",
      UNLOCK_ROUTE: "UNLOCK_ROUTE",
      SET_SWITCH_POSITION: "SET_SWITCH_POSITION",
      SET_SWITCH_LOCK: "SET_SWITCH_LOCK",
      SET_SIGNAL_STATUS: "SET_SIGNAL_STATUS",
      SET_TRACK_OCCUPANCY: "SET_TRACK_OCCUPANCY",
      SIMULATE_SIGNAL_FAULT: "SIMULATE_SIGNAL_FAULT",
      RESET: "RESET",
    },
  };

  const StationData = {
    tracks: {
      "1G": { id: "1G", name: "1G", line: "接近区段", role: "approach", neighbors: ["5G"] },
      "2G": { id: "2G", name: "2G", line: "I道", role: "receiving", neighbors: ["1G", "3G"] },
      "3G": { id: "3G", name: "3G", line: "I道", role: "platform", neighbors: ["2G", "4G"] },
      "4G": { id: "4G", name: "4G", line: "I道", role: "departure", neighbors: ["3G", "7G"] },
      "5G": { id: "5G", name: "5G", line: "II道", role: "shunting", neighbors: ["1G", "8G"] },
      "6G": { id: "6G", name: "6G", line: "III道", role: "pullout", neighbors: ["9G"] },
      "7G": { id: "7G", name: "7G", line: "出站区段", role: "departure", neighbors: ["4G", "8G"] },
      "8G": { id: "8G", name: "8G", line: "II道", role: "shunting", neighbors: ["5G", "7G"] },
      "9G": { id: "9G", name: "9G", line: "III道", role: "pullout", neighbors: ["6G", "7G"] },
    },
    switches: {
      1: {
        id: "1",
        name: "1#道岔",
        normal: { label: "定位", connects: ["1G", "2G"] },
        reverse: { label: "反位", connects: ["1G", "6G"] },
      },
      3: {
        id: "3",
        name: "3#道岔",
        normal: { label: "定位", connects: ["1G", "5G"] },
        reverse: { label: "反位", connects: ["1G", "6G"] },
      },
      5: {
        id: "5",
        name: "5#道岔",
        normal: { label: "定位", connects: ["9G", "7G"] },
        reverse: { label: "反位", connects: ["4G", "7G"] },
      },
    },
    signals: {
      X1: { id: "X1", name: "X1信号机", type: "entry", direction: "up", protects: ["1G", "2G", "5G"] },
      S1: { id: "S1", name: "S1信号机", type: "exit", direction: "down", protects: ["7G"] },
      D1: { id: "D1", name: "D1信号机", type: "shunt", direction: "down", protects: ["9G", "5G"] },
    },
    routes: {
      RECEIVE_MAIN: {
        id: "RECEIVE_MAIN",
        name: "办理接车进路",
        type: "train-receive",
        entranceSignal: "X1",
        openSignals: ["X1"],
        closeSignals: ["S1", "D1"],
        routeTracks: ["2G", "5G"],
        requiredFreeTracks: ["2G", "5G"],
        requiredSwitches: { 1: "positioned" },
      },
      DEPART_MAIN: {
        id: "DEPART_MAIN",
        name: "办理发车进路",
        type: "train-depart",
        entranceSignal: "S1",
        openSignals: ["S1"],
        closeSignals: ["X1", "D1"],
        routeTracks: ["8G", "7G"],
        requiredFreeTracks: ["8G", "7G"],
        requiredSwitches: { 5: "positioned" },
      },
      THROUGH_MAIN: {
        id: "THROUGH_MAIN",
        name: "办理通过进路",
        type: "train-through",
        entranceSignal: "X1",
        openSignals: ["X1", "S1"],
        closeSignals: ["D1"],
        routeTracks: ["1G", "5G", "8G", "7G"],
        requiredFreeTracks: ["1G", "5G", "8G", "7G"],
        requiredSwitches: { 1: "positioned", 5: "positioned" },
      },
      SHUNT_D1_TO_9G: {
        id: "SHUNT_D1_TO_9G",
        name: "办理调车进路",
        type: "shunt",
        entranceSignal: "D1",
        openSignals: ["D1"],
        closeSignals: ["X1", "S1"],
        routeTracks: ["9G", "5G"],
        requiredFreeTracks: ["9G", "5G"],
        requiredSwitches: { 5: "positioned" },
      },
    },
  };

  const RouteAlias = {
    receive: "RECEIVE_MAIN",
    depart: "DEPART_MAIN",
    through: "THROUGH_MAIN",
    shunt: "SHUNT_D1_TO_9G",
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createInitialState() {
    return {
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
      activeRoutes: {},
      events: [],
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
  }

  function ensureStateShape(state) {
    const initial = createInitialState();
    state.activeRoutes ||= {};
    state.events ||= [];
    state.mode ||= initial.mode;
    state.systemState ||= initial.systemState;
    state.operator ||= initial.operator;
    state.countdown ??= initial.countdown;
    state.selectedSection ||= initial.selectedSection;
    state.signals ||= clone(initial.signals);
    state.switches ||= clone(initial.switches);
    state.tracks ||= clone(initial.tracks);
    state.logs ||= clone(initial.logs);
    return state;
  }

  function normalizeRouteId(routeId) {
    return RouteAlias[routeId] || routeId;
  }

  function makeResult(ok, code, message, changes = []) {
    return { ok, code, message, changes };
  }

  function isEnumValue(enumGroup, value) {
    return Object.values(enumGroup).includes(value);
  }

  function createSystem(seedState, options = {}) {
    let state = options.clone === false ? seedState || createInitialState() : clone(seedState || createInitialState());
    const listeners = new Set();
    ensureStateShape(state);

    function emit(event) {
      const item = {
        id: state.events.length + 1,
        at: Date.now(),
        ...event,
      };
      state.events.push(item);
      listeners.forEach((listener) => listener(item, state));
      return item;
    }

    function notifyResult(result) {
      emit({
        type: result.ok ? "RESULT_OK" : "RESULT_FAIL",
        code: result.code,
        message: result.message,
        changes: result.changes || [],
      });
      return result;
    }

    function getState() {
      return state;
    }

    function replaceState(nextState, replaceOptions = {}) {
      state = replaceOptions.clone === true ? clone(nextState) : nextState;
      ensureStateShape(state);
      emit({ type: "STATE_REPLACED", message: "核心状态已替换" });
      return state;
    }

    function subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    function validateRoute(routeId) {
      const id = normalizeRouteId(routeId);
      const route = StationData.routes[id];
      if (!route) {
        return makeResult(false, "ROUTE_NOT_FOUND", `进路不存在：${routeId}`);
      }

      for (const trackId of route.requiredFreeTracks) {
        const track = state.tracks[trackId];
        if (!track) {
          return makeResult(false, "TRACK_NOT_FOUND", `轨道区段不存在：${trackId}`);
        }
        if (track.status === Enums.TrackStatus.OCCUPIED) {
          return makeResult(false, "TRACK_OCCUPIED", `${trackId}轨道区段占用，不能建立进路`);
        }
        if (track.status === Enums.TrackStatus.BLOCKED) {
          return makeResult(false, "TRACK_BLOCKED", `${trackId}轨道区段封锁，不能建立进路`);
        }
      }

      for (const [switchId, requiredPosition] of Object.entries(route.requiredSwitches)) {
        const item = state.switches[switchId];
        if (!item) {
          return makeResult(false, "SWITCH_NOT_FOUND", `${switchId}#道岔不存在`);
        }
        if (item.lock === Enums.SwitchLock.BLOCKED) {
          return makeResult(false, "SWITCH_BLOCKED", `${switchId}#道岔封锁，不能建立进路`);
        }
        if ([Enums.SwitchLock.LOCKED, Enums.SwitchLock.SINGLE].includes(item.lock) && item.position !== requiredPosition) {
          return makeResult(false, "SWITCH_LOCKED_WRONG_POSITION", `${switchId}#道岔锁闭在非进路要求位置`);
        }
      }

      for (const signalId of route.openSignals) {
        const sig = state.signals[signalId];
        if (sig && sig.status === Enums.SignalStatus.FAULT) {
          return makeResult(false, "SIGNAL_FAULT", `${signalId}信号机断丝熄灭，不能建立${route.name}`);
        }
      }

      return makeResult(true, "ROUTE_VALID", `${route.name}条件检查通过`);
    }

    function switchPositionLabel(switchId, position) {
      const meta = StationData.switches[switchId];
      if (position === Enums.SwitchPosition.POSITIONED) {
        return meta?.normal?.label || "定位";
      }
      return meta?.reverse?.label || "反位";
    }

    function switchDescriptionByPosition(position) {
      return position === Enums.SwitchPosition.POSITIONED ? "开通直向" : "开通侧向";
    }

    function switchDescriptionByLock(item) {
      if (item.lock === Enums.SwitchLock.BLOCKED) return "设备封锁";
      if (item.lock === Enums.SwitchLock.SINGLE) return "单独锁闭";
      if (item.lock === Enums.SwitchLock.LOCKED) return "进路锁闭";
      return switchDescriptionByPosition(item.position);
    }

    function setSwitchPosition(switchId, position) {
      const item = state.switches[switchId];
      if (!item) return notifyResult(makeResult(false, "SWITCH_NOT_FOUND", `${switchId}#道岔不存在`));
      if (!isEnumValue(Enums.SwitchPosition, position)) {
        return notifyResult(makeResult(false, "INVALID_SWITCH_POSITION", `无效道岔位置：${position}`));
      }
      if (item.lock === Enums.SwitchLock.BLOCKED) {
        return notifyResult(makeResult(false, "SWITCH_BLOCKED", `${switchId}#道岔封锁，禁止转换`));
      }
      if ([Enums.SwitchLock.LOCKED, Enums.SwitchLock.SINGLE].includes(item.lock) && item.position !== position) {
        return notifyResult(makeResult(false, "SWITCH_LOCKED", `${switchId}#道岔锁闭，禁止转换`));
      }
      const label = switchPositionLabel(switchId, position);
      if (item.position === position) {
        return notifyResult(makeResult(true, "SWITCH_POSITION_UNCHANGED", `${switchId}#道岔已在${label}`, [
          { kind: "switch", id: switchId, field: "position", value: position },
        ]));
      }
      item.position = position;
      if (item.lock === Enums.SwitchLock.FREE) {
        item.description = switchDescriptionByPosition(position);
      }
      return notifyResult(makeResult(true, "SWITCH_POSITION_SET", `${switchId}#道岔转换至${label}`, [
        { kind: "switch", id: switchId, field: "position", value: position },
      ]));
    }

    function setSwitchLock(switchId, lock) {
      const item = state.switches[switchId];
      if (!item) return notifyResult(makeResult(false, "SWITCH_NOT_FOUND", `${switchId}#道岔不存在`));
      if (!isEnumValue(Enums.SwitchLock, lock)) {
        return notifyResult(makeResult(false, "INVALID_SWITCH_LOCK", `无效道岔锁闭状态：${lock}`));
      }
      const lockMessage = {
        [Enums.SwitchLock.FREE]: "已解锁",
        [Enums.SwitchLock.SINGLE]: "已单独锁闭",
        [Enums.SwitchLock.BLOCKED]: "已设备封锁",
        [Enums.SwitchLock.LOCKED]: "已进路锁闭",
      }[lock];
      const lockStatusLabel = {
        [Enums.SwitchLock.FREE]: "解锁",
        [Enums.SwitchLock.SINGLE]: "单独锁闭",
        [Enums.SwitchLock.BLOCKED]: "设备封锁",
        [Enums.SwitchLock.LOCKED]: "进路锁闭",
      }[lock];
      if (item.lock === lock) {
        return notifyResult(makeResult(true, "SWITCH_LOCK_UNCHANGED", `${switchId}#道岔已处于${lockStatusLabel}状态`, [
          { kind: "switch", id: switchId, field: "lock", value: lock },
        ]));
      }
      if (item.lock === Enums.SwitchLock.BLOCKED && lock !== Enums.SwitchLock.FREE) {
        return notifyResult(makeResult(false, "SWITCH_BLOCKED", `${switchId}#道岔处于封锁状态，只能执行解锁操作`));
      }
      if (item.lock === Enums.SwitchLock.LOCKED && lock !== Enums.SwitchLock.LOCKED) {
        return notifyResult(makeResult(false, "SWITCH_ROUTE_LOCKED", `${switchId}#道岔进路锁闭，请通过取消进路或进路解锁释放`));
      }
      if (lock === Enums.SwitchLock.BLOCKED && item.lock !== Enums.SwitchLock.FREE) {
        return notifyResult(makeResult(false, "SWITCH_NOT_FREE", `${switchId}#道岔未解锁，不能施加设备封锁`));
      }
      item.lock = lock;
      item.description = switchDescriptionByLock(item);
      return notifyResult(makeResult(true, "SWITCH_LOCK_SET", `${switchId}#道岔${lockMessage}`, [
        { kind: "switch", id: switchId, field: "lock", value: lock },
      ]));
    }

    function signalDescription(signalId, status) {
      const meta = StationData.signals[signalId];
      const name = meta?.name || `${signalId}信号机`;
      if (status === Enums.SignalStatus.OPEN) return `${name}开放`;
      if (status === Enums.SignalStatus.CLOSED) return `${name}关闭`;
      return `${name}断丝熄灭`;
    }

    function signalStatusMessage(signalId, status) {
      const meta = StationData.signals[signalId];
      const name = meta?.name || `${signalId}信号机`;
      if (status === Enums.SignalStatus.OPEN) return `${name}已开放`;
      if (status === Enums.SignalStatus.CLOSED) return `${name}已关闭`;
      return `${name}断丝熄灭`;
    }

    function setSignalStatus(signalId, status) {
      const item = state.signals[signalId];
      if (!item) return notifyResult(makeResult(false, "SIGNAL_NOT_FOUND", `${signalId}信号机不存在`));
      if (!isEnumValue(Enums.SignalStatus, status)) {
        return notifyResult(makeResult(false, "INVALID_SIGNAL_STATUS", `无效信号机状态：${status}`));
      }
      if (status === Enums.SignalStatus.OPEN && item.status === Enums.SignalStatus.FAULT) {
        return notifyResult(makeResult(false, "SIGNAL_FAULT", `${signalId}信号机断丝熄灭，禁止开放`));
      }
      item.status = status;
      item.description = signalDescription(signalId, status);
      return notifyResult(makeResult(true, "SIGNAL_STATUS_SET", signalStatusMessage(signalId, status), [
        { kind: "signal", id: signalId, field: "status", value: status },
      ]));
    }

    function trackDescriptionByStatus(trackId, status) {
      const meta = StationData.tracks[trackId];
      if (status === Enums.TrackStatus.OCCUPIED) return `${trackId}轨道区段占用`;
      if (status === Enums.TrackStatus.ROUTE) return `${trackId}进路锁闭`;
      return meta?.line ? `${meta.line}空闲` : `${trackId}轨道区段空闲`;
    }

    function setTrackOccupancy(trackId, occupied) {
      const item = state.tracks[trackId];
      if (!item) return notifyResult(makeResult(false, "TRACK_NOT_FOUND", `${trackId}轨道区段不存在`));
      if (occupied) {
        item.status = Enums.TrackStatus.OCCUPIED;
        item.description = trackDescriptionByStatus(trackId, Enums.TrackStatus.OCCUPIED);
        return notifyResult(makeResult(true, "TRACK_OCCUPIED", `${trackId}轨道区段占用`, [
          { kind: "track", id: trackId, field: "status", value: item.status },
        ]));
      }
      const nextStatus = findTrackInActiveRoute(trackId) ? Enums.TrackStatus.ROUTE : Enums.TrackStatus.FREE;
      item.status = nextStatus;
      item.description = trackDescriptionByStatus(trackId, nextStatus);
      return notifyResult(makeResult(true, "TRACK_CLEARED", `${trackId}轨道区段出清`, [
        { kind: "track", id: trackId, field: "status", value: item.status },
      ]));
    }

    function findTrackInActiveRoute(trackId) {
      return Object.values(state.activeRoutes).some((active) => {
        const route = StationData.routes[active.routeId];
        return active.status === Enums.RouteStatus.ACTIVE && route?.routeTracks.includes(trackId);
      });
    }

    function establishRoute(routeId) {
      const id = normalizeRouteId(routeId);
      const route = StationData.routes[id];
      const valid = validateRoute(id);
      if (!valid.ok) return notifyResult(valid);

      const changes = [];
      Object.entries(route.requiredSwitches).forEach(([switchId, position]) => {
        const item = state.switches[switchId];
        item.position = position;
        item.lock = Enums.SwitchLock.LOCKED;
        item.description = "进路锁闭";
        changes.push({ kind: "switch", id: switchId, field: "position", value: position });
        changes.push({ kind: "switch", id: switchId, field: "lock", value: Enums.SwitchLock.LOCKED });
      });

      route.routeTracks.forEach((trackId) => {
        if (state.tracks[trackId].status !== Enums.TrackStatus.OCCUPIED) {
          state.tracks[trackId].status = Enums.TrackStatus.ROUTE;
          changes.push({ kind: "track", id: trackId, field: "status", value: Enums.TrackStatus.ROUTE });
        }
      });

      route.openSignals.forEach((signalId) => {
        state.signals[signalId].status = Enums.SignalStatus.OPEN;
        changes.push({ kind: "signal", id: signalId, field: "status", value: Enums.SignalStatus.OPEN });
      });

      route.closeSignals.forEach((signalId) => {
        state.signals[signalId].status = Enums.SignalStatus.CLOSED;
        changes.push({ kind: "signal", id: signalId, field: "status", value: Enums.SignalStatus.CLOSED });
      });

      state.activeRoutes[id] = {
        routeId: id,
        status: Enums.RouteStatus.ACTIVE,
        startedAt: Date.now(),
      };

      return notifyResult(makeResult(true, "ROUTE_ESTABLISHED", `${route.name}建立成功`, changes));
    }

    function cancelRoute(routeId) {
      const id = routeId ? normalizeRouteId(routeId) : Object.keys(state.activeRoutes)[0];
      const route = StationData.routes[id];
      if (!route) return notifyResult(makeResult(false, "ROUTE_NOT_FOUND", "没有可取消的进路"));
      releaseRoute(route);
      return notifyResult(makeResult(true, "ROUTE_CANCELED", `${route.name}已取消`));
    }

    function unlockRoute(routeId) {
      const id = routeId ? normalizeRouteId(routeId) : Object.keys(state.activeRoutes)[0];
      const route = StationData.routes[id];
      if (!route) return notifyResult(makeResult(false, "ROUTE_NOT_FOUND", "没有可解锁的进路"));
      releaseRoute(route);
      return notifyResult(makeResult(true, "ROUTE_UNLOCKED", `${route.name}已解锁`));
    }

    function manualUnlock(routeId, seconds = 30) {
      state.countdown = seconds;
      const id = routeId ? normalizeRouteId(routeId) : Object.keys(state.activeRoutes)[0];
      const route = StationData.routes[id];
      return notifyResult(makeResult(true, "MANUAL_UNLOCK_STARTED", `${route?.name || "进路"}人工解锁倒计时 ${seconds} 秒`, [
        { kind: "system", field: "countdown", value: seconds },
      ]));
    }

    function releaseRoute(route) {
      route.routeTracks.forEach((trackId) => {
        if (state.tracks[trackId].status === Enums.TrackStatus.ROUTE) {
          state.tracks[trackId].status = Enums.TrackStatus.FREE;
        }
      });
      Object.keys(route.requiredSwitches).forEach((switchId) => {
        if (state.switches[switchId]?.lock === Enums.SwitchLock.LOCKED) {
          state.switches[switchId].lock = Enums.SwitchLock.FREE;
          state.switches[switchId].description =
            state.switches[switchId].position === Enums.SwitchPosition.POSITIONED ? "开通直向" : "开通侧向";
        }
      });
      route.openSignals.forEach((signalId) => {
        state.signals[signalId].status = Enums.SignalStatus.CLOSED;
      });
      delete state.activeRoutes[route.id];
    }

    function reset() {
      replaceState(createInitialState());
      return notifyResult(makeResult(true, "SYSTEM_RESET", "系统状态已复位"));
    }

    function dispatch(command) {
      if (!command || !command.type) {
        return notifyResult(makeResult(false, "BAD_COMMAND", "命令缺少type字段"));
      }
      switch (command.type) {
        case Enums.CommandType.REQUEST_ROUTE:
          return establishRoute(command.routeId);
        case Enums.CommandType.CANCEL_ROUTE:
          return cancelRoute(command.routeId);
        case Enums.CommandType.MANUAL_UNLOCK:
          return manualUnlock(command.routeId, command.seconds);
        case Enums.CommandType.UNLOCK_ROUTE:
          return unlockRoute(command.routeId);
        case Enums.CommandType.SET_SWITCH_POSITION:
          return setSwitchPosition(String(command.switchId), command.position);
        case Enums.CommandType.SET_SWITCH_LOCK:
          return setSwitchLock(String(command.switchId), command.lock);
        case Enums.CommandType.SET_SIGNAL_STATUS:
          return setSignalStatus(command.signalId, command.status);
        case Enums.CommandType.SET_TRACK_OCCUPANCY:
          return setTrackOccupancy(command.trackId, Boolean(command.occupied));
        case Enums.CommandType.SIMULATE_SIGNAL_FAULT:
          return setSignalStatus(command.signalId, command.faulted ? Enums.SignalStatus.FAULT : Enums.SignalStatus.CLOSED);
        case Enums.CommandType.RESET:
          return reset();
        default:
          return notifyResult(makeResult(false, "UNKNOWN_COMMAND", `未知命令：${command.type}`));
      }
    }

    return {
      getState,
      replaceState,
      subscribe,
      dispatch,
      validateRoute,
      establishRoute,
      cancelRoute,
      manualUnlock,
      unlockRoute,
      setSwitchPosition,
      setSwitchLock,
      setSignalStatus,
      setTrackOccupancy,
      reset,
    };
  }

  global.InterlockingCore = {
    Enums,
    StationData,
    RouteAlias,
    createInitialState,
    createSystem,
    clone,
  };
})(window);
