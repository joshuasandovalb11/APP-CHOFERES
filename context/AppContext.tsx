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
import { apiService } from "@/services/api";
import { AppState as ReactNativeAppState } from "react-native";
import locationService from "@/services/location";

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
  | {
      type: "LOGIN";
      payload: { driver: Driver; fec: FEC };
    }
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
  | { type: "CLEAR_TRACKING_POINTS" }
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
    }
  | {
      type: "SET_ROUTE_DETAILS";
      payload: { deliveryId: number; distance: string; duration: string };
    }
  | { type: "SYNC_TIMER" };

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
      const allDeliveries = action.payload.fec.deliveries;

      const activeDelivery =
        allDeliveries.find((d) => d.status === "in_progress") || null;

      const pendingDeliveries = allDeliveries.filter(
        (d) => d.status === "pending"
      );
      const completedDeliveries = allDeliveries.filter(
        (d) => d.status === "completed"
      );
      const cancelledDeliveries = allDeliveries.filter(
        (d) => d.status === "cancelled"
      );

      let restoredTimerState = initialState.deliveryTimer;

      if (activeDelivery && activeDelivery.start_time) {
        let startTimeString = activeDelivery.start_time;

        if (!startTimeString.endsWith("Z")) {
          startTimeString += "Z";
          console.log(
            `[AppContext] Corregida zona horaria para start_time: ${startTimeString}`
          );
        }

        const startTimeFromDB = new Date(startTimeString).getTime();
        const currentTime = new Date().getTime();
        const elapsedSeconds = Math.floor(
          (currentTime - startTimeFromDB) / 1000
        );

        restoredTimerState = {
          isActive: true,
          startTime: activeDelivery.start_time,
          elapsedTime: elapsedSeconds > 0 ? elapsedSeconds : 0,
        };

        console.log(
          `[AppContext] Contador restaurado. Tiempo transcurrido: ${elapsedSeconds}s`
        );
      }

      return {
        ...state,
        isLoggedIn: true,
        driver: action.payload.driver,
        currentFEC: action.payload.fec,
        deliveryStatus: {
          ...initialState.deliveryStatus,
          hasActiveDelivery: !!activeDelivery,
          currentDelivery: activeDelivery,
          nextDeliveries: pendingDeliveries,
          completedDeliveries: completedDeliveries,
          cancelledDeliveries: cancelledDeliveries,
        },
        deliveryTimer: restoredTimerState,
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
      if (!state.currentFEC) return state;

      const deliveryToComplete = state.currentFEC.deliveries.find(
        (d) => d.delivery_id === action.payload
      );

      if (!deliveryToComplete) {
        console.warn(
          `[Reducer] No se encontró la entrega #${action.payload} para completar.`
        );
        return state;
      }

      const completedDelivery: Delivery = {
        ...deliveryToComplete,
        status: "completed" as const,
      };

      const updatedFecDeliveries = state.currentFEC.deliveries.map((d) =>
        d.delivery_id === action.payload ? completedDelivery : d
      );
      const updatedNextDeliveries = updatedFecDeliveries.filter(
        (d) => d.status === "pending"
      );
      const updatedCompletedDeliveries = updatedFecDeliveries.filter(
        (d) => d.status === "completed"
      );

      return {
        ...state,
        currentFEC: {
          ...state.currentFEC,
          deliveries: updatedFecDeliveries,
        },
        deliveryStatus: {
          ...state.deliveryStatus,
          hasActiveDelivery: false,
          currentDelivery: null,
          nextDeliveries: updatedNextDeliveries,
          completedDeliveries: updatedCompletedDeliveries,
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

    case "CLEAR_TRACKING_POINTS":
      return {
        ...state,
        locationTracking: { ...state.locationTracking, trackingPoints: [] },
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

    case "SET_ROUTE_DETAILS": {
      if (
        !state.deliveryStatus.currentDelivery ||
        state.deliveryStatus.currentDelivery.delivery_id !==
          action.payload.deliveryId
      ) {
        return state;
      }

      const updatedDeliveryWithDetails = {
        ...state.deliveryStatus.currentDelivery,
        estimated_distance: action.payload.distance,
        estimated_duration: action.payload.duration,
      };

      return {
        ...state,
        currentFEC: state.currentFEC
          ? {
              ...state.currentFEC,
              deliveries: state.currentFEC.deliveries.map((d) =>
                d.delivery_id === action.payload.deliveryId
                  ? updatedDeliveryWithDetails
                  : d
              ),
            }
          : state.currentFEC,
        deliveryStatus: {
          ...state.deliveryStatus,
          currentDelivery: updatedDeliveryWithDetails,
        },
      };
    }

    case "SYNC_TIMER": {
      if (!state.deliveryTimer.isActive || !state.deliveryTimer.startTime) {
        return state;
      }

      let startTimeString = state.deliveryTimer.startTime;
      if (!startTimeString.endsWith("Z")) {
        startTimeString += "Z";
      }

      const startTimeFromDB = new Date(startTimeString).getTime();
      const currentTime = new Date().getTime();
      const elapsedSeconds = Math.floor((currentTime - startTimeFromDB) / 1000);

      console.log(
        `[AppContext] Resincronizando timer. Nuevo tiempo: ${elapsedSeconds}s`
      );

      return {
        ...state,
        deliveryTimer: {
          ...state.deliveryTimer,
          elapsedTime: elapsedSeconds > 0 ? elapsedSeconds : 0,
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
  flushTrackingPoints: () => Promise<void>;
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
    location: Location,
    details?: { estimatedDuration?: string; estimatedDistance?: string }
  ) => void;
  setOptimizedRoute: (
    fec: FEC,
    deliveries: Delivery[],
    currentLocation: Location
  ) => Promise<FEC | null>;
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
  flushTrackingPoints: async () => {},
  login: async () => {},
  logout: () => {},
  startDelivery: () => {},
  completeDelivery: () => {},
  updateLocation: async () => {},
  startJourneyTracking: () => {},
  stopJourneyTracking: () => {},
  logDeliveryEvent: () => {},
  setOptimizedRoute: async () => null,
  setViewedDeliveryId: () => {},
  reportIncident: async () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [isOffline, setIsOffline] = useState(false);
  const isOfflineRef = useRef(isOffline);
  const lastNotificationTimestampRef = useRef(0);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline]);

  // EFECTO PARA SINCRONIZAR EL TIMER CUANDO LA APP VUELVE A PRIMER PLANO
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === "active") {
        console.log(
          "[AppContext] La aplicación ha vuelto a primer plano. Sincronizando timer..."
        );
        dispatch({ type: "SYNC_TIMER" });
      }
    };

    const subscription = ReactNativeAppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // EFECTO PARA SINCRONIZAR EL TIMER CADA SEGUNDO
  useEffect(() => {
    if (state.deliveryTimer.isActive && state.deliveryTimer.startTime) {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }

      const updateTimer = () => {
        let startTimeString = state.deliveryTimer.startTime!;
        if (!startTimeString.endsWith("Z")) {
          startTimeString += "Z";
        }

        const startTimeFromDB = new Date(startTimeString).getTime();
        const currentTime = new Date().getTime();
        const elapsedSeconds = Math.floor(
          (currentTime - startTimeFromDB) / 1000
        );

        if (Math.abs(elapsedSeconds - state.deliveryTimer.elapsedTime) >= 1) {
          dispatch({
            type: "UPDATE_TIMER",
            payload: elapsedSeconds > 0 ? elapsedSeconds : 0,
          });
        }
      };

      updateTimer();
      syncTimerRef.current = setInterval(updateTimer, 1000);

      return () => {
        if (syncTimerRef.current) {
          clearInterval(syncTimerRef.current);
          syncTimerRef.current = null;
        }
      };
    } else {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    }
  }, [
    state.deliveryTimer.isActive,
    state.deliveryTimer.startTime,
    state.deliveryTimer.elapsedTime,
  ]);

  // EFECTO PARA SINCRONIZAR PUNTOS DE TRACKING CADA 15 SEGUNDOS
  useEffect(() => {
    if (state.locationTracking.isTracking) {
      const syncInterval = setInterval(async () => {
        const pointsToSync = [...state.locationTracking.trackingPoints];
        if (pointsToSync.length > 0) {
          console.log(
            `Sincronizando ${pointsToSync.length} puntos de tracking...`
          );
          try {
            if (!isOfflineRef.current) {
              await apiService.logTrackingEvents(pointsToSync);
              dispatch({ type: "CLEAR_TRACKING_POINTS" });
            }
          } catch (error) {
            console.error("Fallo la sincronización de tracking points:", error);
          }
        }
      }, 15000);

      return () => clearInterval(syncInterval);
    }
  }, [
    state.locationTracking.isTracking,
    state.locationTracking.trackingPoints,
  ]);

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

    // Agrupamos los eventos de tracking para enviarlos en un solo lote
    const trackingEvents: TrackingPoint[] = [];
    const otherEvents: OfflineEvent[] = [];

    queue.forEach((event) => {
      if (
        event.type === "start_delivery" ||
        event.type === "complete_delivery" ||
        event.type === "log_event"
      ) {
        trackingEvents.push(event.payload as TrackingPoint);
      } else {
        otherEvents.push(event);
      }
    });

    try {
      // Enviamos el lote de eventos de tracking si hay alguno
      if (trackingEvents.length > 0) {
        await apiService.logTrackingEvents(trackingEvents);
        console.log(
          `${trackingEvents.length} eventos de tracking sincronizados.`
        );
      }

      // Enviamos los otros eventos uno por uno (ej. incidencias)
      for (const event of otherEvents) {
        if (event.type === "report_incident") {
          const { deliveryId, reason, notes } = event.payload;
          await apiService.reportIncident(deliveryId, reason, notes);
          console.log(`Incidencia para entrega ${deliveryId} sincronizada.`);
        }
      }

      // Si todas las sincronizaciones son exitosas, limpiamos la cola
      await AsyncStorage.removeItem("offlineQueue");
      console.log("Sincronización completada. Cola limpiada.");
    } catch (error) {
      console.error("Fallo la sincronización de eventos:", error);
      // No limpiamos la cola para poder reintentar más tarde.
    }
  };

  // Función para manejar el inicio de sesión
  const login = async (driver: Driver, fec: FEC) => {
    try {
      dispatch({
        type: "LOGIN",
        payload: { driver, fec },
      });

      // Guardamos en AsyncStorage para persistir la sesión
      await AsyncStorage.setItem("isAuthenticated", "true");
      await AsyncStorage.setItem("fecData", JSON.stringify(fec));
      await AsyncStorage.setItem("driverData", JSON.stringify(driver));
    } catch (error) {
      console.error("Error en el proceso de login:", error);
      throw error;
    }
  };

  const logout = async () => {
    await apiService.logout(); // Borra el token
    await AsyncStorage.multiRemove(["isAuthenticated", "fecData"]);
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
    const location = state.currentLocation;
    if (!location) {
      console.error("No se puede iniciar entrega sin ubicación actual.");
      throw new Error("Ubicación actual no encontrada.");
    }

    const deliveryData = state.deliveryStatus.nextDeliveries.find(
      (d) => d.delivery_id === deliveryId
    );

    if (!deliveryData) {
      console.error(
        `No se encontró la entrega con ID ${deliveryId} para iniciar.`
      );
      return;
    }

    let estimatedDuration: string | undefined = undefined;
    let estimatedDistance: string | undefined = undefined;
    let deliveryToStart = deliveryData;

    if (deliveryData?.client?.gps_location) {
      try {
        const clientLocationParts = deliveryData.client.gps_location.split(",");
        const clientDestination = {
          latitude: parseFloat(clientLocationParts[0]),
          longitude: parseFloat(clientLocationParts[1]),
        };

        const routeDetails = await googleMapsService.getRouteDetails(
          location,
          clientDestination
        );

        if (routeDetails) {
          estimatedDuration = routeDetails.duration.text;
          estimatedDistance = routeDetails.distance.text;

          deliveryToStart = {
            ...deliveryData,
            estimated_distance: estimatedDistance,
            estimated_duration: estimatedDuration,
          };

          console.log(
            `[AppContext] Datos calculados: ${estimatedDistance}, ${estimatedDuration}`
          );
        }
      } catch (e) {
        console.error("Error al calcular la duración estimada:", e);
      }
    }

    dispatch({ type: "START_DELIVERY", payload: deliveryId });
    dispatch({ type: "START_TIMER", payload: new Date().toISOString() });

    if (estimatedDistance && estimatedDuration) {
      dispatch({
        type: "SET_ROUTE_DETAILS",
        payload: {
          deliveryId,
          distance: estimatedDistance,
          duration: estimatedDuration,
        },
      });
    }

    try {
      await locationService.startForegroundUpdate(deliveryToStart);
    } catch (error) {
      console.error("Error iniciando el servicio de ubicación:", error);
    }

    const eventPayload: TrackingPoint = {
      ...location,
      timestamp: new Date().toISOString(),
      eventType: "start_delivery",
      deliveryId: deliveryId,
      estimatedDuration: estimatedDuration,
      estimatedDistance: estimatedDistance,
    };

    if (isOffline) {
      await addEventToQueue({
        type: "log_event",
        payload: eventPayload,
        timestamp: Date.now(),
      });
    } else {
      try {
        await apiService.logTrackingEvents([eventPayload]);
      } catch (error) {
        console.error("Error al reportar inicio de entrega, encolando:", error);
        await addEventToQueue({
          type: "log_event",
          payload: eventPayload,
          timestamp: Date.now(),
        });
      }
    }
  };

  // Funcion para completar una entrega
  const completeDelivery = async (deliveryId: number) => {
    const location = state.currentLocation;
    if (!location) {
      console.error("No se puede completar entrega sin ubicación actual.");
      return;
    }

    const eventPayload: TrackingPoint = {
      ...location,
      timestamp: new Date().toISOString(),
      eventType: "end_delivery",
      deliveryId: deliveryId,
    };

    if (isOffline) {
      await addEventToQueue({
        type: "log_event",
        payload: eventPayload,
        timestamp: Date.now(),
      });
    } else {
      try {
        await apiService.logTrackingEvents([eventPayload]);
      } catch (error) {
        console.error("Error al reportar fin de entrega, encolando:", error);
        await addEventToQueue({
          type: "log_event",
          payload: eventPayload,
          timestamp: Date.now(),
        });
      }
    }
    dispatch({ type: "COMPLETE_DELIVERY", payload: deliveryId });
    dispatch({ type: "STOP_TIMER" });
  };

  const reportIncident = async (
    deliveryId: number,
    reason: IncidentReason,
    notes?: string
  ) => {
    const location = state.currentLocation;
    if (!location) {
      console.warn(
        "No se encontró ubicación actual. La incidencia se reportará sin coordenadas."
      );
    }

    const eventPayload = { deliveryId, reason, notes, location };

    if (isOffline) {
      console.log("Offline: Encolando reporte de incidencia.");
      await addEventToQueue({
        type: "report_incident",
        payload: eventPayload,
        timestamp: Date.now(),
      });
    } else {
      try {
        console.log("Online: Enviando reporte de incidencia al servidor.");
        await apiService.reportIncident(
          deliveryId,
          reason,
          notes,
          location || undefined
        );
      } catch (error) {
        console.error("Error al reportar incidencia, encolando:", error);
        await addEventToQueue({
          type: "report_incident",
          payload: eventPayload,
          timestamp: Date.now(),
        });
      }
    }
    dispatch({
      type: "REPORT_INCIDENT",
      payload: { deliveryId, reason, notes },
    });
    if (state.deliveryStatus.currentDelivery?.delivery_id === deliveryId) {
      dispatch({ type: "STOP_TIMER" });
    }
  };

  // Funcion para iniciar el seguimiento del viaje
  const startJourneyTracking = () => {
    if (state.locationTracking.isTracking) {
      console.log("[AppContext] El seguimiento de la jornada ya está activo.");
      return;
    }

    dispatch({ type: "START_JOURNEY_TRACKING" });
    LocationService.startLocationTracking((location) => {
      console.log(
        `📍 Nuevo punto de tracking capturado: ${new Date().toLocaleTimeString()}`,
        location
      );
      const trackingPoint: TrackingPoint = {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date().toISOString(),
        eventType: "journey",
        deliveryId: state.deliveryStatus.currentDelivery?.delivery_id,
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
    location: Location,
    details?: { estimatedDuration?: string; estimatedDistance?: string }
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
      ...details,
    };
    dispatch({ type: "ADD_TRACKING_POINT", payload: eventPoint });
  };

  // Funcion para establecer la ruta optimizada
  const setOptimizedRoute = async (
    fec: FEC,
    deliveries: Delivery[],
    currentLocation: Location
  ): Promise<FEC | null> => {
    console.log(
      `[setOptimizedRoute] Iniciando cálculo para FEC ID: ${fec.fec_id}`
    );

    const hasExistingRoute =
      fec.suggestedJourneyPolyline &&
      fec.suggestedJourneyPolyline.length > 0 &&
      fec.optimizedOrderId_list &&
      fec.optimizedOrderId_list.length > 0;

    if (hasExistingRoute) {
      console.log(
        `[setOptimizedRoute] FEC ${fec.fec_id} ya tiene ruta optimizada completa. Saltando cálculo.`,
        {
          optimizedOrderId_list: fec.optimizedOrderId_list,
          polylineLength: fec.suggestedJourneyPolyline?.length || 0,
        }
      );
      return fec;
    }

    try {
      const result = await googleMapsService.getOptimizedRoute(
        currentLocation,
        deliveries
      );

      if (result && fec) {
        const optimizedOrderId_list = result.optimizedDeliveryIds;

        console.log("[setOptimizedRoute] Resultado de Google Maps:", {
          optimizedDeliveryIds: optimizedOrderId_list,
          suggestedRoutePolyline:
            result.suggestedRoutePolyline?.substring(0, 50) + "...",
        });

        dispatch({
          type: "SET_OPTIMIZED_ROUTE",
          payload: {
            optimizedOrderId_list,
            suggestedJourneyPolyline: result.suggestedRoutePolyline,
          },
        });

        try {
          const updatedFec = await apiService.updateFecRoute(
            fec.fec_id,
            optimizedOrderId_list,
            result.suggestedRoutePolyline
          );
          console.log(
            `[setOptimizedRoute] ¡Ruta enviada al backend exitosamente!`
          );
          return updatedFec;
        } catch (backendError) {
          console.error(
            "[setOptimizedRoute] Error enviando al backend:",
            backendError
          );
          return null;
        }
      }
      return null;
    } catch (error) {
      console.error("Failed to set and save optimized route.", error);
      return null;
    }
  };

  // Funcion para establecer el ID de entrega visto
  const setViewedDeliveryId = (deliveryId: number | null) => {
    dispatch({ type: "SET_VIEWED_DELIVERY_ID", payload: deliveryId });
  };

  const flushTrackingPoints = async () => {
    const pointsToSync = [...state.locationTracking.trackingPoints];

    if (pointsToSync.length === 0 || isOfflineRef.current) {
      return;
    }

    try {
      console.log(
        `[AppContext] Intentando sincronizar lote de ${pointsToSync.length} puntos.`
      );
      await apiService.logTrackingPoints(pointsToSync);
      dispatch({ type: "CLEAR_TRACKING_POINTS" });
      console.log(`[AppContext] Lote sincronizado exitosamente.`);
    } catch (error) {
      console.error(
        "[AppContext] Error al sincronizar lote de tracking. Se reintentará en el siguiente ciclo.",
        error
      );
    }
  };

  useEffect(() => {
    let batchInterval: ReturnType<typeof setInterval>;

    if (state.locationTracking.isTracking) {
      batchInterval = setInterval(() => {
        flushTrackingPoints();
      }, 60000);

      console.log(
        "[AppContext] Temporizador de batching de tracking INICIADO."
      );
    }

    return () => {
      if (batchInterval) {
        clearInterval(batchInterval);
        console.log(
          "[AppContext] Temporizador de batching de tracking DETENIDO."
        );
        flushTrackingPoints();
      }
    };
  }, [state.locationTracking.isTracking]);

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
        flushTrackingPoints,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
