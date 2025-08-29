import { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import LocationService from "@/services/location";

export const useDeliveryTracking = () => {
  const { state, dispatch } = useApp();
  const timerRef = useRef<NodeJS.Timeout | number | null>(null);

  // EFECTO PARA MANEJAR EL TEMPORIZADOR DE LA ENTREGA ACTIVA
  useEffect(() => {
    if (state.deliveryTimer.isActive && state.deliveryTimer.startTime) {
      timerRef.current = setInterval(() => {
        const startTime = new Date(state.deliveryTimer.startTime!).getTime();
        const currentTime = new Date().getTime();
        const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);

        dispatch({ type: "UPDATE_TIMER", payload: elapsedSeconds });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current as any);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current as any);
      }
    };
  }, [state.deliveryTimer.isActive, state.deliveryTimer.startTime, dispatch]);

  // Función para obtener el tiempo formateado del cronómetro
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

  // Función para calcular la distancia total recorrida durante toda la jornada
  const getTotalDistance = (): number => {
    const points = state.locationTracking.trackingPoints;
    if (points.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      totalDistance += LocationService.calculateDistance(prev, curr);
    }

    return totalDistance;
  };

  return {
    isTimerActive: state.deliveryTimer.isActive,
    formattedTime: getFormattedTime(),
    isTracking: state.locationTracking.isTracking,
    totalDistance: getTotalDistance(),
  };
};
