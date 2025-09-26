import {
  Driver,
  FEC,
  TrackingPoint,
  Location,
  IncidentReason,
  Delivery,
} from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEV_API_URL = "http://192.168.1.129:8000";
const PROD_API_URL = "https://entregas-backend-d4oy.onrender.com";

const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
// const API_BASE_URL = PROD_API_URL;

console.log(`La aplicación está usando la API en: ${API_BASE_URL}`);

class ApiService {
  // Función privada para obtener el token de autenticación guardado
  private async getAuthToken(): Promise<string | null> {
    return await AsyncStorage.getItem("authToken");
  }

  // Función genérica para realizar todas las peticiones a la API
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAuthToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error de la API:", errorData);
        throw new Error(
          errorData.detail || `HTTP error! status: ${response.status}`
        );
      }

      if (response.status === 204 || response.status === 202) {
        // Para respuestas sin contenido (como un POST exitoso que no devuelve nada)
        return null as T;
      }

      return await response.json();
    } catch (error) {
      console.error("Fallo en la petición a la API:", error);
      throw error;
    }
  }

  /**
   * Valida las credenciales del conductor y obtiene un token de acceso.
   * REEMPLAZA a 'validateDriver'.
   */
  async login(
    username: string,
    password: string
  ): Promise<{ access_token: string }> {
    const details = { username: username, password: password };
    const formBody = (Object.keys(details) as Array<keyof typeof details>)
      .map(
        (key) =>
          encodeURIComponent(key) + "=" + encodeURIComponent(details[key])
      )
      .join("&");

    // Esta petición es especial, no usa el 'request' genérico porque no necesita token
    // y usa un 'Content-Type' diferente.
    const response = await fetch(`${API_BASE_URL}/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: formBody,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Credenciales inválidas");
    }

    const data = await response.json();
    await AsyncStorage.setItem("authToken", data.access_token);
    return data;
  }

  /**
   * Cierra la sesión del conductor eliminando el token.
   */
  async logout(): Promise<void> {
    await AsyncStorage.removeItem("authToken");
  }

  /**
   * Obtiene las entregas del chofer por número de FEC.
   * REEMPLAZA a 'getDeliveriesByFEC'. El endpoint es el mismo.
   */
  async getFEC(fecNumber: string): Promise<FEC> {
    return this.request<FEC>(`/fec/${fecNumber}`);
  }

  /**
   * Envía una lista de eventos de tracking al backend.
   * UNIFICA 'updateDriverLocation', 'startDelivery', 'completeDelivery' y 'logDeliveryEvent'
   * en una sola llamada, tal como lo diseñamos en el backend.
   */
  async logTrackingEvents(events: TrackingPoint[]): Promise<void> {
    await this.request<void>(`/deliveries/events/log`, {
      method: "POST",
      body: JSON.stringify(events),
    });
  }

  /**
   * Envía un lote de puntos de seguimiento (tracking points) al backend.
   * Esta es la nueva función optimizada para el batching.
   */
  async logTrackingPoints(points: TrackingPoint[]): Promise<void> {
    if (points.length === 0) {
      return; // No hacemos nada si no hay puntos
    }
    // Usaremos un nuevo endpoint dedicado para el batching
    await this.request<void>(`/deliveries/events/log/batch`, {
      method: "POST",
      body: JSON.stringify(points),
    });
  }

  /**
   * Reporta una incidencia para una entrega específica.
   * (Esta función es nueva, basada en la lógica que construimos en el backend)
   */
  async reportIncident(
    deliveryId: number,
    reason: IncidentReason,
    notes?: string,
    location?: Location
  ): Promise<Delivery> {
    const payload = {
      reason,
      notes,
      latitude: location?.latitude,
      longitude: location?.longitude,
    };
    return this.request<Delivery>(`/deliveries/${deliveryId}/incident`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Envía la ruta optimizada y la polilínea al backend para guardarla.
   */
  async updateFecRoute(
    fecId: number,
    optimizedOrderId_list: number[],
    suggestedJourneyPolyline: string
  ): Promise<FEC> {
    const payload = {
      optimized_order_list_json: JSON.stringify(optimizedOrderId_list),
      suggested_journey_polyline: suggestedJourneyPolyline,
    };

    // **DEBUGGING AÑADIDO**
    console.log(`[API] Enviando al backend PATCH /fec/${fecId}/route:`);
    console.log(`[API] optimizedOrderId_list:`, optimizedOrderId_list);
    console.log(
      `[API] optimized_order_list_json:`,
      payload.optimized_order_list_json
    );
    console.log(
      `[API] suggestedJourneyPolyline length:`,
      suggestedJourneyPolyline.length
    );

    try {
      const response = await this.request<FEC>(`/fec/${fecId}/route`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      console.log(`[API] Respuesta del backend:`, response);
      return response;
    } catch (error) {
      console.error(`[API] Error en updateFecRoute:`, error);
      throw error;
    }
  }
}

// Creamos y exportamos una única instancia de nuestro servicio.
export const apiService = new ApiService();
