# 进路作业与联锁逻辑部分报告

## 1. 进路作业功能设计

### 1.1 功能定位

本模块负责列车作业、调车作业以及进路取消和解锁逻辑。所有操作统一通过 `InterlockingAPI.dispatchCommand(...)` 进入核心层，由 `interlocking-core.js` 检查联锁条件并修改统一的 `state`，不单独维护另一套状态。

本部分覆盖的功能包括：

```text
接车进路
发车进路
通过进路
调车进路
取消进路
人工解锁
进路解锁
```

### 1.2 涉及数据结构

```js
state.activeRoutes = {
  RECEIVE_MAIN: {
    routeId: "RECEIVE_MAIN",
    status: "active", // active 已建立 | canceling 人工解锁中
    startedAt: 1710000000000
  }
};
```

进路静态定义见 `StationData.routes`，当前已有四条进路：

```text
RECEIVE_MAIN     接车进路，别名 receive
DEPART_MAIN      发车进路，别名 depart
THROUGH_MAIN     通过进路，别名 through
SHUNT_D1_TO_9G   调车进路，别名 shunt
```

每条进路定义包含：

```js
{
  routeTracks: ["2G", "5G"],          // 进路包含的轨道区段
  requiredFreeTracks: ["2G", "5G"],   // 办理前要求空闲的轨道区段
  requiredSwitches: { 1: "positioned" }, // 道岔要求位置
  openSignals: ["X1"],                // 成功后开放的信号机
  closeSignals: ["S1", "D1"]          // 成功后关闭的信号机
}
```

### 1.3 命令与函数映射

| 功能 | 命令 type | routeId | 核心函数 |
|---|---|---|---|
| 办理接车进路 | REQUEST_ROUTE | receive | establishRoute(routeId) |
| 办理发车进路 | REQUEST_ROUTE | depart | establishRoute(routeId) |
| 办理通过进路 | REQUEST_ROUTE | through | establishRoute(routeId) |
| 办理调车进路 | REQUEST_ROUTE | shunt | establishRoute(routeId) |
| 取消进路 | CANCEL_ROUTE | receive/depart/through/shunt | cancelRoute(routeId) |
| 人工解锁 | MANUAL_UNLOCK | receive/depart/through/shunt | manualUnlock(routeId, seconds) |
| 进路解锁 | UNLOCK_ROUTE | receive/depart/through/shunt | unlockRoute(routeId) |
| 联锁条件检查 | - | - | validateRoute(routeId) |

所有结果统一返回：

```js
{
  ok: true,
  code: "ROUTE_ESTABLISHED",
  message: "办理接车进路建立成功",
  changes: [
    { kind: "track", id: "2G", field: "status", value: "route" }
  ]
}
```

### 1.4 设计原则

1. 办理进路前先执行 `validateRoute(routeId)`，只有联锁条件满足时才允许建立进路。
2. 同一时刻只允许存在一条活动进路，已有进路未取消或解锁时，禁止办理其他进路。
3. 进路要求的轨道区段必须空闲，轨道占用、封锁或锁闭时拒绝办理。
4. 进路要求的道岔不能处于设备封锁状态；若道岔已锁闭或单锁，则必须处于进路要求位置。
5. 进路需要开放的信号机不能处于断丝/熄灭状态。
6. 建立进路后统一修改 `state.tracks`、`state.switches`、`state.signals` 和 `state.activeRoutes`。
7. 取消进路、人工解锁、进路解锁必须针对已经建立的进路；未建立进路时拒绝操作。

---

## 2. 接车进路办理说明

### 2.1 功能作用

接车进路用于模拟列车由进站方向进入站内到发线的作业过程。办理成功后，系统开放 X1 进站信号机，锁闭相关轨道和道岔，并在站场图中显示接车进路。

### 2.2 调用命令 / 函数

```js
InterlockingAPI.dispatchCommand({
  type: "REQUEST_ROUTE",
  routeId: "receive"
});
```

