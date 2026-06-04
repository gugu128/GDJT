# 组员分工与具体任务说明

本项目当前已经完成了主控大屏页面、站场图、按钮区、设备状态区、日志区，以及一份初步的联锁核心接口。后续两位组员不需要重做页面，不需要写服务器，不需要做数据库，主要是在现有代码基础上把“按钮背后的联锁逻辑”和“设备状态仿真逻辑”补完整。

## 一、当前代码结构

当前项目主要文件如下：

- `index.html`：主控大屏页面结构，包含站场图、按钮、表格、日志区域。
- `styles.css`：页面样式、颜色、按钮、站场图显示样式。
- `app.js`：页面渲染、按钮绑定、日志显示、当前大屏交互逻辑。
- `interlocking-core.js`：核心数据结构、联锁判断、命令分发、进路与设备状态逻辑。
- `docs/core-api.md`：核心接口说明。

两位组员主要改 `interlocking-core.js`。如果需要接按钮或展示效果，可以少量看 `app.js`，但不要重写大屏页面。

## 二、统一协作原则

两位组员都必须围绕同一个状态对象工作，也就是 `state`：

```js
state = {
  signals: {},      // 信号机状态
  switches: {},     // 道岔位置和锁闭状态
  tracks: {},       // 轨道区段状态
  activeRoutes: {}, // 当前已建立的进路
  logs: []          // 操作日志
}
```

所有函数都按这个流程写：

```text
接收操作命令
↓
检查 state 中的设备状态
↓
判断是否允许执行
↓
修改 state
↓
返回 ok / code / message / changes
↓
前端刷新页面和日志
```

统一返回格式：

```js
{
  ok: true,
  code: "ROUTE_ESTABLISHED",
  message: "接车进路建立成功",
  changes: [
    { kind: "track", id: "2G", field: "status", value: "route" }
  ]
}
```

禁止各自重新定义一套状态名。统一使用这些状态：

- 信号机：`open` 开放、`closed` 关闭、`fault` 断丝/熄灭。
- 轨道区段：`free` 空闲、`route` 进路建立、`occupied` 占用、`locked` 锁闭、`blocked` 封锁。
- 道岔位置：`positioned` 定位、`reverse` 反位。
- 道岔锁闭：`free` 解锁、`locked` 进路锁闭、`single` 单独锁闭、`blocked` 设备封锁。

## 三、PDF 示例函数名与当前代码的替换关系

PDF 里有些函数名是早期示例，当前项目已经统一成 `InterlockingAPI.dispatchCommand(...)` 命令分发方式。为了避免看 PDF 和看代码时混乱，后续讲解和报告中建议统一替换成下面这些写法。

### 1. PDF 项目结构替换

PDF 里的示例结构：

```text
interlocking-system/
├── index.html
├── style.css
├── state.js
├── routeLogic.js
├── equipmentLogic.js
├── main.js
└── README.md
```

当前项目应替换为：

```text
GDJT/
├── index.html              # 主控大屏页面结构
├── styles.css              # 页面样式
├── app.js                  # 页面渲染、按钮绑定、日志显示、API 暴露
├── interlocking-core.js    # 状态对象、进路逻辑、设备仿真、命令分发
└── docs/
    ├── core-api.md         # 核心接口说明
    └── team-tasks.md       # 组员分工说明
```

现在不要再新建 `state.js`、`routeLogic.js`、`equipmentLogic.js`、`main.js`。这些内容已经合并为：

```text
state.js              -> interlocking-core.js 里的 createInitialState()
routeLogic.js         -> interlocking-core.js 里的进路相关函数
equipmentLogic.js     -> interlocking-core.js 里的设备相关函数
main.js               -> app.js
style.css             -> styles.css
```

### 2. A 组员 PDF 示例函数替换

PDF 里的 A 组员函数示例：

```js
handleReceiveRoute();     // 办理接车进路
handleDepartureRoute();   // 办理发车进路
handlePassRoute();        // 办理通过进路
handleShuntingRoute();    // 办理调车进路
cancelShunting();         // 调车取消
cancelRoute();            // 取消进路
manualUnlock();           // 人工解锁
unlockRoute();            // 进路解锁
```

当前项目应替换为：

```js
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "receive" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "depart" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "through" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "shunt" });
InterlockingAPI.dispatchCommand({ type: "CANCEL_ROUTE", routeId: "shunt" });
InterlockingAPI.dispatchCommand({ type: "CANCEL_ROUTE", routeId: "receive" });
InterlockingAPI.dispatchCommand({ type: "MANUAL_UNLOCK", routeId: "receive", seconds: 30 });
InterlockingAPI.dispatchCommand({ type: "UNLOCK_ROUTE", routeId: "receive" });
```

