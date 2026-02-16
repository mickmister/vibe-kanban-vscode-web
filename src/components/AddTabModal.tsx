import React, { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Listbox,
  ListboxItem,
} from '@heroui/react';

interface AddTabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (title: string, url: string) => void;
}

const PRESETS = [
  {
    key: 'code',
    title: 'Code Server',
    url: '/?folder=/home/vkuser/repos',
    description: 'VS Code editor',
  },
  {
    key: 'kanban',
    title: 'Vibe Kanban',
    url: '/',
    description: 'Kanban board (default route)',
  },
  {
    key: 'kanban-chat',
    title: 'Kanban Chat',
    url: '/workspaces/',
    description: 'Vibe Kanban workspace chat',
  },
  {
    key: 'custom',
    title: 'Custom URL',
    url: '',
    description: 'Enter a custom URL',
  },
];

export function AddTabModal({ isOpen, onClose, onAdd }: AddTabModalProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handlePresetSelect = (key: string) => {
    const preset = PRESETS.find((p) => p.key === key);
    if (!preset) return;

    if (key === 'custom') {
      setShowCustom(true);
      return;
    }

    onAdd(preset.title, preset.url);
    handleClose();
  };

  const handleCustomSubmit = () => {
    if (title.trim() && url.trim()) {
      onAdd(title.trim(), url.trim());
      handleClose();
    }
  };

  const handleClose = () => {
    setTitle('');
    setUrl('');
    setShowCustom(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="sm" backdrop="blur">
      <ModalContent className="bg-neutral-900 border border-neutral-800">
        <ModalHeader className="text-sm">Add Tab</ModalHeader>
        <ModalBody>
          {!showCustom ? (
            <Listbox
              aria-label="Tab presets"
              onAction={(key) => handlePresetSelect(key as string)}
            >
              {PRESETS.map((preset) => (
                <ListboxItem
                  key={preset.key}
                  description={preset.description}
                  className="text-neutral-200"
                >
                  {preset.title}
                </ListboxItem>
              ))}
            </Listbox>
          ) : (
            <div className="space-y-3">
              <Input
                label="Title"
                size="sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Tab"
                autoFocus
                classNames={{
                  inputWrapper: 'bg-neutral-800',
                }}
              />
              <Input
                label="URL"
                size="sm"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/path or full URL"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCustomSubmit();
                }}
                classNames={{
                  inputWrapper: 'bg-neutral-800',
                }}
              />
            </div>
          )}
        </ModalBody>
        {showCustom && (
          <ModalFooter>
            <Button
              size="sm"
              variant="flat"
              onPress={() => setShowCustom(false)}
            >
              Back
            </Button>
            <Button size="sm" color="primary" onPress={handleCustomSubmit}>
              Add
            </Button>
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
}
