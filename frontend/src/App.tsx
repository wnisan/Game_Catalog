import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FiltersProvider } from './contexts/FiltersContext';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import AppBar from './components/AppBar/AppBar';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import AuthPage from './pages/AuthPage';
import ExplorePage from './pages/ExplorePage';
import UserGamesPage from './pages/UserGamesPage';
import UserPage from './pages/UserPage';
import GameDetailPage from './pages/GameDetailPage';
import LoadingSpinner from './components/Loading/LoadingSpinner';
import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <FiltersProvider>
          <div className="App">
            <Routes>
              <Route
                path="/auth"
                element={
                  <AuthPageWrapper />
                }
              />
              <Route
                path="/signin-callback"
                element={<SignInCallback />}
              />
              <Route
                path="/"
                element={
                  <PublicLayout>
                    <ExplorePage />
                  </PublicLayout>
                }
              />

              <Route
                path="/explore"
                element={
                  <PublicLayout>
                    <ExplorePage />
                  </PublicLayout>
                }
              />

              <Route
                path="/home"
                element={
                  <PublicLayout>
                    <ExplorePage />
                  </PublicLayout>
                }
              />

              <Route
                path="/my-games"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <UserGamesPage />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/user"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <UserPage />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/game/:slug"
                element={
                  <PublicLayout>
                    <GameDetailPage />
                  </PublicLayout>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </FiltersProvider>
      </AuthProvider>
    </Router>
  );
}

const AuthPageWrapper: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to='/' replace />
  }

  return <AuthPage />;
};

const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <LoadingSpinner />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <ScrollToTop />
      <AppBar />
      <main className="app-main">
        {children}
      </main>
    </>
  );
};

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      <ScrollToTop />
      <AppBar />
      <main className="app-main">
        {children}
      </main>
    </>
  );
};

// регистрация с гуглом
const SignInCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const processedRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      if (isProcessing || processedRef.current) {
        return;
      }

      const code = searchParams.get('code');
      if (!code) {
        setError('Authorization code not found');
        return;
      }

      processedRef.current = true;
      setIsProcessing(true);

      try {
        const { googleAuthCallback } = await import('./services/api');
        const response = await googleAuthCallback(code);

        if (!response || !response.user) {
          setError('Invalid response from server');
          setIsProcessing(false);
          processedRef.current = false;
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        window.location.href = '/';
      } catch (err: any) {
        console.error('Google auth error:', err);
        const errorMessage = err?.response?.data?.error || err?.response?.data?.details || err?.message || 'Failed to authenticate with Google';
        setError(errorMessage);
        setIsProcessing(false);
        processedRef.current = false;
      }
    };

    handleCallback();
  }, []);

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Authentication Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.href = '/auth'}>Go to Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <LoadingSpinner />
      <p>Completing authentication...</p>
    </div>
  );
};

export default App;