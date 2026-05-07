import React from 'react';
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter, 
  Button,
  Textarea,
} from '@heroui/react';

interface RejectionReasonModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
}

export const RejectionReasonModal: React.FC<RejectionReasonModalProps> = ({
  isOpen,
  onOpenChange,
  onConfirm,
  isLoading
}) => {
  const [reason, setReason] = React.useState<string>('');
  const [error, setError] = React.useState<string>('');

  // 重置状态当模态框关闭时
  React.useEffect(() => {
    if (!isOpen) {
      setReason('');
      setError('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError('请填写拒绝原因');
      return;
    }
    
    onConfirm(reason.trim());
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onOpenChange={onOpenChange}
      placement="center"
      isDismissable={!isLoading} // 加载时不允许关闭
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              填写拒绝原因
            </ModalHeader>
            <ModalBody>
              <div className="space-y-2">
                <p className="text-sm text-default-600">请填写拒绝该提现申请的原因，该原因将被记录并可能通知用户。</p>
                <Textarea
                  label="拒绝原因"
                  placeholder="请输入拒绝原因"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (e.target.value.trim()) {
                      setError('');
                    }
                  }}
                  isInvalid={!!error}
                  errorMessage={error}
                  isDisabled={isLoading}
                  autoFocus
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button 
                color="default" 
                variant="flat" 
                onPress={onClose}
                isDisabled={isLoading}
              >
                取消
              </Button>
              <Button 
                color="danger" 
                onPress={handleConfirm}
                isLoading={isLoading}
              >
                确认拒绝
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};