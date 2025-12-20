export const routes = {
  Home: "/",
  Dashboard: "/dashboard",
  MyContracts: "/my-contracts",
  MyOrders: "/my-orders",
  ManageOrders: "/manage-orders",
  ManageContracts: "/manage-contracts",
  ManageUsers: "/manage-users",
  Profile: "/profile",
  ChangePassword: "/change-password",
  Settings: "/settings",
  Login: "/login",
  Register: "/register",
  ForgotPassword: "/forgot-password",
};

export function createPageUrl(name: keyof typeof routes): string {
  return routes[name];
}

