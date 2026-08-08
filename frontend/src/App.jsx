import { Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "@/pages/AdminPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { TrackingPage } from "@/pages/TrackingPage";
import { UserPage } from "@/pages/UserPage";
export function App() {
    return (<Routes>
      <Route path="/" element={<HomePage />}/>
      <Route path="/login" element={<LoginPage />}/>
      <Route path="/admin" element={<AdminPage />}/>
      <Route path="/user" element={<UserPage />}/>
      <Route path="/tracking" element={<TrackingPage />}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>);
}