对应核心函数：

```text
validateRoute(routeId)
establishRoute(routeId)
```

### 2.3 检查条件

| 序号 | 条件 | 不满足时 |
|---|---|---|
| 1 | routeId 能匹配到 RECEIVE_MAIN | ROUTE_NOT_FOUND |
| 2 | 当前没有已建立或人工解锁中的进路 | ROUTE_CONFLICT |
| 3 | 2G、5G 轨道区段未占用、未封锁、未锁闭 | TRACK_OCCUPIED / TRACK_BLOCKED / TRACK_LOCKED |
| 4 | 1#道岔存在，且不处于 blocked 封锁 | SWITCH_NOT_FOUND / SWITCH_BLOCKED |
| 5 | 1#道岔若已锁闭或单锁，位置必须为 positioned | SWITCH_LOCKED_WRONG_POSITION |
| 6 | X1信号机存在，且不处于 fault 断丝状态 | SIGNAL_NOT_FOUND / SIGNAL_FAULT |

### 2.4 成功后状态变化

```text
2G、5G 状态变为 route
1#道岔转换到 positioned，并设置 lock 为 locked
X1 信号机状态变为 open
S1、D1 信号机状态变为 closed
state.activeRoutes.RECEIVE_MAIN 写入 active 状态
```

返回：

```text
ok: true
code: ROUTE_ESTABLISHED
message: 办理接车进路建立成功
```

### 2.5 失败时提示示例

```text
5G轨道区段占用，不能建立进路
X1信号机断丝熄灭，不能办理接车进路
发车进路未解锁，不能办理接车进路
```

### 2.6 测试验证

成功测试：

```js
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "receive" });
```

期望结果：

```text
ok: true
code: ROUTE_ESTABLISHED
```

失败测试：轨道占用时拒绝接车。

```js
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "SET_TRACK_OCCUPANCY", trackId: "5G", occupied: true });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "receive" });
```

期望结果：

```text
ok: false
code: TRACK_OCCUPIED
message: 5G轨道区段占用，不能建立进路
```

---

## 3. 发车进路办理说明

### 3.1 功能作用

发车进路用于模拟列车由站内向出站方向发车的作业过程。办理成功后，系统开放 S1 出站信号机，锁闭出站方向相关轨道区段和道岔。

### 3.2 调用命令 / 函数

```js
InterlockingAPI.dispatchCommand({
  type: "REQUEST_ROUTE",
  routeId: "depart"
});
```

对应核心函数：

```text
validateRoute(routeId)
establishRoute(routeId)
```

### 3.3 检查条件

| 序号 | 条件 | 不满足时 |
|---|---|---|
| 1 | routeId 能匹配到 DEPART_MAIN | ROUTE_NOT_FOUND |
| 2 | 当前没有其他活动进路 | ROUTE_CONFLICT |
| 3 | 8G、7G 轨道区段空闲 | TRACK_OCCUPIED / TRACK_BLOCKED / TRACK_LOCKED |
| 4 | 5#道岔存在，且不处于 blocked 封锁 | SWITCH_NOT_FOUND / SWITCH_BLOCKED |
| 5 | 5#道岔若已锁闭或单锁，位置必须为 positioned | SWITCH_LOCKED_WRONG_POSITION |
| 6 | S1信号机存在，且不处于 fault 断丝状态 | SIGNAL_NOT_FOUND / SIGNAL_FAULT |

### 3.4 成功后状态变化

```text
8G、7G 状态变为 route
5#道岔转换到 positioned，并设置 lock 为 locked
S1 信号机状态变为 open
X1、D1 信号机状态变为 closed
state.activeRoutes.DEPART_MAIN 写入 active 状态
```

返回：

```text
ok: true
code: ROUTE_ESTABLISHED
message: 办理发车进路建立成功
```

### 3.5 失败时提示示例

