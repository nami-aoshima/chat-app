// utils/authGuard.ts
import { useEffect } from "react";
import { useRouter } from "next/router";

export const useAuthGuard = () => {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login"); // 🔐 トークンなかったらログインに飛ばす
    }
  }, []);
};
