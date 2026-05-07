import React, { useEffect } from 'react';
import { Link as RouterLink, useHistory, useLocation } from 'react-router-dom';
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
import { register } from '../../api';

const RegisterPage: React.FC = () => {
    const [phone, setPhone] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
    const [acting_id_local, setActing_id_local] = React.useState('');
    const history = useHistory();
    const { theme, setTheme } = useTheme();
    const isDark = theme === 'dark';

    function useQuery() {
        return new URLSearchParams(useLocation().search);
    }

    const togglePasswordVisibility = () =>
        setIsPasswordVisible(!isPasswordVisible);

    const toggleTheme = () => {
        setTheme(isDark ? 'light' : 'dark');
    };
    const query = useQuery();
    const acting_id = query.get('acting_id');

    useEffect(() => {
        if (acting_id) {
            localStorage.setItem('agent_id', acting_id); // 暂存代理ID
            setActing_id_local(acting_id); // 暂存代理ID
        }

        localStorage.removeItem('login');
        localStorage.removeItem('username');
    }, [acting_id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!/^\d{11}$/.test(phone)) {
            addToast({
                title: '请输入手机号码',
                color: 'danger',
                classNames: { base: 'auto-width-toast' },
            });
            return;
        }

        // Validate password match
        if (password !== confirmPassword) {
            addToast({
                title: '两次密码不一致',
                color: 'danger',
                classNames: { base: 'auto-width-toast' },
            });
            return;
        }

        const isRegister = await register(phone, password, acting_id_local);
        if (isRegister) {
            addToast({
                title: '注册成功',
                color: 'success',
                classNames: { base: 'auto-width-toast' },
            });
            history.push('/login');
        } else {
            addToast({
                title: '注册失败',
                color: 'danger',
                classNames: { base: 'auto-width-toast' },
            });
        }
        history.push('/login');
    };

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
                        icon="lucide:user-plus"
                        width={40}
                        className="text-primary"
                    />
                    <h1 className="text-2xl font-bold">注册</h1>
                    <p className="text-default-500">输入手机号码</p>
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
                            type="tel"
                            pattern="[0-9]{11}"
                            maxLength={11}
                            isRequired
                        />

                        <Input
                            label="密码"
                            placeholder="输入密码"
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

                        <Input
                            label="再次输入密码"
                            placeholder="确认密码相同"
                            value={confirmPassword}
                            onValueChange={setConfirmPassword}
                            startContent={
                                <Icon
                                    icon="lucide:lock"
                                    className="text-default-400"
                                />
                            }
                            type={isPasswordVisible ? 'text' : 'password'}
                            isRequired
                        />

                        <Input
                            isReadOnly
                            value={acting_id_local}
                            label="邀请码"
                            type="text"
                            variant="bordered"
                        />

                        <Button
                            type="submit"
                            color="primary"
                            className="mt-2"
                            fullWidth
                        >
                            注册
                        </Button>
                    </form>
                </CardBody>

                <CardFooter className="flex justify-center">
                    <p className="text-default-500">
                        <Link as={RouterLink} to="/login" color="primary">
                            登录
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
};

export default RegisterPage;
