import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { GoogleMapsProvider } from './contexts/GoogleMapsProvider';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import OnboardingSuccess from './pages/OnboardingSuccess';
import Dashboard from './pages/Dashboard';
import FindRide from './pages/FindRide';
import OfferRide from './pages/OfferRide';
import RideMatches from './pages/RideMatches';
import Profile from './pages/Profile';
import Activity from './pages/Activity';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GoogleMapsProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />

          {/* Protected routes */}
          <Route path="/welcome" element={<ProtectedRoute><OnboardingSuccess /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/find-ride" element={<ProtectedRoute><FindRide /></ProtectedRoute>} />
          <Route path="/offer-ride" element={<ProtectedRoute><OfferRide /></ProtectedRoute>} />
          <Route path="/ride-matches" element={<ProtectedRoute><RideMatches /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute><Activity /></ProtectedRoute>} />
        </Routes>
        </GoogleMapsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
