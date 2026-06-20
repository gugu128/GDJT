import base64
import json
import time
import urllib.request
import websocket
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "screenshorts2"
URL = ROOT.joinpath("index.html").resolve().as_uri()
DEBUG = "http://127.0.0.1:9222"


def http_json(url):
    with urllib.request.urlopen(url, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


class ChromePage:
    def __init__(self):
        targets = http_json(f"{DEBUG}/json")
        target = next(item for item in targets if item.get("type") == "page")
        self.ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=10)
        self.next_id = 1

    def call(self, method, params=None):
        message_id = self.next_id
        self.next_id += 1
        self.ws.send(json.dumps({"id": message_id, "method": method, "params": params or {}}))
        while True:
            data = json.loads(self.ws.recv())
            if data.get("id") == message_id:
                if "error" in data:
                    raise RuntimeError(f"{method}: {data['error']}")
                return data.get("result", {})

    def eval(self, expression):
        return self.call("Runtime.evaluate", {
            "expression": expression,
            "awaitPromise": True,
            "returnByValue": True,
        })

    def screenshot(self, filename):
        self.eval("""
          document.body.style.zoom = '0.75';
          window.scrollTo(0, 0);
        """)
        time.sleep(0.3)
        result = self.call("Page.captureScreenshot", {
            "format": "png",
            "captureBeyondViewport": True,
            "fromSurface": True,
        })
        OUT.mkdir(exist_ok=True)
        (OUT / filename).write_bytes(base64.b64decode(result["data"]))

    def close(self):
        self.ws.close()


def run_action(page, expression, filename):
    page.eval(expression)
    time.sleep(0.6)
    page.screenshot(filename)


def main():
    OUT.mkdir(exist_ok=True)
    page = ChromePage()
    try:
        page.call("Page.enable")
        page.call("Runtime.enable")
        page.call("Emulation.setDeviceMetricsOverride", {
            "width": 1600,
            "height": 1000,
            "deviceScaleFactor": 1,
            "mobile": False,
        })
        page.call("Page.navigate", {"url": URL})
        time.sleep(1.2)

        run_action(page, """
          InterlockingAPI.dispatchCommand({ type: 'RESET' });
          InterlockingAPI.dispatchCommand({ type: 'REQUEST_ROUTE', routeId: 'receive' });
        """, "a-receive-route-success.png")

        run_action(page, """
          InterlockingAPI.dispatchCommand({ type: 'RESET' });
          InterlockingAPI.dispatchCommand({ type: 'REQUEST_ROUTE', routeId: 'depart' });
        """, "a-depart-route-success.png")

        run_action(page, """
          InterlockingAPI.dispatchCommand({ type: 'RESET' });
          InterlockingAPI.dispatchCommand({ type: 'REQUEST_ROUTE', routeId: 'through' });
        """, "a-through-route-success.png")

        run_action(page, """
          InterlockingAPI.dispatchCommand({ type: 'RESET' });
          InterlockingAPI.dispatchCommand({ type: 'REQUEST_ROUTE', routeId: 'shunt' });
        """, "a-shunt-route-success.png")

        run_action(page, """
          InterlockingAPI.dispatchCommand({ type: 'RESET' });
          InterlockingAPI.dispatchCommand({ type: 'SET_TRACK_OCCUPANCY', trackId: '5G', occupied: true });
          InterlockingAPI.dispatchCommand({ type: 'REQUEST_ROUTE', routeId: 'receive' });
        """, "a-receive-route-fail-track-occupied.png")

        run_action(page, """
          InterlockingAPI.dispatchCommand({ type: 'RESET' });
          InterlockingAPI.dispatchCommand({ type: 'SET_SIGNAL_STATUS', signalId: 'X1', status: 'fault' });
          InterlockingAPI.dispatchCommand({ type: 'REQUEST_ROUTE', routeId: 'receive' });
        """, "a-receive-route-fail-signal-fault.png")

        run_action(page, """
          InterlockingAPI.dispatchCommand({ type: 'RESET' });
          InterlockingAPI.dispatchCommand({ type: 'REQUEST_ROUTE', routeId: 'depart' });
          InterlockingAPI.dispatchCommand({ type: 'REQUEST_ROUTE', routeId: 'through' });
        """, "a-through-route-fail-conflict.png")

        run_action(page, """
          InterlockingAPI.dispatchCommand({ type: 'RESET' });
          InterlockingAPI.dispatchCommand({ type: 'REQUEST_ROUTE', routeId: 'receive' });
          InterlockingAPI.dispatchCommand({ type: 'CANCEL_ROUTE', routeId: 'receive' });
        """, "a-cancel-route-success.png")

        run_action(page, """
          InterlockingAPI.dispatchCommand({ type: 'RESET' });
          InterlockingAPI.dispatchCommand({ type: 'REQUEST_ROUTE', routeId: 'receive' });
          InterlockingAPI.dispatchCommand({ type: 'MANUAL_UNLOCK', routeId: 'receive', seconds: 30 });
        """, "a-manual-unlock-started.png")

        run_action(page, """
          InterlockingAPI.dispatchCommand({ type: 'RESET' });
          InterlockingAPI.dispatchCommand({ type: 'REQUEST_ROUTE', routeId: 'receive' });
          InterlockingAPI.dispatchCommand({ type: 'UNLOCK_ROUTE', routeId: 'receive' });
        """, "a-unlock-route-success.png")
    finally:
        page.close()


if __name__ == "__main__":
    main()
