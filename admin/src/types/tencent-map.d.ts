declare global {
  interface Window {
    qq?: {
      maps: {
        Map;
        LatLng;
        Point;
        Marker;
        Polyline;
        InfoWindow;
        Icon;
        Animation;
        LatLngBounds;
        fitBounds(bounds: any, padding?: any): void;
      };
    };
  }
}

export {};
