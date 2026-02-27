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
  onAddTabGroup?: (label: string) => void;
}

const ORIGIN = location.origin;

const PRESETS = [
  {
    key: 'vk-workspace',
    title: 'Open Existing Workspace',
    url: '',
    description: 'Add workspace with Agent + Code split view',
  },
  {
    key: 'code',
    title: 'Code Server',
    url: '', // Will be provided by user via custom input
    description: 'VS Code editor with custom folder path',
  },
  {
    key: 'kanban',
    title: 'Kanban',
    url: `${ORIGIN}/`,
    description: 'Vibe Kanban board view',
  },
  {
    key: 'custom',
    title: 'Custom URL',
    url: '',
    description: 'Enter a custom URL',
  },
];

export function AddTabModal({ isOpen, onClose, onAdd, onAddVKWorkspace, onAddTabGroup }: AddTabModalProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [showVKWorkspace, setShowVKWorkspace] = useState(false);
  const [showTabGroupInput, setShowTabGroupInput] = useState(false);
  const [tabGroupLabel, setTabGroupLabel] = useState('');

  const handlePresetSelect = (key: string) => {
    const preset = PRESETS.find((p) => p.key === key);
    if (!preset) return;

    if (key === 'custom' || key === 'code') {
      setShowCustom(true);
      if (key === 'code') {
        setTitle('Code Server');
        setUrl(`${ORIGIN}/?folder=`);
      }
      return;
    }

    if (key === 'vk-workspace') {
      setShowVKWorkspace(true);
      return;
    }

    if (key === 'tab-group') {
      setShowTabGroupInput(true);
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

  const handleTabGroupSubmit = () => {
    const label = tabGroupLabel.trim();
    if (label && onAddTabGroup) {
      onAddTabGroup(label);
      handleClose();
    }
  };

  const handleClose = () => {
    setTitle('');
    setUrl('');
    setTabGroupLabel('');
    setShowCustom(false);
    setShowVKWorkspace(false);
    setShowTabGroupInput(false);
    onClose();
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} size="sm" backdrop="blur">
        <ModalContent className="bg-neutral-900 border border-neutral-800">
          <ModalHeader className="text-sm">
            {showTabGroupInput ? 'New Tab Group' : 'Add Tab'}
          </ModalHeader>
          <ModalBody>
            {!showCustom && !showTabGroupInput ? (
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
            ) : showTabGroupInput ? (
              <div className="space-y-3">
                <Input
                  label="Tab Group Name"
                  size="sm"
                  value={tabGroupLabel}
                  onChange={(e) => setTabGroupLabel(e.target.value)}
                  placeholder="Development"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTabGroupSubmit();
                  }}
                  classNames={{
                    inputWrapper: 'bg-neutral-800',
                  }}
                />
              </div>
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
          {showTabGroupInput && (
            <ModalFooter>
              <Button
                size="sm"
                variant="flat"
                onPress={() => setShowTabGroupInput(false)}
              >
                Back
              </Button>
              <Button size="sm" color="primary" onPress={handleTabGroupSubmit}>
                Create
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