```text
5#道岔封锁，不能建立进路
S1信号机断丝熄灭，不能办理发车进路
接车进路未解锁，不能办理发车进路
```

### 3.6 测试验证

成功测试：

```js
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "depart" });
```

失败测试：道岔封锁时拒绝发车。

```js
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "SET_SWITCH_LOCK", switchId: "5", lock: "blocked" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "depart" });
```

期望结果：

```text
ok: false
code: SWITCH_BLOCKED
message: 5#道岔封锁，不能建立进路
```

---

## 4. 通过进路办理说明

### 4.1 功能作用

通过进路用于模拟列车不停车通过车站的作业过程。通过进路同时涉及进站和出站方向，因此办理成功后需要同时开放 X1 和 S1 信号机，并锁闭整条通过路径。

### 4.2 调用命令 / 函数

```js
InterlockingAPI.dispatchCommand({
  type: "REQUEST_ROUTE",
  routeId: "through"
});
```

对应核心函数：

```text
validateRoute(routeId)
establishRoute(routeId)
```

### 4.3 检查条件

| 序号 | 条件 | 不满足时 |
|---|---|---|
| 1 | routeId 能匹配到 THROUGH_MAIN | ROUTE_NOT_FOUND |
| 2 | 当前没有其他活动进路 | ROUTE_CONFLICT |
| 3 | 1G、5G、8G、7G 轨道区段空闲 | TRACK_OCCUPIED / TRACK_BLOCKED / TRACK_LOCKED |
| 4 | 1#、5#道岔存在，且不处于 blocked 封锁 | SWITCH_NOT_FOUND / SWITCH_BLOCKED |
| 5 | 1#、5#道岔满足 positioned 要求位置 | SWITCH_LOCKED_WRONG_POSITION |
| 6 | X1、S1信号机存在，且不处于 fault 断丝状态 | SIGNAL_NOT_FOUND / SIGNAL_FAULT |

### 4.4 成功后状态变化

```text
1G、5G、8G、7G 状态变为 route
1#、5#道岔转换到 positioned，并设置 lock 为 locked
X1、S1 信号机状态变为 open
D1 信号机状态变为 closed
state.activeRoutes.THROUGH_MAIN 写入 active 状态
```

返回：

```text
ok: true
code: ROUTE_ESTABLISHED
message: 办理通过进路建立成功
```

### 4.5 失败时提示示例

```text
发车进路未解锁，不能办理通过进路
X1信号机断丝熄灭，不能办理通过进路
7G轨道区段占用，不能建立进路
```

### 4.6 测试验证

成功测试：

```js
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "through" });
```

失败测试：已有发车进路时拒绝办理通过进路。

```js
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "depart" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "through" });
```

期望结果：

```text
ok: false
code: ROUTE_CONFLICT
message: 发车进路未解锁，不能办理通过进路
```

---

## 5. 调车进路办理说明

### 5.1 功能作用

调车进路用于模拟站内调车作业。系统采用一条固定调车路径，办理成功后开放 D1 调车信号机，并锁闭调车路径上的轨道和道岔。

### 5.2 调用命令 / 函数

```js
InterlockingAPI.dispatchCommand({
  type: "REQUEST_ROUTE",
  routeId: "shunt"
});
```

对应核心函数：

```text
validateRoute(routeId)
establishRoute(routeId)
```

### 5.3 检查条件

| 序号 | 条件 | 不满足时 |
|---|---|---|
| 1 | routeId 能匹配到 SHUNT_D1_TO_9G | ROUTE_NOT_FOUND |
| 2 | 当前没有其他活动进路 | ROUTE_CONFLICT |
| 3 | 9G、5G 轨道区段空闲 | TRACK_OCCUPIED / TRACK_BLOCKED / TRACK_LOCKED |
| 4 | 5#道岔存在，且不处于 blocked 封锁 | SWITCH_NOT_FOUND / SWITCH_BLOCKED |
| 5 | 5#道岔满足 positioned 要求位置 | SWITCH_LOCKED_WRONG_POSITION |
| 6 | D1信号机存在，且不处于 fault 断丝状态 | SIGNAL_NOT_FOUND / SIGNAL_FAULT |

