import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { WalletProvider } from "@/contexts/WalletContext";

import Landing from "./pages/Landing";

import Profile from "./pages/Profile";
import DaoView from "./pages/DaoView";
import DaoInfo from "./pages/DaoInfo";
import ActionPage from "./pages/ActionPage";
import FlowSequencePage from "./pages/FlowSequencePage";
import MandatePage from "./pages/MandatePage";
import AllDaos from "./pages/AllDaos";
import UserProfile from "./pages/UserProfile";
import DaoNameInfo from "./pages/DaoNameInfo";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <WalletProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/portal" element={<Landing />} />
              
              <Route path="/profile" element={<Profile />} />
              <Route path="/view/:slug" element={<DaoView />} />
              <Route path="/view/:slug/action/:actionId" element={<ActionPage />} />
              <Route path="/view/:slug/action/:actionId/flow" element={<FlowSequencePage />} />
              <Route path="/view/:slug/mandate/:mandateId" element={<MandatePage />} />
              <Route path="/info" element={<Navigate to="/all-daos" replace />} />
              <Route path="/user/:username" element={<UserProfile />} />
              <Route path="/all-daos" element={<AllDaos />} />
              <Route path="/dao-info" element={<DaoNameInfo />} />
              
              <Route path="/" element={<Navigate to="/portal" replace />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </WalletProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
