import os
import json
import logging
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestClassifier, IsolationForest
import xgboost as xgb
from dotenv import load_dotenv
import httpx

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AIEngine")

MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY", "").strip()

class SmartEnergyMLEngine:
    def __init__(self):
        # 1. Linear Regression for 30-day Energy Forecasting
        self.lr_forecast_model = LinearRegression()

        # 2. Random Forest for Anomaly Severity Classification (Low, Medium, High, Critical)
        self.rf_severity_model = RandomForestClassifier(n_estimators=50, random_state=42)
        self._train_rf_severity_baseline()

        # 3. XGBoost for Peak Load Pattern Classification
        self.xgb_load_model = xgb.XGBClassifier(n_estimators=30, max_depth=3, random_state=42, eval_metric='logloss')
        self._train_xgb_baseline()

        # 4. Isolation Forest for Telemetry Numerical Anomaly Detection
        self.iso_forest = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
        self._train_iso_forest_baseline()

    def _train_rf_severity_baseline(self):
        """Train Random Forest classifier on synthetic device anomaly feature vectors."""
        # Features: [power_w, voltage_v, temp_c, runtime_min] -> Target: Severity (0=Low, 1=Medium, 2=High, 3=Critical)
        X_train = np.array([
            [1200, 230, 24.0, 60],   # Low
            [1600, 225, 28.0, 120],  # Low
            [2100, 215, 32.0, 180],  # Medium
            [2400, 210, 36.0, 240],  # High
            [3200, 195, 42.0, 300],  # Critical
            [2900, 255, 39.0, 280],  # Critical
            [1450, 228, 25.5, 90],   # Low
            [2250, 220, 34.0, 200],  # Medium
        ])
        y_train = np.array([0, 0, 1, 2, 3, 3, 0, 1])
        self.rf_severity_model.fit(X_train, y_train)

    def _train_xgb_baseline(self):
        """Train XGBoost classifier to detect peak load usage patterns."""
        # Features: [power_w, cpu_load, ram_load, is_charging] -> Target: 0 (Normal Load), 1 (Peak Load Spike)
        X_train = np.array([
            [500, 15, 30, 1],
            [1200, 45, 50, 0],
            [1800, 80, 75, 1],
            [2800, 95, 90, 0],
            [3500, 99, 95, 1],
            [600, 20, 35, 1],
        ])
        y_train = np.array([0, 0, 0, 1, 1, 0])
        self.xgb_load_model.fit(X_train, y_train)

    def _train_iso_forest_baseline(self):
        """Train Isolation Forest baseline for device telemetry."""
        X_normal = np.array([
            [1400, 230, 6.1, 24.5],
            [1450, 228, 6.3, 25.0],
            [1500, 231, 6.5, 25.5],
            [1380, 229, 6.0, 24.0],
            [1420, 232, 6.2, 24.8],
            [1460, 227, 6.4, 25.2],
            [1510, 230, 6.6, 25.8],
            [1390, 228, 6.1, 24.2],
            [1430, 231, 6.2, 24.9],
            [1470, 229, 6.4, 25.3],
        ])
        self.iso_forest.fit(X_normal)

    def forecast_linear_regression(self, historical_kwh_list):
        """
        Use Linear Regression to generate a 30-day projected energy consumption forecast.
        Returns: list of 30 daily predictions and summary.
        """
        if len(historical_kwh_list) < 2:
            historical_kwh_list = [12.5, 13.0, 12.8, 13.5, 14.2, 16.0, 15.5]

        X = np.arange(len(historical_kwh_list)).reshape(-1, 1)
        y = np.array(historical_kwh_list)

        self.lr_forecast_model.fit(X, y)

        future_X = np.arange(len(historical_kwh_list), len(historical_kwh_list) + 30).reshape(-1, 1)
        predictions = self.lr_forecast_model.predict(future_X)
        predictions = [max(1.5, round(float(val), 3)) for val in predictions]

        total_predicted = round(sum(predictions), 2)
        avg_daily = round(total_predicted / 30.0, 2)

        return {
            "forecast_days": 30,
            "total_forecast_kwh": total_predicted,
            "average_daily_kwh": avg_daily,
            "daily_predictions": predictions,
            "model_type": "Linear Regression (scikit-learn)"
        }

    def classify_severity_rf(self, power_w, voltage_v, temp_c, runtime_min):
        """Use Random Forest classifier to predict anomaly severity level."""
        sample = np.array([[power_w, voltage_v, temp_c if temp_c is not None else 25.0, runtime_min]])
        pred = int(self.rf_severity_model.predict(sample)[0])
        labels = ["Low", "Medium", "High", "Critical"]
        return labels[pred]

    def predict_peak_load_xgb(self, power_w, cpu_load=50, ram_load=50, is_charging=1):
        """Use XGBoost model to evaluate if current state is a peak load spike."""
        sample = np.array([[power_w, cpu_load, ram_load, is_charging]])
        pred = int(self.xgb_load_model.predict(sample)[0])
        proba = float(self.xgb_load_model.predict_proba(sample)[0][1])
        return {"is_peak_spike": bool(pred == 1), "peak_probability": round(proba, 2)}

    def detect_telemetry_anomaly(self, sample):
        """
        Isolation Forest + Rule-based numerical anomaly detection.
        Sample: [power_w, voltage_v, current_a, temp_c]
        """
        features = np.array([sample])
        reasons = []
        power, voltage, current, temp = sample[0], sample[1], sample[2], sample[3] if len(sample) > 3 else 25.0

        if power > 2200:
            reasons.append(f"Abnormal power surge: {power}W exceeds normal threshold (2200W)")
        if temp and temp > 35.0:
            reasons.append(f"Thermal anomaly: {temp}°C exceeds safety threshold (35°C)")
        if voltage < 190 or voltage > 260:
            reasons.append(f"Voltage fluctuation: {voltage}V outside safe grid bounds")

        iso_score_raw = self.iso_forest.score_samples(features)[0]
        iso_anomaly = bool(self.iso_forest.predict(features)[0] == -1)

        is_anomalous = len(reasons) > 0 or iso_anomaly
        score = max(0.85 if len(reasons) > 0 else 0.15, round(float(1.0 - (iso_score_raw + 0.5)), 2))

        severity = self.classify_severity_rf(power, voltage, temp, 120) if is_anomalous else "Low"

        return {
            "is_anomaly": is_anomalous,
            "anomaly_score": min(0.98, max(0.05, score)),
            "severity": severity,
            "reasons": reasons if len(reasons) > 0 else (["Isolation Forest statistical anomaly"] if is_anomalous else [])
        }

