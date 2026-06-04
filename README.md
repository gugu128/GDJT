# GDJT 计算机联锁模拟仿真系统

这是轨道交通系统设计作业的前端与联锁逻辑代码。

## 如何运行

直接用浏览器打开 `index.html` 即可运行主控大屏。

## 主要文件

- `index.html`：主控大屏页面结构。
- `styles.css`：页面样式。
- `app.js`：页面渲染、按钮绑定、日志显示、API 暴露。
- `interlocking-core.js`：核心数据结构、联锁判断、进路逻辑、设备状态仿真。
- `docs/core-api.md`：核心接口说明。
- `docs/team-tasks.md`：组员分工和具体任务。

## 协作说明

A、B 组员主要修改 `interlocking-core.js`，不要重写页面结构和样式。所有功能调用尽量统一走：

```js
InterlockingAPI.dispatchCommand({
  type: "REQUEST_ROUTE",
  routeId: "receive"
});
```

