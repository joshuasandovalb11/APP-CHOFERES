import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  Dispatch,
  useRef,
  useEffect,
  useState,
} from "react";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AuthState,
  Delivery,
  Driver,
  FEC,
  Location,
  TrackingPoint,
  TrackingEventType,
  IncidentReason,
} from "../types";
import LocationService from "@/services/location";
import googleMapsService from "@/services/googleMapsService";
import * as Notifications from "expo-notifications";

interface AppState extends AuthState {
  deliveryStatus: {
    hasActiveDelivery: boolean;
    currentDelivery: Delivery | null;
    nextDeliveries: Delivery[];
    completedDeliveries: Delivery[];
    cancelledDeliveries: Delivery[];
  };
  currentLocation: Location | null;
  deliveryTimer: {
    isActive: boolean;
    startTime: string | null;
    elapsedTime: number;
  };
  locationTracking: {
    isTracking: boolean;
    trackingPoints: TrackingPoint[];
  };
  currentlyViewedDeliveryId: number | null;
}

interface OfflineEvent {
  type:
    | "start_delivery"
    | "complete_delivery"
    | "log_event"
    | "report_incident";
  payload: any;
  timestamp: number;
}

type AppAction =
  | { type: "LOGIN"; payload: { driver: Driver; fec: FEC } }
  | { type: "LOGOUT" }
  | { type: "SET_LOCATION"; payload: Location }
  | { type: "START_DELIVERY"; payload: number }
  | { type: "COMPLETE_DELIVERY"; payload: number }
  | { type: "START_TIMER"; payload: string }
  | { type: "UPDATE_TIMER"; payload: number }
  | { type: "STOP_TIMER" }
  | { type: "START_JOURNEY_TRACKING" }
  | { type: "STOP_JOURNEY_TRACKING" }
  | { type: "ADD_TRACKING_POINT"; payload: TrackingPoint }
  | {
      type: "SET_OPTIMIZED_ROUTE";
      payload: {
        optimizedOrderId_list: number[];
        suggestedJourneyPolyline: string;
      };
    }
  | { type: "SET_VIEWED_DELIVERY_ID"; payload: number | null }
  | {
      type: "REPORT_INCIDENT";
      payload: { deliveryId: number; reason: IncidentReason; notes?: string };
    };

