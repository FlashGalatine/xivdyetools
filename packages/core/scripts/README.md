# XIVDyeTools Scripts

Utility scripts for data processing and maintenance tasks.

## Scripts

### fetch_dye_names.py

Fetches localized dye names from XIVAPI v2 and generates a CSV file with multilingual name data.

#### Purpose

This script queries the XIVAPI for each FFXIV dye item in the `colors_xiv.json` database and retrieves the official name in four languages: English, Japanese, German, and French. The output is a CSV file that can be used for localization, data validation, or integration with other tools.

#### Requirements

- Python 3.7+
- `requests` library (see [requirements.txt](requirements.txt))

#### Installation

From the `xivdyetools-core` directory:

```bash
pip install -r scripts/requirements.txt
```

Or install directly:

```bash
pip install requests
```

#### Usage

```bash
# From the xivdyetools-core directory
cd xivdyetools-core

# Run the script
python scripts/fetch_dye_names.py
```

#### Expected Output

```
======================================================================
FFXIV Dye Name Fetcher
======================================================================

Loading dye data from ..\XIVDyeTools\assets\json\colors_xiv.json
Found 136 dyes to process
Fetching names in 4 languages (en, ja, de, fr)
Total requests: 544
Estimated time: ~54 seconds

Processing dye 1/136... (1%)
Processing dye 10/136... (7%)
Processing dye 20/136... (15%)
...
Processing dye 130/136... (96%)
Processing dye 136/136... (100%)

Generating CSV: scripts\output\dye_names.csv
CSV generated successfully: scripts\output\dye_names.csv

======================================================================
Summary
======================================================================
Total dyes processed: 136
Total requests made: 544
Successful requests: 544
Failed requests: 0
Total time: 54.8 seconds

Output: scripts\output\dye_names.csv
======================================================================
```

#### Output Format

The script generates a CSV file at `scripts/output/dye_names.csv` with the following columns:

| Column | Description |
|--------|-------------|
| `itemID` | FFXIV item ID for the dye |
| `English Name` | Dye name in English |
| `Japanese Name` | Dye name in Japanese |
| `German Name` | Dye name in German |
| `French Name` | Dye name in French |

Example:

```csv
itemID,English Name,Japanese Name,German Name,French Name
5729,Snow White,スノウホワイト,Schneeweiß,Blanc neige
5730,Ash Grey,アッシュグレイ,Aschgrau,Gris cendré
5731,Goobbue Grey,グゥーブーグレイ,Goobbue-Grau,Gris goobbue
...
```

The CSV is UTF-8 encoded to properly handle international characters.

#### Configuration

Key configuration constants in the script:

- **API Endpoint**: `https://v2.xivapi.com/api/sheet/Item/{itemID}`
- **Languages**: `['en', 'ja', 'de', 'fr']`
- **Rate Limit**: 10 requests/second (conservative, API allows 20/sec)
- **Request Timeout**: 10 seconds per request
- **Max Retries**: 3 retries with exponential backoff

#### Error Handling

The script includes robust error handling:

- **Rate Limiting (HTTP 429)**: Automatic retry with exponential backoff
- **Server Errors (HTTP 5xx)**: Retry up to 3 times with increasing delays
- **Not Found (HTTP 404)**: Logs warning and continues
- **Network Timeouts**: Retry up to 3 times
- **Network Errors**: Logs error and continues to next item

Failed requests are logged in the summary output and the script continues processing remaining dyes.

#### Troubleshooting

**Error: 'requests' library not found**
```bash
pip install -r scripts/requirements.txt
```

**Error: Could not find colors_xiv.json**

Make sure you run the script from the `xivdyetools-core` directory:
```bash
cd xivdyetools-core
python scripts/fetch_dye_names.py
```

**HTTP 429 Rate Limit Errors**

The script automatically handles rate limiting with retries and backoff. If you continue to see errors, the API may be experiencing issues. Try again later.

**Incomplete Data / Missing Names**

Check the summary output for failed requests. Common causes:
- Item doesn't exist in XIVAPI database
- API temporary unavailability
- Network connectivity issues

Rerun the script to retry failed requests.

**Character Encoding Issues**

The CSV is saved with UTF-8 encoding. When opening in Excel:
1. Use "Data" → "From Text/CSV"
2. Select UTF-8 encoding
3. Import the file

Or open directly in Google Sheets, VS Code, or other UTF-8-compatible tools.

#### Performance

- **Total Requests**: 544 (136 dyes × 4 languages)
- **Rate Limit**: 10 requests/second
- **Expected Runtime**: ~55 seconds
- **Network Dependency**: Requires active internet connection

#### API Reference

The script uses XIVAPI v2:
- **Base URL**: https://v2.xivapi.com
- **Endpoint**: `/api/sheet/Item/{itemID}`
- **Parameters**:
  - `language`: `en`, `ja`, `de`, or `fr`
  - `fields`: `Name` (only fetch the name field)
- **Rate Limit**: 20 requests/second (script uses 10/sec)
- **Documentation**: https://v2.xivapi.com/docs

#### License

Part of the XIVDyeTools monorepo. See root LICENSE file.
