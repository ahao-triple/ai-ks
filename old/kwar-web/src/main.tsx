import React from 'react';
import ReactDOM from 'react-dom/client';
import { HeroUIProvider } from '@heroui/react';
import { ToastProvider } from '@heroui/toast';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <HeroUIProvider>
            <ToastProvider placement="top-right" maxVisibleToasts={2} />
            <App />
        </HeroUIProvider>
    </React.StrictMode>,
);