如果报告中要写“对应核心函数”，可以写：

```text
REQUEST_ROUTE    -> interlocking-core.js / establishRoute(routeId)
CANCEL_ROUTE     -> interlocking-core.js / cancelRoute(routeId)
MANUAL_UNLOCK    -> interlocking-core.js / manualUnlock(routeId, seconds)
UNLOCK_ROUTE     -> interlocking-core.js / unlockRoute(routeId)
联锁条件检查      -> interlocking-core.js / validateRoute(routeId)
```

### 3. B 组员 PDF 示例函数替换

PDF 里的 B 组员函数示例：

```js
setSwitchPosition(id, position);  // 道岔定位/反位
lockSwitch(id);                   // 道岔单锁
blockSwitch(id);                  // 道岔封锁
unlockSwitch(id);                 // 道岔解锁

openSignal(signalId);             // 信号机开放
closeSignal(signalId);            // 信号机关闭
breakSignal(signalId);            // 信号机断丝

occupyTrack(trackId);             // 轨道占用
clearTrack(trackId);              // 轨道出清
```

当前项目应替换为：

```js
InterlockingAPI.dispatchCommand({ type: "SET_SWITCH_POSITION", switchId: "1", position: "positioned" });
InterlockingAPI.dispatchCommand({ type: "SET_SWITCH_POSITION", switchId: "1", position: "reverse" });
InterlockingAPI.dispatchCommand({ type: "SET_SWITCH_LOCK", switchId: "1", lock: "single" });
InterlockingAPI.dispatchCommand({ type: "SET_SWITCH_LOCK", switchId: "1", lock: "blocked" });
InterlockingAPI.dispatchCommand({ type: "SET_SWITCH_LOCK", switchId: "1", lock: "free" });

InterlockingAPI.dispatchCommand({ type: "SET_SIGNAL_STATUS", signalId: "X1", status: "open" });
InterlockingAPI.dispatchCommand({ type: "SET_SIGNAL_STATUS", signalId: "X1", status: "closed" });
InterlockingAPI.dispatchCommand({ type: "SET_SIGNAL_STATUS", signalId: "X1", status: "fault" });

InterlockingAPI.dispatchCommand({ type: "SET_TRACK_OCCUPANCY", trackId: "3G", occupied: true });
InterlockingAPI.dispatchCommand({ type: "SET_TRACK_OCCUPANCY", trackId: "3G", occupied: false });
InterlockingAPI.dispatchCommand({ type: "RESET" });
```

如果报告中要写“对应核心函数”，可以写：

```text
SET_SWITCH_POSITION  -> interlocking-core.js / setSwitchPosition(switchId, position)
SET_SWITCH_LOCK      -> interlocking-core.js / setSwitchLock(switchId, lock)
SET_SIGNAL_STATUS    -> interlocking-core.js / setSignalStatus(signalId, status)
SET_TRACK_OCCUPANCY  -> interlocking-core.js / setTrackOccupancy(trackId, occupied)
RESET                -> interlocking-core.js / reset()
```

### 4. 需要统一改掉的表达

PDF 或报告里如果出现下面写法，建议统一改成当前项目写法：

```text
systemState          -> state
success              -> ok
style.css            -> styles.css
routeLogic.js        -> interlocking-core.js
equipmentLogic.js    -> interlocking-core.js
main.js              -> app.js
handlePassRoute      -> REQUEST_ROUTE + routeId: "through"
breakSignal          -> SET_SIGNAL_STATUS + status: "fault"
lockSwitch           -> SET_SWITCH_LOCK + lock: "single"
blockSwitch          -> SET_SWITCH_LOCK + lock: "blocked"
unlockSwitch         -> SET_SWITCH_LOCK + lock: "free"
occupyTrack          -> SET_TRACK_OCCUPANCY + occupied: true
clearTrack           -> SET_TRACK_OCCUPANCY + occupied: false
```

后续代码、报告、答辩讲解都以 `interlocking-core.js` 和 `InterlockingAPI.dispatchCommand(...)` 为准。

## 四、A 组员任务：列车作业、调车作业、取消与解锁逻辑

A 组员主要负责“进路办理逻辑”。对应老师要求里的这些评分点：

