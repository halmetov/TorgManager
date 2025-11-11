import { Package, Store, Users, Truck, LogOut, ArrowDownToLine } from "lucide-react";
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
  { title: "Товары", url: "/admin/products", icon: Package },
  { title: "Магазины", url: "/admin/shops", icon: Store },
  { title: "Менеджеры", url: "/admin/managers", icon: Users },
  { title: "Поступление", url: "/admin/incoming", icon: ArrowDownToLine },
  { title: "Отправка", url: "/admin/dispatch", icon: Truck },
];

export function AdminSidebar() {
  const { state } = useSidebar();
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
          <SidebarGroupLabel className="text-base">Админ Панель</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="lg">
                    <NavLink
                      to={item.url}
                      end
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
