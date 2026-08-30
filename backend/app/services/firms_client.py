import os
import io
import httpx
import pandas as pd
from datetime import datetime, date

class FirmsClient:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("FIRMS_MAP_KEY")
        if not self.api_key:
            raise ValueError("NASA FIRMS MAP_KEY is not configured.")
        self.base_url = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
        # India Bounding Box: West=68.0, South=6.0, East=97.0, North=36.0
        self.india_bbox = "68.0,6.0,97.0,36.0"

    def fetch_active_fires(self, source: str = "VIIRS_SNPP_NRT", days: int = 1) -> pd.DataFrame:
        """
        Fetch active fire data from FIRMS for the India bounding box.
        Sources: MODIS_NRT, VIIRS_SNPP_NRT, VIIRS_NOAA20_NRT, VIIRS_NOAA21_NRT
        """
        url = f"{self.base_url}/{self.api_key}/{source}/{self.india_bbox}/{days}"
        
        # We need a proper timeout since NASA APIs can be slow
        with httpx.Client(timeout=60.0) as client:
            response = client.get(url)
            
            if response.status_code == 429:
                raise Exception("NASA FIRMS API Rate Limit Exceeded (HTTP 429).")
            elif response.status_code != 200:
                raise Exception(f"NASA FIRMS API Error: {response.status_code} - {response.text}")
                
            content = response.text
            if not content.strip() or "latitude,longitude" not in content:
                print(f"Warning: Empty or unexpected response from FIRMS for {source}: {content[:100]}")
                return pd.DataFrame()
                
            df = pd.read_csv(io.StringIO(content))
            return df

if __name__ == "__main__":
    # Test execution
    client = FirmsClient()
    df = client.fetch_active_fires(source="VIIRS_SNPP_NRT", days=1)
    print(f"Fetched {len(df)} rows from NASA FIRMS VIIRS_SNPP_NRT for India.")
    if not df.empty:
        print(df.head())