- 列车的接车、发车及通过作业办理完整过程。
- 站内调车作业办理完整过程。
- 取消进路功能。
- 人工解锁功能。
- 进路解锁功能。

### A-1. 需要重点看的代码位置

主要文件：

```text
interlocking-core.js
```

重点函数：

```js
validateRoute(routeId)
establishRoute(routeId)
cancelRoute(routeId)
manualUnlock(routeId, seconds)
unlockRoute(routeId)
releaseRoute(route)
dispatch(command)
```

重点数据：

```js
StationData.routes
state.activeRoutes
state.tracks
state.switches
state.signals
```

当前已有进路编号：

```js
RECEIVE_MAIN     // 接车进路
DEPART_MAIN      // 发车进路
THROUGH_MAIN     // 通过进路
SHUNT_D1_TO_9G   // 调车进路
```

也可以使用别名：

```js
receive
depart
through
shunt
```

### A-2. 接车进路要完成什么

目标：点击“办理接车进路”后，系统检查条件，条件满足时建立接车进路，开放 X1 信号机，锁闭相关道岔，轨道显示进路颜色。

建议逻辑：

```text
1. 检查接车目标轨道是否空闲，例如 2G、5G。
2. 检查相关道岔是否可用，不能处于 blocked 封锁状态。
3. 检查是否已经存在冲突进路。
4. 条件满足后，把接车进路相关轨道设为 route。
5. 把 X1 信号机设为 open。
6. 把 S1、D1 等无关或冲突信号机设为 closed。
7. 把相关道岔设为 requiredSwitches 要求的位置。
8. 把相关道岔 lock 设为 locked，表示进路锁闭。
9. 写入 activeRoutes。
10. 返回成功信息。
```

需要能处理失败情况：

```text
如果 2G、5G 被占用，返回失败：轨道区段占用，不能建立接车进路。
如果相关道岔被封锁，返回失败：道岔封锁，不能建立接车进路。
如果已经有冲突进路，返回失败：已有进路未解锁。
```

建议测试命令：

```js
InterlockingAPI.dispatchCommand({
  type: "REQUEST_ROUTE",
  routeId: "receive"
});
```

### A-3. 发车进路要完成什么

目标：点击“办理发车进路”后，系统检查出站方向轨道是否空闲，条件满足时开放 S1 出站信号机。

建议逻辑：

```text
1. 检查出站方向相关轨道是否空闲，例如 8G、7G。
2. 检查 5# 道岔是否可用且能转换到要求位置。
3. 检查是否存在冲突进路。
4. 条件满足后，将 8G、7G 设为 route。
5. 开放 S1 信号机。
6. 关闭 X1、D1 信号机。
7. 锁闭 5# 道岔。
8. 写入 activeRoutes。
9. 返回“发车进路建立成功”。
```

建议测试命令：

```js
InterlockingAPI.dispatchCommand({
  type: "REQUEST_ROUTE",
  routeId: "depart"
});
```

### A-4. 通过进路要完成什么

目标：点击“办理通过进路”后，系统建立从进站到出站的一整条通过路径，同时开放进站和出站相关信号。

建议逻辑：

```text
1. 检查进站到出站方向所有经过轨道是否空闲。
2. 检查 1#、5# 等相关道岔是否可用。
3. 检查是否存在冲突进路。
4. 条件满足后，将通过路径轨道设为 route。
5. 同时开放 X1、S1 信号机。
6. 关闭 D1 调车信号机。
7. 锁闭相关道岔。
8. 写入 activeRoutes。
9. 返回“通过进路建立成功”。
```

注意：通过进路不能省略，因为它属于老师要求中的列车作业部分。

建议测试命令：

```js
InterlockingAPI.dispatchCommand({
  type: "REQUEST_ROUTE",
  routeId: "through"
});
```

### A-5. 调车进路要完成什么

目标：点击“办理调车进路”后，建立一条简化的调车路径，开放 D1 调车信号机。

建议逻辑：

```text
1. 检查调车路径相关轨道是否空闲，例如 9G、5G。
2. 检查相关道岔是否可用。
3. 条件满足后，将调车路径轨道设为 route。
4. 开放 D1 调车信号机。
5. 关闭 X1、S1 信号机。
6. 锁闭相关道岔。
7. 写入 activeRoutes。
8. 返回“调车进路建立成功”。
```

建议测试命令：

```js
InterlockingAPI.dispatchCommand({
  type: "REQUEST_ROUTE",
  routeId: "shunt"
});
```

