import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import ProtectedRoute from '../components/ProtectedRoute'
import MainLayout from '../layouts/MainLayout'
import Landing from '../pages/Landing'
import Login from '../pages/Login'
import Register from '../pages/Register'
import Onboarding from '../pages/Onboarding'
import Chat from '../pages/Chat'
import Settings from '../pages/Settings'
import About from '../pages/About'
import Contact from '../pages/Contact'
import Blog from '../pages/Blog'
import BlogPost from '../pages/BlogPost'
import Privacy from '../pages/Privacy'
import Terms from '../pages/Terms'
import LegalNotice from '../pages/LegalNotice'
import ConnectAuthorize from '../pages/ConnectAuthorize'
import ConnectClaim from '../pages/ConnectClaim'
import TeamAccept from '../pages/TeamAccept'

export default function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/legal" element={<LegalNotice />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/connect/wordpress" element={<ProtectedRoute><ConnectAuthorize provider="wordpress" /></ProtectedRoute>} />
          <Route path="/connect/drupal" element={<ProtectedRoute><ConnectAuthorize provider="drupal" /></ProtectedRoute>} />
          <Route path="/connect/bigcommerce" element={<ProtectedRoute><ConnectClaim provider="bigcommerce" /></ProtectedRoute>} />
          <Route path="/connect/prestashop" element={<ProtectedRoute><ConnectAuthorize provider="prestashop" /></ProtectedRoute>} />
          <Route path="/connect/wix" element={<ProtectedRoute><ConnectClaim provider="wix" /></ProtectedRoute>} />
          <Route path="/team/accept" element={<ProtectedRoute><TeamAccept /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><MainLayout><Chat /></MainLayout></ProtectedRoute>} />
          <Route path="/chat/:conversationId" element={<ProtectedRoute><MainLayout><Chat /></MainLayout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/billing" element={<Navigate to="/settings?tab=billing" replace />} />
          <Route path="/connectors" element={<Navigate to="/settings?tab=connectors" replace />} />
          <Route path="/profile" element={<Navigate to="/settings?tab=account" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
