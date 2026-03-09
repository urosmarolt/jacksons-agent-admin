import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./global.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";

const theme = createTheme({
  primaryColor: "brand",
  fontFamily: "'DM Sans', sans-serif",
  headings: { fontFamily: "'Playfair Display', serif" },
  colors: {
    brand: [
      "#fdf6ee",
      "#f7e9d4",
      "#efd2a8",
      "#e6b878",
      "#dfa051",
      "#da9033",
      "#d88626",
      "#c07318",
      "#aa6512",
      "#93550a",
    ],
  },
  components: {
    Card: {
      defaultProps: { radius: "md" },
      styles: {
        root: {
          border: "1px solid #f0ebe3",
          boxShadow: "0 1px 4px rgba(180,140,80,0.06)",
        },
      },
    },
    AppShell: { styles: { main: { background: "#faf8f5" } } },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" />
      <AuthProvider>
        <App />
      </AuthProvider>
    </MantineProvider>
  </React.StrictMode>,
);