### A-6. 取消进路要完成什么

目标：点击“取消进路”或“调车取消”后，关闭相关信号机，清除当前进路显示，释放进路锁闭。

建议逻辑：

```text
1. 找到要取消的 activeRoutes。
2. 关闭该进路开放过的信号机。
3. 把该进路中 status 为 route 的轨道恢复为 free。
4. 把该进路锁闭的道岔从 locked 恢复为 free。
5. 从 activeRoutes 删除该进路。
6. 返回“进路已取消”。
```

建议测试命令：

```js
InterlockingAPI.dispatchCommand({
  type: "CANCEL_ROUTE",
  routeId: "receive"
});
```

### A-7. 人工解锁要完成什么

目标：点击“人工解锁”后，启动一个倒计时；倒计时结束后释放进路。

简化实现可以这样：

```text
1. manualUnlock(routeId, seconds) 接收 routeId 和秒数。
2. 把 state.countdown 设置为 seconds。
3. 返回“人工解锁倒计时 xx 秒”。
4. 倒计时结束后的实际释放，可以由 app.js 或后续整合代码调用 unlockRoute。
```

如果 A 组员有时间，可以增强：

```text
1. 人工解锁开始时，把 activeRoutes[routeId].status 设为 canceling。
2. 倒计时结束后自动调用 unlockRoute(routeId)。
3. 日志中显示“人工解锁开始”“人工解锁完成”。
```

建议测试命令：

```js
InterlockingAPI.dispatchCommand({
  type: "MANUAL_UNLOCK",
  routeId: "receive",
  seconds: 30
});
```

### A-8. 进路解锁要完成什么

目标：点击“进路解锁”后，直接释放当前进路。

建议逻辑：

```text
1. 找到当前进路。
2. 将进路内 route 轨道恢复为 free。
3. 关闭该进路开放的信号机。
4. 释放该进路锁闭的道岔。
5. 删除 activeRoutes。
6. 返回“进路已解锁”。
```

建议测试命令：

```js
InterlockingAPI.dispatchCommand({
  type: "UNLOCK_ROUTE",
  routeId: "receive"
});
```

### A-9. A 组员需要提交的代码结果

A 组员最终至少要保证这些命令能跑：

```js
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "receive" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "depart" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "through" });
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "shunt" });
InterlockingAPI.dispatchCommand({ type: "CANCEL_ROUTE", routeId: "receive" });
InterlockingAPI.dispatchCommand({ type: "MANUAL_UNLOCK", routeId: "receive", seconds: 30 });
InterlockingAPI.dispatchCommand({ type: "UNLOCK_ROUTE", routeId: "receive" });
```

### A-10. A 组员负责的报告内容

A 组员需要写报告中的这些部分：

```text
1. 列车作业功能设计。
2. 接车进路办理流程说明。
3. 发车进路办理流程说明。
4. 通过进路办理流程说明。
5. 调车进路办理流程说明。
6. 取消进路与人工解锁说明。
7. 进路解锁说明。
8. 联锁检查条件说明。
9. 相关测试截图和测试结果。
```

每个功能的报告写法建议：

```text
这个功能是干什么的；
点击哪个按钮触发；
调用哪个函数或命令；
函数检查哪些条件；
成功后修改哪些设备状态；
失败时提示什么信息；
测试时如何验证。
```

## 五、B 组员任务：道岔控制、信号机仿真、轨道电路仿真

B 组员主要负责“设备状态控制和现场仿真”。对应老师要求里的这些评分点：

- 道岔的单操、单锁及封锁逻辑功能。
- 室外信号设备的开放、关闭、断丝状态仿真。
- 室外道岔设备的动作、位置状态仿真。
- 室外轨道电路的车列占压、出清状态仿真。
- 设备复位。

### B-1. 需要重点看的代码位置

主要文件：

```text
interlocking-core.js
```

重点函数：

```js
setSwitchPosition(switchId, position)
setSwitchLock(switchId, lock)
setSignalStatus(signalId, status)
setTrackOccupancy(trackId, occupied)
reset()
dispatch(command)
```

重点数据：

```js
state.switches
state.signals
state.tracks
StationData.switches
StationData.signals
StationData.tracks
```

### B-2. 道岔定位、反位要完成什么

目标：点击道岔“定位”或“反位”按钮后，判断道岔能否转换，能转换才修改位置。

建议逻辑：

