import React, { createContext, useContext, useReducer, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AuthState,
  Delivery,
  DeliveryStatus,
  Driver,
  FEC,
  Location,
} from "../types";

// INTERFAZ SIMPLIFICADA: Se quita 'cancelledDeliveries'
interface AppState extends AuthState {
  deliveryStatus: DeliveryStatus & {
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
    trackingPoints: Array<{
      latitude: number;
      longitude: number;
      timestamp: string;
    }>;
  };
}

// ACCIONES SIMPLIFICADAS: Se quita 'CANCEL_DELIVERY'
type AppAction =
  | { type: "LOGIN"; payload: { driver: Driver; fec: FEC } }
  | { type: "LOGOUT" }
  | { type: "SET_LOCATION"; payload: Location }
  | { type: "START_DELIVERY"; payload: number }
  | { type: "COMPLETE_DELIVERY"; payload: number }
  | { type: "START_TIMER"; payload: string }
  | { type: "UPDATE_TIMER"; payload: number }
  | { type: "STOP_TIMER" }
  | { type: "START_LOCATION_TRACKING" }
  | { type: "STOP_LOCATION_TRACKING" }
  | { type: "ADD_TRACKING_POINT"; payload: any };

// ESTADO INICIAL SIMPLIFICADO
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

// CONTEXTO SIMPLIFICADO: Se quita 'cancelDelivery'
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  login: (driver: Driver, fec: FEC) => Promise<void>;
  logout: () => Promise<void>;
  startDelivery: (deliveryId: number) => void;
  completeDelivery: (deliveryId: number) => void;
  updateLocation: (location: Location) => void;
}>({
  state: initialState,
  dispatch: () => {},
  login: async () => {},
  logout: async () => {},
  startDelivery: () => {},
  completeDelivery: () => {},
  updateLocation: () => {},
});

// REDUCER SIMPLIFICADO
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
        locationTracking: initialState.locationTracking,
      };

    // Casos de Timer y Tracking (sin cambios)
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
    case "START_LOCATION_TRACKING":
      return {
        ...state,
        locationTracking: { isTracking: true, trackingPoints: [] },
      };
    case "STOP_LOCATION_TRACKING":
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

    default:
      return state;
  }
}

// PROVIDER SIMPLIFICADO
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
  };

  const completeDelivery = (deliveryId: number) => {
    dispatch({ type: "COMPLETE_DELIVERY", payload: deliveryId });
  };

  const updateLocation = (location: Location) => {
    dispatch({ type: "SET_LOCATION", payload: location });
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
