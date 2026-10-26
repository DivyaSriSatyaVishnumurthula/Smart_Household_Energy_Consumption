import os
import logging
from dotenv import load_dotenv
import pymysql
from pymysql.cursors import DictCursor

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Database")

MYSQL_HOST = os.environ.get("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.environ.get("MYSQL_PORT", 3306))
MYSQL_USER = os.environ.get("MYSQL_USER", "root")
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "")
MYSQL_DB = os.environ.get("MYSQL_DATABASE", "smart_energy")

def get_raw_connection():
    """Connect to MySQL server (without selecting DB initially to ensure DB exists)."""
    return pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        autocommit=True,
        cursorclass=DictCursor,
        connect_timeout=5
    )

def get_db_connection():
    """Connect to smart_energy MySQL database."""
    return pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
        autocommit=True,
        cursorclass=DictCursor,
        connect_timeout=5
    )

def init_db():
    """Initialize MySQL database schema and default seed records."""
    try:
        raw_conn = get_raw_connection()
        with raw_conn.cursor() as cur:
            cur.execute(f"CREATE DATABASE IF NOT EXISTS `{MYSQL_DB}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        raw_conn.close()

        conn = get_db_connection()
        with conn.cursor() as cur:
            # Users table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                role ENUM('household', 'provider') NOT NULL DEFAULT 'household',
                phone VARCHAR(50),
                address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Households table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS households (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                home_type VARCHAR(100) DEFAULT 'Apartment',
                size_sqft INT DEFAULT 1200,
                occupants INT DEFAULT 4,
                location VARCHAR(100) DEFAULT 'Mumbai',
                monthly_budget DECIMAL(10, 2) DEFAULT 3500.00,
                solar_available BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Appliances table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS appliances (
                id INT AUTO_INCREMENT PRIMARY KEY,
                household_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                quantity INT DEFAULT 1,
                power_rating_watts DECIMAL(10, 2) DEFAULT 500.00,
                usage_hours_per_day DECIMAL(5, 2) DEFAULT 4.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Energy Readings table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS energy_readings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                household_id INT NOT NULL,
                date VARCHAR(20) NOT NULL,
                kwh DECIMAL(10, 3) NOT NULL,
                source VARCHAR(100) DEFAULT 'Grid Meter',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Household Bills table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS household_bills (
                id INT AUTO_INCREMENT PRIMARY KEY,
                household_id INT NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                units DECIMAL(10, 2) NOT NULL,
                billing_period VARCHAR(100) NOT NULL,
                tariff_rate DECIMAL(6, 2) DEFAULT 7.50,
                fixed_charges DECIMAL(8, 2) DEFAULT 250.00,
                taxes DECIMAL(8, 2) DEFAULT 120.00,
                other_charges DECIMAL(8, 2) DEFAULT 0.00,
                discom VARCHAR(255) DEFAULT 'Utility Provider',
                source VARCHAR(100) DEFAULT 'bill_analyzer',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
            """)

            # Providers table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS providers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                business_name VARCHAR(255) NOT NULL,
                categories TEXT NOT NULL,
                experience_years INT DEFAULT 5,
                location VARCHAR(100) DEFAULT 'Mumbai',
                base_price VARCHAR(100) DEFAULT '₹500 - ₹2000',
                description TEXT,
                availability_status VARCHAR(50) DEFAULT 'Available',
                rating DECIMAL(3, 2) DEFAULT 4.80,
                verified BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Service Requests table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS service_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                provider_id INT NOT NULL,
                service_type VARCHAR(255) NOT NULL,
                description TEXT,
                requested_date VARCHAR(20),
                address TEXT,
                status VARCHAR(50) DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # Seed default user if table is empty
            cur.execute("SELECT COUNT(*) AS cnt FROM users;")
            if cur.fetchone()["cnt"] == 0:
                cur.execute("""
                INSERT INTO users (id, email, password_hash, full_name, role, phone, address) VALUES
                (1, 'household@example.com', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'Alex Sharma', 'household', '+91 9876543210', 'Flat 402, Green Meadows, Mumbai'),
                (2, 'provider@example.com', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'CoolAir Technicians', 'provider', '+91 9811223344', 'Shop 14, High Street, Mumbai');
                """)

            # Seed default household if table is empty
            cur.execute("SELECT COUNT(*) AS cnt FROM households;")
            if cur.fetchone()["cnt"] == 0:
                cur.execute("""
                INSERT INTO households (id, user_id, home_type, size_sqft, occupants, location, monthly_budget, solar_available) VALUES
                (1, 1, 'Apartment', 1250, 4, 'Mumbai', 3500.00, FALSE);
                """)

            # Seed default appliances if table is empty
            cur.execute("SELECT COUNT(*) AS cnt FROM appliances;")
            if cur.fetchone()["cnt"] == 0:
                cur.execute("""
                INSERT INTO appliances (id, household_id, name, category, quantity, power_rating_watts, usage_hours_per_day) VALUES
                (1, 1, 'Air Conditioner (1.5 Ton)', 'Cooling', 1, 1800.00, 8.00),
                (2, 1, 'Double Door Refrigerator', 'Kitchen', 1, 350.00, 24.00),
                (3, 1, 'Washing Machine (Front Load)', 'Laundry', 1, 800.00, 1.00);
                """)

            # Seed default providers if table is empty
            cur.execute("SELECT COUNT(*) AS cnt FROM providers;")
            if cur.fetchone()["cnt"] == 0:
                cur.execute("""
                INSERT INTO providers (id, user_id, business_name, categories, experience_years, location, base_price, description, rating, verified) VALUES
                (1, 2, 'CoolAir Solutions', 'AC Service, HVAC Maintenance', 12, 'Mumbai', '₹500 - ₹2000', 'Certified AC servicing, inverter compressor checks, chemical coil washing.', 4.80, TRUE),
                (2, 2, 'Sparky Electricals', 'Electrical Maintenance, Appliance Repair', 8, 'Mumbai', '₹300 - ₹1500', 'Residential rewiring, smart energy sub-meters, appliance repair.', 4.90, TRUE);
                """)

        conn.close()
        logger.info("MySQL database initialized successfully.")
    except Exception as e:
        logger.warning(f"MySQL database initialization warning (running in resilient mode): {e}")

if __name__ == "__main__":
    init_db()
