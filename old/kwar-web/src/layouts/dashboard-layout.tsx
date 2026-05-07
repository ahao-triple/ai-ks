import React, { useEffect } from 'react';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import {
    Navbar,
    NavbarBrand,
    NavbarContent,
    Button,
    Switch,
    addToast,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTheme } from '@heroui/use-theme';
import { ping } from '../api';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const { theme, setTheme } = useTheme();
    const [navItems, setNavItems] = React.useState([
        {
            path: '/dashboard/ecpm',
            label: '实时数据',
            icon: 'lucide:bar-chart-2',
        },
        {
            path: '/dashboard/user-binding',
            label: '用户绑定',
            icon: 'lucide:user',
        },
    ]);
    const isDark = theme === 'dark';

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const closeSidebar = () => {
        setIsSidebarOpen(false);
    };

    const handleThemeChange = () => {
        setTheme(isDark ? 'light' : 'dark');
    };

    useEffect(() => {
        const usePing = async () => {
            await ping();
        };
        usePing();
        const loginInfo: any = JSON.parse(
            localStorage.getItem('login') || '{}',
        );
        if (loginInfo.identity === 'brush') {
            setNavItems([
                {
                    path: '/dashboard/ecpm',
                    label: '实时数据',
                    icon: 'lucide:bar-chart-2',
                },
                {
                    path: '/dashboard/user-binding',
                    label: '用户绑定',
                    icon: 'lucide:user',
                },
            ]);
        } else if (loginInfo.identity === 'admin') {
            setNavItems([
                {
                    path: '/dashboard/ecpm',
                    label: '实时数据',
                    icon: 'lucide:bar-chart-2',
                },
                {
                    path: '/dashboard/user-binding',
                    label: '用户绑定',
                    icon: 'lucide:user',
                },
                {
                    path: '/dashboard/acting-ecpm',
                    label: '代理数据',
                    icon: 'lucide:bar-chart-2',
                },
            ]);
        } else if (
            loginInfo.identity === 'super' ||
            loginInfo.identity === 'ahaotriple'
        ) {
            setNavItems([
                {
                    path: '/dashboard/ecpm',
                    label: '实时数据',
                    icon: 'lucide:bar-chart-2',
                },
                {
                    path: '/dashboard/game',
                    label: '游戏管理',
                    icon: 'lucide:gamepad',
                },
                {
                    path: '/dashboard/user',
                    label: '用户管理',
                    icon: 'lucide:user-check',
                },
                {
                    path: '/dashboard/acting',
                    label: '代理管理',
                    icon: 'lucide:shield',
                },
                {
                    path: '/dashboard/user-binding',
                    label: '用户绑定',
                    icon: 'lucide:link',
                },
                {
                    path: '/dashboard/acting-ecpm',
                    label: '代理数据',
                    icon: 'lucide:bar-chart-2',
                },
            ]);
        } else if (loginInfo.identity === 'acting') {
            setNavItems([
                {
                    path: '/dashboard/ecpm',
                    label: '实时数据',
                    icon: 'lucide:bar-chart-2',
                },
                {
                    path: '/dashboard/user-binding',
                    label: '用户绑定',
                    icon: 'lucide:link',
                },
                {
                    path: '/dashboard/acting-ecpm',
                    label: '代理数据',
                    icon: 'lucide:bar-chart-2',
                },
            ]);
        }
    }, []);

    const loginOut = () => {
        localStorage.removeItem('login');
        localStorage.removeItem('username');
        addToast({
            title: '退出登录成功',
            color: 'warning',
            classNames: { base: 'auto-width-toast' },
        });
    };

    return (
        <div className="flex h-screen bg-background">
            {/* Mobile overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <div
                className={`sidebar bg-content1 shadow-lg ${
                    isSidebarOpen ? 'open' : ''
                } md:relative md:translate-x-0 md:block`}
            >
                <div className="flex flex-col h-full">
                    <div className="p-4 border-b border-divider">
                        <h1 className="text-xl font-bold">控制台</h1>
                    </div>

                    <nav className="flex-1 p-2">
                        {navItems.map((item) => (
                            <RouterLink
                                key={item.path}
                                to={item.path}
                                className={`sidebar-link ${
                                    location.pathname === item.path
                                        ? 'active'
                                        : ''
                                }`}
                                onClick={closeSidebar}
                            >
                                <Icon icon={item.icon} width={20} />
                                <span>{item.label}</span>
                            </RouterLink>
                        ))}
                    </nav>

                    <div className="p-4 border-t border-divider">
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Theme</span>
                            <div className="flex items-center gap-2">
                                <Icon
                                    icon="lucide:sun"
                                    className={`text-default-500 ${
                                        !isDark && 'text-primary-500'
                                    }`}
                                />
                                <Switch
                                    isSelected={isDark}
                                    onValueChange={handleThemeChange}
                                    size="sm"
                                />
                                <Icon
                                    icon="lucide:moon"
                                    className={`text-default-500 ${isDark && 'text-primary-500'}`}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <Navbar maxWidth="full" className="border-b border-divider">
                    <NavbarContent>
                        <Button
                            isIconOnly
                            variant="light"
                            className="md:hidden"
                            onPress={toggleSidebar}
                        >
                            <Icon icon="lucide:menu" width={24} />
                        </Button>
                        <NavbarBrand>
                            <h3 className="text-xl font-bold">控制台</h3>
                        </NavbarBrand>
                    </NavbarContent>
                    <NavbarContent justify="end">
                        <Button
                            variant="light"
                            color="danger"
                            as={RouterLink}
                            to="/login"
                            startContent={<Icon icon="lucide:log-out" />}
                            onPress={loginOut}
                        >
                            退出登录
                        </Button>
                    </NavbarContent>
                </Navbar>

                <div className="flex-1 overflow-y-auto p-4">{children}</div>
            </div>
        </div>
    );
};

export default DashboardLayout;
