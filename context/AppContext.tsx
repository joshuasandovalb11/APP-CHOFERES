import React, { createContext, useContext, useReducer, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AuthState,
  Delivery,
  Driver,
  FEC,
  Location,
  TrackingPoint,
  TrackingEventType,
} from "../types";
import LocationService from "@/services/location";

interface AppState extends AuthState {
  deliveryStatus: {
    hasActiveDelivery: boolean;
    currentDelivery: Delivery | null;
    nextDeliveries: Delivery[];
    completedDeliveries: Delivery[];
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
  | { type: "ADD_TRACKING_POINT"; payload: TrackingPoint };

// ESTADO INICIAL
const initialState: AppState = {
  isLoggedIn: false,
  driver: null,
  currentFEC: null,
  deliveryStatus: {
    hasActiveDelivery: false,
    currentDelivery: null,
    nextDeliveries: [],
    completedDeliveries: [],
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
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  login: (driver: Driver, fec: FEC) => Promise<void>;
  logout: () => Promise<void>;
  startDelivery: (deliveryId: number) => void;
  completeDelivery: (deliveryId: number) => void;
  updateLocation: (location: Location) => void;
  startJourneyTracking: () => void;
  stopJourneyTracking: () => void;
  logDeliveryEvent: (
    eventType: TrackingEventType,
    deliveryId: number,
    location: Location
  ) => void;
}>({
  state: initialState,
  dispatch: () => {},
  login: async () => {},
  logout: async () => {},
  startDelivery: () => {},
  completeDelivery: () => {},
  updateLocation: () => {},
  startJourneyTracking: () => {},
  stopJourneyTracking: () => {},
  logDeliveryEvent: () => {},
});

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
      };

    case "LOGOUT":
      return { ...initialState };

    case "SET_LOCATION":
      return { ...state, currentLocation: action.payload };

    case "START_DELIVERY":
      const deliveryToStart = state.deliveryStatus.nextDeliveries.find(
        (d) => d.delivery_id === action.payload
      );
      if (!deliveryToStart) return state;
      return {
        ...state,
        deliveryStatus: {
          ...state.deliveryStatus,
          hasActiveDelivery: true,
          currentDelivery: { ...deliveryToStart, status: "in_progress" },
          nextDeliveries: state.deliveryStatus.nextDeliveries.filter(
            (d) => d.delivery_id !== action.payload
          ),
        },
      };

    case "COMPLETE_DELIVERY":
      const completedDelivery = state.deliveryStatus.currentDelivery;
      if (!completedDelivery) return state;
      return {
        ...state,
        deliveryStatus: {
          ...state.deliveryStatus,
          hasActiveDelivery: false,
          currentDelivery: null,
          completedDeliveries: [
            ...state.deliveryStatus.completedDeliveries,
            { ...completedDelivery, status: "completed" },
          ],
        },
        deliveryTimer: initialState.deliveryTimer,
      };

    case "START_JOURNEY_TRACKING":
      return {
        ...state,
        locationTracking: { isTracking: true, trackingPoints: [] },
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

    case "START_TIMER":
      return {
        ...state,
        deliveryTimer: {
          isActive: true,
          startTime: action.payload,
          elapsedTime: 0,
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
        deliveryTimer: { ...state.deliveryTimer, isActive: false },
      };

    default:
      return state;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const login = async (driver: Driver, fec: FEC) => {
    await AsyncStorage.setItem("driver", JSON.stringify(driver));
    await AsyncStorage.setItem("currentFEC", JSON.stringify(fec));
    dispatch({ type: "LOGIN", payload: { driver, fec } });
  };

  const logout = async () => {
    await AsyncStorage.removeItem("driver");
    await AsyncStorage.removeItem("currentFEC");
    dispatch({ type: "LOGOUT" });
  };

  const startDelivery = (deliveryId: number) => {
    dispatch({ type: "START_DELIVERY", payload: deliveryId });
    dispatch({ type: "START_TIMER", payload: new Date().toISOString() });
  };

  const completeDelivery = (deliveryId: number) => {
    dispatch({ type: "COMPLETE_DELIVERY", payload: deliveryId });
    dispatch({ type: "STOP_TIMER" });
  };

  const updateLocation = (location: Location) => {
    dispatch({ type: "SET_LOCATION", payload: location });
  };

  const startJourneyTracking = () => {
    dispatch({ type: "START_JOURNEY_TRACKING" });
    LocationService.startLocationTracking((location) => {
      const trackingPoint: TrackingPoint = {
        ...location,
        timestamp: new Date().toISOString(),
        eventType: "journey",
      };
      dispatch({ type: "ADD_TRACKING_POINT", payload: trackingPoint });
      // Aquí iría la llamada a la API real para guardar el punto
      // console.log("Tracking point added:", trackingPoint);
    });
  };

  const stopJourneyTracking = () => {
    LocationService.stopLocationTracking();
    dispatch({ type: "STOP_JOURNEY_TRACKING" });
  };

  // Función para marcar eventos especiales en el tracking
  const logDeliveryEvent = (
    eventType: TrackingEventType,
    deliveryId: number,
    location: Location
  ) => {
    const eventPoint: TrackingPoint = {
      ...location,
      timestamp: new Date().toISOString(),
      eventType,
      deliveryId,
    };
    dispatch({ type: "ADD_TRACKING_POINT", payload: eventPoint });
    // Aquí también se haría una llamada a la API para registrar el evento
  };

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        login,
        logout,
        startDelivery,
        completeDelivery,
        updateLocation,
        startJourneyTracking,
        stopJourneyTracking,
        logDeliveryEvent,
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
