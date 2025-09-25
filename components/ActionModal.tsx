// src/components/ActionModal.tsx

import React from "react";
import { Modal, StyleSheet, TouchableOpacity } from "react-native";
import { Text, View } from "@/components/Themed";

interface ModalButton {
  text: string;
  onPress: () => void;
  style?: "cancel" | "confirm";
}

interface ActionModalProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: ModalButton[];
  onClose: () => void;
}

export default function ActionModal({
  visible,
  title,
  message,
  buttons,
  onClose,
}: ActionModalProps) {
  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalText}>{message}</Text>
          <View style={styles.modalButtonContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.modalButton,
                  button.style === "cancel"
                    ? styles.modalButtonCancel
                    : styles.modalButtonConfirm,
                ]}
                onPress={button.onPress}
              >
                <Text
                  style={
                    button.style === "cancel"
                      ? styles.modalButtonTextCancel
                      : styles.modalButtonText
                  }
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Estos estilos son extraídos directamente de delivery-detail.tsx
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    width: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 5,
  },
  modalButtonCancel: {
    backgroundColor: "#f0f0f0",
  },
  modalButtonConfirm: {
    backgroundColor: "#007AFF",
  },
  modalButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  modalButtonTextCancel: {
    color: "#333",
    fontWeight: "bold",
  },
});
