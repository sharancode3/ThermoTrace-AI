import os
import json
import glob
import rasterio

def prepare_worldcover():
    print("Preparing ESA WorldCover manifests...")
    base_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw", "landcover")
    manifest_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "manifests")
    
    os.makedirs(manifest_dir, exist_ok=True)
    manifest_path = os.path.join(manifest_dir, "worldcover_manifest.json")
    
    tiff_files = glob.glob(os.path.join(base_dir, "**", "*.tif"), recursive=True)
    
    if not tiff_files:
        print(f"No TIFF files found in {base_dir}")
        return
        
    tiles = []
    
    for tif in tiff_files:
        try:
            with rasterio.open(tif) as src:
                bounds = src.bounds
                tiles.append({
                    "filename": os.path.basename(tif),
                    "filepath": os.path.relpath(tif, start=os.path.join(base_dir, "..", "..")),
                    "crs": str(src.crs),
                    "width": src.width,
                    "height": src.height,
                    "bounds": {
                        "left": bounds.left,
                        "bottom": bounds.bottom,
                        "right": bounds.right,
                        "top": bounds.top
                    },
                    "resolution": src.res
                })
        except Exception as e:
            print(f"Error opening {tif}: {e}")
            
    manifest = {
        "source": "ESA WorldCover 10m 2021 v200",
        "tile_count": len(tiles),
        "tiles": tiles
    }
    
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
        
    print(f"Successfully processed {len(tiles)} WorldCover tiles. Manifest saved.")

if __name__ == "__main__":
    prepare_worldcover()
