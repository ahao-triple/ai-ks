import React, { useEffect } from 'react';
import { Link as RouterLink, useHistory } from 'react-router-dom';
import {
    Card,
    CardBody,
    CardHeader,
    CardFooter,
    Input,
    Button,
    Link,
    Switch,
    addToast,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTheme } from '@heroui/use-theme';
import { login } from '../../api';

const LoginPage: React.FC = () => {
    const [phone, setPhone] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
    const history = useHistory();
    const { theme, setTheme } = useTheme();
    const isDark = theme === 'dark';

    const togglePasswordVisibility = () =>
        setIsPasswordVisible(!isPasswordVisible);

    const toggleTheme = () => {
        setTheme(isDark ? 'light' : 'dark');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!/^\d{11}$/.test(phone) && phone !== 'admin') {
            addToast({
                title: '请输入您的手机号码！',
                color: 'danger',
                classNames: { base: 'auto-width-toast' },
            });
            return;
        }
        const isLogin = await login(phone, password);
        if (isLogin.data.access_token) {
            addToast({
                title: '登录成功',
                color: 'success',
                classNames: { base: 'auto-width-toast' },
            });
            localStorage.setItem('username', phone);
            localStorage.setItem('login', JSON.stringify(isLogin.data));
            history.push('/dashboard');
        } else {
            addToast({
                title: '账号或密码错误',
                color: 'danger',
                classNames: { base: 'auto-width-toast' },
            });
        }
    };

    useEffect(() => {
        const username: string = localStorage.getItem('username') || '';
        if (username.length > 3) {
            history.push('/dashboard');
        }
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="absolute top-4 right-4 flex items-center gap-2">
                <Icon
                    icon="lucide:sun"
                    className={`text-default-500 ${!isDark && 'text-primary-500'}`}
                />
                <Switch
                    isSelected={isDark}
                    onValueChange={toggleTheme}
                    size="sm"
                />
                <Icon
                    icon="lucide:moon"
                    className={`text-default-500 ${isDark && 'text-primary-500'}`}
                />
            </div>

            <Card className="w-full max-w-md">
                <CardHeader className="flex flex-col gap-1 items-center">
                    <Icon
                        icon="lucide:layout-dashboard"
                        width={40}
                        className="text-primary"
                    />
                    <h1 className="text-2xl font-bold">登录</h1>
                    <p className="text-default-500">输入手机号码登录</p>
                </CardHeader>

                <CardBody>
                    <form
                        onSubmit={handleSubmit}
                        className="flex flex-col gap-4"
                    >
                        <Input
                            label="手机号码"
                            placeholder="输入你的手机号码"
                            value={phone}
                            onValueChange={setPhone}
                            startContent={
                                <Icon
                                    icon="lucide:phone"
                                    className="text-default-400"
                                />
                            }
                            // type="tel"
                            // pattern="[0-9]{11}"
                            maxLength={11}
                            isRequired
                        />

                        <Input
                            label="密码"
                            placeholder="输入你的密码"
                            value={password}
                            onValueChange={setPassword}
                            startContent={
                                <Icon
                                    icon="lucide:lock"
                                    className="text-default-400"
                                />
                            }
                            endContent={
                                <button
                                    type="button"
                                    onClick={togglePasswordVisibility}
                                    className="focus:outline-none"
                                >
                                    <Icon
                                        icon={
                                            isPasswordVisible
                                                ? 'lucide:eye-off'
                                                : 'lucide:eye'
                                        }
                                        className="text-default-400 hover:text-default-600"
                                    />
                                </button>
                            }
                            type={isPasswordVisible ? 'text' : 'password'}
                            isRequired
                        />

                        <Button
                            type="submit"
                            color="primary"
                            className="mt-2"
                            fullWidth
                        >
                            登录
                        </Button>
                    </form>
                </CardBody>

                <CardFooter className="flex justify-center">
                    <p className="text-default-500">
                        <Link as={RouterLink} to="/register" color="primary">
                            注册
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
};

export default LoginPage;
