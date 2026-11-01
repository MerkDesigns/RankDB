// Vite rewrites module imports outside its root (installer/) but not HTML script paths, so the
// page loads this file, which pulls in the UI from src/.
import "../src/installer/main";
