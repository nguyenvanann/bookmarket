import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./user/components/Layout";
import Home from "./user/pages/Home";
import BookDetail from "./user/pages/BookDetail";
import BookReader from "./user/pages/BookReader";
import MyBooks from "./user/pages/MyBooks";
import Cart from "./user/pages/Cart";
import Ledger from "./user/pages/Ledger";
import Login from "./user/pages/Login";
import AdminDashboard from "./admin/pages/AdminDashboard";

export default function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminDashboard />} />
      <Route path="/login" element={<Login />} />
      <Route path="/books/:bookId/read" element={<BookReader />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="books/:bookId" element={<BookDetail />} />
        <Route path="cart" element={<Cart />} />
        <Route
          path="my-books"
          element={
            <ProtectedRoute>
              <MyBooks />
            </ProtectedRoute>
          }
        />
        <Route path="ledger" element={<Ledger />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
