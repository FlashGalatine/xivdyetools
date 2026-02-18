#!/usr/bin/env python3
"""
Fetch localized dye names from XIVAPI and generate a CSV file.

This script reads the colors_xiv.json file containing FFXIV dye data,
queries the XIVAPI v2 for each dye's name in multiple languages,
and outputs a CSV file with multilingual name data.

Usage:
    python fetch_dye_names.py

Output:
    scripts/output/dye_names.csv
"""

import csv
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

try:
    import requests
except ImportError:
    print("Error: 'requests' library not found.")
    print("Install it with: pip install -r requirements.txt")
    sys.exit(1)

# Configuration
API_BASE_URL = "https://v2.xivapi.com/api/sheet/Item"
LANGUAGES = ["en", "ja", "de", "fr"]
LANGUAGE_NAMES = {
    "en": "English",
    "ja": "Japanese",
    "de": "German",
    "fr": "French"
}
REQUEST_DELAY = 0.1  # 10 requests/sec = 0.1s between requests
MAX_RETRIES = 3
REQUEST_TIMEOUT = 10  # seconds

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
COLORS_JSON_PATH = PROJECT_ROOT.parent / "XIVDyeTools" / "assets" / "json" / "colors_xiv.json"
OUTPUT_DIR = SCRIPT_DIR / "output"
OUTPUT_CSV_PATH = OUTPUT_DIR / "dye_names.csv"