### 5.4 成功后状态变化

```text
9G、5G 状态变为 route
5#道岔转换到 positioned，并设置 lock 为 locked
D1 信号机状态变为 open
X1、S1 信号机状态变为 closed
state.activeRoutes.SHUNT_D1_TO_9G 写入 active 状态
```

返回：

```text
ok: true
code: ROUTE_ESTABLISHED
message: 办理调车进路建立成功
```

### 5.5 失败时提示示例

```text
5G轨道区段占用，不能建立进路
D1信号机断丝熄灭，不能办理调车进路
发车进路未解锁，不能办理调车进路
```

### 5.6 测试验证

成功测试：

```js
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "shunt" });
```

失败测试：D1 断丝时拒绝调车进路。

```js
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "SET_SIGNAL_STATUS", signalId: "D1", status: "fault" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "shunt" });
```

期望结果：

```text
ok: false
code: SIGNAL_FAULT
```

---

## 6. 取消进路功能说明

### 6.1 功能作用

取消进路用于在进路已经建立后，关闭相关信号机，释放轨道区段和道岔锁闭，并从 `state.activeRoutes` 中移除该进路。

### 6.2 调用命令 / 函数

```js
InterlockingAPI.dispatchCommand({
  type: "CANCEL_ROUTE",
  routeId: "receive"
});
```

对应核心函数：

```text
cancelRoute(routeId)
releaseRoute(route)
```

### 6.3 检查条件

| 序号 | 条件 | 不满足时 |
|---|---|---|
| 1 | routeId 能匹配到已定义进路 | ROUTE_NOT_FOUND |
| 2 | 该进路当前已建立或处于人工解锁中 | ROUTE_NOT_ACTIVE |

### 6.4 成功后状态变化

```text
进路内 status 为 route 的轨道恢复为 free
进路锁闭的道岔 lock 从 locked 恢复为 free
进路开放过的信号机恢复为 closed
state.countdown 设置为 0
从 state.activeRoutes 删除该进路
```

返回：

```text
ok: true
code: ROUTE_CANCELED
message: 办理接车进路已取消
```

### 6.5 测试验证

```js
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "receive" });
InterlockingAPI.dispatchCommand({ type: "CANCEL_ROUTE", routeId: "receive" });
```

失败测试：未建立进路时取消。

```js
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "CANCEL_ROUTE", routeId: "depart" });
```

期望结果：

```text
ok: false
code: ROUTE_NOT_ACTIVE
message: 办理发车进路当前未建立
```

---

## 7. 人工解锁功能说明

### 7.1 功能作用

人工解锁用于模拟人工确认后延时释放进路。当前实现会把目标进路状态设置为 `canceling`，并设置 `state.countdown` 显示倒计时秒数，供大屏显示和日志说明。

### 7.2 调用命令 / 函数

```js
InterlockingAPI.dispatchCommand({
  type: "MANUAL_UNLOCK",
  routeId: "receive",
  seconds: 30
});
```

对应核心函数：

```text
manualUnlock(routeId, seconds)
```

### 7.3 检查条件

| 序号 | 条件 | 不满足时 |
|---|---|---|
| 1 | routeId 能匹配到已定义进路 | ROUTE_NOT_FOUND |
| 2 | 该进路当前已建立或处于人工解锁中 | ROUTE_NOT_ACTIVE |

### 7.4 成功后状态变化

```text
state.countdown 设置为 seconds
activeRoutes[routeId].status 设置为 canceling
activeRoutes[routeId].unlockSeconds 记录倒计时秒数
activeRoutes[routeId].manualUnlockStartedAt 记录开始时间
```

返回：

```text
ok: true
code: MANUAL_UNLOCK_STARTED
message: 办理接车进路人工解锁倒计时 30 秒
```

