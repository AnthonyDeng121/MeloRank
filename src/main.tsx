
  import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css"

// Defensive check for __jstcache property access - add to both Object.prototype and window
Object.defineProperty(Object.prototype, '__jstcache', {
  get() {
    return null;
  },
  set() {
    return true;
  },
  configurable: true
});

// Also add __jstcache to window object directly since external scripts might access it here
// Use type assertion to avoid TypeScript error
if (!(window as any).__jstcache) {
  Object.defineProperty(window, '__jstcache', {
    value: null,
    writable: true,
    configurable: true
  });
}

// Defensive check for storage access - handle both sessionStorage and localStorage
try {
  // Test if sessionStorage is accessible
  sessionStorage.getItem('test');
} catch (error) {
  // If sessionStorage is not accessible (e.g., in iframe contexts), create a mock sessionStorage
  const mockStorage: Storage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0
  };
  
  // Replace sessionStorage with mock implementation
  Object.defineProperty(window, 'sessionStorage', {
    value: mockStorage,
    writable: false,
    configurable: true
  });
}

// Also handle localStorage access
try {
  // Test if localStorage is accessible
  localStorage.getItem('test');
} catch (error) {
  // Create mock localStorage if it's not accessible
  const mockStorage: Storage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0
  };
  
  // Replace localStorage with mock implementation
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: false,
    configurable: true
  });
}

createRoot(document.getElementById("root")!).render(<App />);
  