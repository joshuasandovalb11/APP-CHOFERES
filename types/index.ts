// Driver types
export interface Driver {
  driver_id: number;
  username: string;
  num_unity: string;
  vehicle_plate: string;
  phone_number: string;
}

// Salesperson types
export interface Salesperson {
  name: string;
  phone: string;
}

// Client types
export interface Client {
  client_id: number;
  name: string;
  phone: string;
  gps_location: string;
  salesperson?: Salesperson;
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
  estimated_distance?: string;
  start_latitude: number;
  start_longitude: number;
  end_latitude?: number;
  end_longitude?: number;
  accepted_next_at?: string;
  invoice_id?: string;
  client?: Client;
  status?: "pending" | "in_progress" | "completed" | "cancelled";
  distance?: number;
  priority?: number;
  cancellation_reason?: string;
  cancellation_notes?: string;
}

// Incident reasons
export type IncidentReason =
  | "CLIENTE_AUSENTE"
  | "DIRECCION_INCORRECTA"
  // | "MERCANCIA_RECHAZADA"
  | "VEHICULO_AVERIADO";
// | "OTRO";

// EventType para marcar inicios y fines de entregas
export type TrackingEventType = "journey" | "start_delivery" | "end_delivery";

// Types para calcular los puntos de ruta
export interface TrackingPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  eventType: TrackingEventType;
  deliveryId?: number;
  estimatedDuration?: string | null;
  estimatedDistance?: string | null;
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
  fec_id: number;
  fec_number: number;
  driver_id: number;
  date: string;
  deliveries: Delivery[];
  status: "active" | "completed";
  optimizedOrderId_list?: number[];
  suggestedJourneyPolyline?: string;
}

// Auth types
export interface AuthState {
  isLoggedIn: boolean;
  driver: Driver | null;
  currentFEC: FEC | null;
}