```text
1. 找到 switchId 对应的道岔。
2. 如果道岔是 blocked 封锁，禁止转换。
3. 如果道岔是 locked 进路锁闭，禁止转换到其他位置。
4. 如果道岔是 single 单锁，禁止转换到其他位置。
5. 如果允许转换，修改 position。
6. position 为 positioned 时，说明显示为“开通直向”。
7. position 为 reverse 时，说明显示为“开通侧向”。
8. 返回转换成功或失败信息。
```

建议测试命令：

```js
InterlockingAPI.dispatchCommand({
  type: "SET_SWITCH_POSITION",
  switchId: "5",
  position: "reverse"
});
```

### B-3. 道岔单锁要完成什么

目标：点击“单锁”后，道岔被人工锁住，不能随便转换。

建议逻辑：

```text
1. 将指定道岔 lock 改为 single。
2. description 改为“单独锁闭”。
3. 如果此时再尝试转换到其他位置，应返回失败。
4. 状态区显示“单锁”。
```

建议测试命令：

```js
InterlockingAPI.dispatchCommand({
  type: "SET_SWITCH_LOCK",
  switchId: "1",
  lock: "single"
});
```

### B-4. 道岔封锁要完成什么

目标：点击“封锁”后，道岔禁止使用，不能参与进路办理。

建议逻辑：

```text
1. 将指定道岔 lock 改为 blocked。
2. description 改为“设备封锁”。
3. 道岔封锁后不能转换。
4. 道岔封锁后不能建立经过它的接车、发车、通过或调车进路。
5. 状态区显示“封锁”。
```

建议测试命令：

```js
InterlockingAPI.dispatchCommand({
  type: "SET_SWITCH_LOCK",
  switchId: "5",
  lock: "blocked"
});
```

### B-5. 道岔解锁要完成什么

目标：点击“解锁”后，解除单锁或封锁状态。

建议逻辑：

```text
1. 如果道岔是 single，可以改为 free。
2. 如果道岔是 blocked，可以改为 free。
3. 如果道岔是 locked，说明是进路锁闭，最好由进路取消或进路解锁释放，不建议普通按钮直接释放。
4. 解锁后 description 根据当前位置显示“开通直向”或“开通侧向”。
```

建议测试命令：

```js
InterlockingAPI.dispatchCommand({
  type: "SET_SWITCH_LOCK",
  switchId: "5",
  lock: "free"
});
```

### B-6. 信号机开放、关闭、断丝要完成什么

目标：模拟信号机三种状态，并保证断丝状态下不允许开放该信号机。

建议逻辑：

```text
1. open：信号机开放，页面显示绿色。
2. closed：信号机关闭，页面显示红色。
3. fault：信号机断丝或熄灭，页面显示故障/熄灭状态。
4. 如果信号机处于 fault，再办理需要开放该信号机的进路，应返回失败。
```

当前需要特别注意：

```text
X1：进站信号机，接车/通过进路会用到。
S1：出站信号机，发车/通过进路会用到。
D1：调车信号机，调车进路会用到。
```

建议测试命令：

```js
InterlockingAPI.dispatchCommand({
  type: "SET_SIGNAL_STATUS",
  signalId: "X1",
  status: "fault"
});
```

或者：

```js
InterlockingAPI.dispatchCommand({
  type: "SIMULATE_SIGNAL_FAULT",
  signalId: "X1",
  faulted: true
});
```

### B-7. 轨道占压、出清要完成什么

目标：模拟列车进入轨道区段和离开轨道区段。

建议逻辑：

```text
1. 点击“列车进入区段”后，某个轨道区段变为 occupied。
2. 点击“列车占用/出清”后，占用区段恢复为空闲或进路状态。
3. 轨道被 occupied 时，不能建立经过该区段的进路。
4. 如果该轨道属于当前已建立进路，出清后可以恢复为 route。
5. 如果该轨道不属于当前进路，出清后恢复为 free。
```

建议测试命令：

```js
InterlockingAPI.dispatchCommand({
  type: "SET_TRACK_OCCUPANCY",
  trackId: "3G",
  occupied: true
});
```

出清：

```js
InterlockingAPI.dispatchCommand({
  type: "SET_TRACK_OCCUPANCY",
  trackId: "3G",
  occupied: false
});
```

### B-8. 设备复位要完成什么

目标：点击“设备复位”后，把信号、道岔、轨道恢复到初始演示状态。

建议逻辑：

```text
1. 调用 reset()。
2. 恢复 signals 初始状态。
3. 恢复 switches 初始状态。
4. 恢复 tracks 初始状态。
5. 清除 activeRoutes。
6. 恢复 countdown、systemState、mode。
7. 返回“系统状态已复位”。
```

