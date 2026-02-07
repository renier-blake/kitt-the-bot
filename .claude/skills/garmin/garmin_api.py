#!/usr/bin/env python3
"""
Garmin Connect API wrapper for Moltbot.
Full access to health, fitness, and workout data.
"""

import json
import os
import sys
from datetime import date, datetime, timedelta

try:
    from garminconnect import Garmin
except ImportError:
    print(json.dumps({"error": "garminconnect not installed. Run: pip3 install garminconnect"}))
    sys.exit(1)

TOKEN_DIR = os.path.expanduser("~/.garminconnect")


def get_client():
    """Get authenticated Garmin client."""
    if not os.path.exists(TOKEN_DIR):
        print(json.dumps({"error": "Not logged in. Run: python3 garmin_login.py"}))
        sys.exit(1)
    
    try:
        client = Garmin()
        client.login(TOKEN_DIR)
        # Verify session is valid
        client.display_name
        return client
    except Exception as e:
        print(json.dumps({"error": f"Session expired or invalid: {e}. Run: python3 garmin_login.py"}))
        sys.exit(1)


def parse_date(date_str=None):
    """Parse date string or return today."""
    if not date_str:
        return date.today()
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return date.today()


def cmd_today(client, args):
    """Get today's summary - steps, HR, sleep, stress, calories."""
    d = parse_date(args[0] if args else None)
    
    result = {
        "date": str(d),
        "steps": None,
        "heart_rate": None,
        "sleep": None,
        "stress": None,
        "body_battery": None,
        "calories": None,
        "active_minutes": None,
        "floors": None,
        "distance_km": None,
    }
    
    try:
        stats = client.get_stats(d.isoformat())
        result["steps"] = stats.get("totalSteps")
        result["calories"] = stats.get("totalKilocalories")
        result["active_minutes"] = stats.get("activeMinutes") or stats.get("moderateIntensityMinutes", 0) + stats.get("vigorousIntensityMinutes", 0)
        result["floors"] = stats.get("floorsAscended")
        result["distance_km"] = round(stats.get("totalDistanceMeters", 0) / 1000, 2) if stats.get("totalDistanceMeters") else None
        result["heart_rate"] = {
            "resting": stats.get("restingHeartRate"),
            "min": stats.get("minHeartRate"),
            "max": stats.get("maxHeartRate"),
        }
        result["stress"] = {
            "avg": stats.get("averageStressLevel"),
            "max": stats.get("maxStressLevel"),
        }
        result["body_battery"] = {
            "high": stats.get("bodyBatteryHighestValue"),
            "low": stats.get("bodyBatteryLowestValue"),
        }
    except Exception as e:
        result["stats_error"] = str(e)
    
    try:
        sleep = client.get_sleep_data(d.isoformat())
        if sleep and sleep.get("dailySleepDTO"):
            s = sleep["dailySleepDTO"]
            result["sleep"] = {
                "duration_hours": round(s.get("sleepTimeSeconds", 0) / 3600, 1),
                "quality": s.get("sleepScores", {}).get("overall", {}).get("value"),
                "deep_hours": round(s.get("deepSleepSeconds", 0) / 3600, 1),
                "light_hours": round(s.get("lightSleepSeconds", 0) / 3600, 1),
                "rem_hours": round(s.get("remSleepSeconds", 0) / 3600, 1),
                "awake_hours": round(s.get("awakeSleepSeconds", 0) / 3600, 1),
            }
    except Exception as e:
        result["sleep_error"] = str(e)
    
    return result


def cmd_steps(client, args):
    """Get step count."""
    d = parse_date(args[0] if args else None)
    stats = client.get_stats(d.isoformat())
    return {
        "date": str(d),
        "steps": stats.get("totalSteps"),
        "goal": stats.get("dailyStepGoal"),
        "distance_km": round(stats.get("totalDistanceMeters", 0) / 1000, 2) if stats.get("totalDistanceMeters") else None,
    }


def cmd_hr(client, args):
    """Get heart rate data."""
    d = parse_date(args[0] if args else None)
    stats = client.get_stats(d.isoformat())
    
    result = {
        "date": str(d),
        "resting": stats.get("restingHeartRate"),
        "min": stats.get("minHeartRate"),
        "max": stats.get("maxHeartRate"),
        "avg": stats.get("averageHeartRate"),
    }
    
    # Try to get detailed HR data
    try:
        hr_data = client.get_heart_rates(d.isoformat())
        if hr_data:
            result["time_in_zones"] = hr_data.get("heartRateTimeInZones")
    except:
        pass
    
    return result


