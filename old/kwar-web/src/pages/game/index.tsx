import React, { useEffect } from 'react';
import {
    Card,
    CardBody,
    CardHeader,
    Button,
    Input,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    addToast,
    Switch,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import FixedHeaderTable from '../../components/fixed-header-table';
import {
    addGame,
    getGames,
    updateGameIsWithdraw,
    updateGameScale,
} from '../../api';
import { IGame } from '../../types';

const columns = [
    { key: 'app_id', label: '游戏ID', copyable: true },
    { key: 'game_name', label: '游戏名字', copyable: true },
    {
        key: 'actions',
        label: '游戏分成比例',
        render: (game: IGame) => <>{game}</>,
    },
    {
        key: 'actions_with',
        label: '是否提现',
        render: (game: IGame) => <>{game}</>,
    },
    { key: 'max_video', label: '广告数量' },
    { key: 'game_video_id', label: '游戏视频ID', copyable: true },
    { key: 'secret', label: '密钥', copyable: true },
];

const GamePage: React.FC = () => {
    const [games, setGames] = React.useState<IGame[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
    const [isRatioModalOpen, setIsRatioModalOpen] = React.useState(false);

    const [newGame, setNewGame] = React.useState({
        app_id: '',
        secret: '',
        game_name: '',
        game_video_id: '',
    });

    const [selectedGame, setSelectedGame] = React.useState<IGame | null>(null);
    const [newRatio, setNewRatio] = React.useState('');

    const handleCreateGame = async () => {
        if (
            !newGame.app_id ||
            !newGame.secret ||
            !newGame.game_name ||
            !newGame.game_video_id
        ) {
            addToast({
                title: '需要提交所有信息',
                color: 'danger',
                classNames: { base: 'auto-width-toast' },
            });
            return;
        }
        const game = await addGame(
            newGame.app_id,
            newGame.secret,
            newGame.game_video_id,
            newGame.game_name,
        );
        addToast({
            title: `${game.name}创建成功！`,
            color: 'success',
            classNames: { base: 'auto-width-toast' },
        });
        setIsCreateModalOpen(false);
        setGames(await getGames());
        newGame.app_id = '';
        newGame.secret = '';
        newGame.game_name = '';
        newGame.game_video_id = '';
    };

    const openRatioModal = (game: IGame) => {
        setSelectedGame(game);
        setIsRatioModalOpen(true);
    };

    const handleRatioChange = async () => {
        const ratio = parseInt(newRatio, 10);
        if (isNaN(ratio) || ratio < 0 || ratio > 100) {
            addToast({
                title: '请输入正确的比例',
                color: 'danger',
                classNames: { base: 'auto-width-toast' },
            });
            return;
        }
        if (!selectedGame) {
            addToast({
                title: '请选择一个游戏',
                color: 'danger',
                classNames: { base: 'auto-width-toast' },
            });
            return;
        }
        const result = await updateGameScale(selectedGame.app_id, ratio);
        if (result) {
            addToast({
                title: `${selectedGame.game_name}分成比例修改成功！`,
                color: 'success',
                classNames: { base: 'auto-width-toast' },
            });
        } else {
            addToast({
                title: `${selectedGame.game_name}分成比例修改失败！`,
                color: 'danger',
                classNames: { base: 'auto-width-toast' },
            });
        }
        setIsRatioModalOpen(false);
    };

    const fetchGames = async () => {
        setGames(await getGames());
    };

    useEffect(() => {
        const gamesEffect = async () => {
            fetchGames();
        };
        gamesEffect();
    }, [isRatioModalOpen]);

    const renderGameActions = (game: IGame) => (
        <div className="flex gap-2">
            <Button
                size="sm"
                color="primary"
                variant="flat"
                onPress={() => openRatioModal(game)}
            >
                {game.scale}%
            </Button>
        </div>
    );

    const renderGameActionsWith = (game: IGame) => (
        <div className="flex gap-2 items-center">
            <Switch
                size="sm"
                color="primary"
                isSelected={game.is_withdraw}
                onChange={(e) => toggleGameEnabled(game, e.target.checked)}
            ></Switch>
        </div>
    );

    const toggleGameEnabled = async (game: IGame, isWithdraw: boolean) => {
        const result = await updateGameIsWithdraw(game.app_id, isWithdraw);
        if (result) {
            addToast({
                title: `${game.game_name}提现状态修改成功！`,
                color: 'success',
                classNames: { base: 'auto-width-toast' },
            });
        } else {
            addToast({
                title: `${game.game_name}提现状态修改失败！`,
                color: 'danger',
                classNames: { base: 'auto-width-toast' },
            });
        }
        fetchGames();
    };

    const gameData = games.map((game) => ({
        ...game,
        actions: renderGameActions(game),
        actions_with: renderGameActionsWith(game),
    }));

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Games</h2>
                    <Button
                        color="primary"
                        onPress={() => setIsCreateModalOpen(true)}
                        startContent={<Icon icon="lucide:plus" />}
                    >
                        创建游戏
                    </Button>
                </CardHeader>
                <CardBody>
                    <FixedHeaderTable
                        columns={columns}
                        data={gameData}
                        emptyContent="No games found"
                    />
                </CardBody>
            </Card>

            {/* Create Game Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>创建一个新游戏</ModalHeader>
                            <ModalBody>
                                <div className="flex flex-col gap-4">
                                    <Input
                                        label="游戏名字"
                                        placeholder="输入游戏名字"
                                        value={newGame.game_name}
                                        onValueChange={(value) =>
                                            setNewGame({
                                                ...newGame,
                                                game_name: value,
                                            })
                                        }
                                    />
                                    <Input
                                        label="游戏ID"
                                        placeholder="输入游戏ID"
                                        value={newGame.app_id}
                                        onValueChange={(value) =>
                                            setNewGame({
                                                ...newGame,
                                                app_id: value,
                                            })
                                        }
                                    />
                                    <Input
                                        label="密钥"
                                        placeholder="输入密钥"
                                        value={newGame.secret}
                                        onValueChange={(value) =>
                                            setNewGame({
                                                ...newGame,
                                                secret: value,
                                            })
                                        }
                                    />
                                    <Input
                                        label="游戏视频广告ID"
                                        placeholder="输入游戏视频广告ID"
                                        value={newGame.game_video_id}
                                        onValueChange={(value) =>
                                            setNewGame({
                                                ...newGame,
                                                game_video_id: value,
                                            })
                                        }
                                    />
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    取消
                                </Button>
                                <Button
                                    color="danger"
                                    onPress={handleCreateGame}
                                >
                                    创建(注意不要输入错误信息)
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal isOpen={isRatioModalOpen} onOpenChange={setIsRatioModalOpen}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>修改游戏比例</ModalHeader>
                            <ModalBody>
                                <div className="flex flex-col gap-4">
                                    <p>游戏: {selectedGame?.game_name}</p>
                                    <p>当前分成比例: {selectedGame?.scale}%</p>
                                    <Input
                                        label="修改比例(%)"
                                        placeholder="输入(0-100)"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={newRatio}
                                        onValueChange={setNewRatio}
                                        endContent={
                                            <div className="pointer-events-none flex items-center">
                                                <span className="text-default-400">
                                                    %
                                                </span>
                                            </div>
                                        }
                                    />
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    取消
                                </Button>
                                <Button
                                    color="primary"
                                    onPress={handleRatioChange}
                                >
                                    确定
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default GamePage;
