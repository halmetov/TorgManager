import { Package, Store, ShoppingCart, RotateCcw, FileText, LogOut } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Товары", url: "/manager/products", icon: Package },
  { title: "Магазины", url: "/manager/shops", icon: Store },
  { title: "Заказ", url: "/manager/orders", icon: ShoppingCart },
  { title: "Возврат", url: "/manager/returns", icon: RotateCcw },
  { title: "Отчет", url: "/manager/reports", icon: FileText },
];

export function ManagerSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";

  const handleLogout = () => {
    api.logout();
    navigate("/login");
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-base">Панель водителя</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="lg">
                    <NavLink
                      to={item.url}
                      end
                      onClick={() => {
                        if (isMobile) {
                          setOpenMobile(false);
                        }
                      }}
                      className={({ isActive }) =>
                        isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4">
          <Button onClick={handleLogout} variant="outline" className="w-full h-12 text-base">
            <LogOut className="h-5 w-5" />
            {!collapsed && <span>Выход</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