const initialState: AppState = {
  isLoggedIn: false,
  driver: null,
  currentFEC: null,
  deliveryStatus: {
    hasActiveDelivery: false,
    currentDelivery: null,
    nextDeliveries: [],
    completedDeliveries: [],
    cancelledDeliveries: [],
  },
  currentLocation: null,
  deliveryTimer: {
    isActive: false,
    startTime: null,
    elapsedTime: 0,
  },
  locationTracking: {
    isTracking: false,
    trackingPoints: [],
  },
  currentlyViewedDeliveryId: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "LOGIN":
      const pendingDeliveries = action.payload.fec.deliveries.filter(
        (d) => d.status === "pending" || d.status === "in_progress"
      );
      return {
        ...state,
        isLoggedIn: true,
        driver: action.payload.driver,
        currentFEC: action.payload.fec,
        deliveryStatus: {
          ...initialState.deliveryStatus,
          nextDeliveries: pendingDeliveries,
        },
        locationTracking: {
          isTracking: false,
          trackingPoints: [],
        },
      };

    // --- LÓGICA UNIFICADA Y CORREGIDA PARA START_DELIVERY ---
    case "START_DELIVERY": {
      if (!state.currentFEC) return state;

      const deliveryToStart = state.currentFEC.deliveries.find(
        (d) => d.delivery_id === action.payload
      );
      if (!deliveryToStart) return state;

      const activeDelivery = {
        ...deliveryToStart,
        status: "in_progress" as const,
      };

      // 1. Actualizamos la lista principal (la fuente de verdad)
      const updatedFecDeliveries = state.currentFEC.deliveries.map((d) =>
        d.delivery_id === action.payload ? activeDelivery : d
      );

      // 2. Recalculamos las listas derivadas
      const updatedNextDeliveries = updatedFecDeliveries.filter(
        (d) => d.status === "pending"
      );

      return {
        ...state,
        currentFEC: {
          ...state.currentFEC,
          deliveries: updatedFecDeliveries,
        },
        deliveryStatus: {
          ...state.deliveryStatus,
          hasActiveDelivery: true,
          currentDelivery: activeDelivery,
          nextDeliveries: updatedNextDeliveries,
        },
      };
    }

    case "COMPLETE_DELIVERY": {
      if (!state.currentFEC || !state.deliveryStatus.currentDelivery)
        return state;

      const completedDelivery: Delivery = {
        ...state.deliveryStatus.currentDelivery,
        status: "completed" as const,
      };

      const updatedFecDeliveries = state.currentFEC.deliveries.map((d) =>
        d.delivery_id === action.payload ? completedDelivery : d
      );

      const updatedCompletedDeliveries = [
        ...state.deliveryStatus.completedDeliveries,
        completedDelivery,
      ];

      const updatedNextDeliveries = updatedFecDeliveries.filter(
        (d) => d.status === "pending"
      );

      return {
        ...state,
        currentFEC: {
          ...state.currentFEC,
          deliveries: updatedFecDeliveries,
        },
        deliveryStatus: {
          hasActiveDelivery: false,
          currentDelivery: null,
          nextDeliveries: updatedNextDeliveries,
          completedDeliveries: updatedCompletedDeliveries,
          cancelledDeliveries: state.deliveryStatus.cancelledDeliveries,
        },
        deliveryTimer: initialState.deliveryTimer,
      };
    }

    case "LOGOUT":
      return { ...initialState };
    case "SET_LOCATION":
      return {
        ...state,
        currentLocation: action.payload,
      };
    case "START_TIMER":
      return {
        ...state,
        deliveryTimer: {
          ...state.deliveryTimer,
          isActive: true,
          startTime: action.payload,
        },
      };
    case "UPDATE_TIMER":
      return {
        ...state,
        deliveryTimer: { ...state.deliveryTimer, elapsedTime: action.payload },
      };
    case "STOP_TIMER":
      return {
        ...state,
        deliveryTimer: {
          ...state.deliveryTimer,
          isActive: false,
          elapsedTime: 0,
        },
      };
    case "START_JOURNEY_TRACKING":
      return {
        ...state,
        locationTracking: { ...state.locationTracking, isTracking: true },
      };
    case "STOP_JOURNEY_TRACKING":
      return {
        ...state,
        locationTracking: { ...state.locationTracking, isTracking: false },
      };
    case "ADD_TRACKING_POINT":
      return {
        ...state,
        locationTracking: {
          ...state.locationTracking,
          trackingPoints: [
            ...state.locationTracking.trackingPoints,
            action.payload,
          ],
        },
      };
    case "SET_OPTIMIZED_ROUTE":
      if (!state.currentFEC) return state;
      return {
        ...state,
        currentFEC: {
          ...state.currentFEC,
          optimizedOrderId_list: action.payload.optimizedOrderId_list,
          suggestedJourneyPolyline: action.payload.suggestedJourneyPolyline,
        },
      };
    case "SET_VIEWED_DELIVERY_ID":
      return {
        ...state,
        currentlyViewedDeliveryId: action.payload,
      };

    case "REPORT_INCIDENT": {
      const { deliveryId, reason, notes } = action.payload;

      // Buscamos la entrega en TODAS las listas posibles de origen.
      const deliveryToCancel =
        state.deliveryStatus.currentDelivery?.delivery_id === deliveryId
          ? state.deliveryStatus.currentDelivery
          : state.currentFEC?.deliveries.find(
              (d) => d.delivery_id === deliveryId
            );

      if (!deliveryToCancel) {
        console.warn(
          `[Reducer] No se encontró la entrega ${deliveryId} para cancelar.`
        );
        return state; // Si no se encuentra, no hacemos nada.
      }

      // Creamos la versión actualizada de la entrega.
      const updatedDelivery = {
        ...deliveryToCancel,
        status: "cancelled" as const,
        cancellation_reason: reason,
        cancellation_notes: notes,
      };

      return {
        ...state,
        // Actualizamos la lista de entregas del FEC original.
        currentFEC: state.currentFEC
          ? {
              ...state.currentFEC,
              deliveries: state.currentFEC.deliveries.map((d) =>
                d.delivery_id === deliveryId ? updatedDelivery : d
              ),
            }
          : state.currentFEC,
        deliveryStatus: {
          ...state.deliveryStatus,
          // La quitamos de la lista de visualización de pendientes.
          nextDeliveries: state.deliveryStatus.nextDeliveries.filter(
            (d) => d.delivery_id !== deliveryId
          ),
          // Y la añadimos a la lista de canceladas.
          cancelledDeliveries: [
            ...state.deliveryStatus.cancelledDeliveries,
            updatedDelivery,
          ],
          // Si la entrega cancelada era la que estaba activa, la reseteamos.
          currentDelivery:
            state.deliveryStatus.currentDelivery?.delivery_id === deliveryId
              ? null
              : state.deliveryStatus.currentDelivery,
          hasActiveDelivery:
            state.deliveryStatus.currentDelivery?.delivery_id === deliveryId
              ? false
              : state.deliveryStatus.hasActiveDelivery,
        },
      };
    }

    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  isOffline: boolean;
  dispatch: Dispatch<AppAction>;
  login: (driver: Driver, fec: FEC) => Promise<void>;
  logout: () => void;
  startDelivery: (deliveryId: number) => void;
  completeDelivery: (deliveryId: number) => void;
  updateLocation: (location?: Location) => void;
  startJourneyTracking: () => void;
  stopJourneyTracking: () => void;
  logDeliveryEvent: (
    eventType: TrackingEventType,
    deliveryId: number,
    location: Location
  ) => void;
  setOptimizedRoute: (
    deliveries: Delivery[],
    currentLocation: Location
  ) => Promise<void>;
  setViewedDeliveryId: (deliveryId: number | null) => void;
  reportIncident: (
    deliveryId: number,
    reason: IncidentReason,
    notes?: string
  ) => Promise<void>;
}>({
  state: initialState,
  isOffline: false,
  dispatch: () => null,
  login: async () => {},
  logout: () => {},
  startDelivery: () => {},
  completeDelivery: () => {},
  updateLocation: async () => {},
  startJourneyTracking: () => {},
  stopJourneyTracking: () => {},
  logDeliveryEvent: () => {},
  setOptimizedRoute: async () => {},
  setViewedDeliveryId: () => {},
  reportIncident: async () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [isOffline, setIsOffline] = useState(false);
  const isOfflineRef = useRef(isOffline);
  const lastNotificationTimestampRef = useRef(0);

  useEffect(() => {
    isOfflineRef.current = isOffline; // Mantenemos la ref actualizada
  }, [isOffline]);

  // EFECTO PARA ESCUCHAR EL ESTADO DE LA RED
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netInfoState) => {
      const newOfflineState = !(
        netInfoState.isConnected && netInfoState.isInternetReachable
      );
      setIsOffline(newOfflineState);

      // Si ANTES estábamos online y AHORA estamos offline, enviamos notificación.
      if (!isOfflineRef.current && newOfflineState) {
        const now = Date.now();
        if (now - lastNotificationTimestampRef.current > 10000) {
          console.log("Conexión perdida. Entrando a modo offline.");
          Notifications.scheduleNotificationAsync({
            content: {
              title: "Modo Offline Activado",
              body: "Has perdido la conexión. Tus acciones se guardarán y se sincronizarán cuando vuelvas a estar en línea.",
            },
            trigger: null,
          });
          lastNotificationTimestampRef.current = now;
        }
      }

      // Si vuelve a tener conexión y había eventos pendientes, sincroniza
      if (isOfflineRef.current && !newOfflineState) {
        console.log("Conexión restaurada. Sincronizando eventos pendientes...");
        syncOfflineQueue();
      }
    });

    return () => unsubscribe();
  }, []);

  // FUNCIÓN PARA GUARDAR UN EVENTO EN LA COLA
  const addEventToQueue = async (event: OfflineEvent) => {
    try {
      const queueJson = await AsyncStorage.getItem("offlineQueue");
      const queue: OfflineEvent[] = queueJson ? JSON.parse(queueJson) : [];
      queue.push(event);
      await AsyncStorage.setItem("offlineQueue", JSON.stringify(queue));
      console.log("Evento añadido a la cola offline:", event);
    } catch (error) {
      console.error("Error guardando evento en la cola:", error);
    }
  };

  // FUNCIÓN PARA SINCRONIZAR LA COLA CON EL SERVIDOR
  const syncOfflineQueue = async () => {
    const queueJson = await AsyncStorage.getItem("offlineQueue");
    if (!queueJson) return;

    const queue: OfflineEvent[] = JSON.parse(queueJson);
    if (queue.length === 0) return;

    console.log(`Sincronizando ${queue.length} eventos pendientes...`);

    // Aquí iría la lógica para enviar cada evento al servidor.
    // Es importante que el backend pueda recibir estos eventos,
    // posiblemente en un endpoint que acepte un array de eventos.
    try {
      // Ejemplo: await apiService.syncEvents(queue);

      // Si la sincronización es exitosa, limpia la cola
      await AsyncStorage.removeItem("offlineQueue");
      console.log("Sincronización completada. Cola limpiada.");
    } catch (error) {
      console.error("Fallo la sincronización de eventos:", error);
      // Opcional: Implementar lógica de reintentos
    }
  };

  // Función para manejar el inicio de sesión
  const login = async (driver: Driver, fec: FEC) => {
    dispatch({ type: "LOGIN", payload: { driver, fec } });
    await AsyncStorage.setItem("driverData", JSON.stringify(driver));
    await AsyncStorage.setItem("fecData", JSON.stringify(fec));
  };

  const logout = async () => {
    await AsyncStorage.removeItem("driver");
    await AsyncStorage.removeItem("currentFEC");
    dispatch({ type: "LOGOUT" });
  };

  // Funcion para actualizar la ubicación actual
  const updateLocation = async (location?: Location) => {
    if (location) {
      dispatch({ type: "SET_LOCATION", payload: location });
    } else {
      const currentLocation = await LocationService.getCurrentLocation();
      if (currentLocation) {
        dispatch({ type: "SET_LOCATION", payload: currentLocation });
      }
    }
  };

  // Funcion para iniciar una entrega
  const startDelivery = async (deliveryId: number) => {
    if (isOffline) {
      // Si está offline, guarda el evento en la cola
      const event: OfflineEvent = {
        type: "start_delivery",
        payload: { deliveryId },
        timestamp: Date.now(),
      };
      await addEventToQueue(event);
      // Actualiza el estado local para que el usuario vea el cambio (actualización optimista)
      dispatch({ type: "START_DELIVERY", payload: deliveryId });
      dispatch({ type: "START_TIMER", payload: new Date().toISOString() });
      return;
    }
    // Si está online, ejecuta la lógica original (llamar a tu API, etc.)
    dispatch({ type: "START_DELIVERY", payload: deliveryId });
    dispatch({ type: "START_TIMER", payload: new Date().toISOString() });
  };

  // Funcion para completar una entrega
  const completeDelivery = async (deliveryId: number) => {
    if (isOffline) {
      const event: OfflineEvent = {
        type: "complete_delivery",
        payload: { deliveryId },
        timestamp: Date.now(),
      };
      await addEventToQueue(event);
      dispatch({ type: "COMPLETE_DELIVERY", payload: deliveryId });
      dispatch({ type: "STOP_TIMER" });
      return;
    }
    try {
      console.log(
        `Online: Reportando finalización de entrega ${deliveryId} al servidor.`
      );
      dispatch({ type: "COMPLETE_DELIVERY", payload: deliveryId });
      dispatch({ type: "STOP_TIMER" });
    } catch (error) {
      console.error("Error al completar la entrega:", error);
      // Opcional: si la API falla, podríamos encolar el evento para reintentar.
    }
  };

  const reportIncident = async (
    deliveryId: number,
    reason: IncidentReason,
    notes?: string
  ) => {
    // Si estamos offline, usamos la cola que ya creamos
    if (isOffline) {
      console.log("Offline: Encolando reporte de incidencia.");
      const event: OfflineEvent = {
        type: "report_incident",
        payload: { deliveryId, reason, notes },
        timestamp: Date.now(),
      };
      await addEventToQueue(event);
      // Hacemos el cambio en la UI inmediatamente (actualización optimista)
      dispatch({
        type: "REPORT_INCIDENT",
        payload: { deliveryId, reason, notes },
      });
      dispatch({ type: "STOP_TIMER" });
      return;
    }

    // Si estamos online, intentamos enviar al servidor
    try {
      console.log("Online: Enviando reporte de incidencia al servidor.");
      // --- AQUÍ IRÍA LA LÓGICA PARA LLAMAR A TU API REAL ---
      // await apiService.reportDeliveryIncident({ deliveryId, reason, notes });

      // Si la llamada a la API es exitosa, actualizamos el estado de la app
      dispatch({
        type: "REPORT_INCIDENT",
        payload: { deliveryId, reason, notes },
      });
      dispatch({ type: "STOP_TIMER" });
    } catch (error) {
      console.error("Error al reportar incidencia:", error);
      // Opcional: Si la API falla, podríamos guardar el evento en la cola igualmente.
      // Esto aumentaría la robustez.
    }
  };

  // Funcion para iniciar el seguimiento del viaje
  const startJourneyTracking = () => {
    dispatch({ type: "START_JOURNEY_TRACKING" });
    LocationService.startLocationTracking((location) => {
      const trackingPoint: TrackingPoint = {
        ...location,
        timestamp: new Date().toISOString(),
        eventType: "journey",
      };
      dispatch({ type: "ADD_TRACKING_POINT", payload: trackingPoint });
    });
  };

  // Función para detener el seguimiento del viaje
  const stopJourneyTracking = () => {
    LocationService.stopLocationTracking();
    dispatch({ type: "STOP_JOURNEY_TRACKING" });
  };

  // Función para registrar un evento de entrega
  const logDeliveryEvent = async (
    eventType: TrackingEventType,
    deliveryId: number,
    location: Location
  ) => {
    if (isOffline) {
      const event: OfflineEvent = {
        type: "log_event",
        payload: { eventType, deliveryId, location },
        timestamp: Date.now(),
      };
      await addEventToQueue(event);
      return;
    }
    const eventPoint: TrackingPoint = {
      ...location,
      timestamp: new Date().toISOString(),
      eventType,
      deliveryId,
    };
    dispatch({ type: "ADD_TRACKING_POINT", payload: eventPoint });
  };

  // Funcion para establecer la ruta optimizada
  const setOptimizedRoute = async (
    deliveries: Delivery[],
    currentLocation: Location
  ) => {
    try {
      const result = await googleMapsService.getOptimizedRoute(
        currentLocation,
        deliveries
      );

      if (result) {
        const optimizedOrderId_list = result.optimizedOrder.map(
          (index) => deliveries[index].delivery_id
        );

        dispatch({
          type: "SET_OPTIMIZED_ROUTE",
          payload: {
            optimizedOrderId_list,
            suggestedJourneyPolyline: result.suggestedRoutePolyline,
          },
        });
      }
    } catch (error) {
      console.error(
        "Failed to set optimized route. Using default order.",
        error
      );
    }
  };

  // Funcion para establecer el ID de entrega visto
  const setViewedDeliveryId = (deliveryId: number | null) => {
    dispatch({ type: "SET_VIEWED_DELIVERY_ID", payload: deliveryId });
  };

  return (
    <AppContext.Provider
      value={{
        state,
        isOffline,
        dispatch,
        login,
        logout,
        startDelivery,
        completeDelivery,
        updateLocation,
        startJourneyTracking,
        stopJourneyTracking,
        logDeliveryEvent,
        setOptimizedRoute,
        setViewedDeliveryId,
        reportIncident,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
