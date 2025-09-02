import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  Dispatch,
} from "react";
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
import googleMapsService from "@/services/googleMapsService";

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
  currentlyViewedDeliveryId: number | null;
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
  | { type: "SET_VIEWED_DELIVERY_ID"; payload: number | null };

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
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
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
}>({
  state: initialState,
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
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

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

  const startDelivery = (deliveryId: number) => {
    dispatch({ type: "START_DELIVERY", payload: deliveryId });
    dispatch({ type: "START_TIMER", payload: new Date().toISOString() });
  };

  const completeDelivery = (deliveryId: number) => {
    dispatch({ type: "COMPLETE_DELIVERY", payload: deliveryId });
    dispatch({ type: "STOP_TIMER" });
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
    });
  };

  const stopJourneyTracking = () => {
    LocationService.stopLocationTracking();
    dispatch({ type: "STOP_JOURNEY_TRACKING" });
  };

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
  };

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

  const setViewedDeliveryId = (deliveryId: number | null) => {
    dispatch({ type: "SET_VIEWED_DELIVERY_ID", payload: deliveryId });
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
        setOptimizedRoute,
        setViewedDeliveryId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