建议测试命令：

```js
InterlockingAPI.dispatchCommand({
  type: "RESET"
});
```

### B-9. B 组员需要提交的代码结果

B 组员最终至少要保证这些命令能跑：

```js
InterlockingAPI.dispatchCommand({ type: "SET_SWITCH_POSITION", switchId: "1", position: "positioned" });
InterlockingAPI.dispatchCommand({ type: "SET_SWITCH_POSITION", switchId: "1", position: "reverse" });
InterlockingAPI.dispatchCommand({ type: "SET_SWITCH_LOCK", switchId: "1", lock: "single" });
InterlockingAPI.dispatchCommand({ type: "SET_SWITCH_LOCK", switchId: "1", lock: "blocked" });
InterlockingAPI.dispatchCommand({ type: "SET_SWITCH_LOCK", switchId: "1", lock: "free" });
InterlockingAPI.dispatchCommand({ type: "SET_SIGNAL_STATUS", signalId: "X1", status: "open" });
InterlockingAPI.dispatchCommand({ type: "SET_SIGNAL_STATUS", signalId: "X1", status: "closed" });
InterlockingAPI.dispatchCommand({ type: "SET_SIGNAL_STATUS", signalId: "X1", status: "fault" });
InterlockingAPI.dispatchCommand({ type: "SET_TRACK_OCCUPANCY", trackId: "3G", occupied: true });
InterlockingAPI.dispatchCommand({ type: "SET_TRACK_OCCUPANCY", trackId: "3G", occupied: false });
InterlockingAPI.dispatchCommand({ type: "RESET" });
```

### B-10. B 组员负责的报告内容

B 组员需要写报告中的这些部分：

```text
1. 道岔控制功能设计。
2. 道岔定位、反位、单锁、封锁、解锁逻辑说明。
3. 信号机开放、关闭、断丝状态仿真说明。
4. 轨道电路占压、出清状态仿真说明。
5. 设备复位功能说明。
6. 设备状态区如何显示信号机、道岔、轨道状态。
7. 颜色图例说明。
8. 相关测试截图和测试结果。
```

每个功能的报告写法建议：

```text
这个设备是什么；
有哪些状态；
点击哪个按钮触发；
调用哪个函数或命令；
函数检查哪些条件；
成功后设备状态如何变化；
失败时提示什么；
测试时怎么验证。
```

## 六、两位组员共同需要注意的接口规则

### 1. 不要直接乱改页面颜色和结构

页面已经基本完成。A/B 主要补逻辑，不要重写 `index.html` 和 `styles.css`。如果必须改显示，由组长统一改。

### 2. 不要新建一套自己的 state

所有设备状态都必须进入 `interlocking-core.js` 的 `state`。否则最后整合时会出现页面显示一套、逻辑判断另一套的问题。

### 3. 不要只写 alert

函数必须返回结构化结果：

```js
return {
  ok: false,
  code: "TRACK_OCCUPIED",
  message: "3G轨道区段占用，不能建立进路",
  changes: []
};
```

### 4. 每个功能都要有成功和失败测试

至少准备两种测试：

```text
成功测试：条件满足，功能执行成功。
失败测试：轨道占用、道岔封锁、信号机断丝等条件不满足，功能被拒绝。
```

### 5. 报告和代码要对应

报告里写的函数名、状态名、按钮名要和代码一致。不要报告写 `openSignal()`，代码却只有 `setSignalStatus()`，这样答辩时不好解释。

## 七、建议最终验收清单

A 组员验收：

```text
接车进路能建立；
发车进路能建立；
通过进路能建立；
调车进路能建立；
轨道占用时不能建立进路；
道岔封锁时不能建立进路；
取消进路能关闭信号并释放轨道；
人工解锁有倒计时说明；
进路解锁能释放锁闭。
```

B 组员验收：

```text
道岔能定位、反位；
道岔单锁后不能随意转换；
道岔封锁后不能转换，也不能参与进路；
道岔解锁后恢复可用；
信号机能开放、关闭、断丝；
断丝信号机不能被进路开放；
轨道能占压、出清；
轨道占用时进路被拒绝；
设备复位能恢复初始状态。
```

组长最终整合：

```text
把 A/B 写好的逻辑统一接入按钮；
确认大屏状态、颜色、设备状态区、日志同步变化；
整理最终报告；
准备演示流程和截图。
```
