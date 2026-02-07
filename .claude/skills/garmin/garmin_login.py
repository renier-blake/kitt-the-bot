#!/usr/bin/env python3
"""
Garmin Connect Login Script
Authenticates with Garmin Connect and stores tokens for future use.
"""

import os
import sys
from getpass import getpass
from pathlib import Path

try:
    from garminconnect import Garmin
    import garth
except ImportError:
    print("Error: garminconnect not installed")
    print("Run: pip3 install garminconnect")
    sys.exit(1)

TOKEN_DIR = Path.home() / ".garminconnect"


def prompt_mfa():
    """MFA prompt callback."""
    return input("Enter MFA code: ")


def main():
    print("🔐 Garmin Connect Login")
    print("=" * 40)
    
    # Check for existing tokens first
    if TOKEN_DIR.exists() and list(TOKEN_DIR.glob("*.json")):
        print(f"Found existing tokens in {TOKEN_DIR}")
        try:
            garmin = Garmin()
            garmin.login(str(TOKEN_DIR))
            name = garmin.get_full_name()
            print(f"✅ Already logged in as: {name}")
            return
        except Exception as e:
            print(f"Existing tokens invalid ({e}), need fresh login...")
    
    email = input("Email: ")
    password = getpass("Password: ")
    
    try:
        # Use garth directly for MFA support
        garth.configure(domain="garmin.com")
        garth.login(email, password, prompt_mfa=prompt_mfa)
        
        # Save tokens
        TOKEN_DIR.mkdir(mode=0o700, exist_ok=True)
        garth.save(str(TOKEN_DIR))
        
        # Set restrictive permissions
        for f in TOKEN_DIR.iterdir():
            f.chmod(0o600)
        
        # Verify with garminconnect
        garmin = Garmin()
        garmin.login(str(TOKEN_DIR))
        
        print("\n✅ Login successful!")
        print(f"   Tokens saved to: {TOKEN_DIR}")
        
        name = garmin.get_full_name()
        print(f"   Logged in as: {name}")
        
    except Exception as e:
        print(f"\n❌ Login failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
