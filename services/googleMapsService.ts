import { Delivery, Location } from "../types";

// La API Key se obtiene de las variables de entorno de Expo
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

interface DirectionsResponse {
  routes: {
    overview_polyline: {
      points: string;
    };
    waypoint_order: number[];
  }[];
  status: string;
  error_message?: string;
}

class GoogleMapsService {
  async getOptimizedRoute(
    origin: Location,
    deliveries: Delivery[]
  ): Promise<{
    optimizedOrder: number[];
    suggestedRoutePolyline: string;
  } | null> {
    if (!deliveries || deliveries.length === 0) {
      return null;
    }

    // Extraemos los waypoints (paradas) usando las coordenadas correctas de la interfaz Delivery
    const waypoints = deliveries
      .map((d) => `${d.start_latitud},${d.start_longitud}`)
      .join("|");

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${origin.latitude},${origin.longitude}&waypoints=optimize:true|${waypoints}&key=${GOOGLE_MAPS_API_KEY}`;

    try {
      const response = await fetch(url);
      const data: DirectionsResponse = await response.json();

      if (data.status !== "OK" || !data.routes[0]) {
        console.error(
          "Google Maps API Error:",
          data.status,
          data.error_message
        );
        throw new Error(
          data.error_message || "Failed to fetch optimized route"
        );
      }

      const route = data.routes[0];
      return {
        optimizedOrder: route.waypoint_order,
        suggestedRoutePolyline: route.overview_polyline.points,
      };
    } catch (error) {
      console.error("Error calling Google Maps service:", error);
      return null;
    }
  }
}

export default new GoogleMapsService();
