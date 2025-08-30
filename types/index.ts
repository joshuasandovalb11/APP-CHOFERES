// Driver types
export interface Driver {
  driver_id: number;
  username: string;
  num_unity: string;
  vehicle_plate: string;
  phone_number: string;
}

// Client types
export interface Client {
  client_id: number;
  name: string;
  phone: number;
  gps_location: string;
}

// Delivery types
export interface Delivery {
  delivery_id: number;
  driver_id: number;
  client_id: number;
  start_time: string;
  delivery_time?: string;
  actual_duration?: string;
  estimated_duration?: string;
  start_latitud: number;
  start_longitud: number;
  end_latitud?: number;
  end_longitud?: number;
  accepted_next_at?: string;
  client?: Client;
  status?: "pending" | "in_progress" | "completed" | "cancelled";
  distance?: number;
  priority?: number;
}

// EventType para marcar inicios y fines de entregas
export type TrackingEventType = "journey" | "start_delivery" | "end_delivery";

// Types para calcular los puntos de ruta
export interface TrackingPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  eventType: TrackingEventType;
  deliveryId?: number;
}

// Location types
export interface Location {
  latitude: number;
  longitude: number;
}

// App navigation types
export interface DeliveryStatus {
  hasActiveDelivery: boolean;
  currentDelivery: Delivery | null;
  nextDeliveries: Delivery[];
  completedDeliveries: Delivery[];
}

// FEC (Factura de Entrega Chofer)
export interface FEC {
  fec_number: string;
  driver_id: number;
  date: string;
  deliveries: Delivery[];
  status: "active" | "completed";
  // --- NUEVOS CAMPOS PARA LA RUTA OPTIMIZADA ---
  optimizedOrderId_list?: number[];
  suggestedJourneyPolyline?: string;
}

// Auth types
export interface AuthState {
  isLoggedIn: boolean;
  driver: Driver | null;
  currentFEC: FEC | null;
}
