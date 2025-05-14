// utils/logout.ts
import { useRouter } from "next/router";
import { useEffect } from "react";

export const useLogout = () => {
  const router = useRouter();

  useEffect(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    router.push("/login");
  }, []);
};
