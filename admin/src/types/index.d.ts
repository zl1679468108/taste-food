declare global {
  interface Window {
    qq?: {
      maps: {
        Map: new (container: HTMLElement, options?: any) => any;
        LatLng: new (lat: number, lng: number) => any;
        Point: new (x: number, y: number) => any;
        Marker: new (options: { position: any; map?: any; icon?: any; zIndex?: number }) => any;
        Polyline: new (options: { path: any[]; map?: any; strokeColor?: string; strokeWeight?: number; strokeOpacity?: number }) => any;
        InfoWindow: new (options: { content?: any; map?: any; position?: any }) => any;
        Icon: new (src: any, size?: any, origin?: any, anchor?: any) => any;
        Animation: { BOUNCE: any };
        LatLngBounds: new () => any;
        fitBounds(bounds: any, padding?: any): void;
      };
    };
  }
}

// For modules without default export
export {};