class DyeNameFetcher:
    """Fetches dye names from XIVAPI with rate limiting and error handling."""

    def __init__(self):
        self.session = requests.Session()
        self.failed_requests = []
        self.total_requests = 0
        self.successful_requests = 0

    def fetch_name(self, item_id: int, language: str, retry_count: int = 0) -> Optional[str]:
        """
        Fetch a single dye name from XIVAPI.

        Args:
            item_id: The item ID of the dye
            language: Language code (en, ja, de, fr)
            retry_count: Current retry attempt (internal)

        Returns:
            The dye name, or None if fetching failed
        """
        url = f"{API_BASE_URL}/{item_id}"
        params = {
            "language": language,
            "fields": "Name"
        }

        # Rate limiting
        time.sleep(REQUEST_DELAY)

        try:
            self.total_requests += 1
            response = self.session.get(url, params=params, timeout=REQUEST_TIMEOUT)

            # Handle rate limiting
            if response.status_code == 429:
                if retry_count < MAX_RETRIES:
                    wait_time = 2 ** retry_count  # Exponential backoff: 1s, 2s, 4s
                    print(f"  Rate limited (429). Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                    return self.fetch_name(item_id, language, retry_count + 1)
                else:
                    print(f"  Error: Rate limit exceeded for item {item_id} ({language})")
                    self.failed_requests.append((item_id, language, "Rate limit"))
                    return None

            # Handle not found
            if response.status_code == 404:
                print(f"  Warning: Item {item_id} not found ({language})")
                self.failed_requests.append((item_id, language, "Not found"))
                return None

            # Handle server errors
            if response.status_code >= 500:
                if retry_count < MAX_RETRIES:
                    wait_time = 2 ** retry_count
                    print(f"  Server error ({response.status_code}). Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    return self.fetch_name(item_id, language, retry_count + 1)
                else:
                    print(f"  Error: Server error for item {item_id} ({language})")
                    self.failed_requests.append((item_id, language, f"Server error {response.status_code}"))
                    return None

            # Success
            response.raise_for_status()
            data = response.json()

            # Extract name from response (nested in 'fields' object)
            fields = data.get("fields", {})
            name = fields.get("Name")
            if name:
                self.successful_requests += 1
                return name
            else:
                print(f"  Warning: No 'Name' field in response for item {item_id} ({language})")
                print(f"  Response structure: {data}")
                self.failed_requests.append((item_id, language, "Missing Name field"))
                return None

        except requests.exceptions.Timeout:
            if retry_count < MAX_RETRIES:
                print(f"  Timeout. Retrying... ({retry_count + 1}/{MAX_RETRIES})")
                return self.fetch_name(item_id, language, retry_count + 1)
            else:
                print(f"  Error: Timeout for item {item_id} ({language})")
                self.failed_requests.append((item_id, language, "Timeout"))
                return None

        except requests.exceptions.RequestException as e:
            print(f"  Error fetching item {item_id} ({language}): {e}")
            self.failed_requests.append((item_id, language, str(e)))
            return None

    def fetch_all_languages(self, item_id: int) -> Dict[str, Optional[str]]:
        """
        Fetch a dye's name in all languages.

        Args:
            item_id: The item ID of the dye

        Returns:
            Dictionary mapping language codes to names
        """
        names = {}
        for lang in LANGUAGES:
            names[lang] = self.fetch_name(item_id, lang)
        return names


def load_dye_data() -> List[int]:
    """
    Load dye data from colors_xiv.json and extract item IDs.

    Returns:
        List of item IDs
    """
    if not COLORS_JSON_PATH.exists():
        print(f"Error: Could not find {COLORS_JSON_PATH}")
        print(f"Make sure you're running this script from the xivdyetools-core directory")
        sys.exit(1)

    print(f"Loading dye data from {COLORS_JSON_PATH}")

    try:
        with open(COLORS_JSON_PATH, 'r', encoding='utf-8') as f:
            dyes = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Failed to parse JSON: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: Failed to read file: {e}")
        sys.exit(1)

    if not isinstance(dyes, list):
        print("Error: Expected JSON array at root level")
        sys.exit(1)

    # Extract item IDs
    item_ids = []
    for dye in dyes:
        if "itemID" not in dye:
            print(f"Warning: Dye entry missing 'itemID': {dye}")
            continue
        item_ids.append(dye["itemID"])

    return item_ids


def generate_csv(dye_data: List[Dict]) -> None:
    """
    Generate CSV file with dye names.

    Args:
        dye_data: List of dictionaries containing itemID and names
    """
    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\nGenerating CSV: {OUTPUT_CSV_PATH}")

    try:
        with open(OUTPUT_CSV_PATH, 'w', newline='', encoding='utf-8') as csvfile:
            # Define columns
            fieldnames = ['itemID', 'English Name', 'Japanese Name', 'German Name', 'French Name']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

            # Write header
            writer.writeheader()

            # Write data rows
            for dye in dye_data:
                row = {
                    'itemID': dye['itemID'],
                    'English Name': dye['names'].get('en', ''),
                    'Japanese Name': dye['names'].get('ja', ''),
                    'German Name': dye['names'].get('de', ''),
                    'French Name': dye['names'].get('fr', '')
                }
                writer.writerow(row)

        print(f"CSV generated successfully: {OUTPUT_CSV_PATH}")

    except Exception as e:
        print(f"Error writing CSV: {e}")
        sys.exit(1)


def main():
    """Main script execution."""
    print("=" * 70)
    print("FFXIV Dye Name Fetcher")
    print("=" * 70)
    print()

    start_time = datetime.now()

    # Load dye data
    item_ids = load_dye_data()
    print(f"Found {len(item_ids)} dyes to process")

    # Calculate estimates
    total_requests = len(item_ids) * len(LANGUAGES)
    estimated_seconds = total_requests * REQUEST_DELAY
    print(f"Fetching names in {len(LANGUAGES)} languages ({', '.join(LANGUAGES)})")
    print(f"Total requests: {total_requests}")
    print(f"Estimated time: ~{estimated_seconds:.0f} seconds")
    print()

    # Initialize fetcher
    fetcher = DyeNameFetcher()

    # Fetch names for each dye
    dye_data = []
    for index, item_id in enumerate(item_ids, start=1):
        # Progress update every 10 dyes
        if index % 10 == 0 or index == 1:
            progress_pct = (index / len(item_ids)) * 100
            print(f"Processing dye {index}/{len(item_ids)}... ({progress_pct:.0f}%)")

        # Fetch all language names
        names = fetcher.fetch_all_languages(item_id)

        dye_data.append({
            'itemID': item_id,
            'names': names
        })

    # Generate CSV
    generate_csv(dye_data)

    # Print summary
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    print()
    print("=" * 70)
    print("Summary")
    print("=" * 70)
    print(f"Total dyes processed: {len(item_ids)}")
    print(f"Total requests made: {fetcher.total_requests}")
    print(f"Successful requests: {fetcher.successful_requests}")
    print(f"Failed requests: {len(fetcher.failed_requests)}")
    print(f"Total time: {duration:.1f} seconds")

    if fetcher.failed_requests:
        print()
        print("Failed requests:")
        for item_id, lang, reason in fetcher.failed_requests:
            print(f"  - Item {item_id} ({lang}): {reason}")

    print()
    print(f"Output: {OUTPUT_CSV_PATH}")
    print("=" * 70)

    # Exit with appropriate code
    sys.exit(0 if len(fetcher.failed_requests) == 0 else 1)


if __name__ == "__main__":
    main()
