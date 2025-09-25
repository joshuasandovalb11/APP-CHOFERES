import { Delivery, Location } from "../types";

// La API Key se obtiene de las variables de entorno de Expo
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

interface DirectionsResponse {
  routes: {
    legs: any;
    overview_polyline: {
      points: string;
    };
    waypoint_order: number[];
  }[];
  status: string;
  error_message?: string;
}

interface RouteDetails {
  distance: { text: string; value: number }; // value en metros
  duration: { text: string; value: number }; // value en segundos
}

class GoogleMapsService {
  async getOptimizedRoute(
    origin: Location,
    deliveries: Delivery[]
  ): Promise<{
    optimizedDeliveryIds: number[];
    suggestedRoutePolyline: string;
  } | null> {
    const pendingDeliveries = deliveries.filter(
      (d) => d.status === "pending" && d.client?.gps_location
    );

    if (!pendingDeliveries || pendingDeliveries.length === 0) {
      console.warn(
        "[GoogleMapsService] No hay entregas pendientes para optimizar."
      );
      return null;
    }

    // Extraemos los waypoints (paradas) usando las coordenadas correctas de la interfaz Delivery
    const waypoints = pendingDeliveries
      .map((d) => d.client!.gps_location)
      .join("|");

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${origin.latitude},${origin.longitude}&waypoints=optimize:true|${waypoints}&key=${GOOGLE_MAPS_API_KEY}`;

    console.log("[GoogleMapsService] URL generada:", url);
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

      const optimizedDeliveryIds = route.waypoint_order.map(
        (index) => pendingDeliveries[index].delivery_id
      );

      return {
        optimizedDeliveryIds,
        suggestedRoutePolyline: route.overview_polyline.points,
      };
    } catch (error) {
      console.error("Error calling Google Maps service:", error);
      return null;
    }
  }

  /**
   * Obtiene la distancia y duración estimadas para una ruta desde un
   * origen a un destino.
   */
  async getRouteDetails(
    origin: Location,
    destination: Location
  ): Promise<RouteDetails | null> {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${GOOGLE_MAPS_API_KEY}&language=es`;

    try {
      const response = await fetch(url);
      const data: DirectionsResponse = await response.json();

      if (data.status !== "OK" || !data.routes[0]?.legs[0]) {
        console.error(
          "Google Maps API Error:",
          data.status,
          data.error_message
        );
        return null;
      }

      const leg = data.routes[0].legs[0];
      return {
        distance: leg.distance,
        duration: leg.duration,
      };
    } catch (error) {
      console.error("Error fetching route details from Google Maps:", error);
      return null;
    }
  }
}

export default new GoogleMapsService();