async def generate_mistral_explanation(prompt_type: str, context: dict) -> str:
    """Call Mistral AI API for generating natural language explanations with smart fallback."""
    if not MISTRAL_API_KEY:
        reasons_str = ', '.join(context.get('reasons', [])) or 'operating load variance'
        return f"Device '{context.get('device_name', 'System')}' detected {reasons_str}. Technical inspection recommended."

    headers = {
        "Authorization": f"Bearer {MISTRAL_API_KEY}",
        "Content-Type": "application/json"
    }

    system_prompt = (
        "You are an expert AI Smart Household Energy Technician & Maintenance Assistant. "
        "Provide concise, practical, professional explanations."
    )

    if prompt_type == 'anomaly_explanation':
        user_prompt = (
            f"Device '{context.get('device_name')}' flagged abnormal behavior.\n"
            f"Health Status: {context.get('health_status')}\n"
            f"Power Draw: {context.get('power_w')}W\n"
            f"Flagged Reasons: {', '.join(context.get('reasons', []))}\n"
            "Explain in 2 sentences why this device is flagged and what maintenance risk it poses."
        )
    elif prompt_type == 'ticket_summary':
        user_prompt = (
            f"Summarize auto-created service ticket for technician dispatch.\n"
            f"Device: {context.get('device_name')}\n"
            f"Issue: {context.get('service_type')}\n"
            f"Anomalies: {context.get('description')}\n"
            "Provide a 2-sentence technical summary for the field service technician."
        )
    else:
        user_prompt = f"Analyze energy context: {json.dumps(context)}"

    payload = {
        "model": "mistral-small-latest",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 200
    }

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.post("https://api.mistral.ai/v1/chat/completions", headers=headers, json=payload)
            if resp.status_code == 200:
                result = resp.json()
                return result['choices'][0]['message']['content'].strip()
            elif resp.status_code == 429:
                logger.warning("Mistral AI rate limit reached (429). Using intelligent rule-based explanation.")
            else:
                logger.warning(f"Mistral AI returned status {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.warning(f"Mistral AI request error: {e}")

    return f"Device '{context.get('device_name', 'System')}' exhibits operating deviations ({', '.join(context.get('reasons', ['abnormal load']))}). Technical inspection recommended."

if __name__ == "__main__":
    engine = SmartEnergyMLEngine()
    print("Linear Regression Forecast:", engine.forecast_linear_regression([12.5, 13.0, 12.8, 13.5, 14.2, 16.0]))
    print("Random Forest Severity Test:", engine.classify_severity_rf(2900, 210, 38.0, 200))
    print("XGBoost Peak Spike Test:", engine.predict_peak_load_xgb(3100, 90, 85, 0))
    print("Isolation Forest Anomaly Test:", engine.detect_telemetry_anomaly([2900, 210, 13.8, 38.0]))
