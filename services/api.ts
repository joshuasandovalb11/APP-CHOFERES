import { Driver, FEC, Delivery, Location } from "../types";

// Configuración de la API - cambiar por tu URL real
const API_BASE_URL = "https://your-api-url.com/api";

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  // Obtener las entregas del chofer por número de FEC
  async getDeliveriesByFEC(fecNumber: string): Promise<FEC> {
    return this.request<FEC>(`/fec/${fecNumber}`);
  }

  // Validar credenciales del chofer
  async validateDriver(username: string, password: string): Promise<Driver> {
    return this.request<Driver>("/driver/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  // Actualizar ubicación del chofer
  async updateDriverLocation(
    driverId: number,
    location: Location
  ): Promise<void> {
    await this.request("/driver/location", {
      method: "PUT",
      body: JSON.stringify({
        driver_id: driverId,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  // Iniciar entrega
  async startDelivery(deliveryId: number, location: Location): Promise<void> {
    await this.request("/delivery/start", {
      method: "POST",
      body: JSON.stringify({
        delivery_id: deliveryId,
        start_latitude: location.latitude,
        start_longitude: location.longitude,
        start_time: new Date().toISOString(),
      }),
    });
  }

  // Completar entrega
  async completeDelivery(
    deliveryId: number,
    location: Location
  ): Promise<void> {
    await this.request("/delivery/complete", {
      method: "POST",
      body: JSON.stringify({
        delivery_id: deliveryId,
        end_latitude: location.latitude,
        end_longitude: location.longitude,
        delivery_time: new Date().toISOString(),
      }),
    });
  }

  // Registrar evento de entrega
  async logDeliveryEvent(
    deliveryId: number,
    eventType: "inicio" | "fin" | "pausa" | "reanudacion" | "problema",
    location: Location
  ): Promise<void> {
    await this.request("/delivery/event", {
      method: "POST",
      body: JSON.stringify({
        delivery_id: deliveryId,
        event_type: eventType,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date().toISOString(),
      }),
    });
  }
}

// Mock data para desarrollo - eliminar cuando conectes con la API real
export const mockApiService = {
  async getDeliveriesByFEC(fecNumber: string): Promise<FEC> {
    // Simular delay de red
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      fec_number: fecNumber,
      driver_id: 1,
      date: new Date().toISOString().split("T")[0],
      status: "active",
      deliveries: [
        {
          delivery_id: 1,
          driver_id: 1,
          client_id: 101,
          start_time: new Date().toISOString(),
          start_latitud: 32.50400293893507,
          start_longitud: -116.95667490030546,
          status: "pending",
          distance: 1200,
          priority: 1,
          client: {
            client_id: 101,
            name: "Juan Pérez",
            phone: 8181234567,
            gps_location: "32.500947254430116, -116.92049673664414",
          },
        },
        {
          delivery_id: 2,
          driver_id: 1,
          client_id: 102,
          start_time: new Date().toISOString(),
          start_latitud: 32.50400293893507,
          start_longitud: -116.95667490030546,
          status: "pending",
          distance: 2500,
          priority: 2,
          client: {
            client_id: 102,
            name: "María Guadalupe González Ramos",
            phone: 8187654321,
            gps_location: "32.49405663163976, -116.9329384853697",
          },
        },
        {
          delivery_id: 3,
          driver_id: 1,
          client_id: 103,
          start_time: new Date().toISOString(),
          start_latitud: 32.50400293893507,
          start_longitud: -116.95667490030546,
          status: "pending",
          distance: 800,
          priority: 3,
          client: {
            client_id: 103,
            name: "Carlos Rodríguez",
            phone: 8189876543,
            gps_location: "32.497231852681146, -116.95960551717934",
          },
        },
        {
          delivery_id: 4,
          driver_id: 1,
          client_id: 104,
          start_time: new Date().toISOString(),
          start_latitud: 32.50400293893507,
          start_longitud: -116.95667490030546,
          status: "pending",
          distance: 800,
          priority: 3,
          client: {
            client_id: 104,
            name: "Carlos Flores",
            phone: 8189876543,
            gps_location: "32.508991348572124, -116.94233324711278",
          },
        },
        {
          delivery_id: 5,
          driver_id: 1,
          client_id: 105,
          start_time: new Date().toISOString(),
          start_latitud: 32.50400293893507,
          start_longitud: -116.95667490030546,
          status: "pending",
          distance: 800,
          priority: 3,
          client: {
            client_id: 105,
            name: "Santiago Jimenez",
            phone: 8189876543,
            gps_location: "32.48487337679138, -116.91661248319237",
          },
        },
      ],
    };
  },

  async validateDriver(username: string, password: string): Promise<Driver> {
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (username === "chofer1" && password === "1234") {
      return {
        driver_id: 1,
        username: "chofer1",
        num_unity: "UNIT-001",
        vehicle_plate: "ABC-123",
        phone_number: "8181234567",
      };
    }
    throw new Error("Credenciales inválidas");
  },
};

export default new ApiService();
