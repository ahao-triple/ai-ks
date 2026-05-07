import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		allowedHosts: true,
		host: '0.0.0.0',
		port: 8888
	},
	preview:{
		port: 8888,
		allowedHosts: true,
		host: '0.0.0.0'
	}
});