### 7.5 测试验证

```js
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "receive" });
InterlockingAPI.dispatchCommand({ type: "MANUAL_UNLOCK", routeId: "receive", seconds: 30 });
```

---

## 8. 进路解锁功能说明

### 8.1 功能作用

进路解锁用于直接释放已经建立的进路。该功能和取消进路一样会调用 `releaseRoute(route)`，释放轨道、信号机和道岔锁闭状态。

### 8.2 调用命令 / 函数

```js
InterlockingAPI.dispatchCommand({
  type: "UNLOCK_ROUTE",
  routeId: "receive"
});
```

对应核心函数：

```text
unlockRoute(routeId)
releaseRoute(route)
```

### 8.3 检查条件

| 序号 | 条件 | 不满足时 |
|---|---|---|
| 1 | routeId 能匹配到已定义进路 | ROUTE_NOT_FOUND |
| 2 | 该进路当前已建立或处于人工解锁中 | ROUTE_NOT_ACTIVE |

### 8.4 成功后状态变化

```text
进路内轨道恢复为 free
相关道岔 lock 恢复为 free
开放过的信号机关闭
state.countdown 设置为 0
从 state.activeRoutes 删除该进路
```

返回：

```text
ok: true
code: ROUTE_UNLOCKED
message: 办理接车进路已解锁
```

### 8.5 测试验证

```js
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "receive" });
InterlockingAPI.dispatchCommand({ type: "UNLOCK_ROUTE", routeId: "receive" });
```

---

## 9. 页面接入说明

页面按钮由 `app.js` 绑定，当前已经统一调用核心命令，不再使用旧的“直接改颜色”逻辑。

按钮与命令对应关系：

| 页面按钮 | 调用命令 |
|---|---|
| 办理接车进路 | REQUEST_ROUTE + routeId: receive |
| 办理发车进路 | REQUEST_ROUTE + routeId: depart |
| 办理通过进路 | REQUEST_ROUTE + routeId: through |
| 办理调车进路 | REQUEST_ROUTE + routeId: shunt |
| 取消进路 | CANCEL_ROUTE + 当前活动进路 |
| 调车取消 | CANCEL_ROUTE + routeId: shunt |
| 人工解锁 | MANUAL_UNLOCK + 当前活动进路 |
| 进路解锁 | UNLOCK_ROUTE + 当前活动进路 |

页面刷新流程：

```text
点击按钮
↓
app.js 调用 dispatchCommand(command)
↓
interlocking-core.js 执行联锁判断并修改 state
↓
app.js 同步 InterlockingAPI.state
↓
renderAll() 刷新站场图、信号机、道岔、设备状态区和日志区
```

---

## 10. 验收命令清单

每条测试前建议先执行 `RESET`，避免前序状态影响。

```js
// 1. 接车进路
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "receive" });

// 2. 发车进路
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "depart" });

// 3. 通过进路
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "through" });

// 4. 调车进路
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "shunt" });

// 5. 轨道占用时禁止办理接车进路
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "SET_TRACK_OCCUPANCY", trackId: "5G", occupied: true });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "receive" });

// 6. 道岔封锁时禁止办理发车进路
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "SET_SWITCH_LOCK", switchId: "5", lock: "blocked" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "depart" });

// 7. 信号机断丝时禁止办理接车进路
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "SET_SIGNAL_STATUS", signalId: "X1", status: "fault" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "receive" });

// 8. 已有进路时禁止办理冲突进路
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "depart" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "through" });

// 9. 取消进路
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "receive" });
InterlockingAPI.dispatchCommand({ type: "CANCEL_ROUTE", routeId: "receive" });

// 10. 人工解锁
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "receive" });
InterlockingAPI.dispatchCommand({ type: "MANUAL_UNLOCK", routeId: "receive", seconds: 30 });

// 11. 进路解锁
InterlockingAPI.dispatchCommand({ type: "RESET" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "receive" });
InterlockingAPI.dispatchCommand({ type: "UNLOCK_ROUTE", routeId: "receive" });
```