def cmd_hrv(client, args):
    """Get HRV (Heart Rate Variability) data."""
    d = parse_date(args[0] if args else None)
    try:
        hrv = client.get_hrv_data(d.isoformat())
        if hrv:
            return {
                "date": str(d),
                "hrv_weekly_avg": hrv.get("hrvSummary", {}).get("weeklyAvg"),
                "hrv_last_night": hrv.get("hrvSummary", {}).get("lastNight"),
                "hrv_baseline": hrv.get("hrvSummary", {}).get("baseline"),
                "status": hrv.get("hrvSummary", {}).get("status"),
            }
        return {"date": str(d), "error": "No HRV data available"}
    except Exception as e:
        return {"date": str(d), "error": str(e)}


def cmd_sleep(client, args):
    """Get detailed sleep data."""
    d = parse_date(args[0] if args else None)
    try:
        sleep = client.get_sleep_data(d.isoformat())
        if sleep and sleep.get("dailySleepDTO"):
            s = sleep["dailySleepDTO"]
            return {
                "date": str(d),
                "duration_hours": round(s.get("sleepTimeSeconds", 0) / 3600, 1),
                "quality_score": s.get("sleepScores", {}).get("overall", {}).get("value"),
                "quality_qualifier": s.get("sleepScores", {}).get("overall", {}).get("qualifierKey"),
                "deep_hours": round(s.get("deepSleepSeconds", 0) / 3600, 1),
                "light_hours": round(s.get("lightSleepSeconds", 0) / 3600, 1),
                "rem_hours": round(s.get("remSleepSeconds", 0) / 3600, 1),
                "awake_hours": round(s.get("awakeSleepSeconds", 0) / 3600, 1),
                "avg_spo2": s.get("avgOxygenSaturation"),
                "avg_respiration": s.get("avgRespirationValue"),
                "avg_stress": s.get("avgSleepStress"),
                "sleep_start": s.get("sleepStartTimestampLocal"),
                "sleep_end": s.get("sleepEndTimestampLocal"),
            }
        return {"date": str(d), "error": "No sleep data available"}
    except Exception as e:
        return {"date": str(d), "error": str(e)}


def cmd_stress(client, args):
    """Get stress data."""
    d = parse_date(args[0] if args else None)
    stats = client.get_stats(d.isoformat())
    return {
        "date": str(d),
        "avg_stress": stats.get("averageStressLevel"),
        "max_stress": stats.get("maxStressLevel"),
        "stress_qualifier": stats.get("stressQualifier"),
        "body_battery_high": stats.get("bodyBatteryHighestValue"),
        "body_battery_low": stats.get("bodyBatteryLowestValue"),
        "body_battery_charged": stats.get("bodyBatteryChargedValue"),
        "body_battery_drained": stats.get("bodyBatteryDrainedValue"),
    }


def cmd_body(client, args):
    """Get body composition data."""
    try:
        # Get latest weigh-in
        end = date.today()
        start = end - timedelta(days=30)
        weight_data = client.get_weigh_ins(start.isoformat(), end.isoformat())
        
        result = {"date": str(end)}
        
        if weight_data and weight_data.get("dailyWeightSummaries"):
            latest = weight_data["dailyWeightSummaries"][0]
            result["weight_kg"] = round(latest.get("summaryDate", {}).get("weight", 0) / 1000, 1) if latest.get("summaryDate", {}).get("weight") else None
            result["bmi"] = latest.get("summaryDate", {}).get("bmi")
            result["body_fat_pct"] = latest.get("summaryDate", {}).get("bodyFat")
            result["muscle_mass_kg"] = round(latest.get("summaryDate", {}).get("muscleMass", 0) / 1000, 1) if latest.get("summaryDate", {}).get("muscleMass") else None
            result["bone_mass_kg"] = round(latest.get("summaryDate", {}).get("boneMass", 0) / 1000, 1) if latest.get("summaryDate", {}).get("boneMass") else None
            result["body_water_pct"] = latest.get("summaryDate", {}).get("bodyWater")
        
        return result
    except Exception as e:
        return {"error": str(e)}


