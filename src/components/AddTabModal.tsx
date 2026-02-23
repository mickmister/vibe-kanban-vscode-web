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
import { AddVKWorkspaceModal } from './dialogs/AddVKWorkspaceModal';

interface AddTabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (title: string, url: string) => void;
  onAddVKWorkspace?: (taskAttemptId: string, name: string, containerRef: string) => void;
}

const ORIGIN = 'https://jamtools.dev';

const PRESETS = [
  {
    key: 'vk-workspace',
    title: 'VK Workspace',
    url: '',
    description: 'Add workspace with Kanban + Code split view',
  },
  {
    key: 'code',
    title: 'Code Server',
    url: `${ORIGIN}/?folder=/home/vkuser/repos`,
    description: 'VS Code editor',
  },
  {
    key: 'kanban',
    title: 'Vibe Kanban',
    url: `${ORIGIN}/`,
    description: 'Kanban board (default route)',
  },
  {
    key: 'kanban-chat',
    title: 'Kanban Chat',
    url: `${ORIGIN}/workspaces/`,
    description: 'Vibe Kanban workspace chat',
  },
  {
    key: 'custom',
    title: 'Custom URL',
    url: '',
    description: 'Enter a custom URL',
  },
];

export function AddTabModal({ isOpen, onClose, onAdd, onAddVKWorkspace }: AddTabModalProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [showVKWorkspace, setShowVKWorkspace] = useState(false);

  const handlePresetSelect = (key: string) => {
    const preset = PRESETS.find((p) => p.key === key);
    if (!preset) return;

    if (key === 'custom') {
      setShowCustom(true);
      return;
    }

    if (key === 'vk-workspace') {
      setShowVKWorkspace(true);
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

  const handleVKWorkspaceAdd = (
    taskAttemptId: string,
    name: string,
    containerRef: string
  ) => {
    if (onAddVKWorkspace) {
      onAddVKWorkspace(taskAttemptId, name, containerRef);
    }
    handleClose();
  };

  const handleClose = () => {
    setTitle('');
    setUrl('');
    setShowCustom(false);
    setShowVKWorkspace(false);
    onClose();
  };

  return (
    <>
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

      <AddVKWorkspaceModal
        isOpen={showVKWorkspace}
        onClose={() => setShowVKWorkspace(false)}
        onAdd={handleVKWorkspaceAdd}
      />
    </>
  );
}
