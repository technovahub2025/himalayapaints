import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { AdminPage } from "@/pages/AdminPage";
import { UserPage } from "@/pages/UserPage";
import { TrackingPage } from "@/pages/TrackingPage";
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