def cmd_activities(client, args):
    """Get recent activities."""
    limit = int(args[0]) if args else 5
    try:
        activities = client.get_activities(0, limit)
        result = []
        for act in activities:
            result.append({
                "id": act.get("activityId"),
                "name": act.get("activityName"),
                "type": act.get("activityType", {}).get("typeKey"),
                "date": act.get("startTimeLocal"),
                "duration_min": round(act.get("duration", 0) / 60, 1),
                "distance_km": round(act.get("distance", 0) / 1000, 2) if act.get("distance") else None,
                "calories": act.get("calories"),
                "avg_hr": act.get("averageHR"),
                "max_hr": act.get("maxHR"),
                "avg_pace_min_km": round(act.get("averageSpeed", 0) * 60 / 1000, 2) if act.get("averageSpeed") else None,
            })
        return {"activities": result}
    except Exception as e:
        return {"error": str(e)}


def cmd_activity(client, args):
    """Get detailed activity data."""
    if not args:
        return {"error": "Activity ID required"}
    
    activity_id = args[0]
    try:
        act = client.get_activity(activity_id)
        
        result = {
            "id": act.get("activityId"),
            "name": act.get("activityName"),
            "type": act.get("activityType", {}).get("typeKey"),
            "date": act.get("startTimeLocal"),
            "duration_min": round(act.get("duration", 0) / 60, 1),
            "distance_km": round(act.get("distance", 0) / 1000, 2) if act.get("distance") else None,
            "calories": act.get("calories"),
            "elevation_gain_m": act.get("elevationGain"),
            "avg_hr": act.get("averageHR"),
            "max_hr": act.get("maxHR"),
            "avg_cadence": act.get("averageRunningCadenceInStepsPerMinute"),
            "avg_stride_length_m": act.get("avgStrideLength"),
            "training_effect_aerobic": act.get("aerobicTrainingEffect"),
            "training_effect_anaerobic": act.get("anaerobicTrainingEffect"),
            "vo2max_running": act.get("vO2MaxValue"),
        }
        
        # Pace data for running
        if act.get("averageSpeed"):
            pace_sec_per_km = 1000 / act.get("averageSpeed")
            result["avg_pace"] = f"{int(pace_sec_per_km // 60)}:{int(pace_sec_per_km % 60):02d} /km"
        
        # HR zones
        if act.get("hrZones"):
            result["hr_zones"] = act.get("hrZones")
        
        return result
    except Exception as e:
        return {"error": str(e)}


def cmd_running(client, args):
    """Get recent running activities with detailed stats."""
    limit = int(args[0]) if args else 10
    try:
        # Get running activities
        activities = client.get_activities_by_date(
            (date.today() - timedelta(days=90)).isoformat(),
            date.today().isoformat(),
            "running"
        )
        
        result = []
        for act in activities[:limit]:
            pace_str = None
            if act.get("averageSpeed") and act.get("averageSpeed") > 0:
                pace_sec = 1000 / act.get("averageSpeed")
                pace_str = f"{int(pace_sec // 60)}:{int(pace_sec % 60):02d} /km"
            
            result.append({
                "id": act.get("activityId"),
                "name": act.get("activityName"),
                "date": act.get("startTimeLocal"),
                "distance_km": round(act.get("distance", 0) / 1000, 2) if act.get("distance") else None,
                "duration_min": round(act.get("duration", 0) / 60, 1),
                "avg_pace": pace_str,
                "avg_hr": act.get("averageHR"),
                "max_hr": act.get("maxHR"),
                "calories": act.get("calories"),
                "cadence": act.get("averageRunningCadenceInStepsPerMinute"),
                "elevation_gain": act.get("elevationGain"),
                "training_effect": act.get("aerobicTrainingEffect"),
            })
        
        return {
            "count": len(result),
            "runs": result
        }
    except Exception as e:
        return {"error": str(e)}


def cmd_training_status(client, args):
    """Get training status and readiness."""
    try:
        # Training status
        training = client.get_training_status(date.today().isoformat())
        
        result = {
            "date": str(date.today()),
        }
        
        if training:
            result["training_load"] = training.get("trainingLoad7Day")
            result["training_load_balance"] = training.get("trainingLoadBalance")
            result["training_status"] = training.get("trainingStatus")
            result["vo2max_running"] = training.get("vo2MaxPreciseValue")
            result["lactate_threshold_hr"] = training.get("lactateThresholdHeartRate")
        
        return result
    except Exception as e:
        return {"error": str(e)}


