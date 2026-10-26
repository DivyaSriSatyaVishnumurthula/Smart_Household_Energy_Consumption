import os
import io
import time
import math
import asyncio
import logging
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

from backend.database import init_db, get_db_connection
from backend.ai_engine import SmartEnergyMLEngine, generate_mistral_explanation

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("FastAPIBackend")

# Initialize Machine Learning Engine
ml_engine = SmartEnergyMLEngine()

# In-Memory Fallback & Operational State Cache
users_cache = [
    {
        "id": 1,
        "email": "household@example.com",
        "full_name": "Alex Sharma",
        "role": "household",
        "phone": "+91 9876543210",
        "address": "Flat 402, Green Meadows, Mumbai",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    },
    {
        "id": 2,
        "email": "provider@example.com",
        "full_name": "CoolAir Technicians",
        "role": "provider",
        "phone": "+91 9811223344",
        "address": "Shop 14, High Street, Mumbai",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
]

households_cache = [
    {
        "id": 1,
        "user_id": 1,
        "home_type": "Apartment",
        "size_sqft": 1250,
        "occupants": 4,
        "location": "Mumbai",
        "monthly_budget": 3500.0,
        "solar_available": False,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
]

appliances_cache = [
    {"id": 1, "household_id": 1, "name": "Air Conditioner (1.5 Ton)", "category": "Cooling", "quantity": 1, "power_rating_watts": 1800.0, "usage_hours_per_day": 8.0},
    {"id": 2, "household_id": 1, "name": "Double Door Refrigerator", "category": "Kitchen", "quantity": 1, "power_rating_watts": 350.0, "usage_hours_per_day": 24.0},
    {"id": 3, "household_id": 1, "name": "Washing Machine (Front Load)", "category": "Laundry", "quantity": 1, "power_rating_watts": 800.0, "usage_hours_per_day": 1.0},
]

household_bills_cache: Dict[int, Dict[str, Any]] = {
    1: {
        "id": 1,
        "household_id": 1,
        "amount": 3150.0,
        "units": 420.0,
        "billing_period": "August 2026",
        "tariff_rate": 7.5,
        "fixed_charges": 250.0,
        "taxes": 120.0,
        "other_charges": 0.0,
        "discom": "MSEDCL / Adani Electricity Mumbai",
        "source": "bill_analyzer",
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
}

energy_readings_cache = [
    {"id": 1, "household_id": 1, "date": "2026-09-10", "kwh": 12.9, "source": "Grid Meter", "notes": "Workday"},
    {"id": 2, "household_id": 1, "date": "2026-09-11", "kwh": 14.2, "source": "Grid Meter", "notes": "Friday AC"},
    {"id": 3, "household_id": 1, "date": "2026-09-12", "kwh": 16.8, "source": "Grid Meter", "notes": "Weekend baking"},
    {"id": 4, "household_id": 1, "date": "2026-09-13", "kwh": 15.7, "source": "Grid Meter", "notes": "Sunday home"},
    {"id": 5, "household_id": 1, "date": "2026-09-14", "kwh": 12.2, "source": "Grid Meter", "notes": "Workday"},
    {"id": 6, "household_id": 1, "date": "2026-09-15", "kwh": 12.7, "source": "Grid Meter", "notes": "Workday"},
    {"id": 7, "household_id": 1, "date": "2026-09-16", "kwh": 13.5, "source": "Grid Meter", "notes": "Workday"},
]

providers_cache = [
    {
        "id": 1,
        "user_id": 2,
        "business_name": "CoolAir Solutions",
        "categories": "AC Service, HVAC Maintenance",
        "experience_years": 12,
        "location": "Mumbai",
        "base_price": "₹500 - ₹2000",
        "description": "Certified AC servicing, inverter compressor checks, and chemical coil washing.",
        "availability_status": "Available",
        "rating": 4.8,
        "verified": True,
    },
    {
        "id": 2,
        "user_id": 2,
        "business_name": "Sparky Electricals",
        "categories": "Electrical Maintenance, Appliance Repair",
        "experience_years": 8,
        "location": "Mumbai",
        "base_price": "₹300 - ₹1500",
        "description": "Residential rewiring, smart energy sub-meter installation, and MCB earthing.",
        "availability_status": "Available",
        "rating": 4.9,
        "verified": True,
    },
]

service_requests_cache = [
    {
        "id": 1,
        "user_id": 1,
        "provider_id": 1,
        "service_type": "AC Maintenance",
        "description": "Annual cleaning and refrigerant inspection",
        "requested_date": "2026-03-25",
        "address": "Flat 402, Green Meadows, Mumbai",
        "status": "Pending",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
]

next_ids = {
    "user": 10,
    "household": 5,
    "appliance": 10,
    "bill": 5,
    "reading": 100,
    "request": 10,
    "ticket": 101,
    "telemetry": 1,
}

# AC Simulator State Configuration
ac_simulator_state = {
    "running": True,
    "paused": False,
    "speed_multiplier": 1,
    "scenario": "NORMAL",
    "power_watts": 1450.0,
    "voltage_v": 230.0,
    "current_a": 6.3,
    "energy_kwh": 12.4,
    "runtime_minutes": 120,
    "operating_state": "COOLING",
    "temperature_c": 26.5,
    "target_temperature_c": 24.0,
    "compressor_status": "ON",
    "fan_status": "MEDIUM",
    "cycle_count": 4,
    "last_toggle_time": time.time(),
    "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
}

telemetry_buffer: Dict[str, List[Dict[str, Any]]] = {
    "ac_simulator": [],
    "laptop_primary": [],
}

device_health: Dict[str, Dict[str, Any]] = {
    "ac_simulator": {
        "device_id": "ac_simulator",
        "device_name": "Living Room AC (1.5 Ton)",
        "device_type": "ac_simulator",
        "health_status": "Healthy",
        "anomaly_score": 0.05,
        "anomaly_reasons": [],
        "persistence_count": 0,
        "explanation_mistral": "AC unit is operating within normal thermodynamic and electrical parameters.",
        "active_ticket_id": None,
        "last_updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    },
    "laptop_primary": {
        "device_id": "laptop_primary",
        "device_name": "Primary User Laptop",
        "device_type": "laptop",
        "health_status": "Healthy",
        "anomaly_score": 0.05,
        "anomaly_reasons": [],
        "persistence_count": 0,
        "explanation_mistral": "Laptop battery and system draw are within standard operational limits.",
        "active_ticket_id": None,
        "last_updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    },
}

auto_service_tickets: List[Dict[str, Any]] = []

# Rate limit backoff tracker for Mistral AI
mistral_last_called = 0.0
MISTRAL_COOLDOWN_SEC = 5.0

async def ac_simulator_background_loop():
    """Background task simulating AC appliance physics every 2 seconds."""
    global ac_simulator_state
    while True:
        await asyncio.sleep(2.0)
        if not ac_simulator_state["running"] or ac_simulator_state["paused"]:
            continue

        dt_sec = 2.0 * ac_simulator_state["speed_multiplier"]
        power = 1450.0
        state = "COOLING"
        comp_status = "ON"
        temp_delta = -0.1 * (dt_sec / 2.0)
        scenario = ac_simulator_state["scenario"]

        if scenario == "HIGH_POWER":
            power = 2850.0 + (time.time() % 3 * 50 - 25)
            state = "COOLING"
            comp_status = "ON"
            temp_delta = -0.05
        elif scenario == "LONG_RUNTIME":
            power = 1750.0 + (time.time() % 2 * 20)
            state = "COOLING"
            comp_status = "ON"
            temp_delta = 0.02
        elif scenario == "FREQUENT_CYCLING":
            if time.time() - ac_simulator_state["last_toggle_time"] > 4:
                ac_simulator_state["compressor_status"] = "OFF" if ac_simulator_state["compressor_status"] == "ON" else "ON"
                ac_simulator_state["last_toggle_time"] = time.time()
                ac_simulator_state["cycle_count"] += 1
            comp_status = ac_simulator_state["compressor_status"]
            power = 1650.0 if comp_status == "ON" else 80.0
            state = "COOLING" if comp_status == "ON" else "FAN_ONLY"
        elif scenario == "ABNORMAL_TEMP":
            power = 1600.0
            state = "COOLING"
            comp_status = "ON"
            temp_delta = +0.2
        else:
            if ac_simulator_state["temperature_c"] <= ac_simulator_state["target_temperature_c"]:
                state = "FAN_ONLY"
                comp_status = "OFF"
                power = 75.0
                temp_delta = +0.05
            else:
                state = "COOLING"
                comp_status = "ON"
                power = 1450.0
                temp_delta = -0.08

        ac_simulator_state["power_watts"] = round(power, 1)
        ac_simulator_state["operating_state"] = state
        ac_simulator_state["compressor_status"] = comp_status
        ac_simulator_state["temperature_c"] = min(40.0, max(16.0, round(ac_simulator_state["temperature_c"] + temp_delta, 1)))
        ac_simulator_state["voltage_v"] = round(228.0 + math.sin(time.time() / 2.0) * 4.0, 1)
        ac_simulator_state["current_a"] = round(ac_simulator_state["power_watts"] / (ac_simulator_state["voltage_v"] * 0.92), 1)

        added_kwh = (ac_simulator_state["power_watts"] * (dt_sec / 3600.0)) / 1000.0
        ac_simulator_state["energy_kwh"] = round(ac_simulator_state["energy_kwh"] + added_kwh, 4)
        ac_simulator_state["runtime_minutes"] += int(dt_sec / 60.0) or 1

        reading_id = next_ids["telemetry"]
        next_ids["telemetry"] += 1

        reading = {
            "id": reading_id,
            "device_id": "ac_simulator",
            "device_name": "Living Room AC (1.5 Ton)",
            "device_type": "ac_simulator",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "power_w": ac_simulator_state["power_watts"],
            "voltage_v": ac_simulator_state["voltage_v"],
            "current_a": ac_simulator_state["current_a"],
            "energy_kwh": ac_simulator_state["energy_kwh"],
            "temperature_c": ac_simulator_state["temperature_c"],
            "operating_state": ac_simulator_state["operating_state"],
            "power_measurement_type": "direct_appliance_sim",
            "metrics": {
                "target_temperature_c": ac_simulator_state["target_temperature_c"],
                "compressor_status": ac_simulator_state["compressor_status"],
                "fan_status": ac_simulator_state["fan_status"],
                "scenario": ac_simulator_state["scenario"],
                "speed_multiplier": ac_simulator_state["speed_multiplier"],
                "runtime_minutes": ac_simulator_state["runtime_minutes"],
            }
        }
        telemetry_buffer["ac_simulator"].append(reading)
        if len(telemetry_buffer["ac_simulator"]) > 60:
            telemetry_buffer["ac_simulator"].pop(0)

        await evaluate_device_health_pipeline("ac_simulator", reading)

async def evaluate_device_health_pipeline(device_id: str, reading: Dict[str, Any]):
    global auto_service_tickets, device_health, mistral_last_called
    health = device_health.get(device_id, {
        "device_id": device_id,
        "device_name": reading["device_name"],
        "device_type": reading["device_type"],
        "health_status": "Healthy",
        "anomaly_score": 0.05,
        "anomaly_reasons": [],
        "persistence_count": 0,
        "explanation_mistral": "",
        "active_ticket_id": None,
        "last_updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })

    eval_res = ml_engine.detect_telemetry_anomaly([
        reading["power_w"], reading["voltage_v"], reading["current_a"], reading.get("temperature_c") or 25.0
    ])

    is_anomalous = eval_res["is_anomaly"]
    reasons = eval_res["reasons"]

    if is_anomalous:
        health["persistence_count"] += 1
        health["anomaly_score"] = eval_res["anomaly_score"]
        health["anomaly_reasons"] = reasons
    else:
        health["persistence_count"] = max(0, health["persistence_count"] - 1)
        if health["persistence_count"] == 0:
            health["anomaly_score"] = 0.05
            health["anomaly_reasons"] = []

    prev_status = health["health_status"]
    if health["persistence_count"] >= 3:
        health["health_status"] = "Maintenance Required"
    elif health["persistence_count"] >= 1:
        health["health_status"] = "Attention Required"
    else:
        health["health_status"] = "Healthy"

    health["last_updated"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # Mistral AI Explanation Generation with cooldown to prevent 429
    now = time.time()
    if is_anomalous and (not health["explanation_mistral"] or prev_status != health["health_status"]):
        if now - mistral_last_called > MISTRAL_COOLDOWN_SEC:
            mistral_last_called = now
            explanation = await generate_mistral_explanation("anomaly_explanation", {
                "device_name": reading["device_name"],
                "health_status": health["health_status"],
                "power_w": reading["power_w"],
                "reasons": reasons,
            })
            health["explanation_mistral"] = explanation
        else:
            health["explanation_mistral"] = f"Operating deviation detected: {', '.join(reasons)}. Inspection advised."
    elif not is_anomalous and health["health_status"] == "Healthy":
        health["explanation_mistral"] = "Device is operating within standard parameters."

    # AUTOMATIC SERVICE PROVIDER WORKFLOW
    if health["health_status"] == "Maintenance Required" and not health["active_ticket_id"]:
        ticket_id = next_ids["ticket"]
        next_ids["ticket"] += 1
        ticket_num = f"TKT-2026-{ticket_id:03d}"
        service_type = "AC Compressor & HVAC Overhaul" if reading["device_type"] == "ac_simulator" else "Laptop Power Diagnostic"
        provider_name = "CoolAir Solutions" if reading["device_type"] == "ac_simulator" else "Sparky Electricals"
        provider_id = 1 if reading["device_type"] == "ac_simulator" else 2

        ticket_desc = f"Persistent telemetry anomalies confirmed ({'; '.join(reasons)}). Field technician dispatch initiated."
        if now - mistral_last_called > MISTRAL_COOLDOWN_SEC:
            mistral_last_called = now
            ai_summary = await generate_mistral_explanation("ticket_summary", {
                "device_name": reading["device_name"],
                "service_type": service_type,
                "description": "; ".join(reasons),
            })
            if ai_summary:
                ticket_desc = ai_summary

        ticket = {
            "id": ticket_id,
            "ticket_number": ticket_num,
            "device_id": device_id,
            "device_name": reading["device_name"],
            "user_id": 1,
            "provider_id": provider_id,
            "provider_name": provider_name,
            "service_type": service_type,
            "issue_summary": f"Persistent Anomaly Alert: {reading['device_name']} ({reasons[0] if reasons else 'Abnormal metrics'})",
            "detailed_explanation": ticket_desc,
            "severity": eval_res.get("severity", "High"),
            "status": "Auto-Created",
            "auto_generated": True,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        auto_service_tickets.insert(0, ticket)
        health["active_ticket_id"] = ticket_id

        # Persist to database if available
        try:
            conn = get_db_connection()
            with conn.cursor() as cur:
                cur.execute("""
                INSERT INTO service_requests (user_id, provider_id, service_type, description, requested_date, address, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s);
                """, (1, provider_id, f"{service_type} ({ticket_num})", ticket["issue_summary"], time.strftime("%Y-%m-%d"), "Flat 402, Green Meadows, Mumbai", "Pending"))
            conn.close()
        except Exception:
            pass

    device_health[device_id] = health

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup initialization
    try:
        init_db()
    except Exception as e:
        logger.warning(f"Database init warning: {e}")
    task = asyncio.create_task(ac_simulator_background_loop())
    yield
    task.cancel()

app = FastAPI(title="Smart Household Energy Platform API", lifespan=lifespan)

# Production CORS Configuration
raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =================================================================
# REST API Endpoints
# =================================================================

# 1. Health Endpoint
@app.get("/api/health")
def get_health():
    return {
        "status": "ok",
        "service": "Smart Household Energy Platform API",
        "backend": "Python FastAPI + Uvicorn",
        "database": "MySQL (smart_energy)",
        "ai_ml": "Mistral AI + Linear Regression + Random Forest + XGBoost + Isolation Forest",
    }

# 2. Authentication
class AuthRegister(BaseModel):
    email: str
    full_name: str
    role: Optional[str] = "household"
    password: Optional[str] = "password123"
    phone: Optional[str] = ""
    address: Optional[str] = ""

@app.post("/api/auth/register")
def register_user(data: AuthRegister):
    email_clean = data.email.strip().lower()
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE email = %s;", (email_clean,))
            if cur.fetchone():
                conn.close()
                raise HTTPException(status_code=400, detail="Email already registered.")

            cur.execute("""
            INSERT INTO users (email, password_hash, full_name, role, phone, address)
            VALUES (%s, %s, %s, %s, %s, %s);
            """, (email_clean, "hash_pwd", data.full_name, data.role or "household", data.phone, data.address))
            new_id = cur.lastrowid
        conn.close()
        return {"message": "User registered successfully", "id": new_id}
    except HTTPException:
        raise
    except Exception:
        new_id = next_ids["user"]
        next_ids["user"] += 1
        users_cache.append({
            "id": new_id,
            "email": email_clean,
            "full_name": data.full_name,
            "role": data.role or "household",
            "phone": data.phone or "",
            "address": data.address or "",
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })
        return {"message": "User registered successfully", "id": new_id}

class AuthLogin(BaseModel):
    email: str
    password: Optional[str] = ""

@app.post("/api/auth/login")
def login_user(data: AuthLogin):
    email_clean = data.email.strip().lower()
    role = "provider" if "provider" in email_clean else "household"
    return {
        "access_token": "mock_jwt_token_base64",
        "token_type": "bearer",
        "user": {
            "id": 1 if role == "household" else 2,
            "email": email_clean,
            "full_name": email_clean.split("@")[0].title(),
            "role": role,
            "phone": "+91 9876543210",
            "address": "Flat 402, Green Meadows, Mumbai",
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    }

# 3. User & Household
@app.get("/api/users/{user_id}")
def get_user(user_id: int):
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id, email, full_name, role, phone, address, created_at FROM users WHERE id = %s;", (user_id,))
            u = cur.fetchone()
        conn.close()
        if u: return u
    except Exception:
        pass
    for u in users_cache:
        if u["id"] == user_id: return u
    return {
        "id": user_id, "email": "household@example.com", "full_name": "Alex Sharma",
        "role": "household", "phone": "+91 9876543210", "address": "Mumbai"
    }

@app.put("/api/users/{user_id}")
def update_user(user_id: int, req: Request, data: Dict[str, Any]):
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET full_name = %s, phone = %s, address = %s WHERE id = %s;",
                        (data.get("full_name", "Alex Sharma"), data.get("phone", ""), data.get("address", ""), user_id))
        conn.close()
    except Exception:
        pass
    return {"id": user_id, **data}

@app.get("/api/household/{household_id}")
def get_household(household_id: int):
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM households WHERE id = %s OR user_id = %s;", (household_id, household_id))
            hh = cur.fetchone()
        conn.close()
        if hh: return hh
    except Exception:
        pass
    for hh in households_cache:
        if hh["id"] == household_id or hh["user_id"] == household_id: return hh
    return households_cache[0]

@app.put("/api/household/{household_id}")
def update_household(household_id: int, data: Dict[str, Any]):
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
            UPDATE households SET home_type = %s, size_sqft = %s, occupants = %s, location = %s, monthly_budget = %s, solar_available = %s
            WHERE id = %s;
            """, (data.get("home_type"), data.get("size_sqft"), data.get("occupants"), data.get("location"), data.get("monthly_budget"), data.get("solar_available"), household_id))
        conn.close()
    except Exception:
        pass
    return {"id": household_id, **data}

# 4. Household Bills
@app.get("/api/household/{household_id}/bill")
def get_household_bill(household_id: int):
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM household_bills WHERE household_id = %s ORDER BY id DESC LIMIT 1;", (household_id,))
            b = cur.fetchone()
        conn.close()
        if b: return b
    except Exception:
        pass
    return household_bills_cache.get(household_id) or household_bills_cache.get(1)

@app.post("/api/household/{household_id}/bill")
def save_household_bill(household_id: int, data: Dict[str, Any]):
    bill_data = {
        "id": next_ids["bill"],
        "household_id": household_id,
        "amount": float(data.get("amount", 0)),
        "units": float(data.get("units", 0)),
        "billing_period": data.get("billingPeriod") or data.get("billing_period") or "Current Utility Bill",
        "tariff_rate": float(data.get("tariffRate") or data.get("tariff_rate") or 7.5),
        "fixed_charges": float(data.get("fixedCharges") or data.get("fixed_charges") or 250.0),
        "taxes": float(data.get("taxes") or 0.0),
        "other_charges": float(data.get("otherCharges") or data.get("other_charges") or 0.0),
        "discom": data.get("discom", "Utility Provider"),
        "source": data.get("source", "bill_analyzer"),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    next_ids["bill"] += 1
    household_bills_cache[household_id] = bill_data

    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
            INSERT INTO household_bills (household_id, amount, units, billing_period, tariff_rate, fixed_charges, taxes, other_charges, discom, source)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, (household_id, bill_data["amount"], bill_data["units"], bill_data["billing_period"], bill_data["tariff_rate"], bill_data["fixed_charges"], bill_data["taxes"], bill_data["other_charges"], bill_data["discom"], bill_data["source"]))
        conn.close()
    except Exception:
        pass

    return {"success": True, "bill": bill_data}

@app.delete("/api/household/{household_id}/bill")
def delete_household_bill(household_id: int):
    household_bills_cache.pop(household_id, None)
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM household_bills WHERE household_id = %s;", (household_id,))
        conn.close()
    except Exception:
        pass
    return {"success": True}

# 5. Appliances Management
@app.get("/api/household/{household_id}/appliances")
def get_appliances(household_id: int):
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM appliances WHERE household_id = %s;", (household_id,))
            apps = cur.fetchall()
        conn.close()
        if apps: return apps
    except Exception:
        pass
    return [a for a in appliances_cache if a.get("household_id") == household_id] or appliances_cache

@app.post("/api/household/{household_id}/appliances")
def add_or_update_appliance(household_id: int, data: Dict[str, Any]):
    app_id = int(data.get("id") or next_ids["appliance"])
    next_ids["appliance"] = max(next_ids["appliance"], app_id + 1)
    
    name = data.get("name", "Custom Appliance")
    category = data.get("category", "General")
    qty = int(data.get("quantity") or 1)
    power = float(data.get("power_rating_watts") or data.get("power") or 500.0)
    hours = float(data.get("usage_hours_per_day") or data.get("hours") or 4.0)

    app_obj = {
        "id": app_id,
        "household_id": household_id,
        "name": name,
        "category": category,
        "quantity": qty,
        "power_rating_watts": power,
        "usage_hours_per_day": hours,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    # Update local cache
    existing_idx = next((i for i, a in enumerate(appliances_cache) if a["id"] == app_id), None)
    if existing_idx is not None:
        appliances_cache[existing_idx] = app_obj
    else:
        appliances_cache.append(app_obj)

    # Persist to MySQL
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
            INSERT INTO appliances (id, household_id, name, category, quantity, power_rating_watts, usage_hours_per_day)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), quantity=VALUES(quantity),
            power_rating_watts=VALUES(power_rating_watts), usage_hours_per_day=VALUES(usage_hours_per_day);
            """, (app_id, household_id, name, category, qty, power, hours))
        conn.close()
    except Exception:
        pass

    return app_obj

@app.put("/api/household/{household_id}/appliances/{app_id}")
def update_appliance(household_id: int, app_id: int, data: Dict[str, Any]):
    data["id"] = app_id
    return add_or_update_appliance(household_id, data)

@app.delete("/api/household/{household_id}/appliances/{app_id}")
@app.delete("/api/appliances/{app_id}")
def delete_appliance(app_id: int, household_id: Optional[int] = 1):
    global appliances_cache
    appliances_cache = [a for a in appliances_cache if a["id"] != app_id]
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM appliances WHERE id = %s;", (app_id,))
        conn.close()
    except Exception:
        pass
    return {"success": True, "id": app_id}

# 6. Energy Readings & Consumption
@app.get("/api/energy/readings")
@app.get("/api/energy/readings/{household_id}")
def get_readings(household_id: int = 1):
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM energy_readings WHERE household_id = %s ORDER BY date ASC;", (household_id,))
            readings = cur.fetchall()
        conn.close()
        if readings: return readings
    except Exception:
        pass
    return [r for r in energy_readings_cache if r.get("household_id") == household_id] or energy_readings_cache

@app.post("/api/energy/readings")
@app.post("/api/energy/readings/{household_id}")
def add_reading(data: Dict[str, Any], household_id: int = 1):
    r_id = next_ids["reading"]
    next_ids["reading"] += 1
    new_reading = {
        "id": r_id,
        "household_id": household_id,
        "date": data.get("date", time.strftime("%Y-%m-%d")),
        "kwh": float(data.get("kwh", 0)),
        "source": data.get("source", "Grid Meter"),
        "notes": data.get("notes", ""),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    energy_readings_cache.append(new_reading)

    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
            INSERT INTO energy_readings (id, household_id, date, kwh, source, notes)
            VALUES (%s, %s, %s, %s, %s, %s);
            """, (r_id, household_id, new_reading["date"], new_reading["kwh"], new_reading["source"], new_reading["notes"]))
        conn.close()
    except Exception:
        pass

    return new_reading

@app.delete("/api/energy/readings/{reading_id}")
def delete_reading(reading_id: int):
    global energy_readings_cache
    energy_readings_cache = [r for r in energy_readings_cache if r["id"] != reading_id]
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM energy_readings WHERE id = %s;", (reading_id,))
        conn.close()
    except Exception:
        pass
    return {"message": "Reading deleted successfully", "id": reading_id}

@app.post("/api/energy/consumption/{household_id}")
def log_consumption(household_id: int, data: Dict[str, Any]):
    return add_reading(data, household_id)

# 7. ML Forecasting & CSV Upload
def compute_forecast_dataset(data_points: List[Dict[str, Any]]):
    """Generates Linear Regression projections with seasonality factors."""
    kwh_list = [pt["kwh"] for pt in data_points]
    res = ml_engine.forecast_linear_regression(kwh_list)
    daily_preds = res["daily_predictions"]
    
    last_date = time.strftime("%Y-%m-%d")
    if data_points:
        last_date = data_points[-1].get("date_str") or data_points[-1].get("date") or last_date

    forecast_items = []
    for i in range(min(30, len(daily_preds))):
        forecast_items.append({
            "date": f"2026-10-{i+1:02d}",
            "predicted_kwh": daily_preds[i],
            "kwh": daily_preds[i],
        })

    return {
        "status": "success",
        "data_source": "household_readings",
        "summary": {
            "forecast_days": 30,
            "total_forecast_kwh": res["total_forecast_kwh"],
            "average_daily_forecast_kwh": res["average_daily_kwh"],
            "last_historical_date": last_date,
            "reading_count": len(data_points),
            "model_used": "Linear Regression (scikit-learn)"
        },
        "forecast": forecast_items,
    }

@app.post("/api/energy/forecast/upload")
async def upload_forecast_csv(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a valid CSV file.")

    content = await file.read()
    text = content.decode("utf-8", errors="ignore")
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    if len(lines) < 2:
        raise HTTPException(status_code=400, detail="Uploaded CSV contains no records.")

    header = [c.strip().lower().replace('"', '').replace("'", "") for c in lines[0].split(",")]
    
    date_col = 0
    for idx, h in enumerate(header):
        if h in ["timestamp", "date", "datetime", "time"]:
            date_col = idx
            break

    kwh_col = len(header) - 1
    for idx, h in enumerate(header):
        if h in ["kwh", "consumption", "units", "energy", "predicted_kwh"]:
            kwh_col = idx
            break

    data_points = []
    for line in lines[1:]:
        parts = [p.strip().replace('"', '').replace("'", "") for p in line.split(",")]
        if len(parts) > max(date_col, kwh_col):
            try:
                val = float(parts[kwh_col])
                if val >= 0:
                    data_points.append({"date_str": parts[date_col], "kwh": val})
            except ValueError:
                continue

    if len(data_points) < 5:
        raise HTTPException(status_code=400, detail="Uploaded CSV must contain at least 5 valid historical records.")

    result = compute_forecast_dataset(data_points)
    result["data_source"] = "user_dataset"
    result["uploaded_file"] = file.filename
    result["uploaded_records"] = len(data_points)
    return result

@app.get("/api/energy/forecast")
@app.get("/api/energy/forecast/{household_id}")
@app.post("/api/energy/forecast")
@app.post("/api/energy/forecast/{household_id}")
def get_energy_forecast(household_id: int = 1):
    readings = get_readings(household_id)
    data_pts = [{"date_str": r["date"], "kwh": float(r["kwh"])} for r in readings]
    return compute_forecast_dataset(data_pts)

# 8. Monthly Summary & CSV Downloads
@app.get("/api/energy/monthly-summary")
@app.get("/api/energy/monthly-summary/{household_id}")
def get_monthly_summary(household_id: int = 1, tariff_rate: float = 7.5):
    return {
        "household_id": household_id,
        "tariff_rate": tariff_rate,
        "total_historical_kwh": 412.5,
        "total_historical_cost": round(412.5 * tariff_rate, 2),
        "months_count": 2,
        "months": [
            {
                "month_key": "2026-08", "month_name": "August 2026", "year": 2026, "month_num": 8,
                "total_kwh": 420.0, "avg_daily_kwh": 14.0, "peak_date": "2026-08-29", "peak_kwh": 16.5,
                "lowest_date": "2026-08-31", "lowest_kwh": 11.9, "days_recorded": 31, "estimated_cost": round(420.0 * tariff_rate, 2),
                "tariff_rate": tariff_rate, "status": "Completed Month", "notes": "Recorded meter log"
            },
            {
                "month_key": "2026-09", "month_name": "September 2026", "year": 2026, "month_num": 9,
                "total_kwh": 210.5, "avg_daily_kwh": 13.15, "peak_date": "2026-09-12", "peak_kwh": 16.8,
                "lowest_date": "2026-09-14", "lowest_kwh": 12.2, "days_recorded": 16, "estimated_cost": round(210.5 * tariff_rate, 2),
                "tariff_rate": tariff_rate, "status": "Current Month", "notes": "In Progress"
            }
        ]
    }

@app.get("/api/energy/monthly-summary/csv")
@app.get("/api/energy/monthly-summary/csv/{household_id}")
@app.get("/api/energy/download-csv")
@app.get("/api/energy/download-csv/{household_id}")
def download_monthly_csv(household_id: int = 1, tariff_rate: float = 7.5):
    summary = get_monthly_summary(household_id, tariff_rate)
    csv_lines = [
        "# ==========================================================================================",
        "# SMART HOUSEHOLD ENERGY MANAGEMENT SYSTEM - MONTHLY CONSUMPTION SUMMARY REPORT",
        f"# Household ID: {household_id} | Currency: INR (₹) | Standard Tariff Rate: ₹{tariff_rate:.2f} / kWh",
        "# ==========================================================================================",
        "Month,Year,Total Consumption (kWh),Avg Daily Usage (kWh/day),Peak Day Date,Peak Day (kWh),Lowest Day Date,Lowest Day (kWh),Days Recorded,Estimated Cost (INR),Tariff Rate (INR/kWh),Status,Notes"
    ]

    total_kwh = 0.0
    total_cost = 0.0
    total_days = 0

    for m in summary["months"]:
        total_kwh += m["total_kwh"]
        total_cost += m["estimated_cost"]
        total_days += m["days_recorded"]
        csv_lines.append(f'"{m["month_name"]}",{m["year"]},{m["total_kwh"]:.2f},{m["avg_daily_kwh"]:.2f},"{m["peak_date"]}",{m["peak_kwh"]:.2f},"{m["lowest_date"]}",{m["lowest_kwh"]:.2f},{m["days_recorded"]},{m["estimated_cost"]:.2f},{tariff_rate:.2f},"{m["status"]}","{m["notes"]}"')

    avg_all = total_kwh / total_days if total_days > 0 else 0.0
    csv_lines.append(f'"TOTAL / CUMULATIVE","—",{total_kwh:.2f},{avg_all:.2f},"—","—","—","—",{total_days},{total_cost:.2f},{tariff_rate:.2f},"Combined Total","Cumulative summary across recorded months"')
    csv_lines.append("# ==========================================================================================")

    csv_data = "\n".join(csv_lines)
    filename = f"monthly_energy_consumption_summary_household_{household_id}_{time.strftime('%Y-%m-%d')}.csv"
    return StreamingResponse(
        io.StringIO(csv_data),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# 9. Service Providers & Requests
@app.get("/api/providers")
def get_providers(category: Optional[str] = None, location: Optional[str] = None, search: Optional[str] = None):
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM providers;")
            providers = cur.fetchall()
        conn.close()
        if providers:
            return providers
    except Exception:
        pass
    return providers_cache

@app.get("/api/providers/{provider_id}")
def get_provider(provider_id: int):
    for p in providers_cache:
        if p["id"] == provider_id or p["user_id"] == provider_id:
            return p
    return providers_cache[0]

@app.put("/api/providers/{provider_id}")
def update_provider(provider_id: int, data: Dict[str, Any]):
    return {"id": provider_id, **data}

@app.post("/api/service-requests")
def create_service_request(data: Dict[str, Any]):
    req_id = next_ids["request"]
    next_ids["request"] += 1
    new_req = {
        "id": req_id,
        "user_id": int(data.get("user_id") or 1),
        "provider_id": int(data.get("provider_id") or 1),
        "service_type": data.get("service_type", "Maintenance"),
        "description": data.get("description", ""),
        "requested_date": data.get("requested_date", time.strftime("%Y-%m-%d")),
        "address": data.get("address", "Flat 402, Green Meadows, Mumbai"),
        "status": "Pending",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    service_requests_cache.append(new_req)

    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
            INSERT INTO service_requests (id, user_id, provider_id, service_type, description, requested_date, address, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
            """, (req_id, new_req["user_id"], new_req["provider_id"], new_req["service_type"], new_req["description"], new_req["requested_date"], new_req["address"], new_req["status"]))
        conn.close()
    except Exception:
        pass

    return new_req

@app.get("/api/service-requests/user/{user_id}")
def get_user_service_requests(user_id: int):
    return [r for r in service_requests_cache if r["user_id"] == user_id]

@app.get("/api/service-requests/provider/{provider_id}")
def get_provider_service_requests(provider_id: int):
    return [r for r in service_requests_cache if r["provider_id"] == provider_id]

@app.put("/api/service-requests/{request_id}/status")
def update_service_request_status(request_id: int, data: Dict[str, Any]):
    for r in service_requests_cache:
        if r["id"] == request_id:
            r["status"] = data.get("status", r["status"])
            return r
    return {"id": request_id, "status": data.get("status", "Updated")}

# 10. AC Appliance Simulator
class SimControl(BaseModel):
    action: Optional[str] = None
    scenario: Optional[str] = None
    speed_multiplier: Optional[int] = None
    target_temp: Optional[float] = None

@app.post("/api/simulator/ac/control")
def control_ac_simulator(data: SimControl):
    global ac_simulator_state
    if data.action == "start": ac_simulator_state["running"] = True
    if data.action == "stop": ac_simulator_state["running"] = False
    if data.action == "pause": ac_simulator_state["paused"] = True
    if data.action == "resume": ac_simulator_state["paused"] = False
    if data.scenario: ac_simulator_state["scenario"] = data.scenario
    if data.speed_multiplier: ac_simulator_state["speed_multiplier"] = data.speed_multiplier
    if data.target_temp: ac_simulator_state["target_temperature_c"] = data.target_temp
    return {"success": True, "state": ac_simulator_state}

@app.get("/api/simulator/ac/telemetry")
def get_ac_telemetry():
    return {
        "state": ac_simulator_state,
        "history": telemetry_buffer["ac_simulator"],
        "health": device_health["ac_simulator"],
    }

# 11. Laptop Monitoring Ingestion
class LaptopTelemetryInput(BaseModel):
    device_id: Optional[str] = "laptop_primary"
    device_name: Optional[str] = "Primary User Laptop"
    device_type: Optional[str] = "laptop"
    power_w: float
    voltage_v: float
    current_a: float
    energy_kwh: float
    temperature_c: Optional[float] = None
    operating_state: Optional[str] = "ACTIVE"
    metrics: Optional[Dict[str, Any]] = {}

@app.post("/api/telemetry/laptop")
async def receive_laptop_telemetry(data: LaptopTelemetryInput):
    reading_id = next_ids["telemetry"]
    next_ids["telemetry"] += 1
    reading = {
        "id": reading_id,
        "device_id": data.device_id,
        "device_name": data.device_name,
        "device_type": "laptop",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "power_w": round(data.power_w, 2),
        "voltage_v": round(data.voltage_v, 2),
        "current_a": round(data.current_a, 2),
        "energy_kwh": round(data.energy_kwh, 5),
        "temperature_c": data.temperature_c,
        "operating_state": data.operating_state,
        "power_measurement_type": "battery_side_measured",
        "metrics": data.metrics or {},
    }
    telemetry_buffer["laptop_primary"].append(reading)
    if len(telemetry_buffer["laptop_primary"]) > 60:
        telemetry_buffer["laptop_primary"].pop(0)

    await evaluate_device_health_pipeline("laptop_primary", reading)
    return {
        "success": True,
        "health_status": device_health["laptop_primary"]["health_status"],
        "anomaly_score": device_health["laptop_primary"]["anomaly_score"],
    }

# 12. Unified Device Monitoring
@app.get("/api/devices/monitoring")
def get_unified_device_monitoring():
    return {
        "devices": [
            {
                "device_id": "ac_simulator",
                "device_name": "Living Room AC (1.5 Ton)",
                "device_type": "ac_simulator",
                "latest_telemetry": telemetry_buffer["ac_simulator"][-1] if telemetry_buffer["ac_simulator"] else None,
                "history": telemetry_buffer["ac_simulator"],
                "health": device_health["ac_simulator"],
                "simulator_state": ac_simulator_state,
            },
            {
                "device_id": "laptop_primary",
                "device_name": "Primary User Laptop",
                "device_type": "laptop",
                "latest_telemetry": telemetry_buffer["laptop_primary"][-1] if telemetry_buffer["laptop_primary"] else None,
                "history": telemetry_buffer["laptop_primary"],
                "health": device_health["laptop_primary"],
            },
        ],
        "service_tickets": auto_service_tickets,
    }

# 13. Mistral AI Explanations & Chat
class MistralExplainInput(BaseModel):
    prompt: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

@app.post("/api/ai/mistral/explain")
async def explain_with_mistral(data: MistralExplainInput):
    explanation = await generate_mistral_explanation("anomaly_explanation", data.context or {"device_name": "Appliance"})
    return {"explanation": explanation}

class AIChatInput(BaseModel):
    message: str

@app.post("/api/ai/chat")
async def ai_chat(data: AIChatInput):
    explanation = await generate_mistral_explanation("general", {"query": data.message})
    return {"response": explanation, "conversation_id": 101}

# 14. Service Tickets
@app.get("/api/service-tickets")
def get_service_tickets():
    return auto_service_tickets

@app.get("/api/service-tickets/provider/{provider_id}")
def get_provider_tickets(provider_id: int):
    return [t for t in auto_service_tickets if t.get("provider_id") == provider_id]

class TicketStatusInput(BaseModel):
    status: str

@app.put("/api/service-tickets/{ticket_id}/status")
def update_ticket_status(ticket_id: int, data: TicketStatusInput):
    for ticket in auto_service_tickets:
        if ticket["id"] == ticket_id:
            ticket["status"] = data.status
            return ticket
    raise HTTPException(status_code=404, detail="Ticket not found")

# =================================================================
# Production Static SPA Mounting (Optional Standalone Container Mode)
# =================================================================
dist_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist")
if os.path.exists(dist_dir) and os.path.exists(os.path.join(dist_dir, "index.html")):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")
    logger.info(f"Production static assets mounted from {dist_dir}")
