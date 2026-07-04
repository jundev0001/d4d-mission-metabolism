import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import "./index.css"

class RootElementError extends Error {
  readonly name = "RootElementError"

  constructor() {
    super("React root element was not found")
  }
}

const rootElement = document.getElementById("root")
if (rootElement === null) {
  throw new RootElementError()
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
