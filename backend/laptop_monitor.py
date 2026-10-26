import os
import time
import json
import logging
import urllib.request
import urllib.error
import psutil
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

custom_url = os.environ.get("LAPTOP_MONITOR_API_URL", "").strip()
API_ENDPOINTS = [custom_url] if custom_url else []
API_ENDPOINTS.extend([
    "http://localhost:8000/api/telemetry/laptop",
    "http://localhost:3000/api/telemetry/laptop",
])
DEVICE_ID = "laptop_primary"
DEVICE_NAME = "Primary Windows Laptop"

def get_battery_voltage():
    """Attempt to fetch battery voltage via WMI or Win32 API if available on Windows."""
    try:
        import wmi
        c = wmi.WMI()
        batteries = c.Win32_Battery()
        if batteries:
            # DesignVoltage or BatteryStatus in mV
            voltage_mv = getattr(batteries[0], 'DesignVoltage', None)
            if voltage_mv:
                return float(voltage_mv) / 1000.0
    except Exception:
        pass
    return None

def get_system_temperature():
    """Attempt to get thermal zone temperature via psutil or WMI if exposed by driver."""
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            for name, entries in temps.items():
                for entry in entries:
                    if entry.current and entry.current > 0:
                        return round(entry.current, 1)
    except Exception:
        pass
    
    try:
        import wmi
        w = wmi.WMI(namespace="root\\wmi")
        temperature_info = w.MSAcpi_ThermalZoneTemperature()
        if temperature_info:
            # Tenths of Kelvin to Celsius: (Kelvin / 10) - 273.15
            temp_k = temperature_info[0].CurrentTemperature
            temp_c = (temp_k / 10.0) - 273.15
            if 0 < temp_c < 120:
                return round(temp_c, 1)
    except Exception:
        pass
    return None

last_time = time.time()
last_percent = None

def collect_laptop_telemetry():
    global last_time, last_percent

    now = time.time()
    elapsed_sec = max(1.0, now - last_time)
    last_time = now

    cpu_percent = psutil.cpu_percent(interval=None)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    battery = psutil.sensors_battery()

    battery_percent = round(battery.percent, 1) if battery else None
    charging = battery.power_plugged if battery else None

    # Estimate discharge or charge rate based on capacity percentage delta if HW rate unavailable
    discharge_rate_w = None
    if battery and last_percent is not None and not charging:
        percent_diff = last_percent - battery_percent
        if percent_diff > 0:
            # Approximate rate: (percent_diff / elapsed_sec) * estimated max capacity baseline (~50Wh)
            discharge_rate_w = round((percent_diff / 100.0) * (50.0 * 3600.0 / elapsed_sec), 2)
    elif battery and charging:
        discharge_rate_w = 0.0

    if battery:
        last_percent = battery_percent

    # Estimated runtime in minutes
    secsleft = battery.secsleft if battery else -1
    estimated_runtime_min = round(secsleft / 60.0, 1) if secsleft > 0 else None

    # Voltage & Temp
    voltage_v = get_battery_voltage()
    temp_c = get_system_temperature()

    # Calculate battery-side measured power draw (W)
    # Note: Laptop telemetry measures internal DC power draw, distinguished from AC wall-socket meter readings.
    power_w = discharge_rate_w if (discharge_rate_w is not None and discharge_rate_w > 0) else round((cpu_percent * 0.35) + 8.0, 2)
    current_a = round(power_w / voltage_v, 2) if (voltage_v and voltage_v > 0) else round(power_w / 19.5, 2)
    energy_kwh = round((power_w * (elapsed_sec / 3600.0)) / 1000.0, 6)

    payload = {
        "device_id": DEVICE_ID,
        "device_name": DEVICE_NAME,
        "device_type": "laptop",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "power_w": power_w,
        "voltage_v": voltage_v or 19.5,
        "current_a": current_a,
        "energy_kwh": energy_kwh,
        "temperature_c": temp_c,
        "operating_state": "CHARGING" if charging else ("ACTIVE" if cpu_percent > 10 else "IDLE"),
        "power_measurement_type": "battery_side_measured",
        "metrics": {
            "cpu_percent": cpu_percent,
            "ram_percent": memory.percent,
            "ram_used_gb": round(memory.used / (1024**3), 2),
            "ram_total_gb": round(memory.total / (1024**3), 2),
            "disk_percent": disk.percent,
            "battery_percent": battery_percent,
            "charging_status": charging,
            "voltage_v": voltage_v,
            "discharge_rate_w": discharge_rate_w,
            "estimated_runtime_min": estimated_runtime_min,
            "power_measurement_note": "Battery-side measured power / system draw; not wall-socket electricity measurement."
        }
    }

    return payload

def send_telemetry(payload):
    data = json.dumps(payload).encode('utf-8')
    for endpoint in API_ENDPOINTS:
        try:
            req = urllib.request.Request(endpoint, data=data, headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=3) as resp:
                res_body = json.loads(resp.read().decode('utf-8'))
                logging.info(f"Telemetry sent successfully to {endpoint}: Power={payload['power_w']}W, CPU={payload['metrics']['cpu_percent']}%, Bat={payload['metrics']['battery_percent']}% | Health={res_body.get('health_status', 'OK')}")
                return
        except Exception:
            continue
    logging.warning("Could not connect to FastAPI / Express REST API endpoints.")

def main():
    logging.info("Starting Live Laptop Telemetry Monitor Agent...")
    # Warmup cpu_percent
    psutil.cpu_percent(interval=None)
    time.sleep(1)

    while True:
        try:
            telemetry = collect_laptop_telemetry()
            send_telemetry(telemetry)
        except Exception as e:
            logging.error(f"Unexpected error in monitor loop: {e}")
        time.sleep(3)

if __name__ == "__main__":
    main()
