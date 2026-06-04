# 核心数据结构与函数接口

本项目把“前端显示”和“联锁/仿真逻辑”分开：

- `interlocking-core.js`：站场数据、设备状态、进路定义、联锁检查、命令分发。
- `app.js`：把状态渲染到大屏，并绑定按钮事件。

## 全局入口

浏览器打开页面后可以在控制台访问：

```js
window.InterlockingCore
window.InterlockingAPI
```

`InterlockingAPI` 里已经整理好几个常用入口：

```js
InterlockingAPI.state       // 当前大屏状态
InterlockingAPI.core        // 联锁核心系统实例
InterlockingAPI.enums       // 状态枚举
InterlockingAPI.stationData // 站场、信号机、道岔、进路静态定义
InterlockingAPI.routeAlias  // receive/depart/through/shunt 别名
```

## 常用接口

```js
InterlockingAPI.dispatchCommand({
  type: "REQUEST_ROUTE",
  routeId: "RECEIVE_MAIN"
});

InterlockingAPI.dispatchCommand({
  type: "SET_TRACK_OCCUPANCY",
  trackId: "3G",
  occupied: true
});

InterlockingAPI.dispatchCommand({
  type: "SET_SWITCH_POSITION",
  switchId: "5",
  position: "positioned"
});
```

返回值统一为：

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

## 主要数据结构

```js
state = {
  signals: {
    X1: { id: "X1", status: "open", description: "进站信号机" }
  },
  switches: {
    1: { id: "1", position: "positioned", lock: "locked" }
  },
  tracks: {
    "3G": { id: "3G", status: "occupied", description: "I道中段" }
  },
  activeRoutes: {},
  logs: []
}
```

状态取值约定：

- 信号机：`open` 开放、`closed` 关闭、`fault` 熄灭/故障。
- 轨道区段：`free` 空闲、`route` 进路建立、`occupied` 占用、`locked` 锁闭、`blocked` 封锁。
- 道岔位置：`positioned` 定位、`reverse` 反位。
- 道岔锁闭：`free` 解锁、`locked` 进路锁闭、`single` 单独锁闭、`blocked` 设备封锁。

## 进路编号

- `RECEIVE_MAIN` 或 `receive`：办理接车进路。
- `DEPART_MAIN` 或 `depart`：办理发车进路。
- `THROUGH_MAIN` 或 `through`：办理通过进路。
- `SHUNT_D1_TO_9G` 或 `shunt`：办理调车进路。

## 命令类型

```js
InterlockingAPI.dispatchCommand({ type: "REQUEST_ROUTE", routeId: "receive" });
InterlockingAPI.dispatchCommand({ type: "CANCEL_ROUTE", routeId: "receive" });
InterlockingAPI.dispatchCommand({ type: "MANUAL_UNLOCK", routeId: "receive", seconds: 30 });
InterlockingAPI.dispatchCommand({ type: "UNLOCK_ROUTE", routeId: "receive" });
InterlockingAPI.dispatchCommand({ type: "SET_SWITCH_LOCK", switchId: "1", lock: "single" });
InterlockingAPI.dispatchCommand({ type: "SET_SIGNAL_STATUS", signalId: "X1", status: "fault" });
InterlockingAPI.dispatchCommand({ type: "RESET" });
```

## 推荐分工

A组员可以补：

- `validateRoute(routeId)` 的联锁条件检查
- `establishRoute(routeId)` 的完整进路锁闭逻辑
- `unlockRoute(routeId)` 的分段解锁逻辑

B组员可以补：

- `setTrackOccupancy(trackId, occupied)` 的列车占压/出清仿真
- `setSignalStatus(signalId, status)` 的信号机开放、关闭、断丝
- `setSwitchPosition(switchId, position)` 的道岔转换过程和延时
