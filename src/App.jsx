// src/App.jsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './components/HomePage';
import CustomerList from './pages/CustomerList';
import StockPage from './pages/StockPage';
import Reports from './pages/Reports';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { getCurrentUser } from 'aws-amplify/auth';
import CapitalManagement from './pages/CapitalManagement';

// Protected route wrapper using Amplify Authenticator
function RequireAuth({ children }) {
  const { user } = useAuthenticator((context) => [context.user]);
  return user ? children : <Navigate to="/" replace />;
}

function App() {
  const { user } = useAuthenticator((context) => [context.user]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthState = async () => {
      try {
        // Remove OAuth code from URL if present
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');
        if (authCode) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Attempt to fetch current authenticated user
        await getCurrentUser();
        console.log("✅ User is authenticated");
      } catch {
        console.log("ℹ️ No authenticated user");
      } finally {
        setLoading(false);
      }
    };

    checkAuthState();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-700">Loading authentication...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/customers"
          element={
            <RequireAuth>
              <CustomerList />
            </RequireAuth>
          }
        />
        <Route
          path="/stock"
          element={
            <RequireAuth>
              <StockPage />
            </RequireAuth>
          }
        />
        <Route
          path="/capital-management"
          element={
            <RequireAuth>
              <CapitalManagement />
            </RequireAuth>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireAuth>
              <Reports />
            </RequireAuth>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