---

## 11. 测试结果汇总

| 编号 | 测试项 | 类型 | 结果 | 返回 code |
|---|---|---|---|---|
| A1 | 接车进路建立 | 成功 | 通过 | ROUTE_ESTABLISHED |
| A2 | 发车进路建立 | 成功 | 通过 | ROUTE_ESTABLISHED |
| A3 | 通过进路建立 | 成功 | 通过 | ROUTE_ESTABLISHED |
| A4 | 调车进路建立 | 成功 | 通过 | ROUTE_ESTABLISHED |
| A5 | 5G 占用后办理接车进路 | 失败 | 通过 | TRACK_OCCUPIED |
| A6 | 5# 道岔封锁后办理发车进路 | 失败 | 通过 | SWITCH_BLOCKED |
| A7 | X1 断丝后办理接车进路 | 失败 | 通过 | SIGNAL_FAULT |
| A8 | 发车进路未解锁时办理通过进路 | 失败 | 通过 | ROUTE_CONFLICT |
| A9 | 取消已建立的接车进路 | 成功 | 通过 | ROUTE_CANCELED |
| A10 | 人工解锁已建立的接车进路 | 成功 | 通过 | MANUAL_UNLOCK_STARTED |
| A11 | 进路解锁已建立的接车进路 | 成功 | 通过 | ROUTE_UNLOCKED |
| A12 | 未建立发车进路时执行取消 | 失败 | 通过 | ROUTE_NOT_ACTIVE |

---

## 12. 截图建议

建议报告中至少放以下截图：

| 编号 | 截图内容 | 对应功能 |
|---|---|---|
| A-1 | 办理接车进路成功，2G/5G 显示进路状态，X1 开放 | 接车进路 |
| A-2 | 办理发车进路成功，8G/7G 显示进路状态，S1 开放 | 发车进路 |
| A-3 | 办理通过进路成功，X1/S1 同时开放 | 通过进路 |
| A-4 | 办理调车进路成功，D1 开放，9G/5G 显示进路状态 | 调车进路 |
| A-5 | X1 断丝后办理接车进路失败，日志显示 SIGNAL_FAULT 提示 | 信号断丝联锁 |
| A-6 | 发车进路未解锁时办理通过进路失败，日志显示 ROUTE_CONFLICT 提示 | 冲突进路检查 |
| A-7 | 取消进路或进路解锁后，信号关闭、轨道恢复空闲 | 取消/解锁 |

---

## 13. 返回码速查

| code | 含义 |
|---|---|
| ROUTE_ESTABLISHED | 进路建立成功 |
| ROUTE_CANCELED | 进路取消成功 |
| ROUTE_UNLOCKED | 进路解锁成功 |
| MANUAL_UNLOCK_STARTED | 人工解锁倒计时开始 |
| ROUTE_NOT_FOUND | 进路编号不存在 |
| ROUTE_NOT_ACTIVE | 目标进路当前未建立，不能取消或解锁 |
| ROUTE_ALREADY_ACTIVE | 目标进路已经建立 |
| ROUTE_CONFLICT | 已有其他进路未解锁，禁止办理新进路 |
| TRACK_OCCUPIED | 轨道区段占用，禁止建立进路 |
| TRACK_BLOCKED | 轨道区段封锁，禁止建立进路 |
| TRACK_LOCKED | 轨道区段锁闭，禁止建立进路 |
| SWITCH_NOT_FOUND | 道岔不存在 |
| SWITCH_BLOCKED | 道岔封锁，禁止建立进路 |
| SWITCH_LOCKED_WRONG_POSITION | 道岔锁闭在非进路要求位置 |
| SIGNAL_NOT_FOUND | 信号机不存在 |
| SIGNAL_FAULT | 信号机断丝熄灭，禁止办理相关进路 |