def cmd_training_readiness(client, args):
    """Get training readiness score."""
    d = parse_date(args[0] if args else None)
    try:
        readiness = client.get_training_readiness(d.isoformat())
        if readiness:
            return {
                "date": str(d),
                "score": readiness.get("score"),
                "level": readiness.get("level"),
                "sleep_score": readiness.get("sleepScore"),
                "recovery_score": readiness.get("recoveryScore"),
                "hrv_score": readiness.get("hrvScore"),
                "stress_score": readiness.get("stressScore"),
                "training_load_score": readiness.get("trainingLoadScore"),
            }
        return {"date": str(d), "error": "No training readiness data"}
    except Exception as e:
        return {"date": str(d), "error": str(e)}


def cmd_vo2max(client, args):
    """Get VO2 Max history."""
    try:
        end = date.today()
        start = end - timedelta(days=365)
        vo2 = client.get_max_metrics(start.isoformat(), end.isoformat())
        
        if vo2 and vo2.get("maxMetricsDTO"):
            latest = vo2["maxMetricsDTO"][0] if isinstance(vo2["maxMetricsDTO"], list) else vo2["maxMetricsDTO"]
            return {
                "vo2max_running": latest.get("generic", {}).get("vo2MaxPreciseValue"),
                "vo2max_cycling": latest.get("cycling", {}).get("vo2MaxPreciseValue"),
                "fitness_age": latest.get("generic", {}).get("fitnessAge"),
                "updated": latest.get("calendarDate"),
            }
        return {"error": "No VO2 Max data available"}
    except Exception as e:
        return {"error": str(e)}


def cmd_race_predictions(client, args):
    """Get race time predictions."""
    try:
        predictions = client.get_race_predictions()
        if predictions:
            return {
                "5k": predictions.get("racePredictions", {}).get("5k", {}).get("time"),
                "10k": predictions.get("racePredictions", {}).get("10k", {}).get("time"),
                "half_marathon": predictions.get("racePredictions", {}).get("halfMarathon", {}).get("time"),
                "marathon": predictions.get("racePredictions", {}).get("marathon", {}).get("time"),
            }
        return {"error": "No race predictions available"}
    except Exception as e:
        return {"error": str(e)}


def cmd_devices(client, args):
    """Get connected devices."""
    try:
        devices = client.get_devices()
        result = []
        for d in devices:
            result.append({
                "id": d.get("deviceId"),
                "name": d.get("deviceName") or d.get("productDisplayName"),
                "type": d.get("deviceTypeName"),
                "battery": d.get("batteryLevel"),
                "last_sync": d.get("lastSyncTimestampGMT"),
            })
        return {"devices": result}
    except Exception as e:
        return {"error": str(e)}


def cmd_week(client, args):
    """Get weekly summary."""
    try:
        end = date.today()
        start = end - timedelta(days=7)
        
        result = {
            "period": f"{start} to {end}",
            "days": []
        }
        
        total_steps = 0
        total_calories = 0
        total_active_min = 0
        total_distance = 0
        
        for i in range(7):
            d = start + timedelta(days=i)
            try:
                stats = client.get_stats(d.isoformat())
                steps = stats.get("totalSteps", 0) or 0
                cals = stats.get("totalKilocalories", 0) or 0
                active = (stats.get("moderateIntensityMinutes", 0) or 0) + (stats.get("vigorousIntensityMinutes", 0) or 0)
                dist = stats.get("totalDistanceMeters", 0) or 0
                
                total_steps += steps
                total_calories += cals
                total_active_min += active
                total_distance += dist
                
                result["days"].append({
                    "date": str(d),
                    "steps": steps,
                    "calories": cals,
                    "active_min": active,
                })
            except:
                pass
        
        result["totals"] = {
            "steps": total_steps,
            "avg_steps": total_steps // 7,
            "calories": total_calories,
            "active_minutes": total_active_min,
            "distance_km": round(total_distance / 1000, 1),
        }
        
        return result
    except Exception as e:
        return {"error": str(e)}


def cmd_badges(client, args):
    """Get earned badges."""
    try:
        badges = client.get_earned_badges()
        result = []
        for b in badges[:20]:  # Limit to recent 20
            result.append({
                "name": b.get("badgeName"),
                "earned_date": b.get("badgeEarnedDate"),
                "points": b.get("badgePoints"),
            })
        return {"badges": result}
    except Exception as e:
        return {"error": str(e)}


def cmd_personal_records(client, args):
    """Get personal records."""
    try:
        records = client.get_personal_record()
        result = []
        for r in records:
            result.append({
                "type": r.get("typeKey"),
                "value": r.get("value"),
                "activity_id": r.get("activityId"),
                "date": r.get("prStartTimeGMT"),
            })
        return {"records": result}
    except Exception as e:
        return {"error": str(e)}


