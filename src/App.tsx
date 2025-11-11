import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import Manager from "./pages/Manager";
import NotFound from "./pages/NotFound";
import AdminProducts from "./pages/admin/Products";
import AdminShops from "./pages/admin/Shops";
import AdminManagers from "./pages/admin/Managers";
import AdminIncoming from "./pages/admin/Incoming";
import AdminDispatch from "./pages/admin/Dispatch";
import ManagerProducts from "./pages/manager/Products";
import ManagerShops from "./pages/manager/Shops";
import ManagerDispatches from "./pages/manager/Dispatches";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />}>
            <Route index element={<Navigate to="/admin/products" replace />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="shops" element={<AdminShops />} />
            <Route path="managers" element={<AdminManagers />} />
            <Route path="incoming" element={<AdminIncoming />} />
            <Route path="dispatch" element={<AdminDispatch />} />
          </Route>
          <Route path="/manager" element={<Manager />}>
            <Route index element={<Navigate to="/manager/dispatches" replace />} />
            <Route path="products" element={<ManagerProducts />} />
            <Route path="shops" element={<ManagerShops />} />
            <Route path="dispatches" element={<ManagerDispatches />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
