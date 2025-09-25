import { Delivery, Location } from "../types";

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
  /**
   * Construye los parámetros base para mejorar la precisión de las rutas
   */
  private getBaseRouteParams(): string {
    const now = Math.floor(Date.now() / 1000);

    return [
      `key=${GOOGLE_MAPS_API_KEY}`,
      "language=es",
      "units=metric",
      "region=mx",
      `departure_time=${now}`,
      "traffic_model=best_guess",
      "avoid=ferries",
    ].join("&");
  }

  /**
   * Obtiene una ruta optimizada para múltiples entregas desde la ubicación actual.
   * Retorna el orden optimizado de las entregas y la polilínea sugerida.
   */
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

    const baseParams = this.getBaseRouteParams();
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${origin.latitude},${origin.longitude}&waypoints=optimize:true|${waypoints}&${baseParams}`;

    console.log("[GoogleMapsService] URL generada para optimización:", url);

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

      console.log(
        "[GoogleMapsService] Ruta optimizada calculada con parámetros de tráfico:",
        {
          optimizedDeliveryIds,
          routeLegsCount: route.legs?.length,
          hasTrafficData: route.legs?.[0]?.duration_in_traffic ? "Sí" : "No",
        }
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
   * origen a un destino con parámetros optimizados para mayor precisión.
   */
  async getRouteDetails(
    origin: Location,
    destination: Location
  ): Promise<RouteDetails | null> {
    const baseParams = this.getBaseRouteParams();
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&${baseParams}`;

    console.log("[GoogleMapsService] URL generada para detalles de ruta:", url);

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

      // Preferir duration_in_traffic si está disponible (más preciso)
      const duration = leg.duration_in_traffic || leg.duration;

      console.log("[GoogleMapsService] Detalles de ruta obtenidos:", {
        distance: leg.distance.text,
        duration: duration.text,
        hasTrafficData: leg.duration_in_traffic
          ? "Sí (con tráfico)"
          : "No (sin tráfico)",
        trafficDifference: leg.duration_in_traffic
          ? `${Math.round(
              (leg.duration_in_traffic.value - leg.duration.value) / 60
            )} min`
          : "N/A",
      });

      return {
        distance: leg.distance,
        duration: duration,
      };
    } catch (error) {
      console.error("Error fetching route details from Google Maps:", error);
      return null;
    }
  }

  /**
   * Función auxiliar para comparar estimaciones con diferentes parámetros
   * Útil para debugging y entender las diferencias
   */
  async compareRouteEstimates(
    origin: Location,
    destination: Location
  ): Promise<void> {
    console.log("[GoogleMapsService] Comparando estimaciones de ruta...");

    // Estimación básica (como antes)
    const basicUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${GOOGLE_MAPS_API_KEY}&language=es`;

    // Estimación mejorada (con tráfico)
    const baseParams = this.getBaseRouteParams();
    const enhancedUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&${baseParams}`;

    try {
      const [basicResponse, enhancedResponse] = await Promise.all([
        fetch(basicUrl),
        fetch(enhancedUrl),
      ]);

      const basicData: DirectionsResponse = await basicResponse.json();
      const enhancedData: DirectionsResponse = await enhancedResponse.json();

      if (basicData.status === "OK" && enhancedData.status === "OK") {
        const basicLeg = basicData.routes[0]?.legs[0];
        const enhancedLeg = enhancedData.routes[0]?.legs[0];

        if (basicLeg && enhancedLeg) {
          console.log("[GoogleMapsService] Comparación de estimaciones:", {
            basic: {
              distance: basicLeg.distance.text,
              duration: basicLeg.duration.text,
            },
            enhanced: {
              distance: enhancedLeg.distance.text,
              duration: (
                enhancedLeg.duration_in_traffic || enhancedLeg.duration
              ).text,
              withTraffic: !!enhancedLeg.duration_in_traffic,
            },
            differences: {
              distance: Math.abs(
                basicLeg.distance.value - enhancedLeg.distance.value
              ),
              duration: Math.abs(
                basicLeg.duration.value -
                  (enhancedLeg.duration_in_traffic || enhancedLeg.duration)
                    .value
              ),
            },
          });
        }
      }
    } catch (error) {
      console.error("Error comparing route estimates:", error);
    }
  }
}

export default new GoogleMapsService();
