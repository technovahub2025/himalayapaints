import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "@/App";
import "@/styles/globals.css";
import { Providers } from "@/components/providers";
import { installApiFetchProxy } from "@/services/api-client";
installApiFetchProxy();
ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode>
    <Providers>
    <BrowserRouter>
      <App />
    </BrowserRouter>
    </Providers>
  </React.StrictMode>);
