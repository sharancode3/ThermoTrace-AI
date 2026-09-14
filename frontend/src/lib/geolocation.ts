export function requestCurrentPosition(): Promise<GeolocationPosition> {
  if (!("geolocation" in navigator)) return Promise.reject(new Error("Geolocation is not supported by this browser."));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, () => {
      navigator.geolocation.getCurrentPosition(resolve, (error) => {
        const messages: Record<number, string> = { 1: "Location permission denied.", 2: "Location is unavailable.", 3: "Location request timed out." };
        reject(new Error(messages[error.code] || "Unable to retrieve location."));
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    }, { enableHighAccuracy: true, timeout: 6000, maximumAge: 300000 });
  });
}
