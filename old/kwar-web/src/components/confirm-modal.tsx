import React from 'react';
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
} from '@heroui/react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    content: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: 'primary' | 'danger' | 'success' | 'warning';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    content,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmColor = 'primary',
}) => {
    return (
        <Modal isOpen={isOpen} onOpenChange={onClose}>
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader>{title}</ModalHeader>
                        <ModalBody>{content}</ModalBody>
                        <ModalFooter>
                            <Button variant="light" onPress={onClose}>
                                {cancelText}
                            </Button>
                            <Button
                                color={confirmColor}
                                onPress={() => {
                                    onConfirm();
                                    onClose();
                                }}
                            >
                                {confirmText}
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
};

export default ConfirmModal;
