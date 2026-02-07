## PRD: SensorLog + Tailscale Bridge Integration

### Overview
Build a bridge service that connects to **SensorLog** (iOS) over a **Tailscale** network and streams sensor data (GPS, motion, etc.) to downstream systems.  No app development required — leverages SensorLog’s built-in TCP socket server. 

### Core Functionality
- **Connect to SensorLog**: The bridge connects via TCP to the iPhone’s Tailscale IP and SensorLog socket (e.g., port 56204). 
- **Parse CSV Stream**: SensorLog outputs comma-separated values with timestamps, GPS, accelerometer, gyroscope, magnetometer, battery, and device motion. 
- **Forward Data**: Bridge transforms and forwards data to destinations (e.g., MQTT, HTTP, database, Grafana). 
- **Auto-Reconnect**: Handles iPhone sleep, network changes, or app restarts.

### Data Flow
1. SensorLog → TCP socket (server mode) → Tailscale tunnel
2. Bridge → `nc <iPhone_Tailscale_IP> 56204` → reads CSV stream
3. Bridge → parses, enriches, forwards (JSON to MQTT/HTTP) 

### Example Output (CSV)
```
loggingTime,latitude,longitude,altitude,accuracy,horizontalAccuracy,verticalAccuracy,speed,speedAccuracy,heading,headingAccuracy,x-accel,y-accel,z-accel,x-gyro,y-gyro,z-gyro,...
2026-02-07T10:00:00.123Z,37.7749,-122.4194,5.0,10.0,8.0,15.0,0.5,0.2,270.0,5.0,0.01,-0.02,9.81,0.001,-0.002,0.000,...
```

### Bridge Requirements
- **Language**: Python, Node.js, or Go
- **Dependencies**: Tailscale auth, netcat/TCP client, CSV parser
- **Resilience**: Reconnect on disconnect, buffer during outages
- **Security**: Runs within Tailscale tailnet; no public exposure

### Deployment
- Run bridge on any Tailscale-connected device (Raspberry Pi, server, laptop).
- Configure SensorLog: Enable “TCP Server”, set port, select sensors.
- Start bridge: `python sensorbridge.py --ip 100.x.y.z --port 56204 --mqtt`



