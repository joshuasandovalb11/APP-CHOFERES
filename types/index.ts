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
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  distance?: number; // distancia en metros
  priority?: number; // para ordenar por proximidad
}

// Delivery tracking types
export interface DeliveryTracking {
  tracking_id: number;
  delivery_id: number;
  driver_id: number;
  timestamp: string;
  latitud: number;
  longitud: number;
}

// Delivery events types
export interface DeliveryEvent {
  event_id: number;
  delivery_id: number;
  event_type: "inicio" | "fin" | "pausa" | "reanudacion" | "problema";
  timestamp: string;
  latitud: number;
  longitud: number;
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
}

// FEC (Factura de Entrega Chofer) - Este será el número que ingresa el chofer
export interface FEC {
  fec_number: string;
  driver_id: number;
  date: string;
  deliveries: Delivery[];
  status: 'active' | 'completed';
}

// Auth types
export interface AuthState {
  isLoggedIn: boolean;
  driver: Driver | null;
  currentFEC: FEC | null;
}
