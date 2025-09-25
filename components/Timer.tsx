import React from "react";
import { Text, Platform } from "react-native";
import { useApp } from "@/context/AppContext";

const formatTime = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(remainingSeconds).padStart(2, "0");

  if (hours > 0) {
    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  }

  return `${formattedMinutes}:${formattedSeconds}`;
};

const Timer: React.FC = () => {
  const { state } = useApp();
  const { elapsedTime, isActive } = state.deliveryTimer;

  if (!isActive) {
    return null;
  }

  return (
    <Text
      style={{
        marginLeft: 5,
        fontSize: 14,
        fontWeight: "600",
        color: "#007AFF",
        fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      }}
    >
      {formatTime(elapsedTime)}
    </Text>
  );
};

export default Timer;