def cmd_spo2(client, args):
    """Get SpO2 (blood oxygen) data."""
    d = parse_date(args[0] if args else None)
    try:
        spo2 = client.get_spo2_data(d.isoformat())
        if spo2:
            return {
                "date": str(d),
                "avg_spo2": spo2.get("averageSpO2"),
                "min_spo2": spo2.get("lowestSpO2"),
                "max_spo2": spo2.get("highestSpO2"),
            }
        return {"date": str(d), "error": "No SpO2 data available"}
    except Exception as e:
        return {"date": str(d), "error": str(e)}


def cmd_respiration(client, args):
    """Get respiration data."""
    d = parse_date(args[0] if args else None)
    try:
        resp = client.get_respiration_data(d.isoformat())
        if resp:
            return {
                "date": str(d),
                "avg_breaths_per_min": resp.get("avgWakingRespirationValue"),
                "min_breaths": resp.get("lowestRespirationValue"),
                "max_breaths": resp.get("highestRespirationValue"),
            }
        return {"date": str(d), "error": "No respiration data available"}
    except Exception as e:
        return {"date": str(d), "error": str(e)}


def cmd_hydration(client, args):
    """Get hydration data."""
    d = parse_date(args[0] if args else None)
    try:
        hydration = client.get_hydration_data(d.isoformat())
        if hydration:
            return {
                "date": str(d),
                "intake_ml": hydration.get("intakeGoalInMilliliters"),
                "goal_ml": hydration.get("dailyGoalInMilliliters"),
                "sweat_loss_ml": hydration.get("sweatLossInMilliliters"),
            }
        return {"date": str(d), "error": "No hydration data available"}
    except Exception as e:
        return {"date": str(d), "error": str(e)}


# Command mapping
COMMANDS = {
    "today": cmd_today,
    "steps": cmd_steps,
    "hr": cmd_hr,
    "heart": cmd_hr,
    "hrv": cmd_hrv,
    "sleep": cmd_sleep,
    "stress": cmd_stress,
    "body": cmd_body,
    "weight": cmd_body,
    "activities": cmd_activities,
    "activity": cmd_activity,
    "running": cmd_running,
    "runs": cmd_running,
    "training": cmd_training_status,
    "readiness": cmd_training_readiness,
    "vo2max": cmd_vo2max,
    "vo2": cmd_vo2max,
    "race": cmd_race_predictions,
    "predictions": cmd_race_predictions,
    "devices": cmd_devices,
    "week": cmd_week,
    "weekly": cmd_week,
    "badges": cmd_badges,
    "records": cmd_personal_records,
    "pr": cmd_personal_records,
    "spo2": cmd_spo2,
    "oxygen": cmd_spo2,
    "respiration": cmd_respiration,
    "breathing": cmd_respiration,
    "hydration": cmd_hydration,
    "water": cmd_hydration,
}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "No command specified",
            "available_commands": list(set(COMMANDS.keys())),
        }, indent=2))
        sys.exit(1)
    
    cmd = sys.argv[1].lower()
    args = sys.argv[2:]
    
    if cmd == "help":
        print(json.dumps({
            "commands": {
                "today [date]": "Daily summary (steps, HR, sleep, stress)",
                "steps [date]": "Step count and distance",
                "hr [date]": "Heart rate data",
                "hrv [date]": "Heart rate variability",
                "sleep [date]": "Detailed sleep data",
                "stress [date]": "Stress and body battery",
                "body": "Body composition (weight, BMI, body fat)",
                "activities [limit]": "Recent activities",
                "activity <id>": "Detailed activity data",
                "running [limit]": "Recent running activities",
                "training": "Training status and load",
                "readiness [date]": "Training readiness score",
                "vo2max": "VO2 Max history",
                "race": "Race time predictions",
                "devices": "Connected devices",
                "week": "Weekly summary",
                "badges": "Earned badges",
                "records": "Personal records",
                "spo2 [date]": "Blood oxygen data",
                "respiration [date]": "Breathing rate",
                "hydration [date]": "Water intake",
            }
        }, indent=2))
        sys.exit(0)
    
    if cmd not in COMMANDS:
        print(json.dumps({
            "error": f"Unknown command: {cmd}",
            "available": list(set(COMMANDS.keys())),
        }))
        sys.exit(1)
    
    client = get_client()
    result = COMMANDS[cmd](client, args)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
