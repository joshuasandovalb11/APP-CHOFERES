import { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import LocationService from "@/services/location";
import apiService from "@/services/api";

export const useDeliveryTracking = () => {
  const { state, dispatch } = useApp();
  // CAMBIO: Ajusta el tipo del ref para que acepte ambos tipos.
  const timerRef = useRef<NodeJS.Timeout | number | null>(null);
  const locationWatchRef = useRef<any>(null);

  // Iniciar timer cuando comience una entrega
  useEffect(() => {
    if (
      state.deliveryStatus.hasActiveDelivery &&
      !state.deliveryTimer.isActive
    ) {
      startTimer();
      startLocationTracking();
    }
  }, [state.deliveryStatus.hasActiveDelivery]);

  // Actualizar timer cada segundo
  useEffect(() => {
    if (state.deliveryTimer.isActive) {
      timerRef.current = setInterval(() => {
        const startTime = new Date(state.deliveryTimer.startTime!).getTime();
        const currentTime = new Date().getTime();
        const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);

        dispatch({ type: "UPDATE_TIMER", payload: elapsedSeconds });
      }, 1000);
    } else {
      if (timerRef.current) {
        // @ts-ignore - clearInterval puede manejar ambos tipos, pero TypeScript se queja.
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        // @ts-ignore - Lo mismo aquí.
        clearInterval(timerRef.current);
      }
    };
  }, [state.deliveryTimer.isActive, state.deliveryTimer.startTime]);

  const startTimer = () => {
    const now = new Date().toISOString();
    dispatch({ type: "START_TIMER", payload: now });
  };

  const stopTimer = () => {
    dispatch({ type: "STOP_TIMER" });
  };

  const startLocationTracking = async () => {
    dispatch({ type: "START_LOCATION_TRACKING" });

    try {
      const isStarted = await LocationService.startLocationTracking(
        (location) => {
          // Agregar punto de tracking
          const trackingPoint = {
            latitude: location.latitude,
            longitude: location.longitude,
            timestamp: new Date().toISOString(),
            accuracy: 0, // LocationService podría proporcionar esto
            speed: 0, // LocationService podría proporcionar esto
          };

          dispatch({ type: "ADD_TRACKING_POINT", payload: trackingPoint });

          // Enviar ubicación a la API si hay una entrega activa (deshabilitado para desarrollo)
          if (state.deliveryStatus.hasActiveDelivery && state.driver) {
            // TODO: Descomentar cuando se conecte con API real
            // apiService.updateDriverLocation(state.driver.driver_id, location)
            //   .catch(error => console.error('Error updating driver location:', error));

            // Por ahora solo loggeamos para desarrollo
            console.log("Driver location update (mock):", {
              driver_id: state.driver.driver_id,
              location,
              timestamp: new Date().toISOString(),
            });
          }
        }
      );

      if (!isStarted) {
        console.warn("No se pudo iniciar el tracking de ubicación");
      }
    } catch (error) {
      console.error("Error starting location tracking:", error);
    }
  };

  const stopLocationTracking = () => {
    LocationService.stopLocationTracking();
    dispatch({ type: "STOP_LOCATION_TRACKING" });
  };

  // Función para obtener el tiempo formateado
  const getFormattedTime = (): string => {
    const seconds = state.deliveryTimer.elapsedTime;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Función para calcular distancia recorrida
  const getTotalDistance = (): number => {
    const points = state.locationTracking.trackingPoints;
    if (points.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      const prev = {
        latitude: points[i - 1].latitude,
        longitude: points[i - 1].longitude,
      };
      const curr = {
        latitude: points[i].latitude,
        longitude: points[i].longitude,
      };
      totalDistance += LocationService.calculateDistance(prev, curr);
    }

    return totalDistance;
  };

  // Función para obtener datos completos de la entrega para el dashboard
  const getDeliveryData = () => {
    if (!state.deliveryStatus.currentDelivery) return null;

    return {
      delivery: state.deliveryStatus.currentDelivery,
      timer: {
        startTime: state.deliveryTimer.startTime,
        elapsedTime: state.deliveryTimer.elapsedTime,
        formattedTime: getFormattedTime(),
      },
      tracking: {
        points: state.locationTracking.trackingPoints,
        totalDistance: getTotalDistance(),
        isTracking: state.locationTracking.isTracking,
      },
    };
  };

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        // @ts-ignore - Y finalmente aquí.
        clearInterval(timerRef.current);
      }
      LocationService.stopLocationTracking();
    };
  }, []);

  return {
    isTimerActive: state.deliveryTimer.isActive,
    elapsedTime: state.deliveryTimer.elapsedTime,
    formattedTime: getFormattedTime(),
    isTracking: state.locationTracking.isTracking,
    trackingPoints: state.locationTracking.trackingPoints,
    totalDistance: getTotalDistance(),
    deliveryData: getDeliveryData(),
    startTimer,
    stopTimer,
    startLocationTracking,
    stopLocationTracking,
  };
};
