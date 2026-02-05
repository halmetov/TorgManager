import {
  Package,
  Store,
  Users,
  Truck,
  RotateCcw,
  FileText,
  LogOut,
  ArrowDownToLine,
  BarChart3,
  ClipboardList,
  Handshake,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
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

const systemItems = [
  { title: "Товары", url: "/admin/products", icon: Package },
  { title: "Магазины", url: "/admin/shops", icon: Store },
  { title: "Водители", url: "/admin/managers", icon: Users },
  { title: "Контрагенты", url: "/admin/counterparties", icon: Handshake },
  { title: "Возврат", url: "/admin/returns", icon: RotateCcw },
];

const reportItems = [
  { title: "Отчёт по контрагентам", url: "/admin/counterparty-reports", icon: FileSpreadsheet },
  { title: "Отчёт по магазинам", url: "/admin/shop-reports", icon: BarChart3 },
  { title: "Отчёт водителей", url: "/admin/driver-reports", icon: ClipboardList },
  { title: "Отчеты", url: "/admin/reports", icon: FileText },
];

const operationItems = [
  { title: "Продажа", url: "/admin/sales", icon: Receipt },
  { title: "Поступление", url: "/admin/incoming", icon: ArrowDownToLine },
  { title: "Отправка", url: "/admin/dispatch", icon: Truck },
];

export function AdminSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";

  const handleLogout = () => {
    api.logout();
    navigate("/login");
  };

  const renderMenuItems = (menuItems: typeof systemItems) => (
    <SidebarMenu>
      {menuItems.map((item) => (
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
  );

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-base">Операции</SidebarGroupLabel>
          <SidebarGroupContent>{renderMenuItems(operationItems)}</SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-base">Отчеты</SidebarGroupLabel>
          <SidebarGroupContent>{renderMenuItems(reportItems)}</SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-base">Система</SidebarGroupLabel>
          <SidebarGroupContent>{renderMenuItems(systemItems)}</SidebarGroupContent>
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
